import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'

import { loadConfig, resolveTask } from '@guoba-wiki-agent/agent'
import { describe, expect, it } from 'vitest'

import {
  PAGE,
  SOURCE,
  call,
  finish,
  readVault,
  startFauxRun,
  validIngest,
  wikiPage,
} from '../../../packages/agent/test/harness.ts'
import { DEFAULT_CONFIG } from '../src/args.ts'
import { createProgress } from '../src/run/progress.ts'
import { EXIT_CANCELLED, EXIT_FAILED, EXIT_OK, reviewRun } from '../src/run/review.ts'
import { gitState, toVaultPath } from '../src/run/start.ts'
import type { Terminal } from '../src/run/terminal.ts'

/** 按顺序回答提问的假终端；答案用完或为 null 时相当于 Ctrl-C。 */
function fakeTerminal(answers: (string | null)[]) {
  let output = ''
  const term: Terminal = {
    write(text) {
      output += text
    },
    ask(question) {
      output += `${question}\n`
      return Promise.resolve(answers.shift() ?? null)
    },
  }
  return { term, output: () => stripVTControlCharacters(output) }
}

async function review(responses: Parameters<typeof startFauxRun>[0], answers: (string | null)[]) {
  const { term, output } = fakeTerminal(answers)
  const progress = createProgress((text) => term.write(text))
  const harness = startFauxRun(responses, { onEvent: (event) => progress.onEvent(event) })
  const code = await reviewRun(harness.run, term, progress.events)
  return { ...harness, code, output: output() }
}

describe('wiki-agent run review (ADR 0013)', () => {
  it('shows progress, the Proposal and its diff, then applies on y', async () => {
    const { code, output, vault, run } = await review(validIngest(), ['y'])

    expect(code).toBe(EXIT_OK)
    expect(run.state).toBe('ended')
    expect(output).toContain(`Run ${run.id}`)
    expect(output).toContain(`Step 1   write_file  ${PAGE}`)
    expect(output).toContain('第 1 次 Finish 校验：Invariant 0 条')
    expect(output).toContain('→ 校验通过。改动已就绪，等待用户确认。')
    expect(output).toContain('Proposal：新建 1 个、修改 3 个文件')
    expect(output).toContain(`  + ${PAGE}`)
    expect(output).toContain(`+++ b/${PAGE}`)
    expect(output).toContain('已写入 4 个文件')
    expect(readVault(vault, PAGE)).toContain('Obsidian 官方维护的 Agent Skills 集合。')
  })

  it('discards on n and leaves the Vault unchanged', async () => {
    const { code, output, vault } = await review(validIngest(), ['n'])

    expect(code).toBe(EXIT_OK)
    expect(output).toContain('已放弃，Vault 未改动。')
    expect(() => readVault(vault, PAGE)).toThrow()
  })

  it('re-asks on unknown input and empty feedback, then revises on r', async () => {
    const revision = call('edit_file', {
      path: PAGE,
      old: 'Obsidian 官方维护的 Agent Skills 集合。',
      new: 'Obsidian 官方 Skills。',
    })
    const { code, output, vault } = await review(
      [...validIngest(), revision, finish()],
      ['ok', 'r', '  ', 'r', 'TL;DR 再短一点', 'y'],
    )

    expect(code).toBe(EXIT_OK)
    expect(output).toContain('请输入 y、n 或 r。')
    expect(output).toContain('\nTurn 1\n')
    expect(output.match(/写入 Vault？/g)).toHaveLength(4)
    expect(output.match(/修改意见（一行）/g)).toHaveLength(2)
    expect(readVault(vault, PAGE)).toContain('Obsidian 官方 Skills。')
  })

  it('treats Ctrl-C at the prompt as cancel and leaves the Vault unchanged', async () => {
    const { code, vault, events } = await review(validIngest(), [null])

    expect(code).toBe(EXIT_CANCELLED)
    expect(() => readVault(vault, PAGE)).toThrow()
    expect(events().at(-1)).toMatchObject({ type: 'run/end', data: { reason: 'cancelled' } })
  })

  it('reports Invariants when Finish keeps failing', async () => {
    const page = call('write_file', { path: PAGE, content: wikiPage(['no-such-page']) })
    const { code, output } = await review([page, finish(), finish(), finish()], [])

    expect(code).toBe(EXIT_FAILED)
    expect(output).toContain('✗ 校验未通过（第 1/3 次）：')
    expect(output).toContain('Finish 校验未通过，修正次数已用完')
    expect(output).toContain(`[unresolved-link] ${PAGE}：[[no-such-page]] 指向的页面不存在`)
    expect(output).toContain('Vault 未改动。')
  })

  it('reports provider errors', async () => {
    const { code, output } = await review([], [])

    expect(code).toBe(EXIT_FAILED)
    expect(output).toContain('模型请求失败')
    expect(output).toContain('No more faux responses queued')
  })
})

describe('toVaultPath', () => {
  it('keeps relative paths and converts absolute paths inside the Vault', () => {
    expect(toVaultPath('/v', SOURCE)).toBe(SOURCE)
    expect(toVaultPath('/v', `/v/${SOURCE}`)).toBe(SOURCE)
    expect(() => toVaultPath('/v', '/elsewhere/a.md')).toThrow(/不在 Vault/)
    expect(() => toVaultPath('/v', '/v')).toThrow(/不在 Vault/)
  })
})

describe('gitState', () => {
  it('returns null outside a git repository', () => {
    expect(gitState(mkdtempSync(path.join(tmpdir(), 'no-git-')))).toBeNull()
  })

  it('reads HEAD of this repository', () => {
    expect(gitState(import.meta.dirname)?.head).toMatch(/^[0-9a-f]{40}$/)
  })
})

describe('wiki-agent.config.ts', () => {
  it('loads and defines the ingest execution policy (ADR 0008)', async () => {
    const task = resolveTask(await loadConfig(DEFAULT_CONFIG), 'ingest')

    expect(task.writeScope).toContainEqual({ path: 'log.md', mode: 'append-only' })
    expect(task.writeScope).toContainEqual({
      path: 'sources/**',
      mode: 'frontmatter-fields',
      fields: ['ingested-at'],
    })
    expect(task.warnings).toBe('ingest')
  })
})
