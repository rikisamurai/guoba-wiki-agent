# 0007 以 finish 工具结束运行，校验失败时回传修正

- 状态：已接受
- 日期：2026-11-02

## 背景

0006 定义了 Invariant 和 Warning，但还没定义在什么时候检查、发现问题后由谁来修。参考项目的做法是提交即校验，不通过就拒绝并把原因反馈给模型（Torrent Vibe 的 `submitMetadata`、Kansoku 的 `rejectAnswer`）。

## 决策

**写入时检查**：`write_file` / `edit_file` 当场检查 Write Scope，越界写入直接以工具错误返回，不写进 Staging。

**结束时检查**：Agent 调用 `finish`（参数是一句变更摘要）表示完成。

- `finish` 必须单独调用。如果和其他工具出现在同一批调用中，由 `beforeToolCall` 拦截。
- `finish` 执行时对整个 Staging 运行全部 Invariant 和 Warning 检查：
  - 全部通过：返回 `terminate: true`，运行结束，进入 diff 与确认。
  - 有 Invariant 不通过：作为工具错误把具体问题（文件、行、原因）回传给模型修正。最多允许 3 次 Invariant 失败；第 3 次仍失败，运行以失败结束，可以查看 diff，但不能 Apply。
  - 只有 Warning：第一次回传给模型，可修可不修；再次调用 `finish` 时 Warning 不再阻拦。

**模型未调用 finish 就停止**（只回复文本、没有工具调用）：视为调用了一次 `finish`。校验不通过时，用 follow-up 消息把问题送回模型，继续下一轮。

**兜底上限**：总轮数和费用上限另行决定，作为最后一道防线。

## 实现提示（Pi 1.4.0）

- `finish` 只有在单独调用时才会触发 Pi 的批次结束（批次内全部结果都是 `terminate: true` 才结束），这与上面“必须单独调用”的拦截一致。
- “未调用 finish 就停止”在 `finishTurn` 中处理：没有工具调用时执行校验；失败就 `agent.followUp(...)` 推入反馈消息；通过则返回 `{ action: "end" }`。
- `agent.prompt()` 遇到 provider 错误不会抛异常，运行结束后要检查 `agent.state.errorMessage`。

## 影响

- 断链这类问题在运行内就能被修掉，不需要整次运行重来。
- 每次运行最多多出 3 轮修正请求，费用相应增加。
