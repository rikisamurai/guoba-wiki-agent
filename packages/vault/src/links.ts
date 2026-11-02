import path from 'node:path'

export interface LinkIndex {
  /** 链接目标能否解析到索引中的文件（按完整路径，或按 Obsidian 的文件名匹配）。 */
  resolve(target: string): string | undefined
}

/** 目标是否指向 Markdown 笔记（无扩展名或 `.md`）。图片、PDF 等资源不参与链接检查。 */
export function isNoteTarget(target: string): boolean {
  const ext = path.posix.extname(target)
  return ext === '' || ext === '.md'
}

export function createLinkIndex(files: Iterable<string>): LinkIndex {
  const byPath = new Set<string>()
  const byName = new Map<string, string>()
  for (const file of files) {
    byPath.add(file)
    const name = path.posix.basename(file)
    if (!byName.has(name)) byName.set(name, file)
    if (file.endsWith('.md')) {
      const stem = name.slice(0, -3)
      if (!byName.has(stem)) byName.set(stem, file)
    }
  }
  return {
    resolve(target) {
      const clean = target.replace(/^\/+/, '')
      if (byPath.has(clean)) return clean
      if (byPath.has(`${clean}.md`)) return `${clean}.md`
      const name = path.posix.basename(clean)
      return byName.get(name) ?? byName.get(name.replace(/\.md$/, ''))
    },
  }
}
