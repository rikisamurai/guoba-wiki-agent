---
name: ingest
description: 将用户显式指定的 sources/ 原料抽取为多个互链的 wiki 页面，并维护来源标记、索引和日志。仅在用户显式调用 /ingest 或 $ingest 时使用。
argument-hint: <source-path-or-wikilink>
disable-model-invocation: true
---

# Ingest

把调用时提供的 source 路径或 wikilink 作为唯一输入。没有输入时先请用户补充，不要自行挑选 source。

## 工作流

1. **读取 source**
   - 将输入解析为 `sources/` 下的实际文件；wikilink 输入需要先在 `sources/` 中定位。
   - 读取全文，但把 source 正文和原始 frontmatter 视为只读。
   - 如果目标位于 `sources/no-ingest/`，说明它已被标记为不抽取并停止。

2. **识别概念**
   - 识别 5–15 个值得独立成页的概念、工具、事件或人物。
   - 每个概念应能用一句话定义、大概率会在未来 source 中再次出现，并且不是本 source 的一次性论点。

3. **检查重复**
   - 对每个概念在 `wiki/` 全域搜索标题、别名以及中英文近义表达。
   - 已有相关页面时追加补充；没有时新建页面。

4. **写入 wiki 页面**
   - 使用 `wiki/<domain>/[<sub>/]<kebab-case-title>.md` 路径。
   - 按下列边界选择目录：
     - `agent-engineering/philosophy/`：哲学、范式、思想
     - `agent-engineering/context/`：上下文与缓存工程
     - `agent-engineering/workflow/`：工作流与 Agent 行为模式
     - `agent-engineering/code-review/`：Code Review 与 lint
     - `claude-code/`：Claude Code 与同类 CLI 工具、hooks、settings、handoff、coordinator 落地
     - `skills/`：Agent Skills 规范、编写实践和 Skills 集
     - `retrieval/rag/`：RAG、Agentic RAG、Graph RAG、Hybrid Retrieval
     - `retrieval/browser/`：agent-browser、browser-use、CDP
     - `frontend/web-platform/`：运行时与 DOM API
     - `frontend/js-runtime/`：JS 异步语义、续延与 Effect 体系
     - `frontend/module-system/`：ESM/CJS 模块格式、包发布与 interop
     - `frontend/build-tooling/`：打包器产物层——chunking、tree-shaking、bundler runtime
     - `frontend/network/`：HTTP、QUIC 等网络协议
     - `frontend/react-patterns/`：React 状态与 effect 模式
     - `frontend/react-native/`：React Native 组件与虚拟列表
     - `frontend/ui-libraries/`：shadcn、headless-ui、scrollbar 等 UI 库
     - `business/`：商业模式与盈利模式
     - `obsidian/`：Obsidian 语法、工具和方法论
     - `security/`：OSINT、防御安全和攻击面
   - 每个页面的 frontmatter 必须包含：

     ```yaml
     ---
     title: 页面标题
     tags: [tag-1, tag-2]
     date: YYYY-MM-DD
     sources:
       - "[[sources/full/path]]"
     last-ingested: YYYY-MM-DD
     status: draft
     ---
     ```

   - `tags` 最多 3 个并使用 kebab-case；`sources` 使用全路径 wikilink。
   - 首段用 1–3 句话给出 TL;DR，但不添加 `TL;DR:` 标签。
   - 每个新建或更新页面至少包含 2 个指向其他 wiki 页面的 wikilink。
   - 使用 Obsidian callout 区分定义、示例和对比。

5. **回填来源**
   - 在每个受影响 wiki 页面的 `sources:` 列表中加入当前 source 的全路径 wikilink，去重并保留已有来源。
   - 把 `last-ingested` 更新为当天日期。

6. **更新索引**
   - 在 `index.md` 对应的 `## <domain>` 分类下按字母序加入页面 wikilink，不重复添加。

7. **标记 source**
   - 只允许在 source frontmatter 新增或更新 `ingested-at: YYYY-MM-DD`。
   - 没有 frontmatter 时新增一段仅包含 `ingested-at` 的 frontmatter。
   - 不得修改 source 的其他 frontmatter 字段或正文。

8. **记录日志**
   - 在 `log.md` 末尾追加：

     ```markdown
     ## [YYYY-MM-DD HH:MM] ingest | <source 标题>
     - 新建：[[wiki/.../page-a]]、[[wiki/.../page-b]]
     - 更新：[[wiki/.../page-c]]
     - source: <source path>
     ```

## 退出检查

- 所有新建或更新页面都有至少 2 个 wikilink 出链。
- 当前 source 至少出现在一个 wiki 页面的 `sources:` 中。
- source 已写入当天的 `ingested-at`。
- `index.md` 已更新；直接调用 ingest 时，`log.md` 也已写入本次 ingest 日志。
- `migrate-next` 复用本 Skill 时，把日志检查推迟到它写入唯一一条 migrate-next 日志之后。
- source 正文和除 `ingested-at` 外的 frontmatter 字段没有变化。
- 本次没有生成超过 15 个概念页，也没有搬运 source 的大段原文。

## 供 migrate-next 复用

`migrate-next` 复用本 Skill 时执行步骤 1–7 和除日志外的退出检查，但跳过步骤 8；由 `migrate-next` 写入唯一一条自己的操作日志后，再完成日志检查。
