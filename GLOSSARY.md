# GLOSSARY

本仓库的领域词汇。讨论、代码、类型、配置里都用这里的术语；一个概念开始承重时立即补进来，不让未定义的说法扩散。

内容侧概念沿用 ai-wiki 的 `AGENT.md`，这里只记录本仓库实际依赖的口径。

## 内容侧

**Vault**
被操作的 ai-wiki 仓库根目录。本仓库不存放 Vault 内容，通过配置路径访问。

**Source**
Vault 中 `sources/` 下的一份原料。正文与原始 frontmatter 只读；唯一允许写入的是 `ingested-at` 字段。
`sources/no-ingest/` 下的 Source 不参与 Ingest。

**Wiki Page**
Vault 中 `wiki/` 下的一份概念页。`wiki/_orphans/` 是归档区，不算 Wiki Page。

**Domain**
Wiki Page 所在的概念域目录，例如 `agent-engineering/context`、`frontend/network`。

## Skill

**Skill**
遵循 Agent Skills 格式的目录：一份 `SKILL.md`（frontmatter 含 `name`、`description`），以及可选的 `references/`、`scripts/` 等。默认来源是 Vault 的 `.agents/skills/`。

**Task Skill**
一次运行显式指定的 Skill，例如 `ingest`。它的正文在运行开始时直接加载，定义这次运行要完成的任务。
_避免_：把 Task Skill 叫作“主 prompt”或“system prompt”。

**Skill Catalog**
放在 system prompt 中的可用 Skill 列表，每项只有 `name` 和 `description`。模型通过 `read_skill` 按需展开。
只有允许列表中、且未声明 `disable-model-invocation: true` 的 Skill 才会进入 Catalog。

**Project Instructions**
Vault 根目录的 `AGENT.md`（`CLAUDE.md` 是它的软链）。每次 Run 都完整放进 system prompt，与 Claude Code 的加载行为一致。

**Run Rules**
wiki-agent 自身的运行规则，位于 system prompt 最前面；与 Project Instructions 或 Task Skill 冲突时以它为准。例如：只通过暂存工具写入、不做 git 操作、不在运行中向用户提问、完成时调用 `finish`。

## 操作侧

**Ingest**
把一份 Source 抽取为多个互链 Wiki Page，并维护 `index.md`、`log.md` 与 Source 的 `ingested-at`。v1 唯一支持的操作。一次 Ingest 只处理一份 Source。

**Run**
一次命令行调用对应的完整执行过程：从开始到 `run/end`，包括其间所有 Revise。每个 Run 有唯一的 runId 和一份 Trajectory。

**Turn**
一次用户输入直到处理完。首次任务是 Turn 0，每次 Revise 开启一个新 Turn。

**Step**
一次模型请求，加上它要求的全部工具执行。
_避免_：Pi 的 API 把这个单位叫作 `turn`（`finishTurn`、`turn_end`）。在本仓库的文档和代码命名中，它一律称为 Step，不称 Turn 或“轮”。

**Staging**
一次运行中 Agent 写入的内存暂存层。Agent 的读工具看到的是 Vault 叠加 Staging 后的视图；运行期间 Vault 本身不变。

**Proposal**
运行结束时 Staging 相对 Vault 的全部变更（新建、修改的文件）。Proposal 本身不改动 Vault。

**Apply**
用户确认 Proposal 后，由代码（而不是 Agent）把它写入 Vault 的过程。Apply 之前 Vault 不发生任何变化。
_避免_：用“提交”指 Apply，“提交”只指 Agent 交出 Proposal。

**Revise**
用户在确认环节给出修改意见，Agent 在同一个 Staging、同一段对话上继续修改。Revise 不开启新的运行，共用原运行的上限。

## 校验

**Invariant**
违反就会损坏 Vault 的规则，例如写入越界、改动 Source 正文、wikilink 无法解析。任一 Invariant 不通过，Proposal 就不能 Apply。Invariant 与具体 Skill 的措辞无关。

**Warning**
来自 Skill 内容规范的检查结果，例如 tags 超过 3 个、出链少于 2 条。只在 diff 中提示，不阻止 Apply。
_避免_：把 Warning 称为“错误”或“失败”。

**Finish**
Agent 声明运行完成的工具调用。每次 Finish 都会对整个 Staging 做全量校验；Invariant 失败最多允许 3 次。模型没有调用工具就停止，也按一次 Finish 处理。

**Write Scope**
一个 Task Skill 允许写入的路径集合，以及每类路径允许改动的部分（例如 `sources/**` 只允许改 `ingested-at`）。属于 Invariant 的一部分。

## 观测

**Trajectory**
一个 Run 的完整事件日志 `.runs/<runId>/trajectory.jsonl`，仅追加、无损 JSON，是该 Run 的唯一真源。`result.json`、`proposal.diff` 等都是由它派生的视图。
_避免_：把 Trajectory 叫作“日志”。“日志”专指 Vault 的 `log.md`。

**Trajectory Event**
Trajectory 中的一行，形如 `{ type, seq, time, data }`，`seq` 连续递增。
