const STEPS_S = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800]

/** 时间轴的刻度：不超过 maxTicks 格，刻度取整秒数；domain 是最后一个刻度。 */
export function timeTicks(durationMs: number, maxTicks = 10): { stepMs: number; domainMs: number } {
  const seconds = Math.max(durationMs, 1) / 1000
  const step = STEPS_S.find((s) => seconds / s <= maxTicks) ?? STEPS_S.at(-1) ?? 1
  const stepMs = step * 1000
  return { stepMs, domainMs: Math.ceil(Math.max(durationMs, 1) / stepMs) * stepMs }
}

export function formatTick(ms: number): string {
  return ms % 1000 === 0 ? `${ms / 1000} s` : `${(ms / 1000).toFixed(1)} s`
}
