import type { StepView, TurnView } from '@guoba-wiki-agent/trajectory'

import { formatCount, formatSeconds, formatUsd } from '@/lib/format'
import { WRITE_TOOLS } from '@/lib/status'
import { stepDuration, toolTime, verdictTone } from '@/lib/steps'
import { formatTick, timeTicks } from '@/lib/timeline'
import { useNow } from '@/lib/use-trajectory'
import { cn } from '@/lib/utils'

import { useRun } from './context.ts'

const GRID = 'grid grid-cols-[190px_minmax(0,1fr)_84px_76px] items-center gap-3'
const FIN = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' } as const

/** 时间线：顶部是等待首字、生成、工具三类耗时的合计；下面每个 Turn 一张瀑布图，有自己的时间轴。 */
export function TimelinePage() {
  const { ledger, open } = useRun()
  const now = useNow(open)
  const steps = ledger.turns.flatMap((turn) =>
    turn.entries.flatMap((e) => (e.kind === 'step' ? [e.step] : [])),
  )
  return (
    <div className="bg-surface min-h-0 flex-1 overflow-auto">
      <div className="grid min-w-[720px] gap-6 px-[18px] pt-4 pb-6">
        <Totals steps={steps} />
        {ledger.turns.map((turn) => (
          <TurnWaterfall key={turn.turn} turn={turn} now={now} multi={ledger.turns.length > 1} />
        ))}
      </div>
    </div>
  )
}

function Totals({ steps }: { steps: StepView[] }) {
  const ttft = steps.reduce((sum, s) => sum + (s.ttftMs ?? 0), 0)
  const decode = steps.reduce((sum, s) => sum + (s.decodeMs ?? 0), 0)
  const tools = steps.reduce((sum, s) => sum + toolTime(s), 0)
  const total = ttft + decode + tools || 1
  const share = (ms: number) =>
    ms / total < 0.01 && ms > 0 ? '<1%' : `${Math.round((ms / total) * 100)}%`
  return (
    <div className="border-line-soft grid gap-2 border-b pb-3.5">
      <div className="flex flex-wrap items-center gap-x-[22px] gap-y-1.5">
        <Legend swatch="hatch" label="等待首字" value={formatSeconds(ttft)} share={share(ttft)} />
        <Legend
          swatch="bg-accent"
          label="生成"
          value={formatSeconds(decode)}
          share={share(decode)}
        />
        <Legend swatch="bg-fg" label="工具" value={formatSeconds(tools)} share={share(tools)} />
        <span className="inline-flex items-center gap-1.5">
          <Diamond className="bg-warn" />
          Finish：Warning 回传
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Diamond className="bg-ok" />
          Finish：通过
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Diamond className="bg-bad" />
          Finish：Invariant
        </span>
      </div>
      <div className="bg-sunken flex h-2.5 overflow-hidden rounded-[3px]">
        <span className="hatch" style={{ width: `${(ttft / total) * 100}%` }} />
        <span className="bg-accent" style={{ width: `${(decode / total) * 100}%` }} />
        <span className="bg-fg min-w-[3px]" style={{ width: `${(tools / total) * 100}%` }} />
      </div>
    </div>
  )
}

function Legend(props: { swatch: string; label: string; value: string; share: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block h-2 w-3 rounded-[2px]', props.swatch)} />
      {props.label} <b className="tabular font-mono font-medium">{props.value}</b>
      <span className="text-muted">{props.share}</span>
    </span>
  )
}

function Diamond({ className }: { className: string }) {
  return <span className={cn('inline-block size-2 rotate-45', className)} />
}

