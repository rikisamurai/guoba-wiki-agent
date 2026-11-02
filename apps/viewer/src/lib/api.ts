import type { RunSummary } from '@guoba-wiki-agent/trajectory'

/** `GET /api/runs` 的一项（apps/cli/src/view/runs.ts）。无法解析的 Run 只有 error。 */
export type RunListItem = { id: string; summary: RunSummary } | { id: string; error: string }

export async function fetchRuns(): Promise<RunListItem[]> {
  const response = await fetch('/api/runs')
  if (!response.ok) throw new Error(`读取 Run 列表失败：HTTP ${response.status}`)
  const body: { runs: RunListItem[] } = await response.json()
  return body.runs
}

export function streamUrl(runId: string): string {
  return `/api/runs/${encodeURIComponent(runId)}/stream`
}
