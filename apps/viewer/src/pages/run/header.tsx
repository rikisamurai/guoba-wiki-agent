import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { PathText } from '@/components/path-text'
import { Badge } from '@/components/ui/badge'
import { formatSeconds, formatTokens, formatUsd } from '@/lib/format'
import { RUN_RESULT } from '@/lib/status'
import { useNow } from '@/lib/use-trajectory'

import { useRun } from './context.ts'

const TABS = [
  { to: '/runs/$runId', label: '流水账' },
  { to: '/runs/$runId/timeline', label: '时间线' },
  { to: '/runs/$runId/changes', label: '变更' },
  { to: '/runs/$runId/request', label: '请求' },
] as const

/** Run 摘要（状态、Step、耗时、费用、token……）与四个标签页。 */
export function RunHeader() {
  const { runId, ledger, summary, open, t0 } = useRun()
  const now = useNow(open, 1000)
  const start = ledger.start
  if (!start) return null
  const result = RUN_RESULT[summary.reason]
  const files = ledger.turns.findLast((turn) => turn.proposal)?.proposal?.length ?? 0
  const metrics: [string, ReactNode][] = [
    [
      '状态',
      <Badge key="status" tone={result.tone}>
        {result.label}
      </Badge>,
    ],
    ['开始', new Date(t0).toLocaleTimeString('zh-CN', { hour12: false })],
    ['Step', summary.steps],
    ['耗时', formatSeconds(open ? now - t0 : (summary.durationMs ?? 0))],
    ['费用', `${formatUsd(summary.costUsd)}${summary.costComplete ? '' : '+'}`],
    [
      'Token 输入 / 输出 / 缓存',
      `${formatTokens(summary.usage.input)} / ${formatTokens(summary.usage.output)} / ${formatTokens(summary.usage.cacheRead)}`,
    ],
    ['Finish', `${summary.finishAttempts} 次`],
    ...(summary.warnings.length > 0
      ? [
          [
            'Warning',
            <span key="warning" className="text-warn">
              {summary.warnings.length}
            </span>,
          ] as [string, ReactNode],
        ]
      : []),
    ['模型', `${start.model.id} · ${start.thinkingLevel}`],
  ]

  return (
    <div className="border-line bg-surface grid shrink-0 gap-2.5 border-b px-[18px] pt-3">
      <div className="flex items-baseline gap-3.5">
        <Link to="/" className="text-accent inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="size-3.5" /> Run 列表
        </Link>
        <span className="text-faint truncate font-mono text-xs">{runId}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="border-line bg-bg text-muted rounded-[5px] border px-1.5 font-mono text-xs">
          {start.taskSkill}
        </span>
        <PathText path={start.source} className="text-[15px]" />
      </div>
      <dl className="flex flex-wrap gap-x-[26px] gap-y-1.5">
        {metrics.map(([label, value]) => (
          <div key={label} className="grid gap-px">
            <dt className="text-faint text-[11px]">{label}</dt>
            <dd className="tabular font-mono">{value}</dd>
          </div>
        ))}
      </dl>
      <nav className="mt-1 flex gap-[22px]" aria-label="Run 视图">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            params={{ runId }}
            activeOptions={{ exact: true, includeSearch: false }}
            className="text-muted hover:text-fg inline-flex items-center gap-1.5 border-b-2 border-transparent pt-[7px] pb-[9px]"
            activeProps={{ className: 'border-accent! font-medium text-fg!' }}
          >
            {tab.label}
            {tab.label === '变更' && files > 0 && (
              <span className="bg-sunken text-muted rounded-full px-1.5 font-mono text-[11px]">
                {files}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  )
}
