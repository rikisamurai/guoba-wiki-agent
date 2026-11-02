import { describe, expect, it } from 'vitest'

import { globToRegExp, matchScope, scopeViolation } from '../src/index.ts'
import { INGEST_SCOPE } from './helpers.ts'

describe('globToRegExp', () => {
  it.each([
    ['wiki/**', 'wiki/a/b.md', true],
    ['wiki/**', 'wiki.md', false],
    ['**/*.md', 'a.md', true],
    ['**/*.md', 'x/y/a.md', true],
    ['wiki/*.md', 'wiki/a/b.md', false],
    ['index.md', 'indexXmd', false],
  ])('%s matches %s: %s', (glob, file, expected) => {
    expect(globToRegExp(glob).test(file)).toBe(expected)
  })
})

describe('matchScope', () => {
  it('honours exclude patterns', () => {
    expect(matchScope(INGEST_SCOPE, 'wiki/a.md')?.path).toBe('wiki/**')
    expect(matchScope(INGEST_SCOPE, 'wiki/_orphans/a.md')).toBeUndefined()
  })
})

const check = (file: string, base: string | null, next: string) =>
  scopeViolation(INGEST_SCOPE, file, base, next)

describe('scopeViolation', () => {
  const source = '---\ntitle: S\ntags:\n  - a\n---\n# S\n正文\n'

  it('rejects files outside the scope', () => {
    expect(check('AGENT.md', 'a', 'b')).toMatch(/不在本次任务的写入范围内/)
  })

  it('allows any change inside a full-mode path', () => {
    expect(check('wiki/a.md', 'old', 'new')).toBeUndefined()
  })

  it('allows appending to log.md but not rewriting it', () => {
    expect(check('log.md', '# Log\n', '# Log\n## entry\n')).toBeUndefined()
    expect(check('log.md', '# Log\n', '# Changed\n')).toMatch(/只允许在末尾追加/)
  })

  it('allows adding ingested-at to existing frontmatter', () => {
    expect(
      check(
        'sources/s.md',
        source,
        source.replace('---\n# S', 'ingested-at: 2026-11-02\n---\n# S'),
      ),
    ).toBeUndefined()
  })

  it('allows updating an existing ingested-at', () => {
    const marked = source.replace('title: S', 'title: S\ningested-at: 2026-01-01')
    expect(
      check('sources/s.md', marked, marked.replace('2026-01-01', '2026-11-02')),
    ).toBeUndefined()
  })

  it('allows adding a frontmatter that only holds ingested-at', () => {
    expect(
      check('sources/s.md', '# S\n', '---\ningested-at: 2026-11-02\n---\n# S\n'),
    ).toBeUndefined()
  })

  it('rejects changes to the source body', () => {
    expect(check('sources/s.md', source, source.replace('正文', '改写'))).toMatch(/正文不允许修改/)
  })

  it('rejects changes to other frontmatter fields', () => {
    expect(check('sources/s.md', source, source.replace('title: S', 'title: T'))).toMatch(
      /只允许修改 ingested-at/,
    )
  })

  it('rejects creating new source files', () => {
    expect(check('sources/new.md', null, '---\ningested-at: 2026-11-02\n---\n')).toMatch(/不能新建/)
  })
})
