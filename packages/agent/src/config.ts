import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type { WriteScopeRule } from '@guoba-wiki-agent/vault'

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface Limits {
  steps: number
  durationMs: number
  costUsd: number
}

/** 一个 Task Skill 的执行策略（ADR 0008）。 */
export interface TaskConfig {
  writeScope: WriteScopeRule[]
  /** 允许进入 Skill Catalog 的其他 Skill。 */
  catalog?: string[]
  /** Finish 时额外检查的 Warning 规则集。 */
  warnings?: 'ingest'
  limits?: Partial<Limits>
}

export interface WikiAgentConfig {
  /** Vault 根目录，支持 `~/`，相对路径相对配置文件。 */
  vault: string
  /** Skill 来源目录，相对 Vault。 */
  skillDirs?: string[]
  model?: { provider: string; id: string }
  thinkingLevel?: ThinkingLevel
  /** IANA 时区，默认取系统时区（ADR 0010）。 */
  timeZone?: string
  /** Run 记录目录，相对配置文件（ADR 0014）。 */
  runsDir?: string
  tasks: Record<string, TaskConfig>
}

export const DEFAULT_LIMITS: Limits = { steps: 40, durationMs: 15 * 60_000, costUsd: 1 }
export const DEFAULT_SKILL_DIRS = ['.agents/skills']
export const DEFAULT_MAX_SOURCE_CHARS = 200_000

export function defineConfig(config: WikiAgentConfig): WikiAgentConfig {
  return config
}

export interface ResolvedConfig {
  vault: string
  skillDirs: string[]
  model: { provider: string; id: string }
  thinkingLevel: ThinkingLevel
  timeZone: string
  runsDir: string
  tasks: Record<string, TaskConfig>
}

/** 填入默认值，把路径解析为绝对路径。`baseDir` 是配置文件所在目录。 */
export function resolveConfig(config: WikiAgentConfig, baseDir: string): ResolvedConfig {
  return {
    vault: resolvePath(config.vault, baseDir),
    skillDirs: config.skillDirs ?? DEFAULT_SKILL_DIRS,
    model: config.model ?? { provider: 'deepseek', id: 'deepseek-flash' },
    thinkingLevel: config.thinkingLevel ?? 'high',
    timeZone: config.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    runsDir: resolvePath(config.runsDir ?? '.runs', baseDir),
    tasks: config.tasks,
  }
}

/** 加载 `wiki-agent.config.ts`（Node 原生执行 TypeScript）。 */
export async function loadConfig(file: string): Promise<ResolvedConfig> {
  const absolute = path.resolve(file)
  const module: unknown = await import(pathToFileURL(absolute).href)
  const config = isRecord(module) ? module['default'] : undefined
  if (!isRecord(config) || typeof config['vault'] !== 'string' || !isRecord(config['tasks'])) {
    throw new Error(`${file} 必须 export default defineConfig({ vault, tasks })`)
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 配置由 defineConfig 提供类型，这里只校验了必填字段
  return resolveConfig(config as unknown as WikiAgentConfig, path.dirname(absolute))
}

export interface ResolvedTask {
  name: string
  writeScope: WriteScopeRule[]
  catalog: string[]
  warnings: 'ingest' | 'none'
  limits: Limits
}

/** 没有配置的 Task Skill 拒绝运行，不提供默认的写入范围（ADR 0008）。 */
export function resolveTask(config: ResolvedConfig, name: string): ResolvedTask {
  const task = config.tasks[name]
  if (!task) {
    throw new Error(
      `没有为 Task Skill「${name}」配置执行策略（wiki-agent.config.ts 的 tasks.${name}）`,
    )
  }
  return {
    name,
    writeScope: task.writeScope,
    catalog: task.catalog ?? [],
    warnings: task.warnings ?? 'none',
    limits: { ...DEFAULT_LIMITS, ...task.limits },
  }
}

function resolvePath(value: string, baseDir: string): string {
  if (value === '~' || value.startsWith('~/')) return path.join(homedir(), value.slice(1))
  return path.resolve(baseDir, value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
