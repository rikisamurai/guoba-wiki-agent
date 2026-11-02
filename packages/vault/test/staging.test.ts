import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { Staging, StagingError, VaultPathError, WriteScopeError, hashText } from '../src/index.ts'
import { INGEST_SCOPE, NEW_SOURCE, OVERLAY, copyFixtureVault } from './helpers.ts'

describe('Staging', () => {
  it('reads through to the vault and keeps writes in memory', () => {
    const vault = copyFixtureVault()
    const staging = new Staging(vault, INGEST_SCOPE)
    const original = readFileSync(path.join(vault, OVERLAY), 'utf8')

    expect(staging.read(OVERLAY)).toBe(original)
    staging.write(OVERLAY, 'changed')

    expect(staging.read(OVERLAY)).toBe('changed')
    expect(readFileSync(path.join(vault, OVERLAY), 'utf8')).toBe(original)
  })

  it('returns null for files that exist nowhere', () => {
    expect(new Staging(copyFixtureVault()).read('wiki/missing.md')).toBeNull()
  })

  it('lists vault files plus new staged files, without hidden directories', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    staging.write('wiki/new.md', 'x')
    const files = staging.list()
    expect(files).toContain('wiki/new.md')
    expect(files).toContain('AGENT.md')
    expect(files.some((file) => file.startsWith('.agents/'))).toBe(false)
  })

  it('edits only a unique match', () => {
    const staging = new Staging(copyFixtureVault())
    staging.write('wiki/x.md', 'one two two')
    staging.edit('wiki/x.md', 'one', '1')
    expect(staging.read('wiki/x.md')).toBe('1 two two')
    expect(() => staging.edit('wiki/x.md', 'two', '2')).toThrow(/出现了 2 次/)
    expect(() => staging.edit('wiki/x.md', 'three', '3')).toThrow(/没有找到/)
    expect(() => staging.edit('wiki/none.md', 'a', 'b')).toThrow(StagingError)
  })

  it('treats $ patterns in the replacement literally', () => {
    const staging = new Staging(copyFixtureVault())
    staging.write('wiki/x.md', 'price')
    staging.edit('wiki/x.md', 'price', "$& and $'")
    expect(staging.read('wiki/x.md')).toBe("$& and $'")
  })

  it('appends to the end', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    const before = staging.read('log.md') ?? ''
    staging.append('log.md', '\n## [2026-11-02 10:00] ingest | x\n')
    expect(staging.read('log.md')).toBe(`${before}\n## [2026-11-02 10:00] ingest | x\n`)
  })

  it('reports hashes for each write', () => {
    const staging = new Staging(copyFixtureVault())
    expect(staging.write('wiki/new.md', 'abc')).toEqual({
      path: 'wiki/new.md',
      op: 'write',
      beforeHash: null,
      afterHash: hashText('abc'),
      bytes: 3,
    })
  })

  it('lists only real changes', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    const original = staging.read(OVERLAY) ?? ''
    staging.write(OVERLAY, 'temp')
    staging.write(OVERLAY, original)
    staging.write('wiki/new.md', 'x')
    expect(staging.changes()).toEqual([{ path: 'wiki/new.md', base: null, next: 'x' }])
  })

  it('keeps the content from the first access as the Base', () => {
    const vault = copyFixtureVault()
    const staging = new Staging(vault, INGEST_SCOPE)
    const first = staging.read(OVERLAY)
    writeFileSync(path.join(vault, OVERLAY), 'edited in Obsidian meanwhile')
    staging.write(OVERLAY, 'agent version')
    expect(staging.changes()[0]?.base).toBe(first)
  })

  it('enforces the Write Scope at write time', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    expect(() => staging.write('AGENT.md', 'x')).toThrow(WriteScopeError)
    expect(() => staging.edit(NEW_SOURCE, '# Obsidian Skills', '# Changed')).toThrow(
      /正文不允许修改/,
    )
    expect(() => staging.write('log.md', 'rewritten')).toThrow(/只允许在末尾追加/)
    expect(staging.changes()).toEqual([])
  })

  it('rejects hidden and escaping paths before touching anything', () => {
    const staging = new Staging(copyFixtureVault())
    expect(() => staging.read('.agents/skills/ingest/SKILL.md')).toThrow(VaultPathError)
    expect(() => staging.write('../outside.md', 'x')).toThrow(VaultPathError)
  })
})
