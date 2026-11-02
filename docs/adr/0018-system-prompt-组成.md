# 0018 System prompt 组成：Run Rules 优先，完整加载 Vault 的 AGENT.md

- 状态：已接受
- 日期：2026-11-02

## 背景

在 Claude Code 中运行 `/ingest` 时，Vault 根目录的 `AGENT.md`（`CLAUDE.md` 是它的软链，约 160 行、1 万字符）会自动进入上下文。ingest 依赖其中的“wiki 页面规范”“index.md / log.md 维护”“sources frontmatter”“no-ingest 约定”等章节。它同时包含“提交规范”“与用户沟通”等段落，与 wiki-agent 的流程冲突：wiki-agent 不做 git 提交（0003），运行中也不向用户提问（确认只发生在 Run 结束后，0013）。

## 决策

开头的 system 消息按以下顺序拼接，越稳定的内容越靠前，以利于 DeepSeek 的前缀缓存：

1. **Run Rules**：wiki-agent 自己的运行规则，并声明与后续内容冲突时以 Run Rules 为准：
   - 只能通过 `write_file` / `edit_file` / `append_file` 写入，写入落在 Staging，运行结束后由用户确认；
   - 不执行 git 操作，不向用户提问，信息不足时按 Skill 的退出规则处理并在 `finish` 摘要中说明；
   - 完成时单独调用 `finish`。
2. **Project Instructions**：Vault 根目录 `AGENT.md` 的完整内容，原样加载、不做裁剪。
3. **Task Skill**：本次 Task Skill 的 `SKILL.md` 正文。
4. **Skill Catalog**（0004）。
5. **运行上下文**：当前日期、时间、时区（0010）。每次 Run 都不同，所以放在最后。

目标 Source 路径放在第一条用户消息中，不放进 system prompt。

## 影响

- wiki-agent 与 Claude Code 看到的 Vault 规则一致；改 `AGENT.md` 后两边同时生效。
- `AGENT.md` 与 Run Rules 的冲突靠优先级声明处理，没有逐段过滤。模型仍可能受被覆盖段落的影响，需要在 Trajectory 和评测中观察。
- system prompt 约 1.5–2 万字符，每个 Step 都要发送；依赖前缀缓存控制费用，缓存命中情况以 Usage 中的 cacheRead 数据为准。
- 完整 system prompt 记录在 `request/header` 事件中（0014）。
