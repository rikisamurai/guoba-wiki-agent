import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { TrajectoryEventMap, TrajectoryEventType } from '../src/index.ts'
import { createTrajectoryWriter, readTrajectoryFile } from '../src/node/index.ts'

export interface Recorder {
  emit<K extends TrajectoryEventType>(type: K, data: TrajectoryEventMap[K]): void
  /** 推进假时钟。 */
  tick(ms: number): void
  readonly now: number
}

export const T0 = 1_762_000_000_000

/** 通过真实的 writer 写一份 Trajectory，再用真实的 reader 读回来。 */
export function recordRun(script: (r: Recorder) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), 'trajectory-'))
  const file = path.join(dir, 'trajectory.jsonl')
  let now = T0
  const writer = createTrajectoryWriter(file, { now: () => now })
  script({
    emit: (type, data) => {
      writer.append(type, data)
    },
    tick: (ms) => {
      now += ms
    },
    get now() {
      return now
    },
  })
  writer.close()
  return { file, ...readTrajectoryFile(file) }
}

export function runStart(r: Recorder) {
  r.emit('run/start', {
    runId: 'run-1',
    taskSkill: 'ingest',
    source: 'sources/posts/obsidian/obsidian/obsidian-claude/skills.md',
    vault: '/vault',
    model: { provider: 'deepseek', id: 'deepseek-flash' },
    thinkingLevel: 'high',
    pricing: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0 },
    config: { tasks: { ingest: { limits: { steps: 40 } } } },
    versions: { wikiAgent: 'b1f3fa7', pi: '1.4.0' },
    vaultGit: { head: '8a603e4', dirty: false },
    skillHashes: { ingest: 'sha256:abc' },
  })
}

/** 一个 Step：先回复（流式输出从 Step 开始后 ttft 毫秒起，持续 decode 毫秒），再执行若干工具。 */
export function step(
  r: Recorder,
  at: { turn: number; step: number },
  opts: {
    ttft: number
    decode: number
    tools: {
      name: string
      args?: string
      writes?: string[]
      durationMs?: number
      isError?: boolean
    }[]
    usage?: TrajectoryEventMap['assistant/message']['usage']
    costUsd?: number
    beforeFinish?: () => void
  },
) {
  r.emit('step/start', at)
  const start = r.now
  const callIds = opts.tools.map((_, i) => `call-${at.turn}-${at.step}-${i}`)
  r.tick(opts.ttft + opts.decode)
  r.emit('assistant/message', {
    ...at,
    blocks: opts.tools.map((tool, i) => ({
      type: 'toolCall' as const,
      id: callIds[i] ?? '',
      name: tool.name,
      arguments: tool.args ?? '{}',
    })),
    stream: [
      { at: start + opts.ttft, kind: 'toolcall', delta: '{' },
      { at: start + opts.ttft + opts.decode, kind: 'toolcall', delta: '}' },
    ],
    stopReason: 'toolUse',
    ...(opts.usage && { usage: opts.usage }),
    ...(opts.costUsd !== undefined && { costUsd: opts.costUsd }),
  })
  for (const [i, tool] of opts.tools.entries()) {
    const callId = callIds[i] ?? ''
    r.emit('tool/call', { ...at, callId, name: tool.name, arguments: tool.args ?? '{}' })
    if (tool.name === 'finish') opts.beforeFinish?.()
    for (const file of tool.writes ?? []) {
      r.emit('staging/write', {
        ...at,
        callId,
        path: file,
        op: 'write',
        beforeHash: null,
        afterHash: 'h',
        bytes: 10,
      })
    }
    r.tick(tool.durationMs ?? 1)
    r.emit('tool/result', {
      ...at,
      callId,
      name: tool.name,
      isError: tool.isError ?? false,
      content: 'ok',
      ...(tool.durationMs !== undefined && { durationMs: tool.durationMs }),
    })
  }
  r.emit('step/end', at)
}
