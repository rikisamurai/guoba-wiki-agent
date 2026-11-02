import type { ToolView } from '@guoba-wiki-agent/trajectory'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { PathText } from '@/components/path-text'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/format'
import { argFields, argHint, writeSummary } from '@/lib/steps'
import { cn } from '@/lib/utils'

import { ToolName } from './ledger-rows.tsx'

const CODE =
  'm-0 rounded-md bg-sunken px-2.5 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words'

/** 一个工具调用：折叠时一行，展开后是参数、结果与 Staging 写入。 */
export function ToolCall({ tool, defaultOpen = false }: { tool: ToolView; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const hint = argHint(tool.arguments)
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <div className={cn('border-line-soft border-b last:border-b-0', open && 'bg-bg')}>
      <Button
        variant="row"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="grid grid-cols-[14px_auto_minmax(0,1fr)_auto_48px] items-center gap-2.5 px-3 py-1.5"
      >
        <Icon className="text-faint size-3.5" />
        <ToolName name={tool.name} />
        {hint.includes('/') ? (
          <PathText path={hint} className="text-xs" />
        ) : (
          <span className="text-muted truncate font-mono text-xs">{hint}</span>
        )}
        <span
          className={cn(
            'text-muted font-mono text-[11px] whitespace-nowrap',
            tool.result?.isError && 'text-bad',
          )}
        >
          {tool.result?.isError ? '出错' : writeSummary(tool)}
        </span>
        <span className="tabular text-muted text-right font-mono text-[11px]">
          {tool.result?.durationMs === undefined ? '' : formatDuration(tool.result.durationMs)}
        </span>
      </Button>
      {open && (
        <div className="border-line-soft grid gap-1.5 border-t py-2 pr-3 pl-9">
          <div className="text-faint text-[11px]">参数</div>
          {argFields(tool.arguments).map((field) => (
            <div key={field.key} className="grid gap-1">
              <span className="text-muted font-mono text-[11px]">{field.key}</span>
              <pre className={cn(CODE, 'max-h-80 overflow-auto')}>{field.value}</pre>
            </div>
          ))}
          <div className="text-faint text-[11px]">结果</div>
          <pre
            className={cn(
              CODE,
              'max-h-80 overflow-auto',
              tool.result?.isError ? 'text-bad' : 'text-ok',
            )}
          >
            {tool.result ? tool.result.content : '（还没有结果）'}
          </pre>
          {tool.writes.length > 0 && (
            <>
              <div className="text-faint text-[11px]">Staging</div>
              {tool.writes.map((write) => (
                <div key={write.afterHash + write.op} className="font-mono text-xs">
                  {write.op} · 写入前{' '}
                  <span className="text-muted">
                    {write.beforeHash ? shortHash(write.beforeHash) : '（新文件）'}
                  </span>
                  {' → '}写入后 {shortHash(write.afterHash)} · {write.bytes.toLocaleString('en-US')}{' '}
                  字节
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function shortHash(hash: string): string {
  return hash.length > 24 ? `${hash.slice(0, 15)}…${hash.slice(-7)}` : hash
}
