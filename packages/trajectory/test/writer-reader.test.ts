import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { TrajectoryFormatError, parseTrajectory } from '../src/index.ts'
import { createTrajectoryWriter, readTrajectoryFile } from '../src/node/index.ts'

const tmpFile = () =>
  path.join(mkdtempSync(path.join(tmpdir(), 'trajectory-')), 'run', 'trajectory.jsonl')
const line = (seq: number, type = 'turn/start') =>
  `${JSON.stringify({ type, seq, time: seq, data: { turn: 0 } })}\n`

describe('createTrajectoryWriter', () => {
  it('writes one line per event with contiguous seq starting at 0', () => {
    const file = tmpFile()
    let now = 100
    const writer = createTrajectoryWriter(file, { now: () => now++ })
    writer.append('turn/start', { turn: 0 })
    writer.append('turn/end', { turn: 0, reason: 'finished' })
    writer.close()

    const lines = readFileSync(file, 'utf8').trimEnd().split('\n')
    expect(lines.map((raw) => JSON.parse(raw))).toEqual([
      { type: 'turn/start', seq: 0, time: 100, data: { turn: 0 } },
      { type: 'turn/end', seq: 1, time: 101, data: { turn: 0, reason: 'finished' } },
    ])
  })

  it('writes each event immediately, so a crashed run leaves a readable prefix', () => {
    const file = tmpFile()
    const writer = createTrajectoryWriter(file)
    writer.append('turn/start', { turn: 0 })
    // no close(): simulate the process dying here
    expect(readTrajectoryFile(file).events).toHaveLength(1)
    writer.close()
  })

  it('rejects data that would not survive a JSON round trip', () => {
    const writer = createTrajectoryWriter(tmpFile())
    expect(() =>
      writer.append('review/decision', { turn: 0, choice: 'r', feedback: undefined }),
    ).toThrow(/feedback/)
    expect(() => writer.append('limit/hit', { limit: 'cost', value: Number.NaN, max: 1 })).toThrow(
      /value/,
    )
    writer.close()
  })

  it('refuses to reuse an existing trajectory file', () => {
    const file = tmpFile()
    createTrajectoryWriter(file).close()
    expect(() => createTrajectoryWriter(file)).toThrow(/EEXIST/)
  })

  it('refuses to append after close', () => {
    const writer = createTrajectoryWriter(tmpFile())
    writer.close()
    expect(() => writer.append('turn/start', { turn: 0 })).toThrow(/closed/)
  })
})

describe('parseTrajectory', () => {
  it('drops a half-written last line and reports it', () => {
    const parsed = parseTrajectory(`${line(0)}${line(1)}{"type":"turn/end","se`)
    expect(parsed.events).toHaveLength(2)
    expect(parsed.truncatedTail).toBe(true)
  })

  it('reads an empty file as an empty run', () => {
    expect(parseTrajectory('')).toEqual({ events: [], truncatedTail: false })
  })

  it('fails on invalid JSON before the last line', () => {
    expect(() => parseTrajectory(`${line(0)}not json\n${line(2)}`)).toThrow(TrajectoryFormatError)
  })

  it('fails on unknown event types instead of skipping them', () => {
    expect(() => parseTrajectory(line(0, 'session/title'))).toThrow(/unknown event type/)
  })

  it('fails on a seq gap', () => {
    expect(() => parseTrajectory(`${line(0)}${line(2)}`)).toThrow(/seq gap/)
  })

  it('reads a file written by the writer after more lines were appended externally', () => {
    const file = tmpFile()
    const writer = createTrajectoryWriter(file)
    writer.append('turn/start', { turn: 0 })
    writer.close()
    appendFileSync(file, line(1))
    expect(readTrajectoryFile(file).events.map((event) => event.seq)).toEqual([0, 1])
  })

  it('fails when data is not an object', () => {
    const file = tmpFile()
    createTrajectoryWriter(file).close()
    writeFileSync(file, `${JSON.stringify({ type: 'turn/start', seq: 0, time: 0, data: 1 })}\n`)
    expect(() => readTrajectoryFile(file)).toThrow(/data must be an object/)
  })
})
