import { styleText } from 'node:util'

import type { Finding } from '@guoba-wiki-agent/trajectory'

export function formatFinding(finding: Finding): string {
  return `  - [${finding.rule}] ${finding.path ? `${finding.path}：` : ''}${finding.message}`
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} 秒`
}

export function formatUsd(usd: number): string {
  return `$${usd.toFixed(4)}`
}

/** 给 unified diff 上色；输出不是终端或设置了 NO_COLOR 时 styleText 原样返回。 */
export function colorDiff(diff: string): string {
  return diff
    .split('\n')
    .map((line) => {
      if (line.startsWith('+++') || line.startsWith('---')) return styleText('bold', line)
      if (line.startsWith('+')) return styleText('green', line)
      if (line.startsWith('-')) return styleText('red', line)
      if (line.startsWith('@@')) return styleText('cyan', line)
      return line
    })
    .join('\n')
}
