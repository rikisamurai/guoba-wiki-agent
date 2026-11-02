# ADR 索引

| 编号                                          | 决策                                                                |
| --------------------------------------------- | ------------------------------------------------------------------- |
| [0001](0001-独立仓库驱动-vault.md)            | 独立公开仓库 `guoba-wiki-agent` 驱动 Vault，v1 只做 Ingest          |
| [0002](0002-锁定-pi-1.4.0.md)                 | 锁定 Pi 1.4.0 精确版本，不引入 message-engine 与 pi-durable         |
| [0003](0003-单次运行确认后写盘.md)            | 一次 Run 处理一份 Source，确认后写盘，不做 git 操作                 |
| [0004](0004-规则来自渐进加载的-skill.md)      | 模型侧规则来自渐进加载的 Skill，每次 Run 指定 Task Skill            |
| [0005](0005-暂存写入层.md)                    | Agent 通过 Staging 写入，全部步骤按 Task Skill 执行                 |
| [0006](0006-只阻断不变量.md)                  | 代码只阻断 Invariant，其余 Skill 规则作为 Warning                   |
| [0007](0007-finish-工具与修正回路.md)         | `finish` 结束运行，Invariant 失败回传修正，最多 3 次                |
| [0008](0008-执行策略放在-wiki-agent-配置.md)  | Write Scope 等执行策略写在 `wiki-agent.config.ts` 中                |
| [0009](0009-apply-前核对-hash.md)             | Apply 前核对 hash，目标文件被外部改过就拒绝                         |
| [0010](0010-工具集与上下文.md)                | 通用工具集（含 `append_file`），注入当前时间，v1 不分块             |
| [0011](0011-默认模型-deepseek-flash.md)       | 默认 `deepseek-flash`（Pi 内置 DeepSeek provider，OpenAI 兼容协议） |
| [0012](0012-运行上限.md)                      | 每次 Run 上限：40 Step / 15 分钟 / $1                               |
| [0013](0013-整体确认与反馈修改.md)            | 终端整体确认：`y` / `n` / `r`（Revise）                             |
| [0014](0014-trajectory-事件日志.md)           | 参照 DeepSeek Harness，Trajectory 事件日志是 Run 的唯一真源         |
| [0015](0015-v1-包含网页-trajectory-查看器.md) | v1 包含只读的本地网页 Trajectory 查看器                             |
| [0016](0016-v1-完成标准与测试分层.md)         | v1 完成标准：faux 测试、真模型冒烟测试、3 份真实 Source 验收        |
| [0017](0017-仓库结构.md)                      | monorepo：vault / trajectory / agent + cli / viewer                 |
| [0018](0018-system-prompt-组成.md)            | System prompt：Run Rules → AGENT.md → Task Skill → Catalog → 时间   |
