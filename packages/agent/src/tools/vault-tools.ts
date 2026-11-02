import type { AgentTool } from '@earendil-works/pi-agent-core'
import { type Staging, type WriteResult, globToRegExp } from '@guoba-wiki-agent/vault'

import { text } from './result.ts'
import {
  AppendFileParams,
  EditFileParams,
  GlobParams,
  GrepParams,
  ReadFileParams,
  WriteFileParams,
} from './schemas.ts'

const DEFAULT_LINES = 2000
const MAX_GLOB_RESULTS = 500
const MAX_GREP_MATCHES = 200
const MAX_LINE_CHARS = 300

/** 读写工具都基于 Staging：读到的是 Vault 叠加 Staging 的视图，写入只进 Staging（ADR 0005、0010）。 */
export function vaultTools(
  staging: Staging,
  onWrite: (callId: string, result: WriteResult) => void,
): AgentTool<any>[] {
  const written = (callId: string, result: WriteResult) => {
    onWrite(callId, result)
    return text(`已暂存 ${result.path}（${result.bytes} 字节）`)
  }

  const readFile: AgentTool<typeof ReadFileParams> = {
    name: 'read_file',
    label: '读取文件',
    description: '按行读取 Vault 中的文件。大文件会分段返回，并提示下一段的 offset。',
    parameters: ReadFileParams,
    execute: async (_id, { path, offset = 1, limit = DEFAULT_LINES }) => {
      const content = staging.read(path)
      if (content === null) throw new Error(`${path} 不存在`)
      const lines = content.split('\n')
      const end = Math.min(lines.length, offset - 1 + limit)
      const slice = lines.slice(offset - 1, end).join('\n')
      if (offset === 1 && end === lines.length) return text(slice)
      const more = end < lines.length ? `；用 offset=${end + 1} 继续读取` : ''
      return text(
        `${slice}\n\n（${path} 共 ${lines.length} 行，已显示第 ${offset}–${end} 行${more}）`,
      )
    },
  }

  const glob: AgentTool<typeof GlobParams> = {
    name: 'glob',
    label: '查找文件',
    description: '按 glob 列出 Vault 中的文件（含本次暂存的新文件）。',
    parameters: GlobParams,
    execute: async (_id, { pattern }) => {
      const regex = globToRegExp(pattern)
      const files = staging.list().filter((file) => regex.test(file))
      if (files.length === 0) return text('没有匹配的文件')
      const shown = files.slice(0, MAX_GLOB_RESULTS).join('\n')
      return text(
        files.length > MAX_GLOB_RESULTS
          ? `${shown}\n（共 ${files.length} 个，只显示前 ${MAX_GLOB_RESULTS} 个）`
          : shown,
      )
    },
  }

  const grep: AgentTool<typeof GrepParams> = {
    name: 'grep',
    label: '搜索内容',
    description: '用正则表达式搜索文件内容，返回「路径:行号: 内容」。',
    parameters: GrepParams,
    execute: async (_id, { pattern, path = '**/*.md', ignoreCase = false }) => {
      const regex = new RegExp(pattern, ignoreCase ? 'i' : '')
      const files = staging.list().filter((file) => globToRegExp(path).test(file))
      const matches: string[] = []
      for (const file of files) {
        for (const [index, line] of (staging.read(file) ?? '').split('\n').entries()) {
          if (!regex.test(line)) continue
          matches.push(`${file}:${index + 1}: ${line.slice(0, MAX_LINE_CHARS)}`)
          if (matches.length >= MAX_GREP_MATCHES) {
            return text(`${matches.join('\n')}\n（已达到 ${MAX_GREP_MATCHES} 条上限，请缩小范围）`)
          }
        }
      }
      return text(matches.length > 0 ? matches.join('\n') : '没有匹配的内容')
    },
  }

  const writeFile: AgentTool<typeof WriteFileParams> = {
    name: 'write_file',
    label: '写入文件',
    description: '新建或整体覆盖一个文件。写入进入暂存区，运行结束后由用户确认。',
    parameters: WriteFileParams,
    execute: async (id, { path, content }) => written(id, staging.write(path, content)),
  }

  const editFile: AgentTool<typeof EditFileParams> = {
    name: 'edit_file',
    label: '编辑文件',
    description: '把文件中恰好出现一次的 old 替换为 new。出现 0 次或多次都会报错。',
    parameters: EditFileParams,
    execute: async (id, params) => written(id, staging.edit(params.path, params.old, params.new)),
  }

  const appendFile: AgentTool<typeof AppendFileParams> = {
    name: 'append_file',
    label: '追加内容',
    description: '在文件末尾追加文本，适合 log.md 这类只追加的大文件。',
    parameters: AppendFileParams,
    execute: async (id, { path, text: appended }) => written(id, staging.append(path, appended)),
  }

  return [readFile, glob, grep, writeFile, editFile, appendFile]
}
