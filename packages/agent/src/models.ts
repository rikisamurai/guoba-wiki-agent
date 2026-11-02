import { createModels } from '@earendil-works/pi-ai'
import { deepseekProvider } from '@earendil-works/pi-ai/providers/deepseek'

/** 默认模型（ADR 0011）。长期默认值由 v2 评测决定。 */
export const DEFAULT_MODEL = { provider: 'deepseek', id: 'deepseek-flash' } as const

/**
 * 注册 Pi 内置的 DeepSeek provider（OpenAI Chat Completions 兼容协议），
 * API Key 由 provider 从 DEEPSEEK_API_KEY 读取。
 */
export function createDeepseekModels() {
  const models = createModels()
  models.setProvider(deepseekProvider())
  return models
}
