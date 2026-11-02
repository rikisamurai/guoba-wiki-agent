import { describe, expect, it } from 'vitest'

import { allSteps, buildLedger, summarizeRun } from '../src/index.ts'
import { T0, recordRun, runStart, step } from './record.ts'

const usage = (input: number, output: number) => ({ input, output, cacheRead: 0, cacheWrite: 0 })
const brokenLink = {
  level: 'invariant' as const,
  rule: 'unresolved-link',
  path: 'wiki/a.md',
  message: '[[missing]] does not resolve',
}
const fewLinks = {
  level: 'warning' as const,
  rule: 'min-outlinks',
  path: 'wiki/a.md',
  message: '1 outlink, expected at least 2',
}

describe('normal completion', () => {
  const run = recordRun((r) => {
    runStart(r)
    r.emit('turn/start', { turn: 0 })
    r.emit('user/message', { turn: 0, source: 'task', text: 'ingest skills.md' })
    step(
      r,
      { turn: 0, step: 0 },
      {
        ttft: 300,
        decode: 600,
        tools: [
          { name: 'write_file', writes: ['wiki/b.md'], durationMs: 5 },
          { name: 'write_file', writes: ['wiki/a.md'] },
        ],
        usage: usage(1000, 200),
        costUsd: 0.01,
      },
    )
    step(
      r,
      { turn: 0, step: 1 },
      {
        ttft: 200,
        decode: 50,
        tools: [{ name: 'finish' }],
        usage: usage(1500, 20),
        costUsd: 0.02,
        beforeFinish: () =>
          r.emit('validation/result', {
            turn: 0,
            step: 1,
            attempt: 1,
            invariants: [],
            warnings: [fewLinks],
          }),
      },
    )
    r.emit('turn/end', { turn: 0, reason: 'finished' })
    r.emit('review/decision', { turn: 0, choice: 'y' })
    r.emit('apply/result', {
      written: ['wiki/a.md', 'wiki/b.md'],
      conflicts: [],
      failed: [],
      invariants: [],
    })
    r.emit('run/end', { reason: 'applied' })
  })

  it('groups events into one Turn with two Steps', () => {
    const ledger = buildLedger(run.events)
    expect(ledger.turns).toHaveLength(1)
    expect(ledger.turns[0]?.entries.map((entry) => entry.kind)).toEqual([
      'user',
      'step',
      'step',
      'review',
    ])
    expect(ledger.end).toEqual({ reason: 'applied', at: run.events.at(-1)?.time })
  })

  it('derives TTFT, decode time and tool durations from event times', () => {
    const [first] = allSteps(buildLedger(run.events))
    expect(first?.ttftMs).toBe(300)
    expect(first?.decodeMs).toBe(600)
    expect(first?.tools.map((tool) => tool.result?.durationMs)).toEqual([5, undefined])
    expect(first?.tools[0]?.writes.map((write) => write.path)).toEqual(['wiki/b.md'])
  })

  it('summarizes usage, cost, files and the last validation', () => {
    expect(summarizeRun(run.events)).toMatchObject({
      runId: 'run-1',
      taskSkill: 'ingest',
      reason: 'applied',
      turns: 1,
      steps: 2,
      usage: usage(2500, 220),
      costUsd: 0.03,
      costComplete: true,
      finishAttempts: 1,
      invariants: [],
      warnings: [fewLinks],
      files: ['wiki/a.md', 'wiki/b.md'],
      applied: ['wiki/a.md', 'wiki/b.md'],
    })
  })
})

describe('Invariant failure', () => {
  const run = recordRun((r) => {
    runStart(r)
    r.emit('turn/start', { turn: 0 })
    for (const attempt of [1, 2, 3]) {
      step(
        r,
        { turn: 0, step: attempt - 1 },
        {
          ttft: 100,
          decode: 10,
          tools: [{ name: 'finish', isError: true }],
          beforeFinish: () =>
            r.emit('validation/result', {
              turn: 0,
              step: attempt - 1,
              attempt,
              invariants: [brokenLink],
              warnings: [],
            }),
        },
      )
    }
    r.emit('turn/end', { turn: 0, reason: 'invariant_failed' })
    r.emit('run/end', { reason: 'invariant_failed' })
  })

  it('keeps every Finish attempt and reports the last failures', () => {
    const summary = summarizeRun(run.events)
    expect(summary.reason).toBe('invariant_failed')
    expect(summary.finishAttempts).toBe(3)
    expect(summary.invariants).toEqual([brokenLink])
    expect(summary.applied).toEqual([])
  })

  it('marks cost as incomplete when replies carried no usage', () => {
    expect(summarizeRun(run.events)).toMatchObject({ costUsd: 0, costComplete: false })
  })
})

