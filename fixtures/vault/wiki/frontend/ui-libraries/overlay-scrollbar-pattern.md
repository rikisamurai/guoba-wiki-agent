---
title: Overlay Scrollbar 范式
tags: [scrollbar, web-perf, headless]
date: 2026-04-27
sources:
  - "[[sources/posts/frontend/libraries/overlayscrollbars]]"
last-ingested: 2026-04-27
status: stable
---

Overlay Scrollbar 范式指**藏掉原生 scrollbar、在容器边缘叠一层完全自定义的 DOM scrollbar 当皮肤**，但容器本身保留 `overflow: scroll`、由浏览器原生滚动引擎驱动。代表实现是 [[wiki/frontend/ui-libraries/overlayscrollbars|OverlayScrollbars]] 和 simplebar，跟 [[wiki/frontend/ui-libraries/scrollbar-mock-vs-overlay|Mock 派]] 是滚动条定制的两条对立技术路线。

> [!note] 核心机制三件套
> 1. **隐藏原生 scrollbar**：`::-webkit-scrollbar { display: none }` + Firefox 的 `scrollbar-width: none` + viewport 加负 margin 把 IE/Edge 旧版的 scrollbar 推出可见区
> 2. **叠浮层 DOM**：跟 viewport 平级、`position: absolute` 浮在右侧/底部，内含 track + handle（thumb），不占据滚动尺寸所以拖动不引发 layout 抖动
> 3. **scroll 事件被动跟随**：被动事件监听器（`{ passive: true }`）读 `scrollTop`/`scrollLeft` → 用 CSS `transform: translate3d()` 移动 thumb，O(1) 工作量、走 GPU 合成层不触发 paint

典型 DOM 结构是 host → viewport → content 三层 + 平级的 scrollbar 浮层节点。

> [!compare] vs Mock 派
> Mock 派把容器 `overflow: hidden`，用 wheel/touch/key 事件**重新实现一遍滚动**；Overlay 派只换皮，键盘 PageDown / 触屏惯性 / Trackpad 双指 / 屏幕阅读器朗读位置 / `scroll-behavior: smooth` / `scroll-snap` 全部白嫖浏览器。代价是定制深度比 Mock 派浅——thumb 不能加自定义滚动惯性，只能跟着原生 scroll 节奏走。

**配套依赖**：内容/容器尺寸变化要靠 [[wiki/frontend/web-platform/resize-observer|ResizeObserver]] 触发 thumb 长度重算；DOM 子树变更要靠 [[wiki/frontend/web-platform/mutation-observer|MutationObserver]] 触发整体 update。这套"事件驱动 + 零轮询"的同步模型，是 Overlay 范式跑得稳又省电的前提。
