import { splitFrontmatter } from './markdown.ts'
import type { WriteScopeRule } from './types.ts'

/** 把 glob 转成正则：`**` 匹配任意层级，`*` 与 `?` 不跨越 `/`。 */
export function globToRegExp(glob: string): RegExp {
  let source = ''
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i] ?? ''
    if (char === '*' && glob[i + 1] === '*') {
      const slash = glob[i + 2] === '/'
      source += slash ? '(?:.*/)?' : '.*'
      i += slash ? 2 : 1
    } else if (char === '*') source += '[^/]*'
    else if (char === '?') source += '[^/]'
    else source += char.replaceAll(/[.+^${}()|[\]\\]/g, String.raw`\$&`)
  }
  return new RegExp(`^${source}$`)
}

export function matchScope(
  rules: readonly WriteScopeRule[],
  key: string,
): WriteScopeRule | undefined {
  return rules.find(
    (rule) =>
      globToRegExp(rule.path).test(key) &&
      !(rule.exclude ?? []).some((pattern) => globToRegExp(pattern).test(key)),
  )
}

/**
 * 检查一次从 base 到 next 的改动是否符合 Write Scope。符合时返回 undefined，否则返回原因。
 * 只看最终内容，所以多次写入叠加后也能用同一个函数复查（ADR 0006）。
 */
export function scopeViolation(
  rules: readonly WriteScopeRule[],
  key: string,
  base: string | null,
  next: string,
): string | undefined {
  const rule = matchScope(rules, key)
  if (!rule) return `${key} 不在本次任务的写入范围内`
  if (rule.mode === 'append-only') {
    return base === null || next.startsWith(base)
      ? undefined
      : `${key} 只允许在末尾追加，不能改动已有内容`
  }
  if (rule.mode === 'frontmatter-fields') {
    return frontmatterFieldsViolation(key, base, next, rule.fields ?? [])
  }
  return undefined
}

function frontmatterFieldsViolation(
  key: string,
  base: string | null,
  next: string,
  fields: readonly string[],
): string | undefined {
  if (base === null) return `${key} 只允许修改已有文件的 frontmatter 字段，不能新建`
  const before = splitFrontmatter(base)
  const after = splitFrontmatter(next)
  if (before.body !== after.body) return `${key} 的正文不允许修改`
  const allowed = fields.join('、')
  if (
    dropFields(before.frontmatter ?? '', fields) !== dropFields(after.frontmatter ?? '', fields)
  ) {
    return `${key} 的 frontmatter 只允许修改 ${allowed}`
  }
  return undefined
}

/** 去掉允许修改的顶层字段所在的行（这些字段都是单行标量，例如 `ingested-at: 2026-11-02`）。 */
function dropFields(frontmatter: string, fields: readonly string[]): string {
  return frontmatter
    .split('\n')
    .filter((line) => !fields.some((field) => line.startsWith(`${field}:`)))
    .join('\n')
    .trim()
}
