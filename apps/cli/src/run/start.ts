import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { type Run, loadConfig, resolveModel, startRun } from '@guoba-wiki-agent/agent'
import type { AnyTrajectoryEvent } from '@guoba-wiki-agent/trajectory'

const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..')

/** 加载配置、检查模型与 API Key、记录版本信息，然后开始 Run（写入 run/start）。 */
export async function startCliRun(
  command: { source: string; task: string; config: string },
  onEvent: (event: AnyTrajectoryEvent) => void,
): Promise<Run> {
  if (!existsSync(command.config)) throw new Error(`找不到配置文件：${command.config}`)
  const config = await loadConfig(command.config)
  if (!existsSync(config.vault)) {
    throw new Error(`Vault 不存在：${config.vault}（修改 ${command.config} 中的 vault）`)
  }
  const { model, streamFn } = resolveModel(config.model)
  const tool = gitState(REPO_ROOT)
  return startRun({
    config,
    task: command.task,
    source: toVaultPath(config.vault, command.source),
    model,
    streamFn,
    versions: { wikiAgent: tool && `${tool.head}${tool.dirty ? '-dirty' : ''}` },
    vaultGit: gitState(config.vault),
    onEvent,
  })
}

/** 相对路径按 Vault 根目录解释；绝对路径必须位于 Vault 内。 */
export function toVaultPath(vault: string, source: string): string {
  if (!path.isAbsolute(source)) return source
  const relative = path.relative(vault, source)
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Source 不在 Vault（${vault}）内：${source}`)
  }
  return relative.split(path.sep).join('/')
}

/** 目录所在 git 仓库的 HEAD 与是否有未提交改动；不是 git 仓库时为 null（ADR 0014 run/start）。 */
export function gitState(dir: string): { head: string; dirty: boolean } | null {
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  try {
    return { head: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain') !== '' }
  } catch {
    return null
  }
}
