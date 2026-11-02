import { performance } from 'node:perf_hooks'

import type { Limits } from './config.ts'

export interface LimitHit {
  limit: 'steps' | 'duration' | 'cost'
  value: number
  max: number
}

/**
 * 每个 Run 的上限（ADR 0012）。Revise 与原 Turn 共用同一份额度（ADR 0013）；
 * 时长只累计 Agent 实际运行的时间，不含等待用户确认的时间。
 */
export class Budget {
  readonly limits: Limits
  steps = 0
  costUsd = 0
  activeMs = 0

  constructor(limits: Limits) {
    this.limits = limits
  }

  /** 一个 Step 结束后调用，超过 Step 数或费用上限时返回命中的上限。 */
  addStep(costUsd: number): LimitHit | undefined {
    this.steps += 1
    this.costUsd += costUsd
    if (this.steps >= this.limits.steps)
      return { limit: 'steps', value: this.steps, max: this.limits.steps }
    if (this.costUsd > this.limits.costUsd)
      return { limit: 'cost', value: this.costUsd, max: this.limits.costUsd }
    return undefined
  }

  get remainingMs(): number {
    return Math.max(0, this.limits.durationMs - this.activeMs)
  }

  /** 计时执行一个 Turn：累计实际运行时间，超出剩余时长时调用 onExpire。 */
  async timed(run: () => Promise<void>, onExpire: (hit: LimitHit) => void): Promise<void> {
    const started = performance.now()
    const timer = setTimeout(() => {
      const value = this.activeMs + performance.now() - started
      onExpire({ limit: 'duration', value, max: this.limits.durationMs })
    }, this.remainingMs)
    try {
      await run()
    } finally {
      clearTimeout(timer)
      this.activeMs += performance.now() - started
    }
  }
}
