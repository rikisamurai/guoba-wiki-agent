import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG, DEFAULT_PORT, parseCommand } from '../src/args.ts'

describe('parseCommand', () => {
  it('defaults to help', () => {
    expect(parseCommand([])).toEqual({ kind: 'help' })
    expect(parseCommand(['--help'])).toEqual({ kind: 'help' })
  })

  it('parses run with defaults', () => {
    expect(parseCommand(['run', 'sources/posts/a.md'])).toEqual({
      kind: 'run',
      source: 'sources/posts/a.md',
      task: 'ingest',
      config: DEFAULT_CONFIG,
    })
  })

  it('uses the repository config by default, independent of the working directory', () => {
    expect(DEFAULT_CONFIG).toBe(path.resolve(import.meta.dirname, '../../../wiki-agent.config.ts'))
  })

  it('parses run options and resolves --config against the working directory', () => {
    expect(parseCommand(['run', 'a.md', '--task', 'lint', '-c', 'x.config.ts'])).toEqual({
      kind: 'run',
      source: 'a.md',
      task: 'lint',
      config: path.resolve('x.config.ts'),
    })
  })

  it('rejects run without a source, with extra arguments or unknown options', () => {
    expect(parseCommand(['run'])).toMatchObject({ kind: 'invalid' })
    expect(parseCommand(['run', 'a.md', 'b.md'])).toMatchObject({ kind: 'invalid' })
    expect(parseCommand(['run', 'a.md', '--port', '1'])).toMatchObject({ kind: 'invalid' })
  })

  it('parses view with a port', () => {
    expect(parseCommand(['view'])).toEqual({
      kind: 'view',
      port: DEFAULT_PORT,
      config: DEFAULT_CONFIG,
    })
    expect(parseCommand(['view', '-p', '0'])).toMatchObject({ kind: 'view', port: 0 })
    expect(parseCommand(['view', '--port', 'abc'])).toMatchObject({ kind: 'invalid' })
    expect(parseCommand(['view', '--port', '70000'])).toMatchObject({ kind: 'invalid' })
  })

  it('rejects unknown commands', () => {
    expect(parseCommand(['ingest'])).toMatchObject({ kind: 'invalid' })
  })
})
