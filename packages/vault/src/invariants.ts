import { type LinkIndex, isNoteTarget } from './links.ts'
import { extractWikilinks, parseFrontmatter } from './markdown.ts'
import { scopeViolation } from './scope.ts'
import type { Change, Finding, WriteScopeRule } from './types.ts'

export interface InvariantContext {
  scope: readonly WriteScopeRule[]
  /** 基于 Vault + Staging 全部文件的链接索引。 */
  links: LinkIndex
}

/**
 * Apply 前必须全部通过的规则（ADR 0006）。删除与移动由工具集保证不会发生，这里不检查。
 */
export function checkInvariants(changes: readonly Change[], context: InvariantContext): Finding[] {
  const findings: Finding[] = []
  const add = (rule: string, path: string, message: string) =>
    findings.push({ level: 'invariant', rule, path, message })

  for (const change of changes) {
    const violation = scopeViolation(context.scope, change.path, change.base, change.next)
    if (violation) add('write-scope', change.path, violation)
    if (!change.path.endsWith('.md')) continue

    // 原文件的 frontmatter 本来就无法解析时不阻断，交给 Warning 提示（与新增链接同一口径，ADR 0006）
    const frontmatter = parseFrontmatter(change.next)
    const alreadyBroken = change.base !== null && !parseFrontmatter(change.base).ok
    if (!frontmatter.ok && !alreadyBroken)
      add('frontmatter-parse', change.path, `frontmatter 无法解析：${frontmatter.error}`)

    for (const target of addedNoteLinks(change)) {
      if (!context.links.resolve(target)) {
        add('unresolved-link', change.path, `[[${target}]] 指向的页面不存在`)
      }
    }
  }
  return findings
}

/**
 * 本次新增的 Markdown 链接目标：新文件中的全部链接，或修改后比原版本多出来的链接。
 * 文件原本就有的链接不检查（ADR 0006），frontmatter 中的链接（例如 `sources:`）也算在内。
 */
export function addedNoteLinks(change: Change): string[] {
  const before = countTargets(change.base === null ? '' : change.base)
  const added: string[] = []
  for (const [target, count] of countTargets(change.next)) {
    if (count > (before.get(target) ?? 0)) added.push(target)
  }
  return added
}

function countTargets(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { target } of extractWikilinks(text, { frontmatter: true })) {
    if (!isNoteTarget(target)) continue
    counts.set(target, (counts.get(target) ?? 0) + 1)
  }
  return counts
}
