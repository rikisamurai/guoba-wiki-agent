# 0015 v1 包含本地网页 Trajectory 查看器

- 状态：已接受
- 日期：2026-11-02
- 修订：0001 中“审阅 UI 不在 v1 范围”，Trajectory 查看器提前进入 v1

## 背景

0014 确定每次 Run 都写一份完整的 `trajectory.jsonl`。用户希望能直接观察完整的运行轨迹，而且前端是用户的强项。DeepSeek Harness 的 `ui-trajectory` 证明了“对事件日志做纯投影”的视图是可行的。

## 决策

v1 提供 `wiki-agent view` 命令：启动一个本地 HTTP 服务，同时提供查看器页面和读取 `.runs/` 的接口，默认只监听 `127.0.0.1`。

**数据接口**：

- `GET /api/runs`：Run 列表（由各 Run 的 `run/start` 与 `run/end` 汇总而来）。
- `GET /api/runs/:id/events?from=<seq>`：分页读取 Trajectory Event。
- `GET /api/runs/:id/stream?from=<seq>`：SSE。持续读取文件新增的行，用于实时观察进行中的 Run。每条消息的 `id` 是事件的 `seq`，断线重连时按 `Last-Event-ID` 续传；发出 `run/end` 后再发一条 `event: end` 并关闭连接。

服务除了只监听 `127.0.0.1`，还校验请求的 `Host` 头只能是 `127.0.0.1` 或 `localhost`，防止外部网页借 DNS rebinding 读到 Trajectory（M4 实现时补充）。

Run 进程只负责写文件，查看器服务只读文件，两者之间没有其他通信。查看器可以在 Run 进行中打开，也可以事后打开。

**查看器只读**：v1 不在网页上做确认。`y` / `n` / `r`（0013）仍只在终端输入，查看器只负责展示，包括确认前的 diff。网页确认留给之后的审阅 UI，届时需要另立 ADR，定义 Run 进程如何接收浏览器指令，以及终端和网页同时确认时以哪一方为准。

**视图内容**（全部是对 Trajectory 的投影，不另外存数据）：

- Run 列表：Task Skill、Source、停止原因、Step 数、token、费用、耗时。
- 流水账：按 Turn → Step 分组，列出 user / assistant / tool / staging / validation 记录。
- 记录详情：完整输入输出、reasoning、工具参数原文与结果、usage、费用、耗时、TTFT。
- 时间线：每个 Step 的 TTFT、解码耗时、各工具耗时。
- Staging 变更：按文件展示的 diff，以及 Invariant 与 Warning。

**技术栈**沿用用户在 qr-vault 中的选择：React 19、Vite 8、TanStack Router（hash 路由）、Tailwind v4、Radix / shadcn、lucide-react，测试用 Vitest + Playwright。

## 影响

- v1 范围变大：多一个前端应用和一个本地服务。
- 事件格式（0014）成为前后端之间的契约，修改事件结构时需要同步修改查看器的投影代码与测试。
- 查看器只监听本机地址。日志含 Vault 全文和 reasoning，不对外暴露。
