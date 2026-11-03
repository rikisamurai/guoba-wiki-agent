import { hashText, listVaultFiles, readVaultText, toVaultKey } from './fs.ts'
import { scopeViolation } from './scope.ts'
import type { Change, WriteScopeRule } from './types.ts'

export class StagingError extends Error {
  override name = 'StagingError'
}

export class WriteScopeError extends Error {
  override name = 'WriteScopeError'
}

export interface WriteResult {
  path: string
  op: 'write' | 'edit' | 'append' | 'revert'
  beforeHash: string | null
  /** 撤销本次新建的文件后为 null。 */
  afterHash: string | null
  bytes: number
}

interface Entry {
  /** 第一次读写时 Vault 中的内容（ADR 0009 的 Base）。 */
  base: string | null
  /** 写入后的内容；undefined 表示还没写过。 */
  staged?: string
}

/**
 * 内存中的暂存层（ADR 0005）。读取看到的是 Vault 叠加 Staging 后的视图；
 * 写入只落在内存里，运行期间 Vault 保持不变。
 */
export class Staging {
  readonly #root: string
  readonly #scope: readonly WriteScopeRule[] | undefined
  readonly #entries = new Map<string, Entry>()

  /** `scope` 省略时不检查写入范围（只用于测试与工具代码）。 */
  constructor(vaultRoot: string, scope?: readonly WriteScopeRule[]) {
    this.#root = vaultRoot
    this.#scope = scope
  }

  read(relativePath: string): string | null {
    const entry = this.#entry(toVaultKey(this.#root, relativePath))
    return entry.staged ?? entry.base
  }

  /** Vault 中的文件加上 Staging 里新建的文件。 */
  list(): string[] {
    const files = new Set(listVaultFiles(this.#root))
    for (const [key, entry] of this.#entries) if (entry.staged !== undefined) files.add(key)
    return [...files].toSorted()
  }

  write(relativePath: string, content: string): WriteResult {
    return this.#put(relativePath, 'write', () => content)
  }

  /** 把唯一匹配的 `oldText` 替换为 `newText`。0 处或多处匹配都会报错。 */
  edit(relativePath: string, oldText: string, newText: string): WriteResult {
    return this.#put(relativePath, 'edit', (current, key) => {
      if (current === null) throw new StagingError(`${key} 不存在`)
      if (oldText === '') throw new StagingError('old 不能为空')
      const count = current.split(oldText).length - 1
      if (count === 0) throw new StagingError(`在 ${key} 中没有找到要替换的文本`)
      if (count > 1) {
        throw new StagingError(
          `要替换的文本在 ${key} 中出现了 ${count} 次，请包含更多上下文使其唯一`,
        )
      }
      return current.replace(oldText, () => newText)
    })
  }

  append(relativePath: string, text: string): WriteResult {
    return this.#put(relativePath, 'append', (current) => (current ?? '') + text)
  }

  /**
   * 撤销对这个文件的全部暂存改动，回到 Base（ADR 0019）。本次新建的文件因此从视图中消失；
   * 结果总是 Base，所以不检查 Write Scope。
   */
  revert(relativePath: string): WriteResult {
    const key = toVaultKey(this.#root, relativePath)
    const entry = this.#entry(key)
    if (entry.staged === undefined) throw new StagingError(`${key} 没有暂存的改动`)
    const before = entry.staged
    delete entry.staged
    return {
      path: key,
      op: 'revert',
      beforeHash: hashText(before),
      afterHash: hashText(entry.base),
      bytes: Buffer.byteLength(entry.base ?? ''),
    }
  }

  /** 内容与 Base 不同的文件。写回原样的文件不算变更。 */
  changes(): Change[] {
    const changes: Change[] = []
    for (const [path, { base, staged }] of this.#entries) {
      if (staged !== undefined && staged !== base) changes.push({ path, base, next: staged })
    }
    return changes.toSorted((a, b) => a.path.localeCompare(b.path))
  }

  #put(
    relativePath: string,
    op: WriteResult['op'],
    compute: (current: string | null, key: string) => string,
  ): WriteResult {
    const key = toVaultKey(this.#root, relativePath)
    const entry = this.#entry(key)
    const before = entry.staged ?? entry.base
    const next = compute(before, key)
    if (this.#scope) {
      const violation = scopeViolation(this.#scope, key, entry.base, next)
      if (violation) throw new WriteScopeError(violation)
    }
    entry.staged = next
    return {
      path: key,
      op,
      beforeHash: hashText(before),
      afterHash: hashText(next) ?? '',
      bytes: Buffer.byteLength(next),
    }
  }

  #entry(key: string): Entry {
    let entry = this.#entries.get(key)
    if (!entry) {
      entry = { base: readVaultText(this.#root, key) }
      this.#entries.set(key, entry)
    }
    return entry
  }
}
