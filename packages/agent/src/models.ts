import type { StreamFn } from '@earendil-works/pi-agent-core'
import { type Model, createModels } from '@earendil-works/pi-ai'
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

/** 按配置取模型，在开始 Run 之前检查 provider、模型名与 API Key。v1 只接入 DeepSeek。 */
export function resolveModel(
  ref: { provider: string; id: string },
  env: Record<string, string | undefined> = process.env,
): { model: Model<any>; streamFn: StreamFn } {
  if (ref.provider !== 'deepseek') {
    throw new Error(`v1 只接入了 DeepSeek（ADR 0011），不支持 provider「${ref.provider}」`)
  }
  const models = createDeepseekModels()
  const model = models.getModel(ref.provider, ref.id)
  if (!model) {
    const ids = models.getModels(ref.provider).map((m) => m.id)
    throw new Error(`DeepSeek 没有模型「${ref.id}」，可选：${ids.join('、')}`)
  }
  if (!env['DEEPSEEK_API_KEY']) throw new Error('缺少环境变量 DEEPSEEK_API_KEY')
  return { model, streamFn: models.streamSimple.bind(models) }
}
