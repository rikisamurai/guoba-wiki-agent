import type { Ledger, StepView, TurnView } from '@guoba-wiki-agent/trajectory'
import { Link } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import { formatCount, formatSeconds } from '@/lib/format'
import { WRITE_TOOLS } from '@/lib/status'
import { argHint, groupedTools, stepDuration, verdictText, verdictTone } from '@/lib/steps'
import { cn } from '@/lib/utils'

const ROW =
  'grid grid-cols-[54px_minmax(0,1fr)_84px_58px] items-center gap-2.5 border-b border-line-soft px-3.5 py-1.5'

/** 流水账的一行。to 存在时整行可点。 */
export function Row(props: {
  kind: ReactNode
  children: ReactNode
  bar?: ReactNode
  time: string
  selected?: boolean
  muted?: boolean
  link?: { sel?: string; to?: 'changes'; turn?: number; runId: string }
}) {
  const content = (
    <>
      <span
        className={cn(
          'text-muted font-mono text-xs whitespace-nowrap',
          props.selected && 'text-accent font-medium',
        )}
      >
        {props.kind}
      </span>
      <span className={cn('min-w-0 truncate', props.muted && 'text-muted')}>{props.children}</span>
      <span>{props.bar}</span>
      <span className="tabular text-muted text-right font-mono text-xs whitespace-nowrap">
        {props.time}
      </span>
    </>
  )
  const className = cn(ROW, props.selected ? 'bg-accent-bg' : props.link && 'hover:bg-bg')
  const { link } = props
  if (!link) return <div className={className}>{content}</div>
  if (link.to === 'changes') {
    return (
      <Link
        to="/runs/$runId/changes"
        params={{ runId: link.runId }}
        search={{ turn: link.turn }}
        className={className}
      >
        {content}
      </Link>
    )
  }
  return (
    <Link
      to="/runs/$runId"
      params={{ runId: link.runId }}
      search={{ sel: link.sel }}
      className={className}
    >
      {content}
    </Link>
  )
}

export function TurnHeader({ turn }: { turn: TurnView }) {
  const first = turn.entries.find((entry) => entry.kind === 'user')
  const label = first?.kind === 'user' && first.source === 'revise' ? '修改意见' : '任务'
  return (
    <div className="border-line-soft bg-sunken flex items-baseline gap-2.5 border-b px-3.5 py-2">
      <span className="font-semibold">Turn {turn.turn}</span>
      <span className="text-muted">{label}</span>
      <span className="text-muted ml-auto font-mono text-xs">
        {turn.endedAt === undefined
          ? '进行中'
          : `${formatSeconds(turn.endedAt - turn.startedAt)} · ${turn.reason ?? ''}`}
      </span>
    </div>
  )
}

/** Step 行的主体：工具调用摘要、Finish 结果，或生成中的状态。 */
export function StepSummary({ step, open }: { step: StepView; open: boolean }) {
  const validation = step.validations.at(-1)
  if (!step.assistant) {
    const error = step.attempts.at(-1)?.error
    if (error) return <span className="text-bad">✗ 模型请求未完成：{error}</span>
    if (open && step.endedAt === undefined) {
      return (
        <span className="text-accent inline-flex items-center gap-2">
          <LoaderCircle className="size-3.5 motion-safe:animate-spin" />
          生成中，生成结束后显示思考与工具调用
        </span>
      )
    }
  }
  const grouped = groupedTools(step)
  const tools = grouped ? (
    <>
      <ToolName name={grouped.name} />
      <span className="text-accent mr-2 ml-0.5 font-mono text-xs">×{grouped.count}</span>
      {grouped.bytes > 0 && (
        <span className="text-muted">
          {grouped.count} 个文件 · {formatCount(grouped.bytes)} 字节
        </span>
      )}
    </>
  ) : (
    step.tools
      .filter((tool) => !(validation && tool.name === 'finish'))
      .map((tool, index) => (
        <span key={tool.callId}>
          {index > 0 && <span className="text-faint mx-1.5">·</span>}
          <ToolName name={tool.name} />{' '}
          <span className="text-muted font-mono text-xs">{argHint(tool.arguments)}</span>
        </span>
      ))
  )
  return (
    <>
      {tools}
      {validation && (
        <>
          <ToolName name="finish" />
          <span className="text-faint mx-1.5">→</span>
          <span className={cn(verdictTone(validation) === 'bad' && 'text-bad')}>
            {verdictText(validation)}
          </span>
        </>
      )}
    </>
  )
}

export function ToolName({ name }: { name: string }) {
  return (
    <span
      className={cn(
        'font-mono text-xs font-medium',
        WRITE_TOOLS.has(name) ? 'text-accent' : 'text-fg',
      )}
    >
      {name}
    </span>
  )
}

export function maxStepDuration(ledger: Ledger, now: number): number {
  return Math.max(
    0,
    ...ledger.turns.flatMap((turn) =>
      turn.entries.map((e) => (e.kind === 'step' ? stepDuration(e.step, now) : 0)),
    ),
  )
}
