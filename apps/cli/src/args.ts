import path from 'node:path'
import { type ParseArgsOptionsConfig, parseArgs } from 'node:util'

/** 仓库根目录的执行策略（ADR 0008），与工作目录无关。 */
export const DEFAULT_CONFIG = path.resolve(import.meta.dirname, '../../../wiki-agent.config.ts')
export const DEFAULT_TASK = 'ingest'
export const DEFAULT_PORT = 5050

export type Command =
  | { kind: 'run'; source: string; task: string; config: string }
  | { kind: 'view'; port: number; config: string }
  | { kind: 'help' }
  | { kind: 'invalid'; message: string }

export const USAGE = `用法：
  wiki-agent run <source> [--task ${DEFAULT_TASK}] [--config <file>]
      对一份 Source 执行 Task Skill，在终端确认后写入 Vault。
      <source> 相对 Vault 根目录，也可以是 Vault 内的绝对路径。
  wiki-agent view [--port ${DEFAULT_PORT}] [--config <file>]
      在 http://127.0.0.1:<port> 启动只读的 Trajectory 查看器。

  --config 默认为仓库根目录的 wiki-agent.config.ts。
`

const RUN_OPTIONS = {
  task: { type: 'string' },
  config: { type: 'string', short: 'c' },
} satisfies ParseArgsOptionsConfig

const VIEW_OPTIONS = {
  port: { type: 'string', short: 'p' },
  config: { type: 'string', short: 'c' },
} satisfies ParseArgsOptionsConfig

export function parseCommand(argv: readonly string[]): Command {
  const [name, ...rest] = argv
  if (name === undefined || name === 'help' || name === '--help' || name === '-h') {
    return { kind: 'help' }
  }
  try {
    if (name === 'run') return parseRun(rest)
    if (name === 'view') return parseView(rest)
  } catch (error) {
    return { kind: 'invalid', message: error instanceof Error ? error.message : String(error) }
  }
  return { kind: 'invalid', message: `未知命令：${name}` }
}

function parseRun(args: string[]): Command {
  const { values, positionals } = parseArgs({ args, options: RUN_OPTIONS, allowPositionals: true })
  const [source, ...extra] = positionals
  if (!source) return { kind: 'invalid', message: 'run 需要一个 Source 路径' }
  if (extra.length > 0) return { kind: 'invalid', message: `多余的参数：${extra.join(' ')}` }
  return {
    kind: 'run',
    source,
    task: values.task ?? DEFAULT_TASK,
    config: configPath(values.config),
  }
}

function parseView(args: string[]): Command {
  const { values, positionals } = parseArgs({ args, options: VIEW_OPTIONS, allowPositionals: true })
  if (positionals.length > 0) {
    return { kind: 'invalid', message: `多余的参数：${positionals.join(' ')}` }
  }
  const port = values.port === undefined ? DEFAULT_PORT : Number(values.port)
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    return { kind: 'invalid', message: `端口无效：${values.port}` }
  }
  return { kind: 'view', port, config: configPath(values.config) }
}

function configPath(value: string | undefined): string {
  return value === undefined ? DEFAULT_CONFIG : path.resolve(value)
}
