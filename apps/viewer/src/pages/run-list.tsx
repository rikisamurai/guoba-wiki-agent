import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { PathText } from '@/components/path-text'
import { TopBar } from '@/components/top-bar'
import { Badge } from '@/components/ui/badge'
import { type RunListItem, fetchRuns } from '@/lib/api'
import { formatLocalTime, formatSeconds, formatTokens, formatUsd } from '@/lib/format'
import { RUN_RESULT } from '@/lib/status'

const COLUMNS = [
  '开始',
  'Source',
  'Task Skill',
  '结果',
  'Step',
  'Token 输入 / 输出 / 缓存',
  '费用',
  '耗时',
  '文件',
]

/** 首页：每行一次 Run，按开始时间倒序。窗口重新获得焦点时刷新。 */
export function RunListPage() {
  const [runs, setRuns] = useState<RunListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      try {
        setRuns(await fetchRuns())
        setError(null)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      }
    }
    void load()
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return (
    <div className="min-h-dvh">
      <TopBar />
      <div className="flex items-baseline gap-2.5 px-[18px] pt-4 pb-2.5">
        <h1 className="text-base font-semibold">Run</h1>
        {runs && <span className="text-muted">{runs.length} 次</span>}
      </div>
      {error && <p className="bg-bad-bg text-bad mx-[18px] rounded-md px-3 py-2">{error}</p>}
      {runs?.length === 0 && (
        <p className="text-muted px-[18px]">
          还没有 Run。在终端运行 <code className="font-mono">wiki-agent run &lt;source&gt;</code>{' '}
          后会出现在这里。
        </p>
      )}
      {runs && runs.length > 0 && (
        <div className="overflow-x-auto px-[18px] pb-6">
          <table className="border-line bg-surface w-full min-w-[900px] border-collapse overflow-hidden rounded-lg border">
            <thead>
              <tr>
                {COLUMNS.map((column, index) => (
                  <th
                    key={column}
                    className={`border-line text-faint border-b px-3 py-2 text-[11px] font-medium whitespace-nowrap ${index >= 4 ? 'text-right' : 'text-left'}`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) =>
                'error' in run ? (
                  <tr key={run.id} className="border-line-soft border-b last:border-b-0">
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">{run.id}</td>
                    <td colSpan={8} className="text-bad px-3 py-2.5">
                      无法读取：{run.error}
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={run.id}
                    onClick={() => void navigate({ to: '/runs/$runId', params: { runId: run.id } })}
                    className="border-line-soft hover:bg-bg cursor-pointer border-b last:border-b-0"
                  >
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                      <Link
                        to="/runs/$runId"
                        params={{ runId: run.id }}
                        className="outline-none focus-visible:underline"
                      >
                        {run.summary.startedAt === null
                          ? run.id
                          : formatLocalTime(run.summary.startedAt)}
                      </Link>
                    </td>
                    <td className="max-w-[330px] px-3 py-2.5">
                      <PathText path={run.summary.source ?? ''} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="border-line bg-bg text-muted rounded-[5px] border px-1.5 font-mono text-xs">
                        {run.summary.taskSkill}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={RUN_RESULT[run.summary.reason].tone}>
                        {RUN_RESULT[run.summary.reason].label}
                      </Badge>
                    </td>
                    <Num>{run.summary.steps}</Num>
                    <Num>{`${formatTokens(run.summary.usage.input)} / ${formatTokens(run.summary.usage.output)} / ${formatTokens(run.summary.usage.cacheRead)}`}</Num>
                    <Num>{formatUsd(run.summary.costUsd)}</Num>
                    <Num>
                      {run.summary.durationMs === null
                        ? '—'
                        : formatSeconds(run.summary.durationMs)}
                    </Num>
                    <Num>{run.summary.files.length}</Num>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Num({ children }: { children: React.ReactNode }) {
  return <td className="tabular px-3 py-2.5 text-right font-mono whitespace-nowrap">{children}</td>
}
