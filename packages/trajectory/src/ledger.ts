import type {
  AnyTrajectoryEvent,
  AssistantBlock,
  RunEndReason,
  TokenUsage,
  TrajectoryEventMap,
  TurnEndReason,
} from './events.ts'

export interface ToolView {
  callId: string
  name: string
  arguments: string
  calledAt: number
  result?: { isError: boolean; content: string; at: number; durationMs?: number }
  writes: (TrajectoryEventMap['staging/write'] & { at: number })[]
}

export interface StepView {
  turn: number
  step: number
  startedAt: number
  endedAt?: number
  assistant?: {
    blocks: AssistantBlock[]
    stopReason: string
    usage?: TokenUsage
    costUsd?: number
    at: number
  }
  attempts: { error: string; at: number }[]
  /** Step 开始到收到第一片输出（含被重试掉的那次尝试）。 */
  ttftMs?: number
  /** 最终那次回复的第一片到最后一片。 */
  decodeMs?: number
  tools: ToolView[]
  validations: (TrajectoryEventMap['validation/result'] & { at: number })[]
}

export type TurnEntry =
  | { kind: 'user'; source: TrajectoryEventMap['user/message']['source']; text: string; at: number }
  | { kind: 'step'; step: StepView }
  | { kind: 'review'; choice: 'y' | 'n' | 'r'; feedback?: string; at: number }

export interface TurnView {
  turn: number
  startedAt: number
  endedAt?: number
  reason?: TurnEndReason
  entries: TurnEntry[]
}

export interface Ledger {
  start?: TrajectoryEventMap['run/start'] & { at: number }
  headers: (TrajectoryEventMap['request/header'] & { at: number })[]
  turns: TurnView[]
  limits: (TrajectoryEventMap['limit/hit'] & { at: number })[]
  apply?: TrajectoryEventMap['apply/result'] & { at: number }
  end?: { reason: RunEndReason; at: number }
}

/** 把事件按 Turn → Step 组织成流水账。纯函数，浏览器可用。 */
export function buildLedger(events: readonly AnyTrajectoryEvent[]): Ledger {
  const ledger: Ledger = { headers: [], turns: [], limits: [] }
  const turns = new Map<number, TurnView>()
  const steps = new Map<string, StepView>()
  const firstOutputAt = new Map<StepView, number>()

  const turnOf = (turn: number, at: number): TurnView => {
    let view = turns.get(turn)
    if (!view) {
      view = { turn, startedAt: at, entries: [] }
      turns.set(turn, view)
      ledger.turns.push(view)
    }
    return view
  }
  const stepOf = (turn: number, step: number, at: number): StepView => {
    const key = `${turn}:${step}`
    let view = steps.get(key)
    if (!view) {
      view = { turn, step, startedAt: at, attempts: [], tools: [], validations: [] }
      steps.set(key, view)
      turnOf(turn, at).entries.push({ kind: 'step', step: view })
    }
    return view
  }
  const noteOutput = (view: StepView, at: number | undefined) => {
    if (at === undefined) return
    const seen = firstOutputAt.get(view)
    if (seen === undefined || at < seen) firstOutputAt.set(view, at)
  }

  for (const event of events) {
    const at = event.time
    switch (event.type) {
      case 'run/start':
        ledger.start = { ...event.data, at }
        break
      case 'request/header':
        ledger.headers.push({ ...event.data, at })
        break
      case 'turn/start':
        turnOf(event.data.turn, at)
        break
      case 'turn/end': {
        const view = turnOf(event.data.turn, at)
        view.endedAt = at
        view.reason = event.data.reason
        break
      }
      case 'user/message':
        turnOf(event.data.turn, at).entries.push({
          kind: 'user',
          source: event.data.source,
          text: event.data.text,
          at,
        })
        break
      case 'step/start':
        stepOf(event.data.turn, event.data.step, at)
        break
      case 'step/end':
        stepOf(event.data.turn, event.data.step, at).endedAt = at
        break
      case 'assistant/attempt': {
        const view = stepOf(event.data.turn, event.data.step, at)
        view.attempts.push({ error: event.data.error, at })
        noteOutput(view, event.data.stream[0]?.at)
        break
      }
      case 'assistant/message': {
        const { turn, step, stream, blocks, stopReason, usage, costUsd } = event.data
        const view = stepOf(turn, step, at)
        view.assistant = {
          blocks,
          stopReason,
          at,
          ...(usage && { usage }),
          ...(costUsd !== undefined && { costUsd }),
        }
        const first = stream[0]
        const last = stream.at(-1)
        noteOutput(view, first?.at)
        if (first && last) view.decodeMs = last.at - first.at
        break
      }
      case 'tool/call':
        stepOf(event.data.turn, event.data.step, at).tools.push({
          callId: event.data.callId,
          name: event.data.name,
          arguments: event.data.arguments,
          calledAt: at,
          writes: [],
        })
        break
      case 'tool/result': {
        const tool = findTool(stepOf(event.data.turn, event.data.step, at), event.data.callId)
        if (tool) {
          const { isError, content, durationMs } = event.data
          tool.result = { isError, content, at, ...(durationMs !== undefined && { durationMs }) }
        }
        break
      }
      case 'staging/write':
        findTool(stepOf(event.data.turn, event.data.step, at), event.data.callId)?.writes.push({
          ...event.data,
          at,
        })
        break
      case 'validation/result':
        stepOf(event.data.turn, event.data.step, at).validations.push({ ...event.data, at })
        break
      case 'review/decision':
        turnOf(event.data.turn, at).entries.push({
          kind: 'review',
          choice: event.data.choice,
          at,
          ...(event.data.feedback !== undefined && { feedback: event.data.feedback }),
        })
        break
      case 'apply/result':
        ledger.apply = { ...event.data, at }
        break
      case 'limit/hit':
        ledger.limits.push({ ...event.data, at })
        break
      case 'run/end':
        ledger.end = { reason: event.data.reason, at }
        break
    }
  }

  for (const [view, at] of firstOutputAt) view.ttftMs = at - view.startedAt
  return ledger
}

function findTool(step: StepView, callId: string): ToolView | undefined {
  return step.tools.find((tool) => tool.callId === callId)
}

export function allSteps(ledger: Ledger): StepView[] {
  return ledger.turns.flatMap((turn) =>
    turn.entries.flatMap((entry) => (entry.kind === 'step' ? [entry.step] : [])),
  )
}
