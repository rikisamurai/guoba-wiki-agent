import type {
  AgentTool,
  BeforeToolCallContext,
  BeforeToolCallResult,
} from '@earendil-works/pi-agent-core'

import { type Verdict, verdictText } from '../finish.ts'
import { text } from './result.ts'
import { FinishParams } from './schemas.ts'

/**
 * 结束协议（ADR 0007）：通过时返回 terminate；Invariant 未通过时以错误回传，
 * 第 maxFailures 次未通过时同时 terminate；只有 Warning 时以普通结果提示一次。
 */
export function finishTool(
  check: () => Verdict,
  maxFailures: number,
): AgentTool<typeof FinishParams> {
  return {
    name: 'finish',
    label: '完成',
    description:
      '完成 Task Skill 的全部步骤后单独调用。会校验暂存的改动；不通过时返回需要修正的问题。',
    parameters: FinishParams,
    execute: async () => {
      const verdict = check()
      return text(verdictText(verdict, maxFailures), {
        isError: verdict.kind === 'retry' || verdict.kind === 'failed',
        terminate: verdict.kind === 'pass' || verdict.kind === 'failed',
      })
    },
  }
}

/** `beforeToolCall`：finish 与其他工具出现在同一批调用中时拦下 finish（ADR 0007）。 */
export async function requireFinishAlone({
  assistantMessage,
  toolCall,
}: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> {
  const calls = assistantMessage.content.filter((block) => block.type === 'toolCall')
  if (toolCall.name !== 'finish' || calls.length === 1) return undefined
  return {
    block: true,
    reason: 'finish 必须单独调用：先完成其他工具调用，再在下一次回复中只调用 finish。',
  }
}
