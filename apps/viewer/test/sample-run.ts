import type {
  AnyTrajectoryEvent,
  TrajectoryEventMap,
  TrajectoryEventType,
} from '@guoba-wiki-agent/trajectory'

export const RUN_ID = '2026-11-02T09-10-19Z-c59f6340'
export const SOURCE = 'sources/posts/obsidian/obsidian/obsidian-claude/skills.md'
export const PAGE = 'wiki/skills/obsidian-skills.md'
export const THINKING =
  '先读 Source，确认要新建哪些页面。\n第二行：检查 index.md 的分区。\n第三行不应在折叠时出现。'
const T0 = Date.UTC(2026, 10, 2, 9, 10, 19)

const PAGE_DIFF = `===================================================================
--- /dev/null
+++ b/${PAGE}
@@ -0,0 +1,3 @@
+---
+title: Obsidian Skills
+---
`
const INDEX_DIFF = `===================================================================
--- a/index.md
+++ b/index.md
@@ -1,2 +1,3 @@
 # Index
-- old
+- [[wiki/skills/obsidian-skills|Obsidian Skills]]
+- new
`

/**
 * 一次两个 Turn 的 ingest：Turn 0 写页面、Finish 先回传 Warning 再通过；Revise 后 Turn 1 再改一次，最后写入。
 * `upTo` 只保留前若干个事件，用来模拟进行中的 Run。
 */
