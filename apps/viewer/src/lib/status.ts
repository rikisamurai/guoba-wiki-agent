import type { RunEndReason } from '@guoba-wiki-agent/trajectory'

export type Tone = 'ok' | 'warn' | 'bad' | 'mute' | 'live'

/** Run 结果标签（设计稿「结果标签」一节）。没有 run/end 的 Run 显示「未结束」。 */
export const RUN_RESULT: Record<RunEndReason | 'incomplete', { label: string; tone: Tone }> = {
  applied: { label: '已写入', tone: 'ok' },
  discarded: { label: '已放弃', tone: 'mute' },
  apply_rejected: { label: '写入被拒', tone: 'bad' },
  invariant_failed: { label: '校验未通过', tone: 'bad' },
  limit: { label: '触及上限', tone: 'warn' },
  cancelled: { label: '已中止', tone: 'mute' },
  provider_error: { label: '模型错误', tone: 'bad' },
  incomplete: { label: '未结束', tone: 'live' },
}

/** 会写入 Staging 的工具，用强调色显示。 */
export const WRITE_TOOLS: ReadonlySet<string> = new Set([
  'write_file',
  'edit_file',
  'append_file',
  'revert_file',
])
