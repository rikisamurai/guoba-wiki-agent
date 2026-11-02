/**
 * Pi 1.4.0 行为的契约测试。ADR 0002 / 0007 / 0018 依赖这些行为；
 * 升级 Pi 时这里先失败，说明需要重新审视相应 ADR。
 */
import { Agent } from '@earendil-works/pi-agent-core'
import {
  Type,
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from '@earendil-works/pi-ai'
import { describe, expect, it } from 'vitest'

/** 只有 `finish` 返回 terminate: true 的工具。 */
function tool(name: string) {
  return {
    name,
    label: name,
    description: name,
    // 1.4.0 的 AgentTool 只接受 TypeBox schema；main 分支已改为任意 JSON Schema（ADR 0002）。
    parameters: Type.Object({}),
    execute: async () => ({
      content: [{ type: 'text' as const, text: 'ok' }],
      details: {},
      terminate: name === 'finish',
    }),
  }
}

function setup() {
  const faux = fauxProvider()
  const models = createModels()
  models.setProvider(faux.provider)
  const agent = new Agent({
    initialState: { systemPrompt: 'RUN RULES', model: faux.getModel() },
    streamFn: models.streamSimple.bind(models),
  })
  return { agent, faux }
}

describe('Pi 1.4.0 contract', () => {
  it('puts the system prompt into the transcript as the leading system message', async () => {
    const { agent, faux } = setup()
    faux.setResponses([
      (context) => {
        expect(context.messages[0]).toMatchObject({ role: 'system' })
        return fauxAssistantMessage('pong')
      },
    ])

    await agent.prompt('ping')

    expect(agent.state.messages.at(-1)).toMatchObject({ role: 'assistant' })
    expect(faux.getPendingResponseCount()).toBe(0)
  })

  it('resolves prompt() on provider errors and exposes them on state (ADR 0007)', async () => {
    const { agent, faux } = setup()
    faux.setResponses([fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'boom' })])

    await expect(agent.prompt('ping')).resolves.toBeUndefined()

    expect(agent.state.errorMessage).toBe('boom')
  })

  it('does not end the batch when only some tool results terminate (ADR 0007)', async () => {
    const { agent, faux } = setup()
    agent.state.tools = [tool('finish'), tool('other')]
    faux.setResponses([
      fauxAssistantMessage([fauxToolCall('finish', {}), fauxToolCall('other', {})], {
        stopReason: 'toolUse',
      }),
      fauxAssistantMessage('continued after the mixed batch'),
    ])

    await agent.prompt('go')

    expect(faux.getPendingResponseCount()).toBe(0)
  })
})
