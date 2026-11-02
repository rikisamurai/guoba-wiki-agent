import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { Staging, applyProposal, listVaultFiles, renderDiff } from '../src/index.ts'
import { INGEST_SCOPE, OVERLAY, copyFixtureVault, wikiPage } from './helpers.ts'

describe('renderDiff', () => {
  it('shows a new file against /dev/null', () => {
    const diff = renderDiff({ path: 'wiki/a.md', base: null, next: 'hello\n' })
    expect(diff).toContain('--- /dev/null')
    expect(diff).toContain('+++ b/wiki/a.md')
    expect(diff).toContain('+hello')
  })

  it('shows changed lines with context', () => {
    const diff = renderDiff({ path: 'log.md', base: 'a\nb\n', next: 'a\nb\nc\n' })
    expect(diff).toContain('--- a/log.md')
    expect(diff).toContain(' b')
    expect(diff).toContain('+c')
  })
})

function stagedIngest(vault: string) {
  const staging = new Staging(vault, INGEST_SCOPE)
  staging.write('wiki/frontend/ui-libraries/a.md', wikiPage(['overlayscrollbars', 'flash-list']))
  staging.append('log.md', '\n## [2026-11-02 10:00] ingest | a\n')
  return staging
}

describe('applyProposal', () => {
  it('writes every change and leaves no temporary files', () => {
    const vault = copyFixtureVault()
    const changes = stagedIngest(vault).changes()

    expect(applyProposal(vault, changes, INGEST_SCOPE)).toEqual({
      status: 'applied',
      written: ['log.md', 'wiki/frontend/ui-libraries/a.md'],
      failed: [],
    })
    for (const change of changes)
      expect(readFileSync(path.join(vault, change.path), 'utf8')).toBe(change.next)
    const leftovers = readdirSync(path.join(vault, 'wiki/frontend/ui-libraries')).filter((name) =>
      name.includes('wiki-agent'),
    )
    expect(leftovers).toEqual([])
  })

  it('refuses everything when a target file changed during the Run', () => {
    const vault = copyFixtureVault()
    const changes = stagedIngest(vault).changes()
    writeFileSync(path.join(vault, 'log.md'), 'edited in Obsidian')

    expect(applyProposal(vault, changes, INGEST_SCOPE)).toEqual({
      status: 'conflict',
      conflicts: ['log.md'],
    })
    expect(listVaultFiles(vault)).not.toContain('wiki/frontend/ui-libraries/a.md')
  })

  it('treats a new file created meanwhile as a conflict', () => {
    const vault = copyFixtureVault()
    const changes = stagedIngest(vault).changes()
    writeFileSync(path.join(vault, 'wiki/frontend/ui-libraries/a.md'), 'created by hand')

    expect(applyProposal(vault, changes, INGEST_SCOPE)).toMatchObject({
      status: 'conflict',
      conflicts: ['wiki/frontend/ui-libraries/a.md'],
    })
  })

  it('re-checks Invariants against the current vault', () => {
    const vault = copyFixtureVault()
    const changes = stagedIngest(vault).changes()
    rmSync(path.join(vault, 'wiki/frontend/react-native/flash-list.md'))

    const result = applyProposal(vault, changes, INGEST_SCOPE)
    expect(result).toMatchObject({ status: 'invalid', invariants: [{ rule: 'unresolved-link' }] })
    expect(readFileSync(path.join(vault, OVERLAY), 'utf8')).not.toBe('')
  })

  it('stops at the first failed write and reports the rest as not attempted', () => {
    const vault = copyFixtureVault()
    writeFileSync(path.join(vault, 'wiki/a-blocked'), 'a file where a directory is needed')
    const staging = new Staging(vault, INGEST_SCOPE)
    staging.write('wiki/a-blocked/x.md', wikiPage(['overlayscrollbars', 'flash-list']))
    staging.write('wiki/b.md', wikiPage(['overlayscrollbars', 'flash-list']))

    const result = applyProposal(vault, staging.changes(), INGEST_SCOPE)
    expect(result).toMatchObject({
      status: 'partial',
      written: [],
      failed: [
        { path: 'wiki/a-blocked/x.md', error: expect.stringMatching(/EEXIST|ENOTDIR/) },
        { path: 'wiki/b.md', error: '前面的文件写入失败，未尝试写入' },
      ],
    })
  })
})
