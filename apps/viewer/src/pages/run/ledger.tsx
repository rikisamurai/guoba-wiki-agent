import { type StepView, type TurnView, allSteps } from '@guoba-wiki-agent/trajectory'
import { Link, getRouteApi } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Fragment } from 'react'

import { Badge } from '@/components/ui/badge'
import { formatClock, formatSeconds } from '@/lib/format'
import { limitText } from '@/lib/limits'
import { RUN_RESULT } from '@/lib/status'
import { stepDuration } from '@/lib/steps'
import { useNow } from '@/lib/use-trajectory'
import { cn } from '@/lib/utils'

import { type RunData, stepKey, useRun, userKey } from './context.ts'
import { DurationBar } from './duration-bar.tsx'
import { Row, StepSummary, TurnHeader, maxStepDuration } from './ledger-rows.tsx'
import { StepDetail } from './step-detail.tsx'

const route = getRouteApi('/runs/$runId/')
const USER_LABEL = { task: 'user', validation: '校验', revise: '修改' } as const

/** 流水账（方案 A）：左侧按 Turn → Step 列出记录，右侧是选中记录的详情。窄屏时两级切换。 */
export function LedgerPage() {
  const run = useRun()
  const { sel } = route.useSearch()
  const now = useNow(run.open)
  const steps = allSteps(run.ledger)
  const last = steps.at(-1)
  const selected = sel ?? (last ? stepKey(last.turn, last.step) : undefined)
  return (
    <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,47fr)_minmax(0,53fr)]">
      <div
        className={cn(
          'border-line bg-surface min-h-0 overflow-auto md:border-r',
          sel && 'max-md:hidden',
        )}
      >
        <LedgerList run={run} selected={selected} now={now} />
      </div>
      <div className={cn('min-h-0 overflow-auto', !sel && 'max-md:hidden')}>
        {sel && (
          <Link
            to="/runs/$runId"
            params={{ runId: run.runId }}
            className="text-accent flex items-center gap-1 px-[18px] pt-3 md:hidden"
          >
            <ArrowLeft className="size-3.5" /> 流水账
          </Link>
        )}
        <EntryDetail run={run} selected={selected} now={now} steps={steps} />
      </div>
    </div>
  )
}

function LedgerList({ run, selected, now }: { run: RunData; selected?: string; now: number }) {
  const { ledger, runId, t0 } = run
  const scale = maxStepDuration(ledger, now)
  const lastTurn = ledger.turns.at(-1)?.turn
  return (
    <>
      {ledger.turns.map((turn) => (
        <Fragment key={turn.turn}>
          <TurnHeader turn={turn} />
          {turn.entries.map((entry, index) => {
            if (entry.kind === 'review') return null
            if (entry.kind === 'user') {
              const key = userKey(turn.turn, index)
              return (
                <Row
                  key={key}
                  kind={USER_LABEL[entry.source]}
                  time={formatClock(entry.at - t0)}
                  muted
                  selected={key === selected}
                  link={{ runId, sel: key }}
                >
                  {entry.text}
                </Row>
              )
            }
            const key = stepKey(turn.turn, entry.step.step)
            return (
              <Row
                key={key}
                kind={`Step ${entry.step.step + 1}`}
                bar={<DurationBar step={entry.step} scale={scale} now={now} />}
                time={formatSeconds(stepDuration(entry.step, now))}
                selected={key === selected}
                link={{ runId, sel: key }}
              >
                <StepSummary step={entry.step} open={run.open} />
              </Row>
            )
          })}
          {turn.proposal && <ProposalRow run={run} turn={turn} />}
          {turn.entries.map((entry) =>
            entry.kind === 'review' ? (
              <Row key={`r${turn.turn}`} kind="确认" time={formatClock(entry.at - t0)} muted>
                <span className="border-line text-fg mr-1.5 rounded border border-b-2 px-1 font-mono text-[11px]">
                  {entry.choice}
                </span>
                {reviewText(entry.choice, entry.feedback, turn.turn === lastTurn ? run : undefined)}
              </Row>
            ) : null,
          )}
        </Fragment>
      ))}
      {ledger.end && !['applied', 'discarded', 'apply_rejected'].includes(ledger.end.reason) && (
        <Row kind="结束" time={formatClock(ledger.end.at - t0)}>
          <Badge tone={RUN_RESULT[ledger.end.reason].tone}>
            {RUN_RESULT[ledger.end.reason].label}
          </Badge>
          {ledger.limits.map((hit) => (
            <span key={hit.limit} className="text-muted ml-2">
              {limitText(hit)}
            </span>
          ))}
        </Row>
      )}
    </>
  )
}

function ProposalRow({ run, turn }: { run: RunData; turn: TurnView }) {
  const files = turn.proposal ?? []
  const created = files.filter((file) => file.created).length
  const validation = turn.entries
    .flatMap((e) => (e.kind === 'step' ? e.step.validations : []))
    .at(-1)
  return (
    <Row
      kind="提案"
      time={formatClock((turn.endedAt ?? turn.startedAt) - run.t0)}
      muted
      link={{ runId: run.runId, to: 'changes', turn: turn.turn }}
    >
      新建 {created} · 修改 {files.length - created}
      {validation && (
        <>
          {' · '}Invariant {validation.invariants.length}
          {' · '}
          <span className={cn(validation.warnings.length > 0 && 'text-warn font-medium')}>
            Warning {validation.warnings.length}
          </span>
        </>
      )}
    </Row>
  )
}

function reviewText(choice: 'y' | 'n' | 'r', feedback: string | undefined, run?: RunData): string {
  if (choice === 'r') return `修改意见：${feedback ?? ''}`
  if (choice === 'n') return '放弃，Vault 未改动'
  const apply = run?.ledger.apply
  if (!apply) return '写入'
  if (apply.conflicts.length > 0)
    return `写入被拒：${apply.conflicts.length} 个文件在运行期间被外部修改`
  if (apply.invariants.length > 0) return '写入被拒：基于当前 Vault 重新校验发现 Invariant'
  if (apply.failed.length > 0)
    return `只写入了 ${apply.written.length} 个文件，${apply.failed.length} 个失败`
  return `已写入 ${apply.written.length} 个文件`
}

function EntryDetail({
  run,
  selected,
  now,
  steps,
}: {
  run: RunData
  selected?: string
  now: number
  steps: StepView[]
}) {
  const step = steps.find((s) => stepKey(s.turn, s.step) === selected)
  if (step) return <StepDetail step={step} now={now} />
  const match = /^u(\d+)-(\d+)$/.exec(selected ?? '')
  const entry =
    match && run.ledger.turns.find((t) => t.turn === Number(match[1]))?.entries[Number(match[2])]
  if (entry?.kind === 'user') {
    return (
      <div className="grid gap-3 px-[18px] pt-3.5 pb-5">
        <h4 className="text-base font-semibold">{USER_LABEL[entry.source]} 消息</h4>
        <pre className="bg-sunken rounded-md px-2.5 py-2 font-mono text-xs whitespace-pre-wrap">
          {entry.text}
        </pre>
      </div>
    )
  }
  return <p className="text-muted p-6">还没有记录。</p>
}
