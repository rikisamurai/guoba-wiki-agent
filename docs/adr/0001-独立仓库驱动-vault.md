# 0001 独立仓库驱动 Vault

- 状态：已接受
- 日期：2026-11-02

## 背景

ai-wiki 目前靠 Claude Code / Codex 共享 Skill 维护，规则写在 `SKILL.md` 里，由模型自检。静态检查发现自检有漏网：09-06 那次 Ingest 留下 6 条断链，`wiki/frontend/network/imgs/` 下混入了 5 个没有 frontmatter 的配图中间文件。

## 决策

新开公开仓库 `rikisamurai/guoba-wiki-agent`，基于 Pi 构建 Ingest Agent，通过配置路径读写 Vault。Vault 继续只放内容，保持为纯 Obsidian vault。

命名：仓库名沿用个人项目的 `guoba-` 前缀；命令行和配置文件使用短名 `wiki-agent`（`wiki-agent` 命令、`wiki-agent.config.ts`），文档中“wiki-agent”指本仓库产出的工具。

公开的依据：ai-wiki 本身公开，测试 fixture 可以直接放进仓库；`.runs/` 和 API Key 不进入仓库。

v1 只做 Ingest。lint、query、审阅 UI、MCP 接入不在 v1 范围内。

## 影响

- Vault 不引入 `package.json`、Node 依赖或构建产物。
- 本仓库测试不依赖真实 Vault，使用从 Vault 截取的 fixtures。
- 在 Vault 现有 Skill 被替代前，规则可能同时存在于两处（Skill 与代码），需要后续 ADR 明确以哪边为准。
