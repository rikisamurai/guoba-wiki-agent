import { Agent, type AgentTool, type AgentTurnContext } from '@earendil-works/pi-agent-core'
import type { RunEndReason } from '@guoba-wiki-agent/trajectory'
import { type ApplyResult, type Change, applyProposal, skillDomains } from '@guoba-wiki-agent/vault'

import { writeRunArtifacts } from './artifacts.ts'
import { Budget, type LimitHit } from './budget.ts'
import { FinishGate, type Validation, type Verdict, verdictText } from './finish.ts'
import { taskMessage } from './prompt.ts'
import { knownUsage } from './recorder.ts'
import { type PreparedRun, type StartRunOptions, prepareRun, recordRequestHeader } from './setup.ts'
import { finishTool, requireFinishAlone } from './tools/finish-tool.ts'
import { skillTools } from './tools/skill-tools.ts'
import { vaultTools } from './tools/vault-tools.ts'
import { validateStaging } from './validate.ts'

export type TurnStatus = 'ready' | 'invariant_failed' | 'limit' | 'cancelled' | 'provider_error'

export interface TurnResult {
  status: TurnStatus
  changes: Change[]
  validation?: Validation
  limit?: LimitHit
  error?: string
}

type Outcome = { status: TurnStatus; limit?: LimitHit; error?: string }

/** 开始一次 Run：校验输入、写入 run/start 与 request/header，返回尚未执行的 Run。 */
export function startRun(options: StartRunOptions): Run {
  return new Run(prepareRun(options))
}

/**
 * 一次 Run 的生命周期（ADR 0003、0007、0012、0013）：
 * execute() → 状态 ready 后由用户选择 apply() / discard() / revise(feedback)。
 */
export class Run {
  readonly id: string
  readonly dir: string
  readonly #p: PreparedRun
  readonly #agent: Agent
  readonly #gate: FinishGate
  readonly #budget: Budget
  #state: 'idle' | 'running' | 'ready' | 'ended' = 'idle'
  #turn = -1
  #outcome: Outcome | undefined
  #validation: Validation | undefined

