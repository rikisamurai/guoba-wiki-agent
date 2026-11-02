import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { defineConfig } from '@playwright/test'

// 测试用的 .runs 放在临时目录；view 服务与测试 worker 都通过这个环境变量拿到同一个目录
process.env['E2E_RUNS_DIR'] ??= mkdtempSync(path.join(tmpdir(), 'viewer-e2e-'))
const PORT = 5181

/** 端到端测试：真实的 wiki-agent view 服务 + 构建后的查看器（先运行 vite build）。 */
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `node ../cli/src/main.ts view -p ${PORT} -c e2e/wiki-agent.config.ts`,
    url: `http://127.0.0.1:${PORT}/api/runs`,
    reuseExistingServer: false,
  },
})
