import type { StepView } from '@guoba-wiki-agent/trajectory'
import { LoaderCircle } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { Button } from '@/components/ui/button'
import { formatClock, formatCount, formatDuration, formatSeconds } from '@/lib/format'
import {
  replyText,
  stepDuration,
  thinkingText,
  toolTime,
  verdictText,
  verdictTone,
} from '@/lib/steps'
import { cn } from '@/lib/utils'

import { useRun } from './context.ts'
import { ToolCall } from './tool-call.tsx'

const TONE = { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad' } as const

/** 选中 Step 的详情：时延与用量、思考（默认折叠）、回复、工具调用、Finish 校验。 */
export function StepDetail({ step, now }: { step: StepView; now: number }) {
  const { t0, open } = useRun()
  const reply = step.assistant
  const generating = open && !reply && step.endedAt === undefined && step.attempts.length === 0
  const usage = reply?.usage
  const metrics: [string, string][] = [
    ['等待首字', step.ttftMs === undefined ? '—' : formatSeconds(step.ttftMs)],
    ['生成', step.decodeMs === undefined ? '—' : formatSeconds(step.decodeMs)],
    ['工具', formatDuration(toolTime(step))],
    ['stop', reply?.stopReason ?? '—'],
    ['输入', usage ? formatCount(usage.input) : '—'],
    ['输出', usage ? formatCount(usage.output) : '—'],
    ['缓存命中', usage ? formatCount(usage.cacheRead) : '—'],
    ['费用', reply?.costUsd === undefined ? '—' : `$${reply.costUsd.toFixed(5)}`],
  ]
  const end = step.endedAt === undefined ? '' : ` → ${formatClock(step.endedAt - t0)}`
  return (
    <div className="grid content-start gap-4 px-[18px] pt-3.5 pb-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <h4 className="text-base font-semibold">Step {step.step + 1}</h4>
        <span className="text-muted font-mono">
          Turn {step.turn} · {formatClock(step.startedAt - t0)}
          {end} · {formatSeconds(stepDuration(step, now))}
        </span>
      </div>
      {generating ? (
        <div className="border-accent bg-accent-bg flex gap-3 rounded-lg border border-dashed p-3.5">
          <LoaderCircle className="text-accent mt-0.5 size-4 shrink-0 motion-safe:animate-spin" />
          <div>
            <b className="font-semibold">模型正在生成</b>
            <p className="text-muted mt-1 max-w-[60ch]">
              Trajectory 在一次回复结束时才写入 assistant
              消息，所以生成中只显示计时。回复结束后，思考、文字和工具调用会一起出现在这里。
            </p>
          </div>
        </div>
      ) : (
        <dl className="border-line-soft bg-bg grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg border px-3.5 py-3 sm:grid-cols-4">
          {metrics.map(([label, value]) => (
            <div key={label} className="grid gap-px">
              <dt className="text-faint text-[11px]">{label}</dt>
              <dd className="tabular font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {step.attempts.map((attempt) => (
        <p key={attempt.at} className="bg-bad-bg text-bad rounded-md px-3 py-2">
          模型请求未完成：{attempt.error}
        </p>
      ))}
      <Thinking text={thinkingText(step)} />
      {reply && (
        <Section
          label="回复"
          note={`${step.tools.length} 个工具调用${replyText(step) ? '' : '，没有文字'}`}
        >
          {replyText(step) && <p className="whitespace-pre-wrap">{replyText(step)}</p>}
          {step.tools.length > 0 && (
            <div className="border-line-soft overflow-hidden rounded-lg border">
              {step.tools.map((tool) => (
                <ToolCall key={tool.callId} tool={tool} />
              ))}
            </div>
          )}
        </Section>
      )}
      {step.validations.map((validation) => (
        <Section
          key={validation.attempt}
          label={`第 ${validation.attempt} 次 Finish 校验`}
          note={verdictText(validation)}
          noteClass={TONE[verdictTone(validation)]}
        >
          {[...validation.invariants, ...validation.warnings].map((finding) => (
            <p
              key={`${finding.rule}${finding.path ?? ''}${finding.message}`}
              className={cn(
                'rounded-md px-3 py-1.5',
                finding.level === 'invariant' ? 'bg-bad-bg' : 'bg-warn-bg',
              )}
            >
              <span
                className={cn(
                  'mr-2.5 font-mono text-[11px] font-medium',
                  finding.level === 'invariant' ? 'text-bad' : 'text-warn',
                )}
              >
                {finding.rule}
              </span>
              {finding.path && <span className="font-mono text-xs">{finding.path}：</span>}
              {finding.message}
            </p>
          ))}
        </Section>
      ))}
    </div>
  )
}

/** 思考默认折叠：显示字数和开头两行（设计确认项 3）。 */
function Thinking({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null
  return (
    <Section
      label="思考"
      note={`${formatCount(text.length)} 字`}
      action={
        <Button onClick={() => setExpanded(!expanded)}>{expanded ? '收起' : '展开全部'}</Button>
      }
    >
      <div className="border-line bg-bg text-muted rounded-r-md border-l-2 px-3 py-2.5 leading-relaxed">
        <p className={cn('whitespace-pre-wrap', !expanded && 'line-clamp-2')}>{text}</p>
      </div>
    </Section>
  )
}

function Section(props: {
  label: string
  note?: string
  noteClass?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="grid min-w-0 gap-2">
      <div className="flex items-baseline gap-2 text-xs font-semibold">
        {props.label}
        {props.note && (
          <span className={cn('text-muted font-normal', props.noteClass)}>{props.note}</span>
        )}
        {props.action && <span className="ml-auto font-normal">{props.action}</span>}
      </div>
      {props.children}
    </section>
  )
}
