---
title: ai-wiki Index
date: 2026-04-22
---

# ai-wiki

> [!note] 三层架构
> `sources/`（原料，只读） · `wiki/`（精华，可改） · `AGENT.md`（schema）
>
> Claude Code 用 `/ingest` `/query` `/lint` `/migrate-next`；Codex 用对应的 `$ingest` `$query` `$lint` `$migrate-next`。详见 [[AGENT]]。


## Frontend


### web-platform

- [[wiki/frontend/web-platform/mutation-observer|MutationObserver]]
- [[wiki/frontend/web-platform/resize-observer|ResizeObserver]]

### react-native

- [[wiki/frontend/react-native/flash-list|FlashList]]
- [[wiki/frontend/react-native/view-recycling|View 回收]]

### ui-libraries

- [[wiki/frontend/ui-libraries/css-scrollbar-styling|CSS 原生 Scrollbar 样式能力]]
- [[wiki/frontend/ui-libraries/overlay-scrollbar-pattern|Overlay Scrollbar 范式]]
- [[wiki/frontend/ui-libraries/overlayscrollbars|OverlayScrollbars]]
- [[wiki/frontend/ui-libraries/scrollbar-mock-vs-overlay|Scrollbar Mock 派 vs Overlay 派]]
