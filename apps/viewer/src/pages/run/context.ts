import type { AnyTrajectoryEvent, Ledger, RunSummary } from '@guoba-wiki-agent/trajectory'
import { createContext, useContext } from 'react'

import type { StreamState } from '@/lib/use-trajectory'

export interface RunData {
  runId: string
  events: AnyTrajectoryEvent[]
  ledger: Ledger
  summary: RunSummary
  stream: StreamState
  error?: string
  /** 还没有 run/end：Run 可能仍在进行（也可能是进程中途退出了） */
  open: boolean
  /** 第一个事件的时间，Run 内的相对时间以它为起点 */
  t0: number
}

export const RunContext = createContext<RunData | null>(null)

export function useRun(): RunData {
  const run = useContext(RunContext)
  if (!run) throw new Error('useRun 只能在 Run 页面内使用')
  return run
}

/** 流水账中选中项的键：Step 为 s<turn>-<step>，用户消息为 u<turn>-<序号>。 */
export const stepKey = (turn: number, step: number) => `s${turn}-${step}`
export const userKey = (turn: number, index: number) => `u${turn}-${index}`