function TurnWaterfall({ turn, now, multi }: { turn: TurnView; now: number; multi: boolean }) {
  const steps = turn.entries.flatMap((e) => (e.kind === 'step' ? [e.step] : []))
  const end = turn.endedAt ?? steps.at(-1)?.endedAt ?? now
  const { stepMs, domainMs } = timeTicks(end - turn.startedAt)
  const pct = (ms: number) => `${((ms - turn.startedAt) / domainMs) * 100}%`
  const ticks = Array.from({ length: domainMs / stepMs + 1 }, (_, i) => i * stepMs)
  const longest = Math.max(...steps.map((s) => s.decodeMs ?? 0))
  return (
    <section className="grid gap-1">
      {multi && <h4 className="font-semibold">Turn {turn.turn}</h4>}
      <div className={cn(GRID, 'text-muted min-h-[22px] text-[11px]')}>
        <span>Step · 主要工具</span>
        <span className="relative h-[22px]">
          {ticks.map((t, i) => (
            <span
              key={t}
              className={cn(
                'text-faint absolute top-[3px] font-mono text-[10px] whitespace-nowrap',
                i === 0 ? '' : i === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2',
              )}
              style={{ left: `${(t / domainMs) * 100}%` }}
            >
              {formatTick(t)}
            </span>
          ))}
        </span>
        <span className="text-right">输出 token</span>
        <span className="text-right">费用</span>
      </div>
      {steps.map((step) => {
        const validation = step.validations.at(-1)
        const stepEnd = step.startedAt + stepDuration(step, now)
        const decodeStart = step.startedAt + (step.ttftMs ?? stepEnd - step.startedAt)
        const first = step.tools[0]
        const sameName = step.tools.every((tool) => tool.name === first?.name)
        const label = first
          ? `${first.name}${step.tools.length > 1 ? (sameName ? ` ×${step.tools.length}` : ` 等 ${step.tools.length} 个`) : ''}`
          : ''
        return (
          <div key={step.step} className={cn(GRID, 'min-h-[30px]')}>
            <span className="flex items-baseline gap-2.5 overflow-hidden whitespace-nowrap">
              <span className="text-muted w-14 shrink-0 font-mono text-xs">
                Step {step.step + 1}
              </span>
              <span
                className={cn(
                  'truncate font-mono text-xs font-medium',
                  first && WRITE_TOOLS.has(first.name) && 'text-accent',
                )}
              >
                {label}
              </span>
            </span>
            <span className="border-line relative h-[30px] border-l">
              {ticks.slice(1).map((t) => (
                <span
                  key={t}
                  className="border-line absolute inset-y-0 border-l border-dashed opacity-70"
                  style={{ left: `${(t / domainMs) * 100}%` }}
                />
              ))}
              <span
                className="hatch absolute top-[9px] h-3 min-w-0.5 rounded-[2px]"
                style={{
                  left: pct(step.startedAt),
                  width: `${((decodeStart - step.startedAt) / domainMs) * 100}%`,
                }}
              />
              {step.decodeMs !== undefined && (
                <span
                  className="bg-accent absolute top-[9px] h-3 min-w-0.5 rounded-[2px]"
                  style={{ left: pct(decodeStart), width: `${(step.decodeMs / domainMs) * 100}%` }}
                >
                  {step.decodeMs === longest && step.decodeMs / domainMs > 0.3 && (
                    <span className="text-surface absolute inset-0 flex items-center justify-center text-[11px] whitespace-nowrap">
                      输出 {formatCount(step.assistant?.usage?.output ?? 0)} token ·{' '}
                      {formatSeconds(step.decodeMs)}
                    </span>
                  )}
                </span>
              )}
              {step.endedAt !== undefined && (
                <span
                  className="bg-fg absolute top-[7px] h-4 w-0.5"
                  style={{ left: pct(step.endedAt) }}
                />
              )}
              {validation && (
                <span
                  className={cn(
                    'absolute top-2.5 size-2.5 translate-x-1 rotate-45',
                    FIN[verdictTone(validation)],
                  )}
                  style={{ left: pct(stepEnd) }}
                  title={`第 ${validation.attempt} 次 Finish`}
                />
              )}
            </span>
            <span className="tabular text-right font-mono text-xs">
              {step.assistant?.usage ? formatCount(step.assistant.usage.output) : '—'}
            </span>
            <span className="tabular text-right font-mono text-xs">
              {step.assistant?.costUsd === undefined ? '—' : formatUsd(step.assistant.costUsd)}
            </span>
          </div>
        )
      })}
    </section>
  )
}
