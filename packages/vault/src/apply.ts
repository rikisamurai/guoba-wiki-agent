import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { hashText, listVaultFiles, readVaultText } from './fs.ts'
import { checkInvariants } from './invariants.ts'
import { createLinkIndex } from './links.ts'
import { resolveVaultPath } from './path.ts'
import type { Change, Finding, WriteScopeRule } from './types.ts'

export type ApplyResult =
  | { status: 'conflict'; conflicts: string[] }
  | { status: 'invalid'; invariants: Finding[] }
  | { status: 'applied' | 'partial'; written: string[]; failed: { path: string; error: string }[] }

/**
 * 把 Proposal 写入 Vault（ADR 0009）：
 * 1. 要写的文件在运行期间被外部改过（hash 与 Base 不同）就整体拒绝；
 * 2. 基于当前 Vault 重新校验 Invariant（例如被链接的页面可能已被删除）；
 * 3. 逐个文件写临时文件再 rename。遇到失败即停止，其余文件记为未写入，恢复依赖 Vault 的 git。
 */
export function applyProposal(
  vaultRoot: string,
  changes: readonly Change[],
  scope: readonly WriteScopeRule[],
): ApplyResult {
  const conflicts = changes
    .filter((change) => hashText(readVaultText(vaultRoot, change.path)) !== hashText(change.base))
    .map((change) => change.path)
  if (conflicts.length > 0) return { status: 'conflict', conflicts }

  const files = new Set([...listVaultFiles(vaultRoot), ...changes.map((change) => change.path)])
  const invariants = checkInvariants(changes, { scope, links: createLinkIndex(files) })
  if (invariants.length > 0) return { status: 'invalid', invariants }

  const written: string[] = []
  const failed: { path: string; error: string }[] = []
  for (const change of changes) {
    if (failed.length > 0) {
      failed.push({ path: change.path, error: '前面的文件写入失败，未尝试写入' })
      continue
    }
    try {
      writeAtomically(resolveVaultPath(vaultRoot, change.path), change.next)
      written.push(change.path)
    } catch (error) {
      failed.push({
        path: change.path,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { status: failed.length > 0 ? 'partial' : 'applied', written, failed }
}

function writeAtomically(file: string, content: string): void {
  mkdirSync(path.dirname(file), { recursive: true })
  const temp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.wiki-agent-${process.pid}.tmp`,
  )
  try {
    writeFileSync(temp, content)
    renameSync(temp, file)
  } catch (error) {
    rmSync(temp, { force: true })
    throw error
  }
}
