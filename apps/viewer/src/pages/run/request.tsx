import { Link, getRouteApi } from '@tanstack/react-router'

import { formatCount } from '@/lib/format'
import { splitSystemPrompt } from '@/lib/prompt'
import { WRITE_TOOLS } from '@/lib/status'
import { cn } from '@/lib/utils'

import { useRun } from './context.ts'

const route = getRouteApi('/runs/$runId/request')
const CODE =
  'm-0 rounded-md bg-sunken px-3 py-2.5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-words'

/** 请求：模型实际看到的 system prompt（按 ADR 0018 分段）、工具 Schema 与 run/start 快照。 */
export function RequestPage() {
  const { ledger, runId } = useRun()
  const { part = 's0' } = route.useSearch()
  const header = ledger.headers.at(-1)
  const start = ledger.start
  if (!header || !start) return <p className="text-muted p-6">这次 Run 没有记录请求头。</p>

  const sections = splitSystemPrompt(header.systemPrompt)
  const largest = Math.max(...sections.map((s) => s.text.length))
  const tool = part.startsWith('t:') ? header.tools.find((t) => `t:${t.name}` === part) : undefined
  const sectionIndex = tool ? -1 : Number(part.slice(1)) || 0
  const section = sections[sectionIndex]
  const total = sections.reduce((sum, s) => sum + s.text.length, 0)
  const snapshot: [string, string][] = [
    ['模型', `${start.model.provider} / ${start.model.id} · thinking ${start.thinkingLevel}`],
    [
      '价格 $/M token',
      start.pricing
        ? `输入 ${start.pricing.input} · 输出 ${start.pricing.output} · 缓存 ${start.pricing.cacheRead}`
        : '未知',
    ],
    ['wiki-agent', start.versions.wikiAgent ?? '未知'],
    ['Pi', start.versions.pi],
    [
      'Vault git',
      start.vaultGit
        ? `${start.vaultGit.head.slice(0, 7)}${start.vaultGit.dirty ? '（有未提交改动）' : ''}`
        : '不是 git 仓库',
    ],
    [
      'Skill hash',
      Object.entries(start.skillHashes)
        .map(([name, hash]) => `${name} ${hash.replace('sha256:', '').slice(0, 8)}…`)
        .join(' · '),
    ],
  ]
  const link = (target: string, className: string, children: React.ReactNode) => (
    <Link
      to="/runs/$runId/request"
      params={{ runId }}
      search={{ part: target }}
      className={className}
    >
      {children}
    </Link>
  )

  return (
    <div className="grid min-h-0 flex-1 md:grid-cols-[360px_minmax(0,1fr)]">
      <div className="border-line bg-surface grid min-h-0 content-start gap-2 overflow-auto px-4 pt-3.5 pb-4 md:border-r">
        <Label text="System prompt" note={`${formatCount(total)} 字 · ${sections.length} 段`} />
        {sections.map((s, index) =>
          link(
            `s${index}`,
            cn(
              'grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-0.5 rounded-md px-2 py-1.5',
              index === sectionIndex ? 'bg-accent-bg' : 'hover:bg-bg',
            ),
            <>
              <span className="truncate">{s.title}</span>
              <span className="tabular text-muted text-right font-mono text-[11px]">
                {formatCount(s.text.length)} 字
              </span>
              <span className="bg-sunken col-span-2 h-1 overflow-hidden rounded-sm">
                <span
                  className={cn('block h-full', index === sectionIndex ? 'bg-accent' : 'bg-faint')}
                  style={{ width: `${(s.text.length / largest) * 100}%` }}
                />
              </span>
            </>,
          ),
        )}
        <Label text="工具" note={`${header.tools.length} 个`} />
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-2">
          {header.tools.map((t) =>
            link(
              `t:${t.name}`,
              cn(
                'font-mono text-xs font-medium hover:underline',
                WRITE_TOOLS.has(t.name) && 'text-accent',
                tool?.name === t.name && 'underline',
              ),
              t.name,
            ),
          )}
        </div>
        <Label text="run/start 快照" />
        {snapshot.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[96px_minmax(0,1fr)] gap-2.5 px-2 py-0.5 text-xs"
          >
            <span className="text-faint">{label}</span>
            <span className="font-mono text-[11.5px] [overflow-wrap:anywhere]">{value}</span>
          </div>
        ))}
      </div>
      <div className="grid min-h-0 min-w-0 content-start gap-2.5 overflow-auto px-[18px] pt-3.5 pb-5">
        {tool ? (
          <>
            <h4 className="font-mono text-base font-semibold">{tool.name}</h4>
            <p className="text-muted">{tool.description}</p>
            <pre className={CODE}>{JSON.stringify(tool.parameters, null, 2)}</pre>
          </>
        ) : (
          section && (
            <>
              <div className="flex flex-wrap items-baseline gap-3">
                <h4 className="text-base font-semibold">{section.title}</h4>
                <span className="text-muted">
                  第 {sectionIndex + 1} 段 · {formatCount(section.text.length)} 字
                </span>
              </div>
              <pre className={CODE}>{section.text}</pre>
            </>
          )
        )}
      </div>
    </div>
  )
}

function Label({ text, note }: { text: string; note?: string }) {
  return (
    <div className="mt-2 flex items-baseline gap-2 text-xs font-semibold first:mt-0">
      {text}
      {note && <span className="text-muted font-normal">{note}</span>}
    </div>
  )
}
