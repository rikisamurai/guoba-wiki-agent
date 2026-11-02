import { buildLedger, allSteps } from '@guoba-wiki-agent/trajectory'
import { describe, expect, it } from 'vitest'

import { parseDiff } from '@/lib/diff'
import { formatClock, formatSeconds, formatTokens, splitPath } from '@/lib/format'
import { splitSystemPrompt } from '@/lib/prompt'
import { argHint, groupedTools, verdictText, verdictTone, writeSummary } from '@/lib/steps'
import { timeTicks } from '@/lib/timeline'

import { PAGE, sampleRun } from './sample-run.ts'

describe('format', () => {
  it('formats durations, clock time, tokens and paths', () => {
    expect(formatSeconds(960)).toBe('0.96 s')
    expect(formatSeconds(57_121)).toBe('57.1 s')
    expect(formatClock(73_354)).toBe('01:13.4')
    expect(formatTokens(131_712)).toBe('131.7k')
    expect(formatTokens(351)).toBe('351')
    expect(splitPath('wiki/skills/a.md')).toEqual({ dir: 'wiki/skills/', name: 'a.md' })
    expect(splitPath('index.md')).toEqual({ dir: '', name: 'index.md' })
  })
})

describe('parseDiff', () => {
  it('numbers lines from the hunk header and counts changes', () => {
    const diff =
      '===\n--- a/x\n+++ b/x\n@@ -3,2 +3,3 @@\n same\n-old\n+new\n+more\n\\ No newline at end of file\n'
    const parsed = parseDiff(diff)
    expect(parsed).toMatchObject({ added: 2, removed: 1 })
    expect(parsed.rows.map((row) => [row.kind, row.oldNo, row.newNo])).toEqual([
      ['hunk', undefined, undefined],
      ['ctx', 3, 3],
      ['del', 4, undefined],
      ['add', undefined, 4],
      ['add', undefined, 5],
      ['meta', undefined, undefined],
    ])
  })
})

describe('timeTicks', () => {
  it('picks round steps with at most ten intervals', () => {
    expect(timeTicks(84_652)).toEqual({ stepMs: 10_000, domainMs: 90_000 })
    expect(timeTicks(7_300)).toEqual({ stepMs: 1000, domainMs: 8000 })
    expect(timeTicks(0)).toEqual({ stepMs: 500, domainMs: 500 })
  })
})

describe('splitSystemPrompt', () => {
  it('splits on the ADR 0018 separator but keeps rules inside a section', () => {
    const header = buildLedger(sampleRun()).headers[0]
    const sections = splitSystemPrompt(header?.systemPrompt ?? '')
    expect(sections.map((section) => section.title)).toEqual([
      'Run Rules（运行规则）',
      'Project Instructions（Vault 根目录 AGENT.md）',
      '运行上下文',
    ])
    expect(sections[1]?.text).toContain('不是新段')
  })
})

describe('steps', () => {
  const steps = allSteps(buildLedger(sampleRun()))

  it('summarizes tool calls and Staging writes', () => {
    const write = steps[1]?.tools[0]
    expect(write && argHint(write.arguments)).toBe(PAGE)
    expect(write && writeSummary(write)).toBe('新建 · 2,043 字节')
    expect(steps[1] && groupedTools(steps[1])).toBeNull()
  })

  it('describes Finish verdicts, and falls back to counts for old Trajectories', () => {
    const [warned, passed] = steps.flatMap((step) => step.validations)
    expect(warned && [verdictText(warned), verdictTone(warned)]).toEqual([
      'Warning 1 条，已回传模型',
      'warn',
    ])
    expect(passed && [verdictText(passed), verdictTone(passed)]).toEqual(['校验通过', 'ok'])
    const { verdict: _, ...old } = passed ?? warned!
    expect(verdictText(old)).toBe('Invariant 0 条 · Warning 1 条')
    expect(verdictTone(old)).toBe('warn')
  })
})
