import { describe, expect, it } from 'vitest'

import { parseCommand } from '../src/args.ts'

describe('parseCommand', () => {
  it('defaults to help', () => {
    expect(parseCommand([])).toEqual({ kind: 'help' })
  })

  it('parses run with a source path', () => {
    expect(parseCommand(['run', 'sources/posts/a.md'])).toEqual({
      kind: 'run',
      source: 'sources/posts/a.md',
    })
  })

  it('rejects run without a source path', () => {
    expect(parseCommand(['run'])).toMatchObject({ kind: 'invalid' })
  })

  it('rejects unknown commands', () => {
    expect(parseCommand(['ingest'])).toMatchObject({ kind: 'invalid' })
  })
})
