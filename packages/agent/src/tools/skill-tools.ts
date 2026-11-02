import type { AgentTool } from '@earendil-works/pi-agent-core'

import { type Skill, listSkillFiles, readSkillFile } from '../skills.ts'
import { text } from './result.ts'
import { ReadSkillFileParams, ReadSkillParams } from './schemas.ts'

/** 渐进加载的第 2、3 层（ADR 0004）：只能读 Task Skill 与 Catalog 中的 Skill。 */
export function skillTools(readable: readonly Skill[]): AgentTool<any>[] {
  const find = (name: string) => {
    const skill = readable.find((candidate) => candidate.name === name)
    if (!skill) throw new Error(`Skill「${name}」不在本次运行的 Skill Catalog 中`)
    return skill
  }

  const readSkill: AgentTool<typeof ReadSkillParams> = {
    name: 'read_skill',
    label: '读取 Skill',
    description: '读取 Skill Catalog 中某个 Skill 的完整说明，以及它附带的文件列表。',
    parameters: ReadSkillParams,
    execute: async (_id, { name }) => {
      const skill = find(name)
      const files = listSkillFiles(skill)
      const listing =
        files.length > 0
          ? `\n\n附带文件（用 read_skill_file 读取）：\n${files.map((file) => `- ${file}`).join('\n')}`
          : ''
      return text(`${skill.body}${listing}`)
    },
  }

  const readSkillFileTool: AgentTool<typeof ReadSkillFileParams> = {
    name: 'read_skill_file',
    label: '读取 Skill 文件',
    description: '读取某个 Skill 目录中的附带文件，例如 references 下的说明。',
    parameters: ReadSkillFileParams,
    execute: async (_id, { name, path }) => text(readSkillFile(find(name), path)),
  }

  return [readSkill, readSkillFileTool]
}
