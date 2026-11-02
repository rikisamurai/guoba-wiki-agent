# Handoff：guoba-wiki-agent v1（M0–M5 完成）

更新：2026-11-02 · `main` = `396143d` · 下一步：M6 验收

基于 Pi 1.4.0 的 Agent：按 ai-wiki 里的 Agent Skill 把一份 Source ingest 成互链的 Wiki Page。改动先进 Staging，终端确认后才写入 Vault；每次 Run 留下完整的 Trajectory，可在本地网页查看器回放。

先读：[`GLOSSARY.md`](../GLOSSARY.md) → [`docs/adr/README.md`](adr/README.md) → [`docs/plan/v1.md`](plan/v1.md)（每个里程碑的“偏离 / 说明”都记在那里）。

## 进度

| 里程碑        | 提交      | 内容                                                                                                     |
| ------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| 设计          | `bd26932` | 术语表、ADR 0001–0018、v1 计划                                                                           |
| M0 骨架       | `b1f3fa7` | pnpm monorepo、无构建 TS、oxlint/oxfmt、Vitest、fixture Vault、Pi 契约测试                               |
| M1 trajectory | `a80e843` | 事件类型、JSONL 读写、Turn → Step 投影、`result.json`                                                    |
| M2 vault      | `0c5e70a` | Staging、Write Scope、Invariant / Warning、diff、Apply（hash 核对）                                      |
| M3 agent      | `0c72698` | `startRun()` → `execute / apply / discard / revise / cancel`，工具、Finish 回路、上限、Trajectory 记录   |
| M4 cli        | `7b48321` | `wiki-agent run`（进度、diff、y/n/r、Ctrl-C）与 `wiki-agent view`（`/api/runs`、`/events`、SSE）         |
| 修复          | `1096e16` | `new-domain` Warning 改为对照 Task Skill 列出的目录（原实现对照 Vault 已有目录，M4 真实运行 8 条全误报） |
| M5 viewer     | `396143d` | 按确认的设计稿实现：Run 列表、流水账（双栏）、时间线、变更、请求、实时追加                               |
| M6 验收       | —         | 未开始，见下文                                                                                           |

验证状态（`396143d`）：`pnpm test` 21 个文件 183 项通过；`pnpm test:e2e` 3 项通过；lint、typecheck、fmt:check 通过。只在 Node 22.23 上验证过（配置要求 Node 24）。

## 怎么跑

```bash
pnpm install
pnpm build:viewer                          # 查看器页面，只需一次；dist 不进 git
export DEEPSEEK_API_KEY=sk-...
pnpm wiki-agent run sources/posts/xxx.md   # 相对 Vault；也接受 Vault 内的绝对路径
pnpm wiki-agent view                       # http://127.0.0.1:5050
```

- 执行策略在仓库根目录的 [`wiki-agent.config.ts`](../wiki-agent.config.ts)：Vault 写的是 `~/ai-wiki`，本机路径不同要改；`--config` 可指定其他文件。
- 经 `HTTPS_PROXY` 访问 DeepSeek 时加 `NODE_USE_ENV_PROXY=1`（Node 的 `fetch` 默认不读代理变量）。
- 退出码：0 写入或放弃；1 失败（Invariant 用完、上限、模型错误、Apply 被拒）；130 中止。

## 代码地图

| 包 / 应用             | 规模              | 关键入口                                                                                                           |
| --------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `packages/trajectory` | 9 文件 / 677 行   | `events.ts`（事件契约）、`ledger.ts`（投影）、`summary.ts`、`parse.ts`（含 `parseTrajectoryLine`）                 |
| `packages/vault`      | 12 文件 / 694 行  | `staging.ts`、`scope.ts`、`invariants.ts`、`warnings.ts`（含 `skillDomains`）、`apply.ts`                          |
| `packages/agent`      | 17 文件 / 1324 行 | `run.ts`（生命周期）、`setup.ts`（`onEvent`）、`recorder.ts`、`finish.ts`、`tools/`、`models.ts`（`resolveModel`） |
| `apps/cli`            | 13 文件 / 806 行  | `run/`（启动、进度、确认流程、终端）、`view/`（服务、列表、SSE、静态文件）                                         |
| `apps/viewer`         | 29 文件 / 2071 行 | `router.tsx`、`lib/use-trajectory.ts`（SSE）、`pages/run/*`、`test/sample-run.ts`（Vitest 与 Playwright 共用）     |

依赖方向：`apps → packages/agent → packages/{vault,trajectory}`；vault 与 trajectory 不依赖 Pi。

## 实现中对 ADR 的修订

都已写回对应 ADR 和 `docs/plan/v1.md`：

