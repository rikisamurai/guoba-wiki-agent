import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { resolveVaultPath } from './path.ts'

/** 把 Vault 内路径规范成以 `/` 分隔的相对路径，同时拒绝越界与隐藏路径。 */
export function toVaultKey(vaultRoot: string, relativePath: string): string {
  const resolved = resolveVaultPath(vaultRoot, relativePath)
  return path.relative(path.resolve(vaultRoot), resolved).split(path.sep).join('/')
}

/** 读取 Vault 中的文本文件；不存在时返回 null。 */
export function readVaultText(vaultRoot: string, key: string): string | null {
  try {
    return readFileSync(resolveVaultPath(vaultRoot, key), 'utf8')
  } catch (error) {
    if (isNodeError(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) return null
    throw error
  }
}

/** 列出 Vault 中的全部文件（跳过以 `.` 开头的目录和文件），按路径排序。 */
export function listVaultFiles(vaultRoot: string): string[] {
  const root = path.resolve(vaultRoot)
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else files.push(path.relative(root, full).split(path.sep).join('/'))
    }
  }
  walk(root)
  return files.toSorted()
}

/** 内容 hash；不存在的文件记为 null（ADR 0009）。 */
export function hashText(text: string | null): string | null {
  return text === null ? null : `sha256:${createHash('sha256').update(text).digest('hex')}`
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
