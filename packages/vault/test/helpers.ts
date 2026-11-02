import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { WriteScopeRule } from '../src/index.ts'

export const FIXTURE_VAULT = path.resolve(import.meta.dirname, '../../../fixtures/vault')

/** 每个用例操作自己的 fixture 副本，fixtures/vault 本身保持不变。 */
export function copyFixtureVault(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vault-'))
  cpSync(FIXTURE_VAULT, dir, { recursive: true, verbatimSymlinks: true })
  return dir
}

/** ADR 0008 中 ingest 的 Write Scope。 */
export const INGEST_SCOPE: WriteScopeRule[] = [
  { path: 'wiki/**', exclude: ['wiki/_orphans/**'] },
  { path: 'index.md' },
  { path: 'log.md', mode: 'append-only' },
  { path: 'sources/**', mode: 'frontmatter-fields', fields: ['ingested-at'] },
]

export const NEW_SOURCE = 'sources/posts/obsidian/obsidian/obsidian-claude/skills.md'
export const OVERLAY = 'wiki/frontend/ui-libraries/overlayscrollbars.md'
export const FLASH_LIST = 'wiki/frontend/react-native/flash-list.md'

/** 一个符合 ingest 规范的新页面，正文链接到给定目标。 */
export function wikiPage(
  links: string[],
  options: { tags?: string[]; sources?: string[] } = {},
): string {
  const tags = options.tags ?? ['obsidian']
  const sources = options.sources ?? [NEW_SOURCE.replace(/\.md$/, '')]
  return [
    '---',
    'title: 示例页面',
    `tags: [${tags.join(', ')}]`,
    'date: 2026-11-02',
    'sources:',
    ...sources.map((source) => `  - "[[${source}]]"`),
    'last-ingested: 2026-11-02',
    'status: draft',
    '---',
    '',
    '一句话说明这个概念。',
    '',
    links.map((link) => `[[${link}]]`).join('、'),
    '',
  ].join('\n')
}
