import { defineConfig } from '@guoba-wiki-agent/agent'

// wiki-agent 的执行策略（ADR 0008）。`wiki-agent run` 默认读取这个文件，可用 --config 指定其他文件。
export default defineConfig({
  // Vault 根目录：本机 ai-wiki 的位置不同就改这里
  vault: '~/ai-wiki',
  timeZone: 'Asia/Shanghai',
  tasks: {
    ingest: {
      writeScope: [
        { path: 'wiki/**', exclude: ['wiki/_orphans/**'] },
        { path: 'index.md' },
        { path: 'log.md', mode: 'append-only' },
        { path: 'sources/**', mode: 'frontmatter-fields', fields: ['ingested-at'] },
      ],
      catalog: ['obsidian-markdown'],
      warnings: 'ingest',
    },
  },
})
