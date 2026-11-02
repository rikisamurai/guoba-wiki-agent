import type { AgentToolResult } from '@earendil-works/pi-agent-core'

export function text(
  content: string,
  extra: { isError?: boolean; terminate?: boolean } = {},
): AgentToolResult<undefined> {
  return { content: [{ type: 'text', text: content }], details: undefined, ...extra }
}
