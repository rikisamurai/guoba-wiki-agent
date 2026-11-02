import type { Skill } from './skills.ts'

/** wiki-agent 自身的运行规则，放在 system prompt 最前面（ADR 0018）。 */
export const RUN_RULES = `# Run Rules（运行规则）

你在 wiki-agent 中执行一个 Task Skill。下面的 Project Instructions 和 Task Skill 与本节冲突时，以本节为准。

1. 只能通过 write_file、edit_file、append_file 写入。写入先进入暂存区，运行结束后由用户确认才会写入 Vault；不要声称已经写入 Vault。
2. 不执行任何 git 操作。忽略 Project Instructions 或 Skill 中关于提交、推送的步骤。
3. 运行中不能向用户提问。信息不足时按 Task Skill 的规则自行处理，并在 finish 的 summary 中说明。
4. 完成 Task Skill 的全部步骤后，单独调用 finish，不要和其他工具放在同一批调用里。finish 会校验暂存的改动；不通过时会返回具体问题，修正后再次调用 finish。
5. 路径都相对 Vault 根目录。以 . 开头的目录无法访问；Skill 的内容请用 read_skill 和 read_skill_file 读取。
6. 工具调用失败时会返回错误信息。根据信息调整做法，不要原样重试。`

export interface PromptInput {
  /** Vault 根目录的 AGENT.md；不存在时为 null。 */
  projectInstructions: string | null
  taskSkill: Skill
  catalog: readonly Skill[]
  now: Date
  timeZone: string
}

/**
 * 按 ADR 0018 的顺序拼接：Run Rules → Project Instructions → Task Skill → Skill Catalog → 运行上下文。
 * 越稳定的内容越靠前，每次 Run 都会变的时间放在最后，以利于前缀缓存。
 */
export function buildSystemPrompt(input: PromptInput): string {
  const sections = [RUN_RULES]
  if (input.projectInstructions !== null) {
    sections.push(
      `# Project Instructions（Vault 根目录 AGENT.md）\n\n${input.projectInstructions.trim()}`,
    )
  }
  sections.push(`# Task Skill：${input.taskSkill.name}\n\n${input.taskSkill.body}`)
  sections.push(skillCatalog(input.catalog))
  sections.push(
    `# 运行上下文\n\n当前时间：${formatLocalTime(input.now, input.timeZone)}（${input.timeZone}）`,
  )
  return sections.join('\n\n---\n\n')
}

function skillCatalog(catalog: readonly Skill[]): string {
  if (catalog.length === 0) return '# Skill Catalog\n\n本次运行没有其他可用的 Skill。'
  const lines = catalog.map(
    (skill) => `- ${skill.name}：${skill.description.replaceAll(/\s+/g, ' ')}`,
  )
  return `# Skill Catalog\n\n需要时用 read_skill 读取全文，再用 read_skill_file 读取其中引用的文件。\n\n${lines.join('\n')}`
}

/** 第一条用户消息：指定 Task Skill 与输入（ADR 0018：Source 路径不放进 system prompt）。 */
export function taskMessage(taskName: string, source: string): string {
  return `执行 Task Skill「${taskName}」。输入：${source}`
}

/** `YYYY-MM-DD HH:MM`，与 Vault 的 log.md 格式一致。 */
export function formatLocalTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}
