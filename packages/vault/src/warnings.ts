import path from 'node:path'

import { type LinkIndex, isNoteTarget } from './links.ts'
import { extractWikilinks, parseFrontmatter } from './markdown.ts'
import type { Change, Finding } from './types.ts'

const REQUIRED_FIELDS = ['title', 'tags', 'date', 'sources', 'last-ingested', 'status'] as const
const MAX_TAGS = 3
const MIN_OUTLINKS = 2
const MAX_NEW_PAGES = 15

export interface IngestWarningContext {
  links: LinkIndex
  /** Task Skill 列出的 Wiki Page 目录，例如 `frontend/ui-libraries`（见 skillDomains）。 */
  domains: ReadonlySet<string>
}

/**
 * ingest Skill 中的内容规范（ADR 0006 的 Warning）。只提示，不阻止 Apply。
 * 规则文字以 Vault 的 SKILL.md 为准，这里只是机械可查的那部分。
 */
export function checkIngestWarnings(
  changes: readonly Change[],
  context: IngestWarningContext,
): Finding[] {
  const findings: Finding[] = []
  const add = (rule: string, message: string, file?: string) =>
    findings.push({ level: 'warning', rule, message, ...(file !== undefined && { path: file }) })

  const pages = changes.filter((change) => isWikiPage(change.path))
  const created = pages.filter((change) => change.base === null)
  if (created.length > MAX_NEW_PAGES)
    add('max-pages', `本次新建了 ${created.length} 个页面，超过 ${MAX_NEW_PAGES} 个`)

  for (const page of pages) {
    const frontmatter = parseFrontmatter(page.next)
    if (!frontmatter.ok && page.base !== null && !parseFrontmatter(page.base).ok) {
      add('frontmatter-parse', `frontmatter 原本就无法解析：${frontmatter.error}`, page.path)
    }
    const data = frontmatter.ok ? (frontmatter.data ?? {}) : null
    if (data) {
      const missing = REQUIRED_FIELDS.filter((field) => !(field in data))
      if (missing.length > 0)
        add('frontmatter-fields', `frontmatter 缺少 ${missing.join('、')}`, page.path)
      const tags = data['tags']
      if (Array.isArray(tags) && tags.length > MAX_TAGS)
        add('max-tags', `有 ${tags.length} 个 tags，最多 ${MAX_TAGS} 个`, page.path)
    }

    const outlinks = countOutlinks(page, context.links)
    if (outlinks < MIN_OUTLINKS)
      add('min-outlinks', `只有 ${outlinks} 条出链，至少需要 ${MIN_OUTLINKS} 条`, page.path)

    // 新页面必须放在 Skill 列出的目录内（ADR 0006）。读不到目录列表时不检查，避免每个页面都误报
    const dir = path.posix.dirname(page.path).slice('wiki/'.length)
    if (page.base === null && context.domains.size > 0 && !isListed(dir, context.domains)) {
      add('new-domain', `${dir} 不在 Skill 列出的目录里`, page.path)
    }
  }
  return findings
}

/**
 * Task Skill 中列出的 Wiki Page 目录，即形如 ``- `frontend/web-platform/`：运行时与 DOM API`` 的行。
 * 目录本身和它的子目录都算在列表内。
 */
export function skillDomains(skillText: string): Set<string> {
  const domains = new Set<string>()
  for (const match of skillText.matchAll(/^\s*-\s+`([\w-]+(?:\/[\w-]+)*)\/`[：:]/gm)) {
    if (match[1]) domains.add(match[1])
  }
  return domains
}

function isListed(dir: string, domains: ReadonlySet<string>): boolean {
  for (const domain of domains) if (dir === domain || dir.startsWith(`${domain}/`)) return true
  return false
}

function isWikiPage(file: string): boolean {
  return file.startsWith('wiki/') && file.endsWith('.md') && !file.startsWith('wiki/_orphans/')
}

/** 正文中指向其他页面的不同链接数（Vault lint 口径：不含 frontmatter，不含自链接）。 */
function countOutlinks(page: Change, links: LinkIndex): number {
  const targets = new Set<string>()
  for (const { target } of extractWikilinks(page.next, { frontmatter: false })) {
    if (!isNoteTarget(target)) continue
    const resolved = links.resolve(target)
    if (resolved && resolved !== page.path) targets.add(resolved)
  }
  return targets.size
}
