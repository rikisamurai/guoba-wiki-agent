/**
 * 全部工具参数 Schema 集中在这里（ADR 0002）。Pi 1.4.0 只接受 TypeBox schema；
 * main 分支已移除 pi-ai 的 `Type` 导出，升级时只需改这个文件。
 */
import { Type } from '@earendil-works/pi-ai'

const path = Type.String({ description: '相对 Vault 根目录的路径，例如 wiki/frontend/a.md' })

export const ReadFileParams = Type.Object({
  path,
  offset: Type.Optional(Type.Integer({ minimum: 1, description: '从第几行开始读，默认 1' })),
  limit: Type.Optional(Type.Integer({ minimum: 1, description: '最多读多少行，默认 2000' })),
})

export const GlobParams = Type.Object({
  pattern: Type.String({ description: 'glob，例如 wiki/**/*.md；** 跨目录，* 不跨目录' }),
})

export const GrepParams = Type.Object({
  pattern: Type.String({ description: 'JavaScript 正则表达式' }),
  path: Type.Optional(Type.String({ description: '只搜索匹配这个 glob 的文件，默认 **/*.md' })),
  ignoreCase: Type.Optional(Type.Boolean({ description: '忽略大小写，默认 false' })),
})

export const WriteFileParams = Type.Object({
  path,
  content: Type.String({ description: '文件的完整内容' }),
})

export const EditFileParams = Type.Object({
  path,
  old: Type.String({ description: '要替换的原文，必须在文件中恰好出现一次' }),
  new: Type.String({ description: '替换后的文本' }),
})

export const AppendFileParams = Type.Object({
  path,
  text: Type.String({ description: '追加到文件末尾的文本（不会自动补换行）' }),
})

export const RevertFileParams = Type.Object({ path })

export const ReadSkillParams = Type.Object({
  name: Type.String({ description: 'Skill Catalog 中的 Skill 名称' }),
})

export const ReadSkillFileParams = Type.Object({
  name: Type.String({ description: 'Skill 名称' }),
  path: Type.String({ description: 'Skill 目录内的相对路径，例如 references/callouts.md' }),
})

export const FinishParams = Type.Object({
  summary: Type.String({ description: '一两句话说明本次做了哪些改动' }),
})
