import { cpSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  type AssistantMessage,
  type FauxResponseStep,
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from '@earendil-works/pi-ai'
import { type AnyTrajectoryEvent, findSeqGap } from '@guoba-wiki-agent/trajectory'
import { readTrajectoryFile } from '@guoba-wiki-agent/trajectory/node'

import { type Limits, type Run, resolveConfig, startRun } from '../src/index.ts'

export const FIXTURE_VAULT = path.resolve(import.meta.dirname, '../../../fixtures/vault')

export const SOURCE = 'sources/posts/obsidian/obsidian/obsidian-claude/skills.md'
export const PAGE = 'wiki/frontend/web-platform/obsidian-skills.md'
/** 2026-11-02 08:00 UTC，即上海时间 16:00。 */
export const T0 = Date.UTC(2026, 10, 2, 8, 0, 0)

export interface Harness {
  run: Run
  vault: string
  faux: ReturnType<typeof fauxProvider>
  events: () => AnyTrajectoryEvent[]
}

export function startFauxRun(
  responses: FauxResponseStep[],
  options: {
    limits?: Partial<Limits>
    tokensPerSecond?: number
    /** 美元 / 百万 token；faux 自己估算 token 数，费用由 wiki-agent 按价格计算。 */
    pricePerMillion?: number
    onEvent?: (event: AnyTrajectoryEvent) => void
  } = {},
): Harness {
  const root = mkdtempSync(path.join(tmpdir(), 'agent-'))
  const vault = path.join(root, 'vault')
  cpSync(FIXTURE_VAULT, vault, { recursive: true, verbatimSymlinks: true })
  const config = resolveConfig(
    {
      vault,
      runsDir: path.join(root, '.runs'),
      timeZone: 'Asia/Shanghai',
      tasks: {
        ingest: {
          writeScope: [
            { path: 'wiki/**', exclude: ['wiki/_orphans/**'] },
            { path: 'index.md' },
            { path: 'log.md', mode: 'append-only' },
            { path: 'sources/**', mode: 'frontmatter-fields', fields: ['ingested-at'] },
          ],
          catalog: ['obsidian-markdown'],
          warnings: 'ingest',
          ...(options.limits && { limits: options.limits }),
        },
      },
    },
    root,
  )
  const price = options.pricePerMillion
  const faux = fauxProvider({
    ...(options.tokensPerSecond && { tokensPerSecond: options.tokensPerSecond }),
    ...(price !== undefined && {
      models: [
        {
          id: 'faux-priced',
          cost: { input: price, output: price, cacheRead: price, cacheWrite: price },
        },
      ],
    }),
  })
  const models = createModels()
  models.setProvider(faux.provider)
  faux.setResponses(responses)
  let clock = T0
  const run = startRun({
    config,
    task: 'ingest',
    source: SOURCE,
    model: faux.getModel(),
    streamFn: models.streamSimple.bind(models),
    now: () => clock++,
    ...(options.onEvent && { onEvent: options.onEvent }),
  })
  const events = () => {
    const parsed = readTrajectoryFile(path.join(run.dir, 'trajectory.jsonl')).events
    if (findSeqGap(parsed)) throw new Error('trajectory seq is not contiguous')
    return parsed
  }
  return { run, vault, faux, events }
}

/** 一次只调用一个工具的回复。 */
export const call = (name: string, args: Record<string, string>): AssistantMessage =>
  fauxAssistantMessage([fauxToolCall(name, args)], { stopReason: 'toolUse' })

export const finish = (): AssistantMessage => call('finish', { summary: '完成' })

export function wikiPage(links: string[]): string {
  return [
    '---',
    'title: Obsidian Skills',
    'tags: [obsidian, agent-skills]',
    'date: 2026-11-02',
    'sources:',
    `  - "[[${SOURCE.replace(/\.md$/, '')}]]"`,
    'last-ingested: 2026-11-02',
    'status: draft',
    '---',
    '',
    'Obsidian 官方维护的 Agent Skills 集合。',
    '',
    links.map((link) => `[[${link}]]`).join('、'),
    '',
  ].join('\n')
}

/** 一次合规的 ingest：写页面、更新 index、追加 log、标记 Source，然后 finish。 */
export function validIngest(): AssistantMessage[] {
  return [
    call('write_file', { path: PAGE, content: wikiPage(['mutation-observer', 'resize-observer']) }),
    call('edit_file', {
      path: 'index.md',
      old: '- [[wiki/frontend/web-platform/resize-observer|ResizeObserver]]',
      new: '- [[wiki/frontend/web-platform/resize-observer|ResizeObserver]]\n- [[wiki/frontend/web-platform/obsidian-skills|Obsidian Skills]]',
    }),
    call('append_file', {
      path: 'log.md',
      text: '\n## [2026-11-02 16:00] ingest | Obsidian Skills\n- 新建：[[wiki/frontend/web-platform/obsidian-skills]]\n',
    }),
    call('edit_file', {
      path: SOURCE,
      old: 'date: 2026-03-12\n',
      new: 'date: 2026-03-12\ningested-at: 2026-11-02\n',
    }),
    finish(),
  ]
}

export function readVault(vault: string, file: string): string {
  return readFileSync(path.join(vault, file), 'utf8')
}

/** 上一条工具结果的文字。 */
export function lastToolResult(messages: readonly { role: string }[]): {
  text: string
  isError: boolean
} {
  const last = messages.findLast((message) => message.role === 'toolResult')
  if (!last || !('content' in last) || !Array.isArray(last.content))
    return { text: '', isError: false }
  const text = last.content.map((part: { text?: string }) => part.text ?? '').join('\n')
  return { text, isError: 'isError' in last && last.isError === true }
}

export function messageText(message: { role: string } | undefined): string {
  if (!message || !('content' in message)) return ''
  const { content } = message
  if (typeof content === 'string') return content
  return Array.isArray(content)
    ? content.map((part: { text?: string }) => part.text ?? '').join('\n')
    : ''
}
