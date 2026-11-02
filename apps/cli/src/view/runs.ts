import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

import {
  type AnyTrajectoryEvent,
  type RunSummary,
  summarizeRun,
} from '@guoba-wiki-agent/trajectory'
import { readTrajectoryFile } from '@guoba-wiki-agent/trajectory/node'

export type RunListItem = { id: string; summary: RunSummary } | { id: string; error: string }

/** runId 形如 2026-11-02T08-53-08Z-c732ff8f；只接受这类字符，避免路径穿越。 */
const RUN_ID = /^[\w-]+$/

export function trajectoryFile(runsDir: string, id: string): string | undefined {
  if (!RUN_ID.test(id)) return undefined
  const file = path.join(runsDir, id, 'trajectory.jsonl')
  return existsSync(file) ? file : undefined
}

/** Run 列表，新的在前。每项由该 Run 的 Trajectory 投影而来；无法解析的 Run 带上错误信息。 */
export function listRuns(runsDir: string): RunListItem[] {
  if (!existsSync(runsDir)) return []
  return readdirSync(runsDir)
    .filter((id) => trajectoryFile(runsDir, id) !== undefined)
    .toSorted()
    .toReversed()
    .map((id): RunListItem => {
      try {
        return { id, summary: summarizeRun(readTrajectoryFile(trajectoryPath(runsDir, id)).events) }
      } catch (error) {
        return { id, error: error instanceof Error ? error.message : String(error) }
      }
    })
}

/** 从 seq = from 开始读取至多 limit 个事件。`next` 为下一页的起点，已读到文件末尾时为 null。 */
export function readEvents(
  file: string,
  from: number,
  limit: number,
): { events: AnyTrajectoryEvent[]; next: number | null } {
  const { events } = readTrajectoryFile(file)
  const page = events.slice(from, from + limit)
  const next = from + page.length
  return { events: page, next: page.length > 0 && next < events.length ? next : null }
}

function trajectoryPath(runsDir: string, id: string): string {
  return path.join(runsDir, id, 'trajectory.jsonl')
}
