import { findSeqGap } from './event.ts'
import { type AnyTrajectoryEvent, TRAJECTORY_EVENT_TYPES } from './events.ts'

export class TrajectoryFormatError extends Error {
  override name = 'TrajectoryFormatError'
}

export interface ParsedTrajectory {
  events: AnyTrajectoryEvent[]
  /** 末尾有一行没写完（进程在写入途中退出），已被丢弃。 */
  truncatedTail: boolean
}

/**
 * 解析 trajectory.jsonl 的文本。浏览器与 Node 共用。
 * 未知事件类型、缺字段、seq 不连续都会报错，不静默跳过（ADR 0014）。
 */
export function parseTrajectory(text: string): ParsedTrajectory {
  if (text === '') return { events: [], truncatedTail: false }
  const lines = text.split('\n')
  const endsWithNewline = text.endsWith('\n')
  if (endsWithNewline) lines.pop()

  const events: AnyTrajectoryEvent[] = []
  let truncatedTail = false
  for (const [index, line] of lines.entries()) {
    const isLast = index === lines.length - 1
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch (error) {
      if (isLast && !endsWithNewline) {
        truncatedTail = true
        break
      }
      throw new TrajectoryFormatError(`line ${index + 1}: invalid JSON (${String(error)})`)
    }
    events.push(toEvent(value, index + 1))
  }

  const gap = findSeqGap(events)
  if (gap) {
    throw new TrajectoryFormatError(
      `seq gap at event ${gap.index}: expected ${gap.expected}, got ${gap.actual}`,
    )
  }
  return { events, truncatedTail }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toEvent(value: unknown, line: number): AnyTrajectoryEvent {
  if (!isRecord(value)) {
    throw new TrajectoryFormatError(`line ${line}: event must be an object`)
  }
  const { type, seq, time, data } = value
  if (typeof type !== 'string' || !TRAJECTORY_EVENT_TYPES.has(type)) {
    throw new TrajectoryFormatError(`line ${line}: unknown event type ${JSON.stringify(type)}`)
  }
  if (typeof seq !== 'number' || typeof time !== 'number') {
    throw new TrajectoryFormatError(`line ${line}: seq and time must be numbers`)
  }
  if (!isRecord(data)) {
    throw new TrajectoryFormatError(`line ${line}: data must be an object`)
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 读取只校验信封；各类型 data 的结构由写入方的同一份类型定义保证
  return value as AnyTrajectoryEvent
}
