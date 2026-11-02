/** 与 packages/trajectory 的 Finding 结构一致（两个包互不依赖，ADR 0017）。 */
export interface Finding {
  level: 'invariant' | 'warning'
  rule: string
  message: string
  path?: string
}

/** Staging 相对 Vault 的一处变更。`base` 为 null 表示新建文件。 */
export interface Change {
  path: string
  base: string | null
  next: string
}

/**
 * Write Scope 中的一条规则（ADR 0006、0008）。按顺序匹配，第一条命中的规则生效。
 * - `full`：允许任意改动（默认）
 * - `append-only`：只能在原内容末尾追加
 * - `frontmatter-fields`：只能改 frontmatter 中 `fields` 列出的顶层字段
 */
export interface WriteScopeRule {
  path: string
  exclude?: string[]
  mode?: 'full' | 'append-only' | 'frontmatter-fields'
  fields?: string[]
}
