import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { buildLedger, summarizeRun } from '@guoba-wiki-agent/trajectory'
import { describe, expect, it } from 'vitest'

import {
  PAGE,
  SOURCE,
  call,
  finish,
  lastToolResult,
  messageText,
  readVault,
  startFauxRun,
  validIngest,
} from './harness.ts'

describe('a valid ingest', () => {
  it('stages every step, passes Finish and applies after confirmation', async () => {
    const { run, vault, events } = startFauxRun(validIngest())
    const before = readVault(vault, 'log.md')

    const result = await run.execute()

    expect(result.status).toBe('ready')
    expect(result.changes.map((change) => change.path)).toEqual([
      'index.md',
      'log.md',
      SOURCE,
      PAGE,
    ])
    expect(result.validation).toEqual({ invariants: [], warnings: [] })
    expect(readVault(vault, 'log.md')).toBe(before)

    expect(run.apply()).toMatchObject({ status: 'applied' })
    expect(readVault(vault, PAGE)).toContain('Obsidian 官方维护的 Agent Skills 集合')
    expect(readVault(vault, SOURCE)).toContain('ingested-at: 2026-11-02')
    expect(run.state).toBe('ended')

    const all = events()
    expect(all[0]?.type).toBe('run/start')
    expect(all.at(-1)).toMatchObject({ type: 'run/end', data: { reason: 'applied' } })
    const ledger = buildLedger(all)
    expect(ledger.turns).toHaveLength(1)
    expect(ledger.turns[0]?.proposal?.map((file) => file.path)).toHaveLength(4)
    const summary = JSON.parse(readFileSync(path.join(run.dir, 'result.json'), 'utf8'))
    expect(summary).toEqual(summarizeRun(all))
    expect(summary).toMatchObject({ reason: 'applied', steps: 5, finishAttempts: 1 })
    expect(readFileSync(path.join(run.dir, 'proposal.diff'), 'utf8')).toContain(`+++ b/${PAGE}`)
  })

  it('records each staged write under the tool call that made it', async () => {
    const { run, events } = startFauxRun(validIngest())
    await run.execute()
    const writes = events().filter((event) => event.type === 'staging/write')
    expect(writes.map((event) => event.data.op)).toEqual(['write', 'edit', 'append', 'edit'])
    expect(writes[0]?.data).toMatchObject({ turn: 0, step: 0, path: PAGE, beforeHash: null })
  })
})

describe('the prompt', () => {
  it('orders the system prompt as ADR 0018 says and puts the source in the first user message', async () => {
    let system = ''
    let firstUser = ''
    const { run } = startFauxRun([
      (context) => {
        system = messageText(context.messages.find((message) => message.role === 'system'))
        firstUser = messageText(context.messages.find((message) => message.role === 'user'))
        return finish()
      },
    ])
    await run.execute()

    const order = [
      '# Run Rules',
      '# Project Instructions',
      '# Task Skill：ingest',
      '# Skill Catalog',
      '# 运行上下文',
    ]
    const positions = order.map((heading) => system.indexOf(heading))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual(positions.toSorted((a, b) => a - b))
    expect(system).toContain('三层架构')
    expect(system).toContain('- obsidian-markdown：')
    expect(system).not.toMatch(/^- ingest：/m)
    expect(system).toContain('当前时间：2026-11-02 16:00（Asia/Shanghai）')
    expect(firstUser).toBe(`执行 Task Skill「ingest」。输入：${SOURCE}`)
  })
})

describe('tools', () => {
  it('reads back what was staged', async () => {
    let seen = ''
    const { run } = startFauxRun([
      call('write_file', { path: 'wiki/frontend/web-platform/x.md', content: 'staged text' }),
      call('read_file', { path: 'wiki/frontend/web-platform/x.md' }),
      (context) => {
        seen = lastToolResult(context.messages).text
        return call('write_file', { path: 'wiki/frontend/web-platform/x.md', content: 'gone' })
      },
      call('edit_file', { path: 'wiki/frontend/web-platform/x.md', old: 'gone', new: 'removed' }),
      finish(),
    ])
    await run.execute()
    expect(seen).toBe('staged text')
  })

  it('reads catalog Skills but not Skills outside the catalog', async () => {
    const results: { text: string; isError: boolean }[] = []
    const { run } = startFauxRun([
      call('read_skill', { name: 'obsidian-markdown' }),
      (context) => {
        results.push(lastToolResult(context.messages))
        return call('read_skill', { name: 'lint' })
      },
      (context) => {
        results.push(lastToolResult(context.messages))
        return finish()
      },
    ])
    await run.execute()
    expect(results[0]?.isError).toBe(false)
    expect(results[0]?.text).toContain('references/')
    expect(results[1]).toMatchObject({
      isError: true,
      text: expect.stringContaining('不在本次运行的 Skill Catalog 中'),
    })
  })

  it('reports out-of-scope writes and hidden paths as tool errors and keeps going', async () => {
    const results: { text: string; isError: boolean }[] = []
    const capture =
      (next: ReturnType<typeof call>) => (context: { messages: { role: string }[] }) => {
        results.push(lastToolResult(context.messages))
        return next
      }
    const { run } = startFauxRun([
      call('write_file', { path: 'AGENT.md', content: 'x' }),
      capture(call('read_file', { path: '.agents/skills/ingest/SKILL.md' })),
      capture(finish()),
    ])
    const result = await run.execute()
    expect(results.map((r) => r.isError)).toEqual([true, true])
    expect(results[0]?.text).toContain('不在本次任务的写入范围内')
    expect(result.status).toBe('ready')
    expect(existsSync(path.join(run.dir, 'trajectory.jsonl'))).toBe(true)
  })
})
