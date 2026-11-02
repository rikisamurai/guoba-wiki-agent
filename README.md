# guoba-wiki-agent

基于 [Pi](https://github.com/earendil-works/pi) 的个人知识库 Agent：按 [ai-wiki](https://github.com/rikisamurai/ai-wiki) 中的 Agent Skill 把原料沉淀为互链的 wiki 页面。改动先写进内存里的 Staging，在终端确认后才写入 Vault；每次运行都记录完整的 Trajectory，可以在本地网页里回放。

> 状态：v1 开发中。`wiki-agent run` 与 `wiki-agent view`（接口）已可用，查看器页面尚未实现，进度见 [`docs/plan/v1.md`](docs/plan/v1.md)。

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

## 使用

需要 Node 24、pnpm 11 和 DeepSeek API Key。执行策略（Vault 位置、Write Scope、允许的 Skill）在仓库根目录的 [`wiki-agent.config.ts`](wiki-agent.config.ts) 中，Vault 不在 `~/ai-wiki` 时先改这里。

```bash
pnpm install
export DEEPSEEK_API_KEY=sk-...
pnpm wiki-agent run sources/posts/xxx.md   # 路径相对 Vault，也可以是 Vault 内的绝对路径
pnpm wiki-agent view                       # 另开终端，http://127.0.0.1:5050
```

- 运行中显示每个 Step 的工具调用和 Finish 校验结果；结束后显示变更摘要、Warning 和逐文件 diff，然后选择 `y` 写入、`n` 放弃、`r` 输入修改意见继续改。
- Ctrl-C 随时中止，Vault 不变。
- 写入后不做 git 提交，请在 Vault 中检查后自行提交。
- 每次 Run 的记录在 `.runs/<runId>/`（`trajectory.jsonl`、`result.json`、`proposal.diff`），含 Vault 全文与模型 reasoning，已被 git 忽略。
- 需要经 `HTTPS_PROXY` 访问 DeepSeek 时，加上 `NODE_USE_ENV_PROXY=1`（Node 的 `fetch` 默认不读代理环境变量）。

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
