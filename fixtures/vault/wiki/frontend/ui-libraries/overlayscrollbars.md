---
title: OverlayScrollbars
tags: [scrollbar, ui-library, web-perf]
date: 2026-04-27
sources:
  - "[[sources/posts/frontend/libraries/overlayscrollbars]]"
last-ingested: 2026-07-15
status: stable
---

[OverlayScrollbars](https://github.com/KingSora/OverlayScrollbars) 是 KingSora 维护的 ~15 KB vanilla JS 库，给 Web 应用加一根跨浏览器一致的 **浮层 scrollbar**——藏掉原生 scrollbar，叠一层自定义 DOM 当皮肤，但完整沿用浏览器原生滚动引擎。属于典型的 [[wiki/frontend/ui-libraries/overlay-scrollbar-pattern|Overlay 派]]，跟全 mock 滚动事件的方案有本质区别。

> [!example] 最小用法
> ```js
> import { OverlayScrollbars } from 'overlayscrollbars';
> import 'overlayscrollbars/overlayscrollbars.css';
>
> OverlayScrollbars(document.querySelector('#chat'), {
>   scrollbars: { autoHide: 'leave', theme: 'os-theme-dark' },
> });
> ```
> React 侧用 `useOverlayScrollbars` Hook，可以传 `defer: true` 推迟到 hydration 后再初始化，避免首屏视觉跳动。

**核心 API**：实例方法 `.options()` / `.update()` / `.state()` / `.on()/.off()` / `.sleep()` / `.destroy()`；配置项三族——`overflow`（x/y 行为）、`scrollbars`（visibility / autoHide / theme / dragScroll / clickScroll）、`update`（[[wiki/frontend/web-platform/mutation-observer|MutationObserver]] 防抖参数）。

**框架适配齐全**：官方包覆盖 React / Vue / Angular / Svelte / Solid，全 TypeScript。

> [!compare] 同类方案横评
> | 维度 | 原生 | [[wiki/frontend/ui-libraries/css-scrollbar-styling\|CSS-only]] | OverlayScrollbars | simplebar | perfect-scrollbar |
> |---|---|---|---|---|---|
> | 滚动行为 | 原生 | 原生 | **原生** | 原生 | 部分 mock |
> | 体积 (gzip) | 0 | 0 | 15 KB | 6 KB | 8 KB |
> | TS 类型 | — | — | ✅ 完整 | 社区 | 社区 |
> | 框架包 | — | — | ✅ 5 框架 | ✅ 2 框架 | ⚠️ 仅社区 |
> | 维护活跃度 | — | — | **活跃** | 活跃 | 低 |

**关键卖点**：包体相对小、零依赖、tree-shakable，并通过保留原生滚动行为来兼容键盘、触摸、RTL 和 writing-mode。具体版本、包体和浏览器支持矩阵会随发布变化，选型时应查项目 README / npm 当前版本，而不是把某次 Star、版本或体积快照当作长期事实。

> [!tip] 该不该用的判断口诀
> **跨浏览器视觉一致 + thumb 上要做花活 + 内容会高频动态变更** → 上 OverlayScrollbars；
> 三条满足两条以上才考虑，只满足一条优先试 [[wiki/frontend/ui-libraries/css-scrollbar-styling|CSS 原生方案]]。

**注意点**：每实例都挂 [[wiki/frontend/web-platform/resize-observer|ResizeObserver]] + [[wiki/frontend/web-platform/mutation-observer|MutationObserver]]，不适合频繁创建销毁海量实例；SSR 场景 React 适配的 `defer: true` 是缓解水合视觉跳动的标准手段。它解决"滚动条样式"，**不解决"列表性能"**——长列表性能问题该用 [[wiki/frontend/react-native/view-recycling|view-recycling]] / [[wiki/frontend/react-native/flash-list|FlashList]] 这类虚拟化方案，两者正交可叠加。
