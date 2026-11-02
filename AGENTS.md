# AGENT.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## Addressing the User

When replying to the user, address them as Riki.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. UI Changes Need Visual Approval First

**For UI layout, visual hierarchy, or information-placement changes, show the design before coding.**

Before changing UI code:

- Generate a screenshot, mock image, or visual proposal that shows the intended result.
- Let Riki choose or approve the direction before editing implementation files.
- Keep display areas, metadata, and action controls visually distinct unless the approved design says otherwise.
- Do not use code changes as the first draft for subjective UI placement decisions.

## 3. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 4. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 5. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 6. File Size & Splitting (`max-lines`)

oxlint enforces **max 200 lines** per source file (`error`; counts code only — blank lines and comments are skipped). Treat it as a **floor that prevents bloat, not a ceiling that proves good design** — a file under 200 can still be a mess. The limit's job is to make you _notice_ growth and decide how to decompose.

Applies to **any** source file, not just React components: a `lib`/`utils` file with too many functions should be split by concern so things are findable from directory + filename.

**When you hit 200, split by cohesion — never mechanically:**

- Extract a **cohesive** unit (sub-component, helper) that stands on its own and is named for what it is. Don't slice into `thing-part1` / `thing-part2` to beat the counter.
- Put **shared** pieces in a shared home (`components/`, `lib/`, … — the name isn't fixed) and import them. Copying the same code into two feature folders to pass the limit defeats the goal (reuse).
- Group split files into a feature/function folder so structure reads from names alone.

**Tests are exempt** (`*.test.*`, `tests/`) — they grow by case count, not complexity.

**Escape hatches** (both greppable, both reviewed):

1. One genuinely-cohesive long file → top-of-file directive **with a reason**: `/* oxlint-disable max-lines -- <reason> */`. A reasonless disable gets bounced in review; a stale one is flagged automatically.
2. A whole category (generated / vendored, e.g. shadcn `ui/`) → add it to `ignorePatterns` in the root `.oxlintrc.json`.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Project: guoba-wiki-agent

基于 Pi（`@earendil-works/pi-agent-core` / `pi-ai`，锁定 1.4.0）的 Agent，按 Vault 中的 Agent Skill 执行 Ingest 等任务，确认后才写入 [ai-wiki](https://github.com/rikisamurai/ai-wiki)。

### Before working

- 先读 `GLOSSARY.md`，讨论、命名、测试名都用其中的术语（例如 Step 不叫 turn，Trajectory 不叫日志）。
- 再读 `docs/adr/README.md` 中与改动相关的 ADR。改动与 ADR 冲突时要明确指出，不要静默覆盖。
- 当前进度与下一步见 `docs/plan/v1.md`。

### Layout

| Path                  | Role                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `packages/vault`      | Vault 读写、Staging、wikilink / frontmatter、Invariant 与 Warning、Apply。不依赖 Pi      |
| `packages/trajectory` | Trajectory Event 类型、读写与投影；Run 进程与查看器共用                                  |
| `packages/agent`      | Pi Agent 装配、工具、Skill 加载、Finish 回路、上限                                       |
| `apps/cli`            | `wiki-agent run` / `wiki-agent view`                                                     |
| `apps/viewer`         | 只读的 Trajectory 网页查看器                                                             |
| `fixtures/vault`      | 从 ai-wiki 截取的测试 Vault，**按字节保留，不要格式化或手改**（见 `fixtures/README.md`） |

依赖方向只能是 `apps → packages/agent → packages/{vault,trajectory}`；`packages/vault` 与 `packages/trajectory` 不依赖 Pi。

### Conventions

- **无构建步骤**：Node 24 原生执行 TypeScript（type stripping）。只用可擦除语法（`erasableSyntaxOnly`），相对导入写 `.ts` 扩展名；workspace 包的 `exports` 直接指向 `src/*.ts`。
- **Pi 版本**：只通过 `pnpm-workspace.yaml` 的 catalog 修改，升级是单独一次变更，并先跑通 `packages/agent/test/pi-contract.test.ts`。
- **测试分三层**（ADR 0016）：`pnpm test` 跑 faux 与单元测试（不需要 API Key）；`pnpm test:live` 跑 `*.live.ts`（需要 `DEEPSEEK_API_KEY`）；真实 Source 验收由人工完成。
- `.runs/` 含 Vault 全文与模型 reasoning，永远不要提交。

### Commands

```bash
pnpm install
pnpm test          # faux + unit
pnpm typecheck
pnpm lint
pnpm fmt
pnpm wiki-agent run <source>   # 需要 DEEPSEEK_API_KEY；执行策略在 wiki-agent.config.ts
pnpm wiki-agent view
```

## Agent skills

### Domain docs

Domain documentation uses a single-context layout. See `docs/agents/domain.md`.
