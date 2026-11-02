# fixtures

## `vault/`

从 [ai-wiki](https://github.com/rikisamurai/ai-wiki)（`8a603e4`，2026-09-17）截取的小型 Vault，供测试使用，不跟随 ai-wiki 自动更新。

由 `OverlayScrollbars` 那次 Ingest 产出的 6 个 Wiki Page，加上它们链接到的 2 个页面组成，共 8 页：

| 页面 | 来源 |
|---|---|
| `wiki/frontend/ui-libraries/` 下 4 页、`wiki/frontend/web-platform/` 下 2 页 | `sources/posts/frontend/libraries/overlayscrollbars.md` 的 Ingest 产出 |
| `wiki/frontend/react-native/flash-list.md`、`view-recycling.md` | 被上面的页面链接 |

为了让 fixture 自洽，截取时做了以下改动：

- 指向 fixture 以外页面的 wikilink 改写为纯文本（保留显示文字），非 Markdown 的嵌入（`![[…]]`）被删除。因此 `flash-list` 与 `view-recycling` 只剩 1 条出链，可以直接作为 Warning 的测试数据。
- `index.md`：保留原文件头部，只列出这 8 页。
- `log.md`：保留原文件头部，只保留一条按当前路径改写的 OverlayScrollbars Ingest 记录。
- `AGENT.md` 原样复制，`CLAUDE.md` 是指向它的软链。
- `.agents/skills/` 只复制 `ingest` 与 `obsidian-markdown` 两个 Skill。

Source 只取用户原创的 `sources/posts/`，不包含第三方网页剪藏：

- `sources/posts/frontend/libraries/overlayscrollbars.md`：已 Ingest，原样复制。
- `sources/posts/obsidian/obsidian/obsidian-claude/skills.md`：删除了 `ingested-at` 字段，模拟一份未 Ingest 的 Source（约 2.5k 字符），供 faux 测试与真模型冒烟测试使用。
