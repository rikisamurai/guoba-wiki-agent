---
title: ai-wiki Activity Log
---

# Log

> [!warning] 路径迁移
> 2026-04-28 完成 wiki/ 目录重组（详见 docs/superpowers/specs/2026-04-28-wiki-reorganization-design.md）。本日期之前的日志条目里的 wikilink 全路径已过期（仅文件名形式的 `[[xxx]]` 不受影响）。想看历史路径用 `git log -- wiki/<old-path>`。

> append-only 时间线，记录所有 ingest / query / lint / migrate-next 操作。
> 格式：`## [YYYY-MM-DD HH:MM] <op> | <subject>`，便于 `grep '## \[2026-'`。

## [2026-04-27 13:35] ingest | OverlayScrollbars · 隐藏原生滚动条的覆盖层方案
- 新建：[[wiki/frontend/ui-libraries/css-scrollbar-styling]]、[[wiki/frontend/ui-libraries/overlay-scrollbar-pattern]]、[[wiki/frontend/ui-libraries/overlayscrollbars]]、[[wiki/frontend/ui-libraries/scrollbar-mock-vs-overlay]]、[[wiki/frontend/web-platform/mutation-observer]]、[[wiki/frontend/web-platform/resize-observer]]
- source: [[sources/posts/frontend/libraries/overlayscrollbars]]
