import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { Staging, addedNoteLinks, checkInvariants, createLinkIndex } from '../src/index.ts'
import { INGEST_SCOPE, OVERLAY, copyFixtureVault, wikiPage } from './helpers.ts'

function check(staging: Staging) {
  return checkInvariants(staging.changes(), {
    scope: INGEST_SCOPE,
    links: createLinkIndex(staging.list()),
  })
}

describe('checkInvariants', () => {
  it('passes links to existing pages and to pages created in the same Run', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    staging.write('wiki/obsidian/a.md', wikiPage(['overlayscrollbars', 'wiki/obsidian/b']))
    staging.write('wiki/obsidian/b.md', wikiPage(['a', 'flash-list']))
    expect(check(staging)).toEqual([])
  })

  it('reports links to pages that do not exist', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    staging.write('wiki/obsidian/a.md', wikiPage(['overlayscrollbars', '原文直出']))
    expect(check(staging)).toEqual([
      {
        level: 'invariant',
        rule: 'unresolved-link',
        path: 'wiki/obsidian/a.md',
        message: '[[原文直出]] 指向的页面不存在',
      },
    ])
  })

  it('checks frontmatter links such as sources', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    staging.write(
      'wiki/obsidian/a.md',
      wikiPage(['overlayscrollbars', 'flash-list'], { sources: ['sources/missing'] }),
    )
    expect(check(staging).map((finding) => finding.message)).toEqual([
      '[[sources/missing]] 指向的页面不存在',
    ])
  })

  it('ignores broken links that were already in the file (ADR 0006)', () => {
    const vault = copyFixtureVault()
    const log = path.join(vault, 'log.md')
    writeFileSync(log, `${readFileSync(log, 'utf8')}\n- 示例语法：[[xxx]]\n`)
    const staging = new Staging(vault, INGEST_SCOPE)
    staging.append(
      'log.md',
      '\n## [2026-11-02 10:00] ingest | x\n- 新建：[[wiki/frontend/ui-libraries/overlayscrollbars]]\n',
    )
    expect(check(staging)).toEqual([])
  })

  it('reports a link that was added again when it was already broken once', () => {
    const change = { path: 'log.md', base: '[[xxx]]\n', next: '[[xxx]]\n[[xxx]]\n' }
    expect(addedNoteLinks(change)).toEqual(['xxx'])
  })

  it('does not check embeds of non-note assets', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    staging.write(
      'wiki/obsidian/a.md',
      `${wikiPage(['overlayscrollbars', 'flash-list'])}\n![[diagram.png]]\n`,
    )
    expect(check(staging)).toEqual([])
  })

  it('reports frontmatter that does not parse', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    staging.write('wiki/obsidian/a.md', '---\ntitle: [oops\n---\n[[overlayscrollbars]]\n')
    expect(check(staging).map((finding) => finding.rule)).toEqual(['frontmatter-parse'])
  })

  it('does not block on frontmatter that was already broken before the Run', () => {
    // ai-wiki 中真实存在的写法：双引号字符串里未转义的引号
    const broken =
      '---\nsources:\n  - "[[sources/从"机械应答"到"服务伙伴"]]"\n---\n[[overlayscrollbars]]\n'
    const change = { path: 'wiki/x.md', base: broken, next: `${broken}补充。\n` }
    const links = createLinkIndex(['sources/从"机械应答"到"服务伙伴".md', OVERLAY])
    expect(checkInvariants([change], { scope: INGEST_SCOPE, links })).toEqual([])
  })

  it('blocks a Run that breaks a frontmatter which used to parse', () => {
    const change = {
      path: 'wiki/x.md',
      base: '---\ntitle: A\n---\n',
      next: '---\ntitle: [A\n---\n',
    }
    const findings = checkInvariants([change], { scope: INGEST_SCOPE, links: createLinkIndex([]) })
    expect(findings.map((finding) => finding.rule)).toEqual(['frontmatter-parse'])
  })

  it('re-checks the Write Scope on the final content', () => {
    const findings = checkInvariants([{ path: 'AGENT.md', base: 'a', next: 'b' }], {
      scope: INGEST_SCOPE,
      links: createLinkIndex([]),
    })
    expect(findings.map((finding) => finding.rule)).toEqual(['write-scope'])
  })

  it('accepts the bookkeeping an ingest normally does', () => {
    const vault = copyFixtureVault()
    const staging = new Staging(vault, INGEST_SCOPE)
    staging.write('wiki/obsidian/obsidian-skills.md', wikiPage(['overlayscrollbars', 'flash-list']))
    staging.edit(
      'index.md',
      '## Frontend',
      '## Obsidian\n\n- [[wiki/obsidian/obsidian-skills|Obsidian Skills]]\n\n## Frontend',
    )
    staging.append(
      'log.md',
      '\n## [2026-11-02 10:00] ingest | Obsidian Skills\n- 新建：[[wiki/obsidian/obsidian-skills]]\n',
    )
    const source = 'sources/posts/obsidian/obsidian/obsidian-claude/skills.md'
    staging.edit(source, 'date: 2026-03-12\n', 'date: 2026-03-12\ningested-at: 2026-11-02\n')
    expect(staging.changes().map((change) => change.path)).toEqual([
      'index.md',
      'log.md',
      source,
      'wiki/obsidian/obsidian-skills.md',
    ])
    expect(check(staging)).toEqual([])
    expect(readFileSync(path.join(vault, OVERLAY), 'utf8')).not.toBe('')
  })
})
