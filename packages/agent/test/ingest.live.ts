/**
 * 真模型冒烟测试（ADR 0016 第 2 层）。运行：DEEPSEEK_API_KEY=... pnpm test:live
 * 按仓库的 wiki-agent.config.ts，在 fixture Vault 的临时副本上对未 Ingest 的 Source 跑一次真实 ingest 并 Apply。
 * 只断言 Invariant 全部通过、Trajectory 完整、Usage 与费用被记录，不断言页面内容。
 */
import { cpSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { summarizeRun } from '@guoba-wiki-agent/trajectory'
import { readTrajectoryFile } from '@guoba-wiki-agent/trajectory/node'
import { describe, expect, it } from 'vitest'

import { loadConfig, resolveModel, startRun } from '../src/index.ts'
import { FIXTURE_VAULT, SOURCE } from './harness.ts'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')

describe.skipIf(!process.env['DEEPSEEK_API_KEY'])('DeepSeek live ingest', () => {
  it('ingests the fixture Source with all Invariants passing and a complete Trajectory', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'agent-live-'))
    const vault = path.join(root, 'vault')
    cpSync(FIXTURE_VAULT, vault, { recursive: true, verbatimSymlinks: true })
    const config = {
      ...(await loadConfig(path.join(REPO_ROOT, 'wiki-agent.config.ts'))),
      vault,
      runsDir: path.join(root, '.runs'),
    }
    const run = startRun({ config, task: 'ingest', source: SOURCE, ...resolveModel(config.model) })

    const result = await run.execute()
    expect(result.status, `${run.dir} ${result.error ?? ''}`).toBe('ready')
    expect(result.validation?.invariants).toEqual([])
    expect(run.apply().status).toBe('applied')

    const { events, truncatedTail } = readTrajectoryFile(path.join(run.dir, 'trajectory.jsonl'))
    expect(truncatedTail).toBe(false)
    expect(events[0]?.type).toBe('run/start')
    expect(events.at(-1)).toMatchObject({ type: 'run/end', data: { reason: 'applied' } })
    const summary = summarizeRun(events)
    expect(JSON.parse(readFileSync(path.join(run.dir, 'result.json'), 'utf8'))).toEqual(summary)
    expect(summary.invariants).toEqual([])
    expect(summary.usage.input).toBeGreaterThan(0)
    expect(summary.usage.output).toBeGreaterThan(0)
    expect(summary.costComplete).toBe(true)
    expect(summary.costUsd).toBeGreaterThan(0)
  })
})
