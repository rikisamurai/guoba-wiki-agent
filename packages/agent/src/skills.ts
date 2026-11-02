import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { parseFrontmatter, splitFrontmatter } from '@guoba-wiki-agent/vault'

export interface Skill {
  name: string
  description: string
  dir: string
  /** SKILL.md 去掉 frontmatter 之后的正文。 */
  body: string
  disableModelInvocation: boolean
  hash: string
}

/** 扫描 Skill 目录（相对 Vault）。同名 Skill 以先出现的目录为准。 */
export function loadSkills(vaultRoot: string, skillDirs: readonly string[]): Map<string, Skill> {
  const skills = new Map<string, Skill>()
  for (const dir of skillDirs) {
    const root = path.resolve(vaultRoot, dir)
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const file = path.join(root, entry.name, 'SKILL.md')
      if (!existsSync(file)) continue
      const skill = readSkill(path.join(root, entry.name), file)
      if (!skills.has(skill.name)) skills.set(skill.name, skill)
    }
  }
  return skills
}

function readSkill(dir: string, file: string): Skill {
  const text = readFileSync(file, 'utf8')
  const frontmatter = parseFrontmatter(text)
  const data = frontmatter.ok ? (frontmatter.data ?? {}) : {}
  const name = typeof data['name'] === 'string' ? data['name'] : path.basename(dir)
  return {
    name,
    description: typeof data['description'] === 'string' ? data['description'].trim() : '',
    dir,
    body: splitFrontmatter(text).body.trim(),
    disableModelInvocation: data['disable-model-invocation'] === true,
    hash: `sha256:${createHash('sha256').update(text).digest('hex')}`,
  }
}

export interface SkillSelection {
  task: Skill
  /** 进入 Skill Catalog 的 Skill（ADR 0004）。 */
  catalog: Skill[]
}

/**
 * 选出 Task Skill 与 Catalog。Catalog 只包含允许列表中、未声明
 * `disable-model-invocation: true` 的 Skill；允许列表里写了不存在的 Skill 时报错。
 */
export function selectSkills(
  skills: ReadonlyMap<string, Skill>,
  taskName: string,
  allowlist: readonly string[],
): SkillSelection {
  const task = skills.get(taskName)
  if (!task) throw new Error(`找不到 Task Skill「${taskName}」`)
  const catalog: Skill[] = []
  for (const name of allowlist) {
    const skill = skills.get(name)
    if (!skill) throw new Error(`Skill Catalog 中的「${name}」不存在`)
    if (!skill.disableModelInvocation && skill.name !== taskName) catalog.push(skill)
  }
  return { task, catalog }
}

/** 读取 Skill 目录下的附属文件，不允许越出该目录。 */
export function readSkillFile(skill: Skill, relativePath: string): string {
  const file = path.resolve(skill.dir, relativePath)
  const inside = path.relative(skill.dir, file)
  if (inside === '' || inside.startsWith('..') || path.isAbsolute(inside)) {
    throw new Error(`路径越出了 Skill 目录：${relativePath}`)
  }
  if (!existsSync(file)) throw new Error(`Skill「${skill.name}」中没有 ${relativePath}`)
  return readFileSync(file, 'utf8')
}

/** Skill 目录下的文件列表（不含 SKILL.md），供模型知道有哪些附属文件可读。 */
export function listSkillFiles(skill: Skill): string[] {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else files.push(path.relative(skill.dir, full).split(path.sep).join('/'))
    }
  }
  walk(skill.dir)
  return files.filter((file) => file !== 'SKILL.md').toSorted()
}
