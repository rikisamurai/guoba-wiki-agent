import { describe, expect, it } from 'vitest'

import { Staging, checkIngestWarnings, createLinkIndex, wikiDomains } from '../src/index.ts'
import { FLASH_LIST, INGEST_SCOPE, OVERLAY, copyFixtureVault, wikiPage } from './helpers.ts'

function warn(staging: Staging) {
  const files = staging.list()
  return checkIngestWarnings(staging.changes(), {
    links: createLinkIndex(files),
    domains: wikiDomains(new Staging(copyFixtureVault()).list()),
  })
}

const rules = (staging: Staging) =>
  warn(staging).map((finding) => `${finding.rule}:${finding.path ?? ''}`)

describe('checkIngestWarnings', () => {
  it('stays quiet for a page that follows the ingest rules', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    staging.write('wiki/frontend/ui-libraries/a.md', wikiPage(['overlayscrollbars', 'flash-list']))
    expect(warn(staging)).toEqual([])
  })

  it('flags more than three tags', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    staging.write(
      'wiki/frontend/ui-libraries/a.md',
      wikiPage(['overlayscrollbars', 'flash-list'], { tags: ['a', 'b', 'c', 'd'] }),
    )
    expect(rules(staging)).toEqual(['max-tags:wiki/frontend/ui-libraries/a.md'])
  })

  it('flags missing frontmatter fields', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    staging.write(
      'wiki/frontend/ui-libraries/a.md',
      '---\ntitle: A\n---\n[[overlayscrollbars]] [[flash-list]]\n',
    )
    expect(warn(staging)[0]?.message).toBe(
      'frontmatter 缺少 tags、date、sources、last-ingested、status',
    )
  })

  it('counts distinct outlinks and ignores self-links', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    const file = 'wiki/frontend/ui-libraries/a.md'
    staging.write(file, wikiPage(['overlayscrollbars', 'overlayscrollbars', 'a']))
    expect(rules(staging)).toEqual([`min-outlinks:${file}`])
  })

  it('flags an existing page that still has too few outlinks after an update', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    staging.append(FLASH_LIST, '\n补充一句。\n')
    expect(rules(staging)).toEqual([`min-outlinks:${FLASH_LIST}`])
  })

  it('flags a page created in a new Domain', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    staging.write('wiki/obsidian/a.md', wikiPage(['overlayscrollbars', 'flash-list']))
    expect(rules(staging)).toEqual(['new-domain:wiki/obsidian/a.md'])
  })

  it('mentions frontmatter that was already unparseable', () => {
    const broken = '---\nsources:\n  - "[[a"b"]]"\n---\n[[overlayscrollbars]] [[flash-list]]\n'
    const findings = checkIngestWarnings(
      [{ path: 'wiki/frontend/ui-libraries/x.md', base: broken, next: `${broken}补充。\n` }],
      {
        links: createLinkIndex([OVERLAY, FLASH_LIST]),
        domains: new Set(['frontend/ui-libraries']),
      },
    )
    expect(findings.map((finding) => finding.rule)).toEqual(['frontmatter-parse'])
  })

  it('flags more than 15 new pages', () => {
    const staging = new Staging(copyFixtureVault(), INGEST_SCOPE)
    for (let i = 0; i < 16; i++) {
      staging.write(
        `wiki/frontend/ui-libraries/p${i}.md`,
        wikiPage(['overlayscrollbars', 'flash-list']),
      )
    }
    expect(rules(staging)).toEqual(['max-pages:'])
  })
})