describe('limit hit', () => {
  const run = recordRun((r) => {
    runStart(r)
    r.emit('turn/start', { turn: 0 })
    step(
      r,
      { turn: 0, step: 0 },
      { ttft: 10, decode: 10, tools: [{ name: 'grep' }], usage: usage(10, 1), costUsd: 1.2 },
    )
    r.emit('limit/hit', { limit: 'cost', value: 1.2, max: 1 })
    r.emit('turn/end', { turn: 0, reason: 'limit' })
    r.emit('run/end', { reason: 'limit' })
  })

  it('records which limit stopped the run', () => {
    const ledger = buildLedger(run.events)
    expect(ledger.limits).toEqual([{ limit: 'cost', value: 1.2, max: 1, at: expect.any(Number) }])
    expect(summarizeRun(run.events).reason).toBe('limit')
  })
})

describe('Revise across Turns', () => {
  const run = recordRun((r) => {
    runStart(r)
    r.emit('turn/start', { turn: 0 })
    r.emit('user/message', { turn: 0, source: 'task', text: 'ingest' })
    step(r, { turn: 0, step: 0 }, { ttft: 10, decode: 10, tools: [{ name: 'finish' }] })
    r.emit('turn/end', { turn: 0, reason: 'finished' })
    r.tick(60_000) // the user reads the diff
    r.emit('review/decision', { turn: 0, choice: 'r', feedback: '把 TL;DR 写短一点' })
    r.emit('turn/start', { turn: 1 })
    r.emit('user/message', { turn: 1, source: 'revise', text: '把 TL;DR 写短一点' })
    step(
      r,
      { turn: 1, step: 0 },
      { ttft: 10, decode: 10, tools: [{ name: 'edit_file', writes: ['wiki/a.md'] }] },
    )
    step(r, { turn: 1, step: 1 }, { ttft: 10, decode: 10, tools: [{ name: 'finish' }] })
    r.emit('turn/end', { turn: 1, reason: 'finished' })
    r.emit('review/decision', { turn: 1, choice: 'y' })
    r.emit('run/end', { reason: 'applied' })
  })

  it('opens a new Turn for the feedback and keeps Steps numbered per Turn', () => {
    const ledger = buildLedger(run.events)
    expect(ledger.turns.map((turn) => turn.turn)).toEqual([0, 1])
    expect(ledger.turns[0]?.entries.at(-1)).toMatchObject({
      kind: 'review',
      choice: 'r',
      feedback: '把 TL;DR 写短一点',
    })
    expect(ledger.turns[1]?.entries[0]).toMatchObject({ kind: 'user', source: 'revise' })
    expect(allSteps(ledger).map((s) => `${s.turn}:${s.step}`)).toEqual(['0:0', '1:0', '1:1'])
  })

  it('counts wall time including the review wait', () => {
    const summary = summarizeRun(run.events)
    expect(summary.turns).toBe(2)
    expect(summary.durationMs).toBe((run.events.at(-1)?.time ?? 0) - T0)
    expect(summary.durationMs).toBeGreaterThan(60_000)
  })
})

describe('retried attempts', () => {
  it('measures TTFT from the Step start to the first output of any attempt', () => {
    const run = recordRun((r) => {
      r.emit('step/start', { turn: 0, step: 0 })
      r.emit('assistant/attempt', {
        turn: 0,
        step: 0,
        stream: [{ at: T0 + 100, kind: 'text', delta: 'Hel' }],
        error: 'connection reset',
      })
      r.tick(900)
      r.emit('assistant/message', {
        turn: 0,
        step: 0,
        blocks: [{ type: 'text', text: 'Hello' }],
        stream: [{ at: T0 + 800, kind: 'text', delta: 'Hello' }],
        stopReason: 'stop',
      })
      r.emit('step/end', { turn: 0, step: 0 })
    })
    const [only] = allSteps(buildLedger(run.events))
    expect(only?.ttftMs).toBe(100)
    expect(only?.decodeMs).toBe(0)
    expect(only?.attempts).toEqual([{ error: 'connection reset', at: T0 }])
  })

  it('reports an unfinished run as incomplete', () => {
    const run = recordRun((r) => {
      runStart(r)
      r.emit('turn/start', { turn: 0 })
    })
    expect(summarizeRun(run.events).reason).toBe('incomplete')
  })
})
