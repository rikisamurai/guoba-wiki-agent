# 0014 每次运行记录完整 Trajectory，事件日志是唯一真源

- 状态：已接受
- 日期：2026-11-02
- 参考：DeepSeek Harness（`deepseek-ai/deepseek-harness`，2026-10-30 `ce7073d`）的 `packages/core/session/src/types.ts`、`packages/session/session-persistence-jsonl`、`packages/client/ui-trajectory`

## 背景

用户需要观察完整的运行轨迹：调试、统计成本、做评测都依赖它。DeepSeek Harness 的做法是：每个会话一份仅追加、无损 JSON 的事件日志；消息历史、Chat 视图、Trajectory 视图都由回放日志得到，而不是另外保存的副本。

## 决策

每次 Run 在 `.runs/<runId>/` 下写一份 `trajectory.jsonl`，它是这次 Run 的唯一真源。

- 每行一个事件：`{ "type": string, "seq": number, "time": number, "data": object }`。`seq` 从 0 连续递增，`time` 为毫秒时间戳，`data` 必须是可无损往返的 JSON。
- 事件产生时立即追加写入。进程崩溃后，已写出的前缀仍然可以读取。
- 其他文件都是派生视图，可由 `trajectory.jsonl` 重新生成：`result.json`（停止原因、合计用量与费用、Invariant/Warning 汇总）、`proposal.diff`。
- 不压缩。`.runs/` 加入 `.gitignore`，路径可在配置中修改，默认相对配置文件所在目录。

### 层级

沿用 DeepSeek Harness 的两层：

- **Turn**：一次用户输入直到处理完。首次任务是 Turn 0，每次 Revise 开启一个新 Turn。
- **Step**：一次模型请求，加上它要求的全部工具执行。Pi 把这个单位叫作 `turn`（`finishTurn`、`turn_end`），本仓库统一称为 Step。

### 事件表（v1）

| 事件                      | data 要点                                                                                                                                       | 对应 DeepSeek Harness                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `run/start`               | runId、Task Skill、Source 路径、配置快照、wiki-agent git commit、Pi 版本、Vault git HEAD 与是否有未提交改动、各 Skill 内容 hash、模型价格表快照 | 无（DeepSeek Harness 放在 session header 中） |
| `request/header`          | 完整 system prompt、工具 Schema、模型、思考档位；只在首次及发生变化时记录                                                                       | `request/header`                              |
| `turn/start` / `turn/end` | turn；`turn/end` 带结束原因                                                                                                                     | 同名                                          |
| `user/message`            | 模型可见的用户消息，`source` 取值：`task`、`validation`（Finish 校验反馈）、`revise`                                                            | `user/message`（`source`）                    |
| `step/start` / `step/end` | turn、step                                                                                                                                      | 同名                                          |
| `assistant/message`       | 组装后的消息（含 reasoning）、带接收时间戳的原始流记录、usage、按价格表算出的费用、stopReason                                                   | `assistant/message`                           |
| `assistant/attempt`       | 失败、重试或被取消的那次尝试的流记录                                                                                                            | `assistant/attempt`                           |
| `tool/call`               | callId、工具名、模型原样输出的 arguments 字符串                                                                                                 | `tool/call`                                   |
| `tool/result`             | 模型看到的结果、isError、durationMs、Staging 变更摘要                                                                                           | `tool/result`（`meta`）                       |
| `staging/write`           | 路径、操作（write / edit / append）、写入前后的 hash、字节数                                                                                    | 类似 `workspace/changes`                      |
| `validation/result`       | 第几次 Finish、Invariant 与 Warning 明细                                                                                                        | 无                                            |
| `review/decision`         | `y` / `n` / `r`，以及 Revise 意见                                                                                                               | 类似 `approval/decided`                       |
| `apply/result`            | 已写入的文件、hash 冲突、写入失败                                                                                                               | 无                                            |
| `limit/hit`               | 触发了哪个上限，以及当时的累计值                                                                                                                | 无                                            |
| `run/end`                 | 停止原因、合计 Step 数、token、费用、耗时                                                                                                       | 无                                            |

- 时间信息都是本进程收到事件时的时钟时间。TTFT 等于 Step 开始到收到第一个 delta 的时间差；解码耗时、工具耗时（Pi 1.1 起提供 `durationMs`）都从事件时间推算，不额外记录。
- pi-ai 在 provider 内部的重试，只在能观察到的范围内记录为 `assistant/attempt`（通过 `onProviderStreamEvent` 等钩子）。观察不到的，不伪造记录。
- 未知事件类型在读取时报错，不静默跳过；以后新增可忽略事件，参考 DeepSeek Harness 的 `ignorable` 标记。

## 不做

- 不实现 resume、fork（DeepSeek Harness 基于同一事件流提供），v1 的日志只用于观察和评测。
- 不做 zstd 压缩和格式代际迁移。

## 影响

- `run/start` 中的 Skill hash、配置快照与价格表快照，让评测能区分“哪个版本的 Skill、哪个模型和配置产出了这次结果”，费用也可以按当时的价格重算。
- 日志包含 Vault 的全文内容和模型的 reasoning，只存在本地且被 git 忽略。
- 0012 中的“轮数”统一指 Step 数。
