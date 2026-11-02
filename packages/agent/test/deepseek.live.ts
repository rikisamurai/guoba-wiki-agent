/**
 * 真模型冒烟测试（ADR 0016 第 2 层）。运行：DEEPSEEK_API_KEY=... pnpm test:live
 * 当前只验证 DeepSeek provider 接线；M3 完成后改为在临时 Vault 副本上跑一次 ingest。
 */
import { Agent } from '@earendil-works/pi-agent-core'
import { describe, expect, it } from 'vitest'

import { DEFAULT_MODEL, createDeepseekModels } from '../src/index.ts'

describe.skipIf(!process.env['DEEPSEEK_API_KEY'])('DeepSeek live smoke', () => {
  it('completes one request and reports usage', async () => {
    const models = createDeepseekModels()
    const model = models.getModel(DEFAULT_MODEL.provider, DEFAULT_MODEL.id)
    if (!model) throw new Error(`model not found: ${DEFAULT_MODEL.provider}/${DEFAULT_MODEL.id}`)
    const agent = new Agent({
      initialState: {
        systemPrompt: 'Reply with the single word: pong',
        model,
        thinkingLevel: 'low',
      },
      streamFn: models.streamSimple.bind(models),
    })

    await agent.prompt('ping')

    expect(agent.state.errorMessage).toBeUndefined()
    const last = agent.state.messages.at(-1)
    if (last?.role !== 'assistant')
      throw new Error(`expected an assistant message, got ${last?.role}`)
    expect(last.usage.input).toBeGreaterThan(0)
  })
})
