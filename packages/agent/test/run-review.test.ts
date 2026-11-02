import { writeFileSync } from 'node:fs'
import path from 'node:path'

import { buildLedger } from '@guoba-wiki-agent/trajectory'
import { describe, expect, it } from 'vitest'

import { PAGE, call, finish, messageText, readVault, startFauxRun, validIngest } from './harness.ts'

describe('review', () => {
  it('continues on the same Staging and conversation after Revise', async () => {
    let feedbackSeen = ''
    const { run, vault, events } = startFauxRun([
      ...validIngest(),
      (context) => {
        feedbackSeen = messageText(context.messages.at(-1))
        return call('edit_file', {
          path: PAGE,
          old: 'Obsidian 官方维护的 Agent Skills 集合。',
          new: 'Obsidian 官方 Skills。',
        })
      },
      finish(),
    ])
    expect((await run.execute()).status).toBe('ready')

    const revised = await run.revise('TL;DR 再短一点')

    expect(feedbackSeen).toBe('TL;DR 再短一点')
    expect(revised.status).toBe('ready')
    expect(revised.changes.find((change) => change.path === PAGE)?.next).toContain(
      'Obsidian 官方 Skills。',
    )
    expect(run.apply()).toMatchObject({ status: 'applied' })
    expect(readVault(vault, PAGE)).toContain('Obsidian 官方 Skills。')

    const ledger = buildLedger(events())
    expect(ledger.turns.map((turn) => turn.turn)).toEqual([0, 1])
    expect(ledger.turns[0]?.entries.at(-1)).toMatchObject({
      kind: 'review',
      choice: 'r',
      feedback: 'TL;DR 再短一点',
    })
    expect(ledger.turns[1]?.entries[0]).toMatchObject({ kind: 'user', source: 'revise' })
  })

  it('shares the Step limit with the original Turn', async () => {
    const { run } = startFauxRun([...validIngest(), call('grep', { pattern: 'x' }), finish()], {
      limits: { steps: 6 },
    })
    expect((await run.execute()).status).toBe('ready')

    const revised = await run.revise('再看一眼')

    expect(revised).toMatchObject({ status: 'limit', limit: { limit: 'steps', value: 6 } })
  })

  it('refuses to apply when a target file changed during the Run', async () => {
    const { run, vault, events } = startFauxRun(validIngest())
    await run.execute()
    writeFileSync(path.join(vault, 'log.md'), 'edited in Obsidian meanwhile\n')

    expect(run.apply()).toEqual({ status: 'conflict', conflicts: ['log.md'] })
    expect(readVault(vault, 'log.md')).toBe('edited in Obsidian meanwhile\n')
    expect(events().at(-1)).toMatchObject({ type: 'run/end', data: { reason: 'apply_rejected' } })
  })

  it('discards without touching the vault', async () => {
    const { run, vault, events } = startFauxRun(validIngest())
    const before = readVault(vault, 'index.md')
    await run.execute()

    run.discard()

    expect(readVault(vault, 'index.md')).toBe(before)
    expect(events().at(-1)).toMatchObject({ type: 'run/end', data: { reason: 'discarded' } })
    await expect(run.revise('x')).rejects.toThrow(/ended/)
  })

  it('only allows execute once', async () => {
    const { run } = startFauxRun(validIngest())
    await run.execute()
    await expect(run.execute()).rejects.toThrow(/ready/)
  })
})
