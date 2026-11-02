import { defineConfig } from 'vitest/config'

// 默认测试：faux 与普通单元测试，不需要 API Key（ADR 0016 第 1 层）。
// 真模型冒烟测试使用 *.live.ts 命名，不匹配默认 include，只由 vitest.live.config.ts 运行。
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/cli', 'apps/viewer'],
  },
})
