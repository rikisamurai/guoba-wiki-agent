# 0008 执行策略放在 wiki-agent 配置中，按 Task Skill 分组

- 状态：已接受
- 日期：2026-11-02

## 背景

0006 的 Write Scope 和 0004 的 Skill 允许列表都随 Task Skill 变化。它们可以写在 Vault 的 `SKILL.md` frontmatter 里，也可以写在 wiki-agent 自己的配置里。

## 决策

执行策略统一写在 wiki-agent 的配置文件（`wiki-agent.config.ts`）中，按 Task Skill 分组，示意如下：

```ts
export default defineConfig({
  vault: '~/ai-wiki',
  skillDirs: ['.agents/skills'], // 相对 Vault
  tasks: {
    ingest: {
      writeScope: [
        { path: 'wiki/**', exclude: ['wiki/_orphans/**'] },
        { path: 'index.md' },
        { path: 'log.md', mode: 'append-only' },
        { path: 'sources/**', mode: 'frontmatter-fields', fields: ['ingested-at'] },
      ],
      catalog: ['obsidian-markdown'], // 允许进入 Skill Catalog 的其他 Skill
      limits: {}, // 轮数、费用、超时，另行决定
    },
  },
})
```

Vault 中的 `SKILL.md` 保持不动，Claude Code / Codex 可以照常使用。

## 理由

- Write Scope 是执行策略，应该和执行它的代码放在一起，由 wiki-agent 的测试覆盖。
- 内容仓库不需要知道有哪些执行器存在。

## 影响

- 新增一个 Task Skill 需要同时改 Vault（加 `SKILL.md`）和 wiki-agent 配置（加 `tasks.<name>`）。没有配置的 Task Skill 拒绝运行，不提供默认的写入范围。
- 配置字段的具体形状以实现为准，上面只是示意。
