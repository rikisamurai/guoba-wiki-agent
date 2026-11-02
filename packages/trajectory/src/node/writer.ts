import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs'
import path from 'node:path'

import type { TrajectoryEventMap, TrajectoryEventType } from '../events.ts'
import { findNonJson } from '../json.ts'

export interface TrajectoryWriter {
  append<K extends TrajectoryEventType>(
    type: K,
    data: TrajectoryEventMap[K],
  ): { type: K; seq: number; time: number; data: TrajectoryEventMap[K] }
  close(): void
}

/**
 * 仅追加写入一份 Trajectory。每个事件同步写出一行，进程崩溃后已写出的前缀仍可读取（ADR 0014）。
 * 文件已存在时拒绝打开：一个 Run 只对应一份 Trajectory，seq 从 0 开始。
 */
export function createTrajectoryWriter(
  file: string,
  options: { now?: () => number } = {},
): TrajectoryWriter {
  const now = options.now ?? Date.now
  mkdirSync(path.dirname(file), { recursive: true })
  const fd = openSync(file, 'wx')
  let seq = 0
  let closed = false

  return {
    append(type, data) {
      if (closed) throw new Error(`trajectory writer is closed: ${file}`)
      const bad = findNonJson(data)
      if (bad) throw new TypeError(`${type} data is not lossless JSON at ${bad}`)
      const event = { type, seq, time: now(), data }
      writeSync(fd, `${JSON.stringify(event)}\n`)
      seq += 1
      return event
    },
    close() {
      if (closed) return
      closed = true
      closeSync(fd)
    },
  }
}
