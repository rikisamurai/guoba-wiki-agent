import { parse } from 'yaml'

const FRONTMATTER = /^---\r?\n([\s\S]*?\r?\n)?---(?:\r?\n|$)/

export interface SplitMarkdown {
  /** frontmatter 的原文（不含两行 `---`）；没有 frontmatter 时为 null。 */
  frontmatter: string | null
  body: string
}

export function splitFrontmatter(text: string): SplitMarkdown {
  const match = FRONTMATTER.exec(text)
  if (!match) return { frontmatter: null, body: text }
  return { frontmatter: match[1] ?? '', body: text.slice(match[0].length) }
}

export type FrontmatterResult =
  | { ok: true; data: Record<string, unknown> | null }
  | { ok: false; error: string }

/** 解析 frontmatter。没有 frontmatter 时 data 为 null；YAML 错误或顶层不是映射时失败。 */
export function parseFrontmatter(text: string): FrontmatterResult {
  const { frontmatter } = splitFrontmatter(text)
  if (frontmatter === null) return { ok: true, data: null }
  let data: unknown
  try {
    data = parse(frontmatter)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  if (data === null || data === undefined) return { ok: true, data: {} }
  if (typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'frontmatter must be a YAML mapping' }
  }
  return { ok: true, data: Object.fromEntries(Object.entries(data)) }
}

export interface Wikilink {
  /** `[[...]]` 中的原文。 */
  raw: string
  /** 去掉别名、标题、块引用之后的链接目标。 */
  target: string
  embed: boolean
}

/**
 * 提取 wikilink。按 Vault lint 的口径排除代码块、行内代码与 HTML 注释；
 * 兼容 `[[target|label]]` 与表格中的 `[[target\|label]]`。
 */
export function extractWikilinks(text: string, options: { frontmatter: boolean }): Wikilink[] {
  const { frontmatter, body } = splitFrontmatter(text)
  const links: Wikilink[] = []
  if (options.frontmatter && frontmatter !== null) {
    for (const value of frontmatterStrings(frontmatter)) links.push(...scanLinks(value))
  }
  links.push(...scanLinks(stripNonContent(body)))
  return links
}

function scanLinks(content: string): Wikilink[] {
  const links: Wikilink[] = []
  for (const match of content.matchAll(/(!?)\[\[([^\]\n]+)\]\]/g)) {
    const raw = match[2] ?? ''
    const target = linkTarget(raw)
    if (target) links.push({ raw, target, embed: match[1] === '!' })
  }
  return links
}

/**
 * frontmatter 中的链接从解析后的 YAML 字符串值里取，这样 `"…\"…"` 这类转义会被还原
 * （例如 `sources: - "[[为什么你的\"AI 优先\"…]]"`）。YAML 无法解析时退回原文，并还原其中的 `\"`。
 */
function frontmatterStrings(frontmatter: string): string[] {
  let data: unknown
  try {
    data = parse(frontmatter)
  } catch {
    return [frontmatter.replaceAll('\\"', '"')]
  }
  const strings: string[] = []
  const walk = (value: unknown) => {
    if (typeof value === 'string') strings.push(value)
    else if (Array.isArray(value)) value.forEach(walk)
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(data)
  return strings
}

export function linkTarget(raw: string): string {
  const beforeAlias = raw.split('|')[0] ?? ''
  const beforeAnchor = beforeAlias.split('#')[0] ?? ''
  return (beforeAnchor.split('^')[0] ?? '').replace(/\\$/, '').trim()
}

/** 去掉代码块（包括 `> ```` 这种写在引用 / callout 里的）、HTML 注释和行内代码。 */
function stripNonContent(text: string): string {
  return text
    .replaceAll(/^((?:>[ \t]?)*)(```|~~~)[^\n]*\n[\s\S]*?^\1\2[^\n]*$/gm, '')
    .replaceAll(/<!--[\s\S]*?-->/g, '')
    .replaceAll(/`[^`\n]*`/g, '')
}
