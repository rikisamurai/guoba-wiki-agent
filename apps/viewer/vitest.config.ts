import { defineProject, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineProject({ test: { environment: 'jsdom', include: ['test/**/*.test.{ts,tsx}'] } }),
)
