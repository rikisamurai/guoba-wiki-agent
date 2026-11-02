import { type AnyTrajectoryEvent, parseTrajectoryLine } from '@guoba-wiki-agent/trajectory'
import { useEffect, useState } from 'react'

import { streamUrl } from './api.ts'

/** connecting：连接中；live：已连接，等待新事件；ended：读到 run/end；error：连接或格式错误。 */
export type StreamState = 'connecting' | 'live' | 'ended' | 'error'

export interface Trajectory {
  events: AnyTrajectoryEvent[]
  state: StreamState
  error?: string
}

/**
 * 通过 SSE 读取一个 Run 的全部事件：先收到已有事件，Run 还在进行时继续收到新增事件（ADR 0015）。
 * 每条事件按 Node 读取器的同一规则校验，seq 必须连续；断线重连由 EventSource 带 Last-Event-ID 续传。
 * 同一帧内收到的事件合并为一次更新。
 */
export function useTrajectory(runId: string): Trajectory {
  // 状态带上 runId：切换 Run 时旧状态自动作废，不需要在 effect 里同步重置
  const [current, setCurrent] = useState(() => initial(runId))
  const trajectory = current.runId === runId ? current : initial(runId)

  useEffect(() => {
    const setTrajectory = (update: (prev: Trajectory) => Trajectory) =>
      setCurrent((prev) => ({ ...update(prev.runId === runId ? prev : initial(runId)), runId }))
    const source = new EventSource(streamUrl(runId))
    let received = 0
    let pending: AnyTrajectoryEvent[] = []
    let frame = 0

    const flush = () => {
      frame = 0
      const batch = pending
      pending = []
      if (batch.length > 0) {
        setTrajectory((prev) => ({ ...prev, events: [...prev.events, ...batch] }))
      }
    }
    const fail = (error: string) => {
      source.close()
      flush()
      setTrajectory((prev) => ({ ...prev, state: 'error', error }))
    }

    source.addEventListener('open', () => {
      setTrajectory((prev) => (prev.state === 'connecting' ? { ...prev, state: 'live' } : prev))
    })
    source.addEventListener('message', (message) => {
      try {
        const event = parseTrajectoryLine(message.data, received + 1)
        if (event.seq !== received)
          throw new Error(`seq 不连续：期望 ${received}，收到 ${event.seq}`)
        received += 1
        pending.push(event)
        frame ||= requestAnimationFrame(flush)
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error))
      }
    })
    source.addEventListener('end', () => {
      source.close()
      flush()
      setTrajectory((prev) => ({ ...prev, state: 'ended' }))
    })
    source.addEventListener('error', (event) => {
      // 服务端发出的 `event: error` 带有说明；浏览器自身的连接错误没有 data，EventSource 会自动重连
      if (event instanceof MessageEvent) fail(JSON.parse(event.data).message)
      else if (source.readyState === EventSource.CLOSED) fail('与 wiki-agent view 的连接已断开')
      else setTrajectory((prev) => ({ ...prev, state: 'connecting' }))
    })
    return () => {
      source.close()
      cancelAnimationFrame(frame)
    }
  }, [runId])

  return trajectory
}

function initial(runId: string): Trajectory & { runId: string } {
  return { runId, events: [], state: 'connecting' }
}

/** 每隔 intervalMs 返回一次当前时间；enabled 为 false 时不计时。用于进行中 Step 的计时。 */
export function useNow(enabled: boolean, intervalMs = 100): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!enabled) return undefined
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [enabled, intervalMs])
  return now
}
