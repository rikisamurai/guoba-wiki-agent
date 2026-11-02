import { defineConfig } from 'vitest/config'

// 真模型冒烟测试（ADR 0016 第 2 层）。未设置 DEEPSEEK_API_KEY 时，各用例自行跳过。
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.live.ts'],
    testTimeout: 180_000,
  },
})
