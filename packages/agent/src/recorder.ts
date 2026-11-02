import type { AgentEvent } from '@earendil-works/pi-agent-core'
import { type AssistantMessage, type Model, calculateCost } from '@earendil-works/pi-ai'
import type {
  AnyTrajectoryEvent,
  AssistantBlock,
  StreamRecord,
  TokenUsage,
  TrajectoryEventMap,
  TrajectoryEventType,
} from '@guoba-wiki-agent/trajectory'
import type { TrajectoryWriter } from '@guoba-wiki-agent/trajectory/node'
import { type ApplyResult, type Change, renderDiff } from '@guoba-wiki-agent/vault'

/**
 * 把 Pi 的事件翻译为 Trajectory Event（ADR 0014）。
 * Pi 的 `turn` 是一次模型请求加它的工具执行，本仓库称为 Step（GLOSSARY）。
 */
export class Recorder {
  readonly #writer: TrajectoryWriter
  readonly #now: () => number
  readonly #model: Model<any>
  readonly #onEvent: ((event: AnyTrajectoryEvent) => void) | undefined
  #turn = -1
  #step = -1
  #stream: StreamRecord[] = []

  constructor(
    writer: TrajectoryWriter,
    now: () => number,
    model: Model<any>,
    onEvent?: (event: AnyTrajectoryEvent) => void,
  ) {
    this.#writer = writer
    this.#now = now
    this.#model = model
    this.#onEvent = onEvent
  }

  /** 写入 Trajectory，写入后再通知观察者（例如终端进度）。 */
  emit<K extends TrajectoryEventType>(type: K, data: TrajectoryEventMap[K]): void {
    const event = this.#writer.append(type, data)
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- type 与 data 由同一个 K 约束，正是联合类型中的一支；TS 无法把泛型收窄到联合
    this.#onEvent?.(event as AnyTrajectoryEvent)
  }

  get turn(): number {
    return this.#turn
  }

  get step(): { turn: number; step: number } {
    return { turn: this.#turn, step: this.#step }
  }

  startTurn(turn: number): void {
    this.#turn = turn
    this.#step = -1
    this.emit('turn/start', { turn })
  }

  /** Turn 结束时记录 Staging 的全部变更，供查看器与 proposal.diff 使用。 */
  proposal(changes: readonly Change[]): void {
    this.emit('proposal/diff', {
      turn: this.#turn,
      files: changes.map((change) => ({
        path: change.path,
        created: change.base === null,
        diff: renderDiff(change),
      })),
    })
  }

  applyResult(result: ApplyResult): void {
    this.emit('apply/result', {
      written: 'written' in result ? result.written : [],
      conflicts: result.status === 'conflict' ? result.conflicts : [],
      failed: 'failed' in result ? result.failed : [],
      invariants: result.status === 'invalid' ? result.invariants : [],
    })
  }

  onAgentEvent(event: AgentEvent): void {
    switch (event.type) {
      case 'turn_start':
        this.#step += 1
        this.#stream = []
        this.emit('step/start', this.step)
        break
      case 'message_update': {
        const delta = streamDelta(event.assistantMessageEvent)
        if (delta) this.#stream.push({ at: this.#now(), ...delta })
        break
      }
      case 'message_end':
        if (event.message.role === 'assistant') this.#assistant(event.message)
        break
      case 'tool_execution_start':
        this.emit('tool/call', {
          ...this.step,
          callId: event.toolCallId,
          name: event.toolName,
          arguments: JSON.stringify(event.args ?? {}),
        })
        break
      case 'tool_execution_end':
        this.emit('tool/result', {
          ...this.step,
          callId: event.toolCallId,
          name: event.toolName,
          isError: event.isError,
          content: resultText(event.result),
          ...(event.durationMs !== undefined && { durationMs: event.durationMs }),
        })
        break
      case 'turn_end':
        this.emit('step/end', this.step)
        break
      default:
        break
    }
  }

  #assistant(message: AssistantMessage): void {
    const stream = this.#stream
    this.#stream = []
    if (message.stopReason === 'error' || message.stopReason === 'aborted') {
      this.emit('assistant/attempt', {
        ...this.step,
        stream,
        error: message.errorMessage ?? message.stopReason,
      })
      return
    }
    const usage = knownUsage(message, this.#model)
    this.emit('assistant/message', {
      ...this.step,
      blocks: message.content.map(toBlock),
      stream,
      stopReason: message.stopReason,
      ...(usage && { usage: usage.tokens, costUsd: usage.costUsd }),
    })
  }
}

function streamDelta(event: {
  type: string
  delta?: string
}): Omit<StreamRecord, 'at'> | undefined {
  if (event.delta === undefined) return undefined
  if (event.type === 'text_delta') return { kind: 'text', delta: event.delta }
  if (event.type === 'thinking_delta') return { kind: 'thinking', delta: event.delta }
  if (event.type === 'toolcall_delta') return { kind: 'toolcall', delta: event.delta }
  return undefined
}

function toBlock(block: AssistantMessage['content'][number]): AssistantBlock {
  if (block.type === 'text') return { type: 'text', text: block.text }
  if (block.type === 'thinking') return { type: 'thinking', thinking: block.thinking }
  return {
    type: 'toolCall',
    id: block.id,
    name: block.name,
    arguments: JSON.stringify(block.arguments),
  }
}

/**
 * 费用 = Usage 中的 token 数 × 模型价格（ADR 0012，价格已在 run/start 中快照）。
 * provider 没有返回 Usage 时 Pi 填的是全 0；真实回复不可能 0 token，所以全 0 视为“费用未知”。
 */
export function knownUsage(
  message: AssistantMessage,
  model: Model<any>,
): { tokens: TokenUsage; costUsd: number } | undefined {
  const { usage } = message
  if (usage.input === 0 && usage.output === 0) return undefined
  return {
    tokens: {
      input: usage.input,
      output: usage.output,
      cacheRead: usage.cacheRead,
      cacheWrite: usage.cacheWrite,
    },
    costUsd: calculateCost(model, usage).total,
  }
}

function resultText(result: unknown): string {
  if (typeof result !== 'object' || result === null || !('content' in result)) return ''
  const { content } = result
  if (!Array.isArray(content)) return ''
  return content
    .map((part: unknown) =>
      typeof part === 'object' && part !== null && 'text' in part && typeof part.text === 'string'
        ? part.text
        : '',
    )
    .filter(Boolean)
    .join('\n')
}
