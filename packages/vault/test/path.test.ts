import { existsSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { VaultPathError, resolveVaultPath } from '../src/index.ts'

const FIXTURE_VAULT = path.resolve(import.meta.dirname, '../../../fixtures/vault')

describe('resolveVaultPath', () => {
  it('resolves files inside the fixture vault', () => {
    const resolved = resolveVaultPath(
      FIXTURE_VAULT,
      'wiki/frontend/ui-libraries/overlayscrollbars.md',
    )
    expect(existsSync(resolved)).toBe(true)
  })

  it.each([
    ['absolute paths', '/etc/passwd'],
    ['parent traversal', '../outside.md'],
    ['traversal through a subdirectory', 'wiki/../../outside.md'],
    ['the vault root itself', '.'],
    ['hidden directories', '.agents/skills/ingest/SKILL.md'],
    ['hidden directories below the root', 'wiki/.obsidian/workspace.json'],
    ['empty paths', ''],
  ])('rejects %s', (_label, relativePath) => {
    expect(() => resolveVaultPath(FIXTURE_VAULT, relativePath)).toThrow(VaultPathError)
  })
})
