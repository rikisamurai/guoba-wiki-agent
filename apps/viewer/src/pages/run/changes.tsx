import type { Finding } from '@guoba-wiki-agent/trajectory'
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router'

import { PathText } from '@/components/path-text'
import { Badge } from '@/components/ui/badge'
import { parseDiff } from '@/lib/diff'
import { cn } from '@/lib/utils'

import { useRun } from './context.ts'
import { DiffView } from './diff-view.tsx'

const route = getRouteApi('/runs/$runId/changes')

/** 变更：某个 Turn 结束时 Staging 的全部变更（proposal/diff），左边文件列表，右边 diff 与相关的 Invariant / Warning。 */
export function ChangesPage() {
  const { ledger, runId } = useRun()
  const search = route.useSearch()
  const navigate = useNavigate()
  const turns = ledger.turns.filter((turn) => turn.proposal)
  const turn = turns.find((t) => t.turn === search.turn) ?? turns.at(-1)
  const files = (turn?.proposal ?? []).map((file) => {
    const { rows, added, removed } = parseDiff(file.diff)
    return { path: file.path, created: file.created, rows, added, removed }
  })
  if (!turn) return <p className="text-muted p-6">这次 Run 没有产生 Proposal。</p>

  const validation = turn.entries
    .flatMap((e) => (e.kind === 'step' ? e.step.validations : []))
    .at(-1)
  const findings: Finding[] = validation ? [...validation.invariants, ...validation.warnings] : []
  const forFile = (path?: string) => findings.filter((finding) => finding.path === path)
  const file = files.find((f) => f.path === search.file) ?? files.find((f) => f.created) ?? files[0]
  const created = files.filter((f) => f.created).length
  const isLast = turn === ledger.turns.at(-1)
  const apply = isLast ? ledger.apply : undefined
  const groups = [
    { label: '修改', items: files.filter((f) => !f.created) },
    { label: '新建', items: files.filter((f) => f.created) },
  ]

  return (
    <>
      <div className="border-line bg-surface flex shrink-0 flex-wrap items-center gap-3.5 border-b px-[18px] py-2.5">
        <span>Turn {turn.turn} 的 Proposal</span>
        {turns.length > 1 && (
          <select
            aria-label="选择 Turn"
            value={turn.turn}
            onChange={(event) =>
              void navigate({
                to: '/runs/$runId/changes',
                params: { runId },
                search: { turn: Number(event.target.value) },
              })
            }
            className="border-line bg-surface rounded-md border px-2 font-mono text-xs"
          >
            {turns.map((t) => (
              <option key={t.turn} value={t.turn}>
                Turn {t.turn}
              </option>
            ))}
          </select>
        )}
        <span className="text-muted">
          新建 {created} · 修改 {files.length - created} · +{files.reduce((s, f) => s + f.added, 0)}{' '}
          −{files.reduce((s, f) => s + f.removed, 0)} 行
        </span>
        <span className="flex-1" />
        {validation && <span className="text-muted">Invariant {validation.invariants.length}</span>}
        {validation && (
          <span
            className={cn('text-muted', validation.warnings.length > 0 && 'text-warn font-medium')}
          >
            Warning {validation.warnings.length}
          </span>
        )}
        {apply && (
          <Badge
            tone={
              apply.written.length > 0 &&
              apply.conflicts.length + apply.failed.length + apply.invariants.length === 0
                ? 'ok'
                : 'bad'
            }
          >
            {apply.conflicts.length > 0 || apply.invariants.length > 0
              ? '写入被拒'
              : `已写入 · ${new Date(apply.at).toLocaleTimeString('zh-CN', { hour12: false })}`}
          </Badge>
        )}
      </div>
      <div className="grid min-h-0 flex-1 md:grid-cols-[330px_minmax(0,1fr)]">
        <nav
          className="border-line bg-surface min-h-0 overflow-auto pb-2.5 md:border-r"
          aria-label="变更的文件"
        >
          <FindingList findings={forFile(undefined)} />
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <div key={group.label}>
                <div className="px-3.5 pt-2.5 pb-1 text-xs font-semibold">
                  {group.label} <span className="text-muted font-normal">{group.items.length}</span>
                </div>
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to="/runs/$runId/changes"
                    params={{ runId }}
                    search={{ turn: turn.turn, file: item.path }}
                    className={cn(
                      'grid grid-cols-[14px_minmax(0,1fr)_8px_auto] items-center gap-2 px-3.5 py-1',
                      item.path === file?.path ? 'bg-accent-bg' : 'hover:bg-bg',
                    )}
                  >
                    <span
                      className={cn(
                        'font-mono font-semibold',
                        item.created ? 'text-ok' : 'text-warn',
                      )}
                    >
                      {item.created ? '+' : '~'}
                    </span>
                    <PathText path={item.path} className="text-xs" />
                    <span
                      className={cn(
                        'size-[7px] rounded-full',
                        forFile(item.path).length > 0 && 'bg-warn',
                      )}
                    />
                    <span className="tabular text-ok font-mono text-[11px]">
                      +{item.added}
                      {item.removed > 0 && <span className="text-bad ml-1">−{item.removed}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            ),
          )}
        </nav>
        {file && (
          <div className="grid min-h-0 min-w-0 content-start gap-2.5 overflow-auto px-[18px] pt-3.5 pb-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <PathText path={file.path} className="text-[13px]" />
              <Badge tone={file.created ? 'ok' : 'warn'}>{file.created ? '新建' : '修改'}</Badge>
              <span className="text-muted font-mono whitespace-nowrap">
                +{file.added} −{file.removed} 行
              </span>
            </div>
            <FindingList findings={forFile(file.path)} />
            <DiffView rows={file.rows} />
          </div>
        )}
      </div>
    </>
  )
}

function FindingList({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return null
  return (
    <div className="grid gap-1.5 p-2">
      {findings.map((finding) => (
        <p
          key={`${finding.rule}${finding.message}`}
          className={cn(
            'flex items-baseline gap-2.5 rounded-md px-3 py-1.5 text-[12.5px]',
            finding.level === 'invariant' ? 'bg-bad-bg' : 'bg-warn-bg',
          )}
        >
          <span
            className={cn(
              'font-mono text-[11px] font-medium',
              finding.level === 'invariant' ? 'text-bad' : 'text-warn',
            )}
          >
            {finding.rule}
          </span>
          {finding.message}
        </p>
      ))}
    </div>
  )
}
