import { fauxAssistantMessage, fauxProvider } from '@earendil-works/pi-ai'
import { describe, expect, it } from 'vitest'

import { knownUsage } from '../src/recorder.ts'
import { call, finish, startFauxRun } from './harness.ts'

const grep = () => call('grep', { pattern: 'Overlay' })

const usage = (input: number, output: number, cacheRead = 0) => ({
  ...finish(),
  usage: {
    input,
    output,
    cacheRead,
    cacheWrite: 0,
    totalTokens: input + output + cacheRead,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
})

describe('limits', () => {
  it('stops after the Step limit', async () => {
    const { run, events } = startFauxRun([grep(), grep(), grep(), finish()], {
      limits: { steps: 2 },
    })
    const result = await run.execute()

    expect(result).toMatchObject({ status: 'limit', limit: { limit: 'steps', value: 2, max: 2 } })
    expect(run.state).toBe('ended')
    expect(events().filter((event) => event.type === 'step/start')).toHaveLength(2)
    expect(events().at(-1)).toMatchObject({ type: 'run/end', data: { reason: 'limit' } })
  })

  it('stops once the cost passes the limit, pricing tokens with the model price', async () => {
    const { run, events } = startFauxRun([grep(), grep(), grep(), grep(), grep(), finish()], {
      limits: { costUsd: 0.5 },
      pricePerMillion: 100,
    })
    const result = await run.execute()

    expect(result).toMatchObject({ status: 'limit', limit: { limit: 'cost', max: 0.5 } })
    const costs = events().flatMap((event) =>
      event.type === 'assistant/message' ? [event.data.costUsd ?? 0] : [],
    )
    expect(costs.every((cost) => cost > 0)).toBe(true)
    expect(costs.reduce((sum, cost) => sum + cost, 0)).toBeGreaterThan(0.5)
    expect(costs.slice(0, -1).reduce((sum, cost) => sum + cost, 0)).toBeLessThanOrEqual(0.5)
  })

  it('treats all-zero usage as unknown cost and prices known usage with the model price', () => {
    const model = fauxProvider({
      models: [{ id: 'p', cost: { input: 2, output: 10, cacheRead: 0.5, cacheWrite: 0 } }],
    }).getModel()

    expect(knownUsage(usage(0, 0), model)).toBeUndefined()
    expect(knownUsage(usage(1_000_000, 100_000, 2_000_000), model)).toEqual({
      tokens: { input: 1_000_000, output: 100_000, cacheRead: 2_000_000, cacheWrite: 0 },
      costUsd: 2 + 1 + 1,
    })
  })

  it('aborts when the Run takes longer than the duration limit', async () => {
    const slow = fauxAssistantMessage('慢慢地说'.repeat(200))
    const { run } = startFauxRun([slow, finish()], {
      limits: { durationMs: 50 },
      tokensPerSecond: 20,
    })
    const result = await run.execute()

    expect(result).toMatchObject({ status: 'limit', limit: { limit: 'duration', max: 50 } })
  })

  it('reports provider errors', async () => {
    const { run } = startFauxRun([
      fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'rate limited' }),
    ])
    const result = await run.execute()

    expect(result).toMatchObject({ status: 'provider_error', error: 'rate limited' })
  })

  it('records failed attempts separately from replies', async () => {
    const { run, events } = startFauxRun([
      fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'boom' }),
    ])
    await run.execute()

    expect(
      events()
        .filter((event) => event.type === 'assistant/attempt')
        .map((event) => event.data.error),
    ).toEqual(['boom'])
    expect(events().filter((event) => event.type === 'assistant/message')).toHaveLength(0)
  })

  it('cancels a running Turn without touching the vault', async () => {
    const { run } = startFauxRun([fauxAssistantMessage('慢慢地说'.repeat(200))], {
      tokensPerSecond: 20,
    })
    const pending = run.execute()
    setTimeout(() => run.cancel(), 20)
    const result = await pending

    expect(result.status).toBe('cancelled')
    expect(result.changes).toEqual([])
  })
})
