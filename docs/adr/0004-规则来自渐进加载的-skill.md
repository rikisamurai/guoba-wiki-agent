# 0004 模型侧规则来自渐进加载的 Skill

- 状态：已接受
- 日期：2026-11-02

## 背景

Ingest 规则目前写在 Vault 的 `AGENT.md` 和 `.agents/skills/ingest/SKILL.md` 里。如果在本仓库代码中重写一遍，规则就会存在两处，改一处容易漏另一处。

Pi 1.0 已把 skills 从 `pi-agent-core` 中移除，加载机制需要自己实现（参考 Torrent Vibe 的“能力目录 + `read_skill`”做法）。

Vault 当前有 16 个 Skill。其中 `ingest`、`lint`、`query`、`migrate-next`、`health` 声明了 `disable-model-invocation: true`，只能被显式调用。

## 决策

模型看到的规则由 Agent Skill（`SKILL.md` 格式）提供，按渐进式披露分三层加载：

1. **目录**：允许使用的 Skill 只把 `name` 和 `description` 放进 system prompt 的 `skills` section。
2. **正文**：模型需要时通过 `read_skill(name)` 读取完整 `SKILL.md`。
3. **附属文件**：模型通过 `read_skill_file(name, path)` 读取 Skill 目录下的 `references/` 等文件。

每次运行必须指定一个 Task Skill（v1 为 `ingest`），它的正文在运行开始时直接加载，不需要模型自己去读。

- 声明了 `disable-model-invocation: true` 的 Skill 只能作为 Task Skill，不进入目录。
- 其他 Skill 需要显式加入允许列表，才会出现在目录中。
- Skill 来源目录可以配置，默认读取 Vault 的 `.agents/skills/`。

## 不做

- 不执行 Skill 附带的 `scripts/` 或 CLI（Agent 没有 shell）。依赖脚本才能完成的 Skill 不放进允许列表。
- 不支持远程或在线安装 Skill。

## 影响

- 自然语言规则只维护在 `SKILL.md` 一处，本仓库代码不复述。
- 代码负责的校验范围需要另立 ADR，至少要防止 Skill 规则与代码校验互相矛盾。
- Task Skill 中描述的写入步骤（写页面、更新 `index.md`、记录 `log.md`、标记 `ingested-at`）在 Agent 侧如何落地，需要与 0003 的“Agent 无写工具”一起确定。