export function sampleRun(upTo?: number): AnyTrajectoryEvent[] {
  const events: AnyTrajectoryEvent[] = []
  let now = T0
  const emit = <K extends TrajectoryEventType>(type: K, data: TrajectoryEventMap[K], dt = 10) => {
    now += dt
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- type 与 data 由同一个 K 约束，正是联合类型中的一支
    events.push({ type, seq: events.length, time: now, data } as AnyTrajectoryEvent)
  }
  const step = (
    turn: number,
    n: number,
    opts: {
      ttft: number
      decode: number
      thinking?: string
      tools: {
        name: string
        args: Record<string, string>
        result: string
        write?: 'write' | 'edit'
        ms?: number
      }[]
    },
  ) => {
    emit('step/start', { turn, step: n })
    const start = now
    emit(
      'assistant/message',
      {
        turn,
        step: n,
        blocks: [
          ...(opts.thinking ? [{ type: 'thinking' as const, thinking: opts.thinking }] : []),
          ...opts.tools.map((tool, i) => ({
            type: 'toolCall' as const,
            id: `c${turn}${n}${i}`,
            name: tool.name,
            arguments: JSON.stringify(tool.args),
          })),
        ],
        stream: [
          { at: start + opts.ttft, kind: 'thinking', delta: '先' },
          { at: start + opts.ttft + opts.decode, kind: 'toolcall', delta: '}' },
        ],
        stopReason: 'toolUse',
        usage: { input: 1200, output: 300 * (n + 1), cacheRead: 4096, cacheWrite: 0 },
        costUsd: 0.0005 * (n + 1),
      },
      opts.ttft + opts.decode,
    )
    for (const [i, tool] of opts.tools.entries()) {
      const callId = `c${turn}${n}${i}`
      emit('tool/call', {
        turn,
        step: n,
        callId,
        name: tool.name,
        arguments: JSON.stringify(tool.args),
      })
      if (tool.write) {
        emit('staging/write', {
          turn,
          step: n,
          callId,
          path: tool.args['path'] ?? '',
          op: tool.write,
          beforeHash: tool.write === 'write' ? null : 'sha256:aaaa',
          afterHash: 'sha256:bbbb',
          bytes: 2043,
        })
      }
      if (tool.name === 'finish') validation(turn, n)
      emit('tool/result', {
        turn,
        step: n,
        callId,
        name: tool.name,
        isError: false,
        content: tool.result,
        durationMs: tool.ms ?? 1,
      })
    }
    emit('step/end', { turn, step: n })
  }
  let attempt = 0
  const validation = (turn: number, n: number) => {
    attempt += 1
    const warned = attempt === 1
    emit('validation/result', {
      turn,
      step: n,
      attempt,
      invariants: [],
      warnings: [
        {
          level: 'warning',
          rule: 'min-outlinks',
          message: '只有 1 条出链，至少需要 2 条',
          path: PAGE,
        },
      ],
      verdict: warned ? 'warnings' : 'pass',
    })
  }
  const finish = { name: 'finish', args: { summary: '完成' }, result: '校验通过。', ms: 20 }

  emit(
    'run/start',
    {
      runId: RUN_ID,
      taskSkill: 'ingest',
      source: SOURCE,
      vault: '/vault',
      model: { provider: 'deepseek', id: 'deepseek-flash' },
      thinkingLevel: 'high',
      pricing: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0 },
      config: {},
      versions: { wikiAgent: '7b48321', pi: '1.4.0' },
      vaultGit: { head: '8a603e4c', dirty: false },
      skillHashes: { ingest: 'sha256:249190c7cee8' },
    },
    0,
  )
  emit('request/header', {
    systemPrompt:
      '# Run Rules（运行规则）\n\n规则\n\n---\n\n# Project Instructions（Vault 根目录 AGENT.md）\n\n段内分隔线\n\n---\n\n不是新段\n\n---\n\n# 运行上下文\n\n当前时间',
    tools: [
      {
        name: 'read_file',
        description: '按行读取 Vault 中的文件。',
        parameters: { type: 'object' },
      },
      { name: 'write_file', description: '新建或覆盖文件。', parameters: { type: 'object' } },
    ],
    model: { provider: 'deepseek', id: 'deepseek-flash' },
    thinkingLevel: 'high',
  })
  emit('turn/start', { turn: 0 })
  emit('user/message', {
    turn: 0,
    source: 'task',
    text: `执行 Task Skill「ingest」。输入：${SOURCE}`,
  })
  step(0, 0, {
    ttft: 1500,
    decode: 200,
    thinking: THINKING,
    tools: [{ name: 'read_file', args: { path: SOURCE }, result: '# Obsidian Skills' }],
  })
  step(0, 1, {
    ttft: 900,
    decode: 12_000,
    tools: [
      {
        name: 'write_file',
        args: { path: PAGE, content: '---\ntitle: Obsidian Skills\n---\n' },
        result: `已暂存 ${PAGE}（2043 字节）`,
        write: 'write',
      },
      {
        name: 'edit_file',
        args: { path: 'index.md', old: '- old', new: '- new' },
        result: '已暂存 index.md',
        write: 'edit',
      },
    ],
  })
  step(0, 2, {
    ttft: 1100,
    decode: 600,
    tools: [{ ...finish, result: 'Invariant 全部通过，但有以下不符合 Skill 规范的地方：…' }],
  })
  step(0, 3, { ttft: 1000, decode: 500, tools: [finish] })
  emit('proposal/diff', {
    turn: 0,
    files: [
      { path: 'index.md', created: false, diff: INDEX_DIFF },
      { path: PAGE, created: true, diff: PAGE_DIFF },
    ],
  })
  emit('turn/end', { turn: 0, reason: 'finished' })
  emit('review/decision', { turn: 0, choice: 'r', feedback: 'TL;DR 再短一点' }, 5000)
  emit('turn/start', { turn: 1 })
  emit('user/message', { turn: 1, source: 'revise', text: 'TL;DR 再短一点' })
  step(1, 0, {
    ttft: 800,
    decode: 900,
    tools: [
      {
        name: 'edit_file',
        args: { path: PAGE, old: 'a', new: 'b' },
        result: `已暂存 ${PAGE}`,
        write: 'edit',
      },
    ],
  })
  step(1, 1, { ttft: 700, decode: 300, tools: [finish] })
  emit('proposal/diff', {
    turn: 1,
    files: [
      { path: 'index.md', created: false, diff: INDEX_DIFF },
      { path: PAGE, created: true, diff: PAGE_DIFF },
    ],
  })
  emit('turn/end', { turn: 1, reason: 'finished' })
  emit('review/decision', { turn: 1, choice: 'y' }, 3000)
  emit('apply/result', { written: ['index.md', PAGE], conflicts: [], failed: [], invariants: [] })
  emit('run/end', { reason: 'applied' })
  return upTo === undefined ? events : events.slice(0, upTo)
}

export function toJsonl(events: readonly AnyTrajectoryEvent[]): string {
  return events.map((event) => `${JSON.stringify(event)}\n`).join('')
}