- **0006**：原本就无法解析的 frontmatter 只给 Warning；链接检查只查本次新增的链接；`new-domain` 对照 Task Skill 的目录列表（子目录算在内）。
- **0013**：等待确认时按 Ctrl-C 视为中止（`cancelled`），不记 `review/decision`。
- **0014**：`run/end` 只记原因，合计由投影算；新增 `proposal/diff` 事件；`tool/call` 存参数对象的 JSON；`validation/result` 新增可选 `verdict`（M5 起才有）。
- **0015**：`view` 校验 Host 头防 DNS rebinding；SSE 的 `id` 是 `seq`，支持 `Last-Event-ID` 续传，`run/end` 后发 `event: end`。查看器只用 `/stream`，`/events` 留给其他调用方。

## 真实运行记录（DeepSeek Flash，fixture Vault 的临时副本）

| Run                             | 方式                       | 结果      | Step | 耗时  | 费用    |
| ------------------------------- | -------------------------- | --------- | ---- | ----- | ------- |
| `2026-11-02T08-53-08Z-c732ff8f` | 脚本直接调 `startRun`      | applied   | 12   | 67 s  | $0.0172 |
| `2026-11-02T09-10-19Z-c59f6340` | `echo y \| wiki-agent run` | applied   | 10   | 85 s  | $0.0241 |
| `2026-11-02T09-12-24Z-530f7d37` | 执行中发送 SIGINT          | cancelled | 5    | 7.3 s | $0.0015 |

- 生成占耗时的 86%，工具执行合计不到 0.1 秒；写 8 个页面的那个 Step 单独生成了 57 秒。
- 这些 Run 只存在于上一个容器的临时目录，没有进仓库。

## 下一步：M6 验收

1. `pnpm test:live` 升级为：在 fixture Vault 的临时副本上对未 ingest 的 Source 跑一次真实 ingest（逻辑同上表第一行）。
2. 在 ai-wiki 的 git worktree 上用 3 份真实 Source（小、中、最大的约 5.9 万字符）验收，记录费用、Step 数、Warning 和人工判断。
3. 结果写入 `docs/plan/v1-acceptance.md`。

开始前需要：

- 会话里重新接入 `rikisamurai/ai-wiki`（容器重启后之前的 clone 已经没了）。
- 新的 DeepSeek key。对话里给过的旧 key 只通过环境变量用过，没写进任何文件，但应作废后换新。
- 预算：3 份 Source 估计合计 $0.1–0.3。

验收时要重点看：

- 表格里的 `[[目标|显示名]]` 竖线没有转义为 `\|`（第二次真实运行出现，第一次没有）。现有 Warning 查不出，决定是否加规则。
- `index.md` 是否按字母序插入已有分区（fixture 里没有对应分区，模型是在末尾追加新分区）。
- 模型在 420 页的真实 Vault 里能否找到已有页面、合并重复内容。

## 已知问题与限制

- `RunSummary.durationMs` 是第一个到最后一个事件的时间，包含等待用户确认的时间；列表和详情页的“耗时”会因此偏大。上限计时（ADR 0013）已经排除了等待时间，显示还没有。
- 列表分不清“仍在运行”和“进程中途退出”，都显示“未结束”。
- 生成中只显示计时：assistant 消息在回复结束时才写入 Trajectory（设计时确认 v1 不做逐字显示）。
- 一次 Run 的 Trajectory 约 1 MB，主要是逐片的流式记录；`/api/runs` 每次都完整解析所有 Trajectory，Run 很多时会变慢。
- M5 之前的 Trajectory 没有 `verdict`，查看器只显示 Invariant / Warning 条数。
- shadcn 是手动初始化的（`components.json`、`cn()`、Badge、Button），因为沙箱访问不了 `ui.shadcn.com`；本机可以直接 `shadcn add`。

## 云端沙箱的坑

- `api.deepseek.com` 需要在环境的网络策略里放行（Riki 已放行过一次）；`ui.shadcn.com` 不通。
- Chromium 拒绝 5060、5061 端口（SIP），本地起服务测试时换端口。
- `pkill -f "<pattern>"` 会匹配到执行它的 shell 自己，用 `pkill -f "[m]ain.ts view ..."` 的写法。
- 在这个会话里用 API 建仓库会 403，仓库是 Riki 手动建的。
- 远端还留着已合并的分支：`chore/scaffold`、`feat/m1-m2`、`feat/m3-agent`、`feat/m4-cli`、`feat/m5-viewer`，可以删。

## 参考页面

- 进度页：https://claude.ai/artifact/NEa57E3Zt5nYZvDQigPLkF
- M5 设计稿（已确认：双栏、生成中只计时、思考默认折叠）：https://claude.ai/artifact/KVB6wTTBFEx5otGBms1jtc
