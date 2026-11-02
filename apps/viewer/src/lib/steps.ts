import type { StepView, ToolView, TrajectoryEventMap } from '@guoba-wiki-agent/trajectory'

type Verdict = NonNullable<TrajectoryEventMap['validation/result']['verdict']>

/** 工具参数里最能说明这次调用的一项：路径、模式或 Skill 名。 */
export function argHint(json: string): string {
  try {
    const args: unknown = JSON.parse(json)
    if (typeof args !== 'object' || args === null) return ''
    const fields = new Map<string, unknown>(Object.entries(args))
    for (const key of ['path', 'pattern', 'name']) {
      const value = fields.get(key)
      if (typeof value === 'string') return value
    }
  } catch {
    // 参数不是 JSON 时不显示提示
  }
  return ''
}

/** 解析后的参数，按字段展示；无法解析时整体作为一个字段。 */
export function argFields(json: string): { key: string; value: string }[] {
  try {
    const args: unknown = JSON.parse(json)
    if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
      return Object.entries(args).map(([key, value]) => ({
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      }))
    }
  } catch {
    // 落到下面的原文
  }
  return [{ key: 'arguments', value: json }]
}

const VERDICT_TEXT: Record<Verdict, (invariants: number, warnings: number) => string> = {
  pass: () => '校验通过',
  warnings: (_, warnings) => `Warning ${warnings} 条，已回传模型`,
  retry: (invariants) => `Invariant ${invariants} 条，已回传模型修正`,
  failed: (invariants) => `Invariant ${invariants} 条，修正次数已用完`,
}

/** 一次 Finish 校验的结果文字。旧 Trajectory 没有 verdict 时只显示条数。 */
export function verdictText(validation: TrajectoryEventMap['validation/result']): string {
  const { invariants, warnings, verdict } = validation
  if (verdict) return VERDICT_TEXT[verdict](invariants.length, warnings.length)
  return `Invariant ${invariants.length} 条 · Warning ${warnings.length} 条`
}

/** 旧 Trajectory 没有 verdict：有 Warning 时按「回传」显示，宁可多提示。 */
export function verdictTone(validation: TrajectoryEventMap['validation/result']) {
  if (validation.invariants.length > 0) return 'bad' as const
  if (validation.verdict === 'warnings') return 'warn' as const
  if (validation.verdict === undefined && validation.warnings.length > 0) return 'warn' as const
  return 'ok' as const
}

export function stepDuration(step: StepView, now: number): number {
  return (step.endedAt ?? now) - step.startedAt
}

export function toolTime(step: StepView): number {
  return step.tools.reduce((sum, tool) => sum + (tool.result?.durationMs ?? 0), 0)
}

/** 一个工具调用写入 Staging 的摘要，例如「新建 · 2,043 字节」。 */
export function writeSummary(tool: ToolView): string {
  const last = tool.writes.at(-1)
  if (!last) return ''
  const created = tool.writes[0]?.beforeHash === null
  return `${created ? '新建' : '修改'} · ${last.bytes.toLocaleString('en-US')} 字节`
}

/** 同名工具连续调用多次时合并显示，例如 write_file ×8。 */
export function groupedTools(
  step: StepView,
): { name: string; count: number; bytes: number } | null {
  const names = new Set(step.tools.map((tool) => tool.name))
  if (step.tools.length < 3 || names.size !== 1) return null
  const bytes = step.tools.reduce((sum, tool) => sum + (tool.writes.at(-1)?.bytes ?? 0), 0)
  return { name: step.tools[0]?.name ?? '', count: step.tools.length, bytes }
}

export function thinkingText(step: StepView): string {
  return (step.assistant?.blocks ?? [])
    .map((block) => (block.type === 'thinking' ? block.thinking : ''))
    .filter(Boolean)
    .join('\n\n')
}

export function replyText(step: StepView): string {
  return (step.assistant?.blocks ?? [])
    .map((block) => (block.type === 'text' ? block.text : ''))
    .filter(Boolean)
    .join('\n\n')
}
