import type { TrajectoryEventMap } from '@guoba-wiki-agent/trajectory'

import { formatSeconds, formatUsd } from './format.ts'

/** 触及的上限（ADR 0012），例如「Step 数 40 / 40」。 */
export function limitText(hit: TrajectoryEventMap['limit/hit']): string {
  if (hit.limit === 'steps') return `Step 数 ${hit.value} / ${hit.max}`
  if (hit.limit === 'duration')
    return `时长 ${formatSeconds(hit.value)} / ${formatSeconds(hit.max)}`
  return `费用 ${formatUsd(hit.value)} / ${formatUsd(hit.max)}`
}
