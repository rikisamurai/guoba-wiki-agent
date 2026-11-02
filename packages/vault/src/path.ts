import path from 'node:path'

export class VaultPathError extends Error {
  override name = 'VaultPathError'
}

/**
 * 把 Vault 内的相对路径解析为绝对路径。
 *
 * 拒绝绝对路径、逃逸出 Vault 根目录的路径，以及经过以 `.` 开头的目录或文件
 * （`.git`、`.obsidian`、`.agents` 等，ADR 0010）。Skill 只能通过 Skill 工具读取。
 */
export function resolveVaultPath(vaultRoot: string, relativePath: string): string {
  if (relativePath === '' || path.isAbsolute(relativePath)) {
    throw new VaultPathError(`expected a path relative to the vault, got "${relativePath}"`)
  }
  const root = path.resolve(vaultRoot)
  const resolved = path.resolve(root, relativePath)
  const inside = path.relative(root, resolved)
  if (inside === '' || inside.startsWith('..') || path.isAbsolute(inside)) {
    throw new VaultPathError(`path escapes the vault: "${relativePath}"`)
  }
  if (inside.split(path.sep).some((segment) => segment.startsWith('.'))) {
    throw new VaultPathError(`hidden paths are not accessible: "${relativePath}"`)
  }
  return resolved
}
