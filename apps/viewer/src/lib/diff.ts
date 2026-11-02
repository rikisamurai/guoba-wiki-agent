export interface DiffRow {
  /** 行在 diff 中的序号，用作 key。 */
  id: number
  kind: 'hunk' | 'add' | 'del' | 'ctx' | 'meta'
  text: string
  oldNo?: number
  newNo?: number
}

export interface ParsedDiff {
  rows: DiffRow[]
  added: number
  removed: number
}

/** 解析 packages/vault 的 renderDiff 产生的 unified diff，跳过文件头。 */
export function parseDiff(diff: string): ParsedDiff {
  const rows: DiffRow[] = []
  let added = 0
  let removed = 0
  let oldNo = 0
  let newNo = 0
  let inHunk = false
  const push = (row: Omit<DiffRow, 'id'>) => rows.push({ id: rows.length, ...row })
  for (const line of diff.split('\n')) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (hunk) {
      inHunk = true
      oldNo = Number(hunk[1])
      newNo = Number(hunk[2])
      push({ kind: 'hunk', text: line })
    } else if (!inHunk) {
      continue
    } else if (line.startsWith('+')) {
      added += 1
      push({ kind: 'add', text: line.slice(1), newNo: newNo++ })
    } else if (line.startsWith('-')) {
      removed += 1
      push({ kind: 'del', text: line.slice(1), oldNo: oldNo++ })
    } else if (line.startsWith(' ')) {
      push({ kind: 'ctx', text: line.slice(1), oldNo: oldNo++, newNo: newNo++ })
    } else if (line.startsWith('\\')) {
      push({ kind: 'meta', text: line })
    }
  }
  return { rows, added, removed }
}
