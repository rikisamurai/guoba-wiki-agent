/**
 * v1 的 Trajectory 事件词汇（ADR 0014）。
 * 本包不依赖 Pi 和 packages/vault，这里的类型是 Run 进程与查看器之间的契约。
 */

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface ModelRef {
  provider: string
  id: string
}

export interface TokenUsage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

/** 美元 / 百万 token，在 run/start 中快照，费用可按当时价格重算。 */
export interface Pricing {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export interface Finding {
  level: 'invariant' | 'warning'
  rule: string
  message: string
  path?: string
}

export interface StreamRecord {
  /** 本进程收到这一片的时间（毫秒）。 */
  at: number
  kind: 'text' | 'thinking' | 'toolcall'
  delta: string
}

export type AssistantBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'toolCall'; id: string; name: string; arguments: string }

export interface ToolSchema {
  name: string
  description: string
  parameters: JsonValue
}

export type TurnEndReason =
  | 'finished'
  | 'invariant_failed'
  | 'limit'
  | 'cancelled'
  | 'provider_error'

export type RunEndReason =
  | 'applied'
  | 'discarded'
  | 'apply_rejected'
  | 'invariant_failed'
  | 'limit'
  | 'cancelled'
  | 'provider_error'

interface StepRef {
  turn: number
  step: number
}

export interface TrajectoryEventMap {
  'run/start': {
    runId: string
    taskSkill: string
    source: string
    vault: string
    model: ModelRef
    thinkingLevel: string
    pricing: Pricing | null
    config: JsonValue
    versions: { wikiAgent: string | null; pi: string }
    vaultGit: { head: string; dirty: boolean } | null
    skillHashes: Record<string, string>
  }
  'request/header': {
    systemPrompt: string
    tools: ToolSchema[]
    model: ModelRef
    thinkingLevel: string
  }
  'turn/start': { turn: number }
  'turn/end': { turn: number; reason: TurnEndReason }
  'user/message': { turn: number; source: 'task' | 'validation' | 'revise'; text: string }
  'step/start': StepRef
  'step/end': StepRef
  'assistant/message': StepRef & {
    blocks: AssistantBlock[]
    stream: StreamRecord[]
    stopReason: string
    usage?: TokenUsage
    /** 缺省表示 provider 没有返回 Usage，费用未知（ADR 0012）。 */
    costUsd?: number
  }
  'assistant/attempt': StepRef & { stream: StreamRecord[]; error: string }
  'tool/call': StepRef & { callId: string; name: string; arguments: string }
  'tool/result': StepRef & {
    callId: string
    name: string
    isError: boolean
    content: string
    /** Pi 1.1+ 测得的 execute() 耗时，不含 hook。 */
    durationMs?: number
  }
  'staging/write': StepRef & {
    callId: string
    path: string
    /** revert 撤销这个文件的全部暂存改动（ADR 0019）。 */
    op: 'write' | 'edit' | 'append' | 'revert'
    beforeHash: string | null
    /** 撤销本次新建的文件后为 null。 */
    afterHash: string | null
    bytes: number
  }
  'validation/result': StepRef & {
    attempt: number
    invariants: Finding[]
    warnings: Finding[]
    /**
     * Finish 的判定（ADR 0007）：pass 通过；warnings 只有 Warning，回传模型提示一次；
     * retry Invariant 未通过，回传修正；failed 修正次数用完。M5 起记录，更早的 Trajectory 没有。
     */
    verdict?: 'pass' | 'warnings' | 'retry' | 'failed'
  }
  /** 每个 Turn 结束时 Staging 相对 Vault 的全部变更；查看器与 proposal.diff 都从这里取。 */
  'proposal/diff': { turn: number; files: { path: string; created: boolean; diff: string }[] }
  'review/decision': { turn: number; choice: 'y' | 'n' | 'r'; feedback?: string }
  'apply/result': {
    written: string[]
    conflicts: string[]
    failed: { path: string; error: string }[]
    invariants: Finding[]
  }
  'limit/hit': { limit: 'steps' | 'duration' | 'cost'; value: number; max: number }
  'run/end': { reason: RunEndReason }
}

export type TrajectoryEventType = keyof TrajectoryEventMap

export const TRAJECTORY_EVENT_TYPES: ReadonlySet<string> = new Set<TrajectoryEventType>([
  'run/start',
  'request/header',
  'turn/start',
  'turn/end',
  'user/message',
  'step/start',
  'step/end',
  'assistant/message',
  'assistant/attempt',
  'tool/call',
  'tool/result',
  'staging/write',
  'validation/result',
  'proposal/diff',
  'review/decision',
  'apply/result',
  'limit/hit',
  'run/end',
])

export type AnyTrajectoryEvent = {
  [K in TrajectoryEventType]: { type: K; seq: number; time: number; data: TrajectoryEventMap[K] }
}[TrajectoryEventType]