  constructor(prepared: PreparedRun) {
    this.#p = prepared
    this.id = prepared.runId
    this.dir = prepared.runDir
    const domains = skillDomains(prepared.skills.task.body)
    this.#gate = new FinishGate(() => validateStaging(prepared.staging, prepared.task, domains))
    this.#budget = new Budget(prepared.task.limits)
    const { recorder, staging, skills } = prepared
    const tools: AgentTool<any>[] = [
      ...vaultTools(staging, (callId, result) =>
        recorder.emit('staging/write', { ...recorder.step, callId, ...result }),
      ),
      ...skillTools([skills.task, ...skills.catalog]),
      finishTool(() => this.#settle(this.#gate.check()), this.#gate.maxFailures),
    ]
    recordRequestHeader(prepared, tools)
    const { config, model, streamFn } = prepared.options
    this.#agent = new Agent({
      initialState: {
        systemPrompt: prepared.systemPrompt,
        model,
        thinkingLevel: config.thinkingLevel,
        tools,
      },
      streamFn,
      sessionId: prepared.runId,
      toolExecution: 'sequential',
      beforeToolCall: requireFinishAlone,
      finishTurn: async (turn) => this.#finishTurn(turn),
    })
    this.#agent.subscribe((event) => recorder.onAgentEvent(event))
  }

  get state(): 'idle' | 'running' | 'ready' | 'ended' {
    return this.#state
  }

  /** 当前 Staging 的全部变更。 */
  changes(): Change[] {
    return this.#p.staging.changes()
  }

  async execute(): Promise<TurnResult> {
    this.#expect('idle', 'execute')
    return this.#runTurn(taskMessage(this.#p.task.name, this.#p.options.source), 'task')
  }

  /** 在同一个 Staging 与对话上继续修改（ADR 0013）。 */
  async revise(feedback: string): Promise<TurnResult> {
    this.#expect('ready', 'revise')
    this.#p.recorder.emit('review/decision', { turn: this.#turn, choice: 'r', feedback })
    return this.#runTurn(feedback, 'revise')
  }

  apply(): ApplyResult {
    this.#expect('ready', 'apply')
    this.#p.recorder.emit('review/decision', { turn: this.#turn, choice: 'y' })
    const { config } = this.#p.options
    const result = applyProposal(config.vault, this.changes(), this.#p.task.writeScope)
    this.#p.recorder.applyResult(result)
    this.#end(result.status === 'applied' ? 'applied' : 'apply_rejected')
    return result
  }

  discard(): void {
    this.#expect('ready', 'discard')
    this.#p.recorder.emit('review/decision', { turn: this.#turn, choice: 'n' })
    this.#end('discarded')
  }

  /** 中止正在执行的 Turn，或放弃等待确认的 Proposal（不记 review/decision）。Vault 不受影响。 */
  cancel(): void {
    if (this.#state === 'ready') {
      this.#end('cancelled')
      return
    }
    if (this.#state !== 'running') return
    this.#outcome ??= { status: 'cancelled' }
    this.#agent.abort()
  }

  async #runTurn(message: string, source: 'task' | 'revise'): Promise<TurnResult> {
    const { recorder } = this.#p
    this.#state = 'running'
    this.#turn += 1
    this.#outcome = undefined
    this.#gate.newTurn()
    recorder.startTurn(this.#turn)
    recorder.emit('user/message', { turn: this.#turn, source, text: message })

    await this.#budget.timed(
      () => this.#agent.prompt(message),
      (hit) => {
        this.#hitLimit(hit)
        this.#agent.abort()
      },
    )

    const outcome: Outcome = this.#outcome ?? {
      status: 'provider_error',
      error: this.#agent.state.errorMessage ?? '运行在没有通过 finish 校验的情况下结束了',
    }
    const changes = this.changes()
    recorder.proposal(changes)
    recorder.emit('turn/end', {
      turn: this.#turn,
      reason: outcome.status === 'ready' ? 'finished' : outcome.status,
    })
    if (outcome.status === 'ready') this.#state = 'ready'
    else this.#end(outcome.status)
    return { ...outcome, changes, ...(this.#validation && { validation: this.#validation }) }
  }

  /** Step 结束时：计入上限；模型没调用工具就停止时，补一次 Finish 校验（ADR 0007）。 */
  async #finishTurn({ message }: AgentTurnContext) {
    const hit = this.#budget.addStep(knownUsage(message, this.#p.options.model)?.costUsd ?? 0)
    if (hit && !this.#outcome) this.#hitLimit(hit)
    if (message.stopReason === 'error' || message.stopReason === 'aborted') return undefined
    if (this.#outcome) return { action: 'end' as const }
    if (message.content.some((block) => block.type === 'toolCall')) return undefined

    const verdict = this.#settle(this.#gate.check())
    if (verdict.kind === 'pass' || verdict.kind === 'failed') return { action: 'end' as const }
    const feedback = verdictText(verdict, this.#gate.maxFailures)
    this.#p.recorder.emit('user/message', {
      turn: this.#turn,
      source: 'validation',
      text: feedback,
    })
    this.#agent.followUp({ role: 'user', content: feedback, timestamp: this.#p.now() })
    return undefined
  }

  #settle(verdict: Verdict): Verdict {
    this.#validation = verdict.validation
    this.#p.recorder.emit('validation/result', {
      ...this.#p.recorder.step,
      attempt: verdict.attempt,
      ...verdict.validation,
      verdict: verdict.kind,
    })
    if (verdict.kind === 'pass') this.#outcome ??= { status: 'ready' }
    if (verdict.kind === 'failed') this.#outcome ??= { status: 'invariant_failed' }
    return verdict
  }

  #hitLimit(hit: LimitHit): void {
    if (this.#outcome) return
    this.#outcome = { status: 'limit', limit: hit }
    this.#p.recorder.emit('limit/hit', hit)
  }

  #end(reason: RunEndReason): void {
    this.#p.recorder.emit('run/end', { reason })
    this.#p.close()
    this.#state = 'ended'
    writeRunArtifacts(this.dir)
  }

  #expect(state: Run['state'], action: string): void {
    if (this.#state !== state) throw new Error(`Run 处于 ${this.#state} 状态，不能 ${action}`)
  }
}
