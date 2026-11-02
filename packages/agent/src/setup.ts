import { randomUUID } from 'node:crypto'
import path from 'node:path'

import type { AgentTool, StreamFn } from '@earendil-works/pi-agent-core'
import type { Model } from '@earendil-works/pi-ai'
import type { AnyTrajectoryEvent, JsonValue } from '@guoba-wiki-agent/trajectory'
import { createTrajectoryWriter } from '@guoba-wiki-agent/trajectory/node'
import { Staging, readVaultText } from '@guoba-wiki-agent/vault'

import { piVersion } from './artifacts.ts'
import {
  DEFAULT_MAX_SOURCE_CHARS,
  type ResolvedConfig,
  type ResolvedTask,
  resolveTask,
} from './config.ts'
import { buildSystemPrompt } from './prompt.ts'
import { Recorder } from './recorder.ts'
import { type SkillSelection, loadSkills, selectSkills } from './skills.ts'

export interface StartRunOptions {
  config: ResolvedConfig
  /** Task Skill 名称，例如 ingest。 */
  task: string
  /** 输入的 Source 路径（相对 Vault）。 */
  source: string
  model: Model<any>
  streamFn: StreamFn
  /** Trajectory 时间戳与当前时间的来源，测试中可替换。 */
  now?: () => number
  versions?: { wikiAgent: string | null }
  vaultGit?: { head: string; dirty: boolean } | null
  maxSourceChars?: number
  /** 每写入一条 Trajectory Event 后调用，例如用于终端进度。 */
  onEvent?: (event: AnyTrajectoryEvent) => void
}

export interface PreparedRun {
  options: StartRunOptions
  runId: string
  runDir: string
  task: ResolvedTask
  skills: SkillSelection
  staging: Staging
  systemPrompt: string
  recorder: Recorder
  close: () => void
  now: () => number
}

/** 校验输入、准备 Staging 与 system prompt、打开 Trajectory 并写入 run/start（ADR 0014、0018）。 */
export function prepareRun(options: StartRunOptions): PreparedRun {
  const { config } = options
  const now = options.now ?? Date.now
  const task = resolveTask(config, options.task)
  const skills = selectSkills(loadSkills(config.vault, config.skillDirs), task.name, task.catalog)
  const staging = new Staging(config.vault, task.writeScope)

  const source = staging.read(options.source)
  if (source === null) throw new Error(`Source 不存在：${options.source}`)
  const maxChars = options.maxSourceChars ?? DEFAULT_MAX_SOURCE_CHARS
  if (source.length > maxChars) {
    throw new Error(`Source 有 ${source.length} 字符，超过上限 ${maxChars}（ADR 0010：v1 不分块）`)
  }

  const systemPrompt = buildSystemPrompt({
    projectInstructions: readVaultText(config.vault, 'AGENT.md'),
    taskSkill: skills.task,
    catalog: skills.catalog,
    now: new Date(now()),
    timeZone: config.timeZone,
  })

  const runId = `${new Date(now())
    .toISOString()
    .replaceAll(':', '-')
    .replace(/\.\d+Z$/, 'Z')}-${randomUUID().slice(0, 8)}`
  const runDir = path.join(config.runsDir, runId)
  const writer = createTrajectoryWriter(path.join(runDir, 'trajectory.jsonl'), { now })
  const { model } = options
  const recorder = new Recorder(writer, now, model, options.onEvent)
  recorder.emit('run/start', {
    runId,
    taskSkill: task.name,
    source: options.source,
    vault: config.vault,
    model: { provider: model.provider, id: model.id },
    thinkingLevel: config.thinkingLevel,
    pricing: { ...model.cost },
    config: toJson({ task, skillDirs: config.skillDirs, timeZone: config.timeZone }),
    versions: { wikiAgent: options.versions?.wikiAgent ?? null, pi: piVersion() },
    vaultGit: options.vaultGit ?? null,
    skillHashes: Object.fromEntries(
      [skills.task, ...skills.catalog].map((skill) => [skill.name, skill.hash]),
    ),
  })
  return {
    options,
    runId,
    runDir,
    task,
    skills,
    staging,
    systemPrompt,
    recorder,
    close: () => writer.close(),
    now,
  }
}

/** 记录发给模型的完整请求头：system prompt 与工具 Schema。 */
export function recordRequestHeader(prepared: PreparedRun, tools: readonly AgentTool<any>[]): void {
  prepared.recorder.emit('request/header', {
    systemPrompt: prepared.systemPrompt,
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: toJson(tool.parameters),
    })),
    model: { provider: prepared.options.model.provider, id: prepared.options.model.id },
    thinkingLevel: prepared.options.config.thinkingLevel,
  })
}

/** 去掉 undefined 与 TypeBox 的 Symbol 键，得到可无损写入 Trajectory 的 JSON。 */
function toJson(value: unknown): JsonValue {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse 的结果本身就是 JSON 值
  return JSON.parse(JSON.stringify(value)) as JsonValue
}
