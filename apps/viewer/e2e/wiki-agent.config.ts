// 端到端测试用的配置：只用到 runsDir（见 playwright.config.ts）
export default { vault: '.', runsDir: process.env['E2E_RUNS_DIR'], tasks: {} }
