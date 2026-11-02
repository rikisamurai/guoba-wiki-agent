export interface PromptSection {
  title: string
  text: string
}

/**
 * 按 ADR 0018 的拼接方式拆分 system prompt：各段以 `\n\n---\n\n` 分隔，每段以一级标题开头。
 * 段内的分隔线（后面不是一级标题）不会被拆开。
 */
export function splitSystemPrompt(prompt: string): PromptSection[] {
  return prompt.split(/\n\n---\n\n(?=# )/).map((text) => ({
    title: (text.split('\n', 1)[0] ?? '').replace(/^#\s*/, ''),
    text,
  }))
}
