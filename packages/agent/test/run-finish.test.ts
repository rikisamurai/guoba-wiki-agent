import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai'
import { describe, expect, it } from 'vitest'

import {
  PAGE,
  call,
  finish,
  lastToolResult,
  messageText,
  readVault,
  startFauxRun,
  wikiPage,
} from './harness.ts'

const brokenPage = () =>
  call('write_file', { path: PAGE, content: wikiPage(['mutation-observer', '原文直出']) })
const fixedPage = () =>
  call('edit_file', { path: PAGE, old: '[[原文直出]]', new: '[[resize-observer]]' })

describe('Finish', () => {
  it('sends Invariant failures back to the model, which fixes them', async () => {
    let feedback = { text: '', isError: false }
    const { run, events } = startFauxRun([
      brokenPage(),
      finish(),
      (context) => {
        feedback = lastToolResult(context.messages)
        return fixedPage()
      },
      finish(),
    ])
    const result = await run.execute()

    expect(feedback.isError).toBe(true)
    expect(feedback.text).toContain('第 1/3 次')
    expect(feedback.text).toContain('[[原文直出]] 指向的页面不存在')
    expect(result.status).toBe('ready')
    const validations = events().filter((event) => event.type === 'validation/result')
    expect(
      validations.map((event) => [
        event.data.attempt,
        event.data.invariants.length,
        event.data.verdict,
      ]),
    ).toEqual([
      [1, 1, 'retry'],
      [2, 0, 'pass'],
    ])
  })

  it('ends the Run after the third Invariant failure and refuses to apply', async () => {
    const { run, vault, events } = startFauxRun([
      brokenPage(),
      finish(),
      finish(),
      finish(),
      finish(),
    ])
    const before = readVault(vault, 'log.md')

    const result = await run.execute()

    expect(result.status).toBe('invariant_failed')
    expect(run.state).toBe('ended')
    expect(() => run.apply()).toThrow(/ended/)
    expect(readVault(vault, 'log.md')).toBe(before)
    expect(events().at(-1)).toMatchObject({ type: 'run/end', data: { reason: 'invariant_failed' } })
  })

  it('shows Warnings once per Turn and accepts the next finish', async () => {
    let first = { text: '', isError: true }
    const { run } = startFauxRun([
      call('write_file', { path: PAGE, content: wikiPage(['mutation-observer']) }),
      finish(),
      (context) => {
        first = lastToolResult(context.messages)
        return finish()
      },
    ])
    const result = await run.execute()

    expect(first.isError).toBe(false)
    expect(first.text).toContain('min-outlinks')
    expect(result.status).toBe('ready')
    expect(result.validation?.warnings.map((warning) => warning.rule)).toEqual(['min-outlinks'])
  })

  it('blocks finish when it shares a batch with other tools, but runs the other tools', async () => {
    let blocked = { text: '', isError: false }
    const { run, events } = startFauxRun([
      fauxAssistantMessage(
        [
          fauxToolCall('write_file', {
            path: PAGE,
            content: wikiPage(['mutation-observer', 'resize-observer']),
          }),
          fauxToolCall('finish', { summary: 'x' }),
        ],
        { stopReason: 'toolUse' },
      ),
      (context) => {
        blocked = lastToolResult(context.messages)
        return finish()
      },
    ])
    const result = await run.execute()

    expect(blocked).toMatchObject({
      isError: true,
      text: expect.stringContaining('finish 必须单独调用'),
    })
    expect(events().filter((event) => event.type === 'staging/write')).toHaveLength(1)
    expect(result.status).toBe('ready')
  })

  it('validates when the model stops without calling finish', async () => {
    const { run, events } = startFauxRun([
      call('write_file', {
        path: PAGE,
        content: wikiPage(['mutation-observer', 'resize-observer']),
      }),
      fauxAssistantMessage('都做完了。'),
    ])
    const result = await run.execute()

    expect(result.status).toBe('ready')
    expect(events().filter((event) => event.type === 'validation/result')).toHaveLength(1)
  })

  it('feeds validation problems back as a follow-up when the model stopped without finish', async () => {
    let followUp = ''
    const { run, events } = startFauxRun([
      brokenPage(),
      fauxAssistantMessage('都做完了。'),
      (context) => {
        followUp = messageText(context.messages.at(-1))
        return fixedPage()
      },
      finish(),
    ])
    const result = await run.execute()

    expect(followUp).toContain('[[原文直出]] 指向的页面不存在')
    expect(result.status).toBe('ready')
    const users = events().filter((event) => event.type === 'user/message')
    expect(users.map((event) => event.data.source)).toEqual(['task', 'validation'])
  })
})
