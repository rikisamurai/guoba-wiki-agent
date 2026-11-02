import { cpSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { createModels, fauxProvider } from '@earendil-works/pi-ai'
import { describe, expect, it } from 'vitest'

import {
  formatLocalTime,
  loadConfig,
  loadSkills,
  resolveConfig,
  resolveTask,
  selectSkills,
  startRun,
} from '../src/index.ts'
import { readSkillFile } from '../src/skills.ts'
import { SOURCE } from './harness.ts'

const FIXTURE_VAULT = path.resolve(import.meta.dirname, '../../../fixtures/vault')

describe('config', () => {
  it('loads a TypeScript config file and resolves paths against it', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'config-'))
    const file = path.join(dir, 'wiki-agent.config.ts')
    writeFileSync(
      file,
      "export default { vault: './vault', tasks: { ingest: { writeScope: [{ path: 'wiki/**' }] } } }\n",
    )

    const config = await loadConfig(file)

    expect(config.vault).toBe(path.join(dir, 'vault'))
    expect(config.runsDir).toBe(path.join(dir, '.runs'))
    expect(config.model).toEqual({ provider: 'deepseek', id: 'deepseek-flash' })
    expect(resolveTask(config, 'ingest').limits).toEqual({
      steps: 40,
      durationMs: 900_000,
      costUsd: 1,
    })
  })

  it('rejects Task Skills that have no execution policy (ADR 0008)', () => {
    const config = resolveConfig({ vault: '/v', tasks: {} }, '/')
    expect(() => resolveTask(config, 'lint')).toThrow(/tasks\.lint/)
  })

  it('expands ~ in the vault path', () => {
    expect(resolveConfig({ vault: '~/ai-wiki', tasks: {} }, '/x').vault).toMatch(/ai-wiki$/)
    expect(resolveConfig({ vault: '~/ai-wiki', tasks: {} }, '/x').vault).not.toContain('~')
  })
})

describe('skills', () => {
  const skills = loadSkills(FIXTURE_VAULT, ['.agents/skills'])

  it('reads name, description and disable-model-invocation from SKILL.md', () => {
    expect(skills.get('ingest')).toMatchObject({ name: 'ingest', disableModelInvocation: true })
    expect(skills.get('obsidian-markdown')?.disableModelInvocation).toBe(false)
  })

  it('keeps disable-model-invocation Skills out of the catalog and fails on unknown names', () => {
    const selection = selectSkills(skills, 'ingest', ['obsidian-markdown', 'ingest'])
    expect(selection.catalog.map((skill) => skill.name)).toEqual(['obsidian-markdown'])
    expect(() => selectSkills(skills, 'ingest', ['missing'])).toThrow(/missing/)
    expect(() => selectSkills(skills, 'nope', [])).toThrow(/nope/)
  })

  it('reads Skill files but not outside the Skill directory', () => {
    const skill = skills.get('obsidian-markdown')
    if (!skill) throw new Error('fixture skill missing')
    expect(() => readSkillFile(skill, '../ingest/SKILL.md')).toThrow(/越出/)
    expect(() => readSkillFile(skill, 'references/none.md')).toThrow(/没有/)
  })
})

const start = (source: string, maxSourceChars?: number) => {
  const root = mkdtempSync(path.join(tmpdir(), 'start-'))
  const vault = path.join(root, 'vault')
  cpSync(FIXTURE_VAULT, vault, { recursive: true, verbatimSymlinks: true })
  const config = resolveConfig(
    { vault, tasks: { ingest: { writeScope: [{ path: 'wiki/**' }] } } },
    root,
  )
  const faux = fauxProvider()
  const models = createModels()
  models.setProvider(faux.provider)
  return startRun({
    config,
    task: 'ingest',
    source,
    model: faux.getModel(),
    streamFn: models.streamSimple.bind(models),
    ...(maxSourceChars !== undefined && { maxSourceChars }),
  })
}

describe('startRun', () => {
  it('rejects a missing Source before creating a Run', () => {
    expect(() => start('sources/missing.md')).toThrow(/Source 不存在/)
  })

  it('rejects a Source above the size limit (ADR 0010)', () => {
    expect(() => start(SOURCE, 100)).toThrow(/超过上限 100/)
  })
})

describe('formatLocalTime', () => {
  it('formats in the configured time zone', () => {
    const instant = new Date(Date.UTC(2026, 10, 2, 16, 30))
    expect(formatLocalTime(instant, 'Asia/Shanghai')).toBe('2026-11-03 00:30')
    expect(formatLocalTime(instant, 'UTC')).toBe('2026-11-02 16:30')
  })
})
