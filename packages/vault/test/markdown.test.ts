import { describe, expect, it } from 'vitest'

import {
  createLinkIndex,
  extractWikilinks,
  isNoteTarget,
  parseFrontmatter,
  splitFrontmatter,
} from '../src/index.ts'

describe('splitFrontmatter', () => {
  it('separates frontmatter from the body', () => {
    expect(splitFrontmatter('---\ntitle: A\n---\nbody\n')).toEqual({
      frontmatter: 'title: A\n',
      body: 'body\n',
    })
  })

  it('treats text without a leading --- block as body only', () => {
    expect(splitFrontmatter('# A\n---\n')).toEqual({ frontmatter: null, body: '# A\n---\n' })
  })
})

describe('parseFrontmatter', () => {
  it('parses a YAML mapping', () => {
    expect(parseFrontmatter('---\ntitle: A\ntags: [x, y]\n---\n')).toEqual({
      ok: true,
      data: { title: 'A', tags: ['x', 'y'] },
    })
  })

  it('returns null data when there is no frontmatter', () => {
    expect(parseFrontmatter('# A')).toEqual({ ok: true, data: null })
  })

  it('fails on invalid YAML', () => {
    expect(parseFrontmatter('---\ntitle: [unclosed\n---\n')).toMatchObject({ ok: false })
  })

  it('fails when the top level is not a mapping', () => {
    expect(parseFrontmatter('---\n- a\n---\n')).toEqual({
      ok: false,
      error: 'frontmatter must be a YAML mapping',
    })
  })
})

const targets = (text: string, frontmatter = false) =>
  extractWikilinks(text, { frontmatter }).map((link) => link.target)

describe('extractWikilinks', () => {
  it('strips aliases, headings, block refs and table escapes', () => {
    expect(targets('[[a|A]] [[b#Heading]] [[c^block]] | [[d\\|D]] |')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('marks embeds', () => {
    expect(extractWikilinks('![[img.png]] [[note]]', { frontmatter: false })).toEqual([
      { raw: 'img.png', target: 'img.png', embed: true },
      { raw: 'note', target: 'note', embed: false },
    ])
  })

  it('ignores code blocks, inline code and HTML comments', () => {
    const text = [
      '```md',
      '[[in-fence]]',
      '```',
      '`[[inline]]`',
      '<!-- [[comment]] -->',
      '[[real]]',
    ].join('\n')
    expect(targets(text)).toEqual(['real'])
  })

  it('ignores code blocks inside callouts', () => {
    const text = ['> [!example] 语法', '> ```markdown', '> [[file#^id]]', '> ```', '[[real]]'].join(
      '\n',
    )
    expect(targets(text)).toEqual(['real'])
  })

  it('unescapes frontmatter links written as YAML double-quoted strings', () => {
    const text = '---\nsources:\n  - "[[sources/为什么你的\\"AI 优先\\"战略]]"\n---\n'
    expect(targets(text, true)).toEqual(['sources/为什么你的"AI 优先"战略'])
  })

  it('still unescapes \\" when the frontmatter does not parse', () => {
    const text = '---\nsources:\n  - "[[a\\"b\\"c]]"\n  - "[[x"y"]]"\n---\n'
    expect(targets(text, true)).toEqual(['a"b"c', 'x"y"'])
  })

  it('includes frontmatter links only when asked', () => {
    const text = '---\nsources:\n  - "[[sources/a]]"\n---\n[[b]]\n'
    expect(targets(text)).toEqual(['b'])
    expect(targets(text, true)).toEqual(['sources/a', 'b'])
  })
})

describe('createLinkIndex', () => {
  const index = createLinkIndex(['wiki/a/note.md', 'sources/posts/x.md', 'asset/img.png'])

  it.each([
    ['full path without .md', 'wiki/a/note', 'wiki/a/note.md'],
    ['full path with .md', 'wiki/a/note.md', 'wiki/a/note.md'],
    ['file name only', 'note', 'wiki/a/note.md'],
    ['a stale directory with a valid file name', 'wiki/old/note', 'wiki/a/note.md'],
    ['an asset by name', 'img.png', 'asset/img.png'],
  ])('resolves %s', (_label, target, expected) => {
    expect(index.resolve(target)).toBe(expected)
  })

  it('returns undefined for missing notes', () => {
    expect(index.resolve('missing')).toBeUndefined()
  })

  it('treats only extension-less and .md targets as notes', () => {
    expect([isNoteTarget('a'), isNoteTarget('a.md'), isNoteTarget('a.png')]).toEqual([
      true,
      true,
      false,
    ])
  })
})
