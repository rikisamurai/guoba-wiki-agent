/**
 * Trajectory 中的一行（ADR 0014）。具体事件类型与 data 结构在 M1 中补全。
 */
export interface TrajectoryEvent<TType extends string = string, TData = unknown> {
  type: TType
  /** 从 0 开始连续递增。 */
  seq: number
  /** 毫秒时间戳，取本进程收到事件时的时钟。 */
  time: number
  data: TData
}

/**
 * 返回第一个不连续的位置；全部连续时返回 undefined。
 */
export function findSeqGap(
  events: readonly Pick<TrajectoryEvent, 'seq'>[],
): { index: number; expected: number; actual: number } | undefined {
  for (const [index, event] of events.entries()) {
    if (event.seq !== index) {
      return { index, expected: index, actual: event.seq }
    }
  }
  return undefined
}
