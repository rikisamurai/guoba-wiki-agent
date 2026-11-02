# guoba-wiki-agent

基于 [Pi](https://github.com/earendil-works/pi) 的个人知识库 Agent：按 [ai-wiki](https://github.com/rikisamurai/ai-wiki) 中的 Agent Skill 把原料沉淀为互链的 wiki 页面。改动先写进内存里的 Staging，在终端确认后才写入 Vault；每次运行都记录完整的 Trajectory，可以在本地网页里回放。

> 状态：v1 开发中。目前只有工程骨架，命令尚未实现，进度见 [`docs/plan/v1.md`](docs/plan/v1.md)。

## 一次 Ingest 会发生什么

```text
wiki-agent run sources/posts/xxx.md
  │
  ├─ system prompt：Run Rules → Vault 的 AGENT.md → ingest Skill → Skill Catalog → 当前时间
  ├─ Agent 读取 Vault，按 Skill 把改动写进 Staging（Vault 不变）
  ├─ finish → 代码校验 Invariant（越界写入、改动 Source 正文、断链……）
  │     └─ 不通过：问题回传给 Agent 修正，最多 3 次
  ├─ 终端展示 diff 与 Warning：y 写盘 / n 放弃 / r 提意见继续改
  └─ 全过程写入 .runs/<runId>/trajectory.jsonl，wiki-agent view 可回放
```

## 开发

需要 Node 24 与 pnpm 11。

```bash
pnpm install
pnpm test        # faux 假模型与单元测试，不需要 API Key
pnpm typecheck
pnpm lint
```

真模型冒烟测试使用 DeepSeek（Pi 内置 provider）：

```bash
DEEPSEEK_API_KEY=sk-... pnpm test:live
```

## 文档

- [`GLOSSARY.md`](GLOSSARY.md)：领域术语
- [`docs/adr/`](docs/adr/README.md)：架构决策记录
- [`docs/plan/v1.md`](docs/plan/v1.md)：v1 实施计划
- [`fixtures/README.md`](fixtures/README.md)：测试 Vault 的来源与改动
