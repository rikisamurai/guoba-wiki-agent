import type { AnyTrajectoryEvent, Finding, RunEndReason, TokenUsage } from './events.ts'
import { type Ledger, allSteps, buildLedger } from './ledger.ts'

/** `result.json` 的内容。完全由 Trajectory 派生，可随时重新生成（ADR 0014）。 */
export interface RunSummary {
  runId: string | null
  taskSkill: string | null
  source: string | null
  /** 第一个事件（run/start）的时间戳。 */
  startedAt: number | null
  /** 没有 run/end 时为 incomplete（进行中，或进程中途退出）。 */
  reason: RunEndReason | 'incomplete'
  turns: number
  steps: number
  usage: TokenUsage
  /** 已知部分的费用合计（美元）。 */
  costUsd: number
  /** 有任何一次回复没有返回 Usage 时为 false（ADR 0012：费用未知）。 */
  costComplete: boolean
  durationMs: number | null
  finishAttempts: number
  /** 最近一次校验（Finish 或 Apply 前的重新校验）留下的 Invariant 问题。 */
  invariants: Finding[]
  /** 最近一次 Finish 校验的 Warning。 */
  warnings: Finding[]
  /** Staging 中写过的文件，去重排序。 */
  files: string[]
  applied: string[]
}

export function summarizeRun(events: readonly AnyTrajectoryEvent[]): RunSummary {
  return summarizeLedger(buildLedger(events), events)
}

export function summarizeLedger(ledger: Ledger, events: readonly AnyTrajectoryEvent[]): RunSummary {
  const steps = allSteps(ledger)
  const usage: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  let costUsd = 0
  let costComplete = true
  for (const step of steps) {
    const reply = step.assistant
    if (!reply) continue
    if (reply.usage) {
      usage.input += reply.usage.input
      usage.output += reply.usage.output
      usage.cacheRead += reply.usage.cacheRead
      usage.cacheWrite += reply.usage.cacheWrite
    }
    if (reply.costUsd === undefined) costComplete = false
    else costUsd += reply.costUsd
  }

  const validations = steps.flatMap((step) => step.validations)
  const lastValidation = validations.at(-1)
  const files = new Set(
    steps.flatMap((step) => step.tools.flatMap((tool) => tool.writes.map((w) => w.path))),
  )
  const first = events[0]
  const last = events.at(-1)

  return {
    runId: ledger.start?.runId ?? null,
    taskSkill: ledger.start?.taskSkill ?? null,
    source: ledger.start?.source ?? null,
    startedAt: first?.time ?? null,
    reason: ledger.end?.reason ?? 'incomplete',
    turns: ledger.turns.length,
    steps: steps.length,
    usage,
    costUsd,
    costComplete,
    durationMs: first && last ? last.time - first.time : null,
    finishAttempts: validations.length,
    invariants: ledger.apply?.invariants.length
      ? ledger.apply.invariants
      : (lastValidation?.invariants ?? []),
    warnings: lastValidation?.warnings ?? [],
    files: [...files].toSorted(),
    applied: ledger.apply?.written ?? [],
  }
}
