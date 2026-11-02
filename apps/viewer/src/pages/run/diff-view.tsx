import type { DiffRow } from '@/lib/diff'
import { cn } from '@/lib/utils'

const ROW_CLASS: Record<DiffRow['kind'], string> = {
  add: 'bg-add-bg',
  del: 'bg-del-bg',
  ctx: '',
  hunk: 'bg-sunken text-muted',
  meta: 'text-faint',
}
const MARK: Record<DiffRow['kind'], string> = { add: '+', del: '-', ctx: ' ', hunk: '', meta: '' }

/** 一个文件的 diff，行号取新文件的行号（删除行取旧行号）。 */
export function DiffView({ rows }: { rows: DiffRow[] }) {
  return (
    <div className="border-line-soft bg-surface overflow-x-auto rounded-lg border font-mono text-xs">
      {rows.map((row) => (
        <div
          key={row.id}
          className={cn(
            'grid min-w-max grid-cols-[40px_16px_minmax(0,1fr)] leading-5',
            ROW_CLASS[row.kind],
          )}
        >
          <span className="tabular text-faint pr-2 text-right text-[11px]">
            {row.newNo ?? row.oldNo ?? ''}
          </span>
          <span className={cn(row.kind === 'add' && 'text-ok', row.kind === 'del' && 'text-bad')}>
            {MARK[row.kind]}
          </span>
          <span className="pr-3 whitespace-pre">{row.text || ' '}</span>
        </div>
      ))}
    </div>
  )
}
