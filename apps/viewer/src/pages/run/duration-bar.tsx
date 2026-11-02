import type { StepView } from '@guoba-wiki-agent/trajectory'

import { formatSeconds } from '@/lib/format'
import { stepDuration } from '@/lib/steps'

/** Step 的耗时条：斜纹是等待首字，实色是生成；总长度按本 Run 最长的 Step 等比缩放。 */
export function DurationBar({ step, scale, now }: { step: StepView; scale: number; now: number }) {
  const total = stepDuration(step, now)
  if (!step.assistant && step.endedAt === undefined) {
    return (
      <span className="bg-sunken block h-1.5 overflow-hidden rounded-[3px]">
        <span className="via-accent motion-safe:animate-slide block h-full w-2/5 bg-linear-to-r from-transparent to-transparent" />
      </span>
    )
  }
  const ttft = step.ttftMs ?? 0
  const decode = step.decodeMs ?? 0
  const title = `等待首字 ${formatSeconds(ttft)} · 生成 ${formatSeconds(decode)}`
  return (
    <span className="bg-sunken block h-1.5 overflow-hidden rounded-[3px]" title={title}>
      <span
        className="flex h-full min-w-0.5"
        style={{ width: `${scale > 0 ? (total / scale) * 100 : 0}%` }}
      >
        <span className="hatch" style={{ width: `${total > 0 ? (ttft / total) * 100 : 0}%` }} />
        <span
          className="bg-accent"
          style={{ width: `${total > 0 ? (decode / total) * 100 : 0}%` }}
        />
      </span>
    </span>
  )
}
