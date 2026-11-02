import { buildLedger, summarizeLedger } from '@guoba-wiki-agent/trajectory'
import { Outlet, getRouteApi } from '@tanstack/react-router'
import { useMemo } from 'react'

import { LiveIndicator, TopBar } from '@/components/top-bar'
import { useTrajectory } from '@/lib/use-trajectory'

import { RunContext, type RunData } from './context.ts'
import { RunHeader } from './header.tsx'

const route = getRouteApi('/runs/$runId')

/** Run 详情的外框：读取 Trajectory，显示顶部摘要与标签页，子页面通过 useRun() 取数据。 */
export function RunLayout() {
  const { runId } = route.useParams()
  const trajectory = useTrajectory(runId)
  const data = useMemo<RunData>(() => {
    const ledger = buildLedger(trajectory.events)
    return {
      runId,
      events: trajectory.events,
      ledger,
      summary: summarizeLedger(ledger, trajectory.events),
      stream: trajectory.state,
      ...(trajectory.error !== undefined && { error: trajectory.error }),
      open: ledger.end === undefined,
      t0: trajectory.events[0]?.time ?? 0,
    }
  }, [runId, trajectory])

  return (
    <RunContext.Provider value={data}>
      <div className="flex h-dvh flex-col">
        <TopBar>{data.open && data.stream === 'live' && <LiveIndicator />}</TopBar>
        {data.error && (
          <div className="border-line bg-bad-bg text-bad border-b px-[18px] py-2">
            无法读取这次 Run：{data.error}
          </div>
        )}
        {data.ledger.start ? (
          <>
            <RunHeader />
            <div className="flex min-h-0 flex-1 flex-col">
              <Outlet />
            </div>
          </>
        ) : (
          !data.error && <p className="text-muted p-6">正在读取 {runId} …</p>
        )}
      </div>
    </RunContext.Provider>
  )
}
