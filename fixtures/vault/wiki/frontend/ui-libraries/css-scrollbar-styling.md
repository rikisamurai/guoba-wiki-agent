---
title: CSS 原生 Scrollbar 样式能力
tags: [scrollbar, css]
date: 2026-04-27
sources:
  - "[[sources/posts/frontend/libraries/overlayscrollbars]]"
last-ingested: 2026-04-27
status: draft
---

现代 CSS 提供四件套样式 scrollbar 的能力：`scrollbar-gutter` / `scrollbar-color` / `scrollbar-width`（标准属性，跨浏览器）+ `::-webkit-scrollbar` 伪元素族（仅 WebKit/Blink 内核）。70-80% 的"想要好看一点的滚动条"需求在 CSS 层就能搞定，不必先上 [[wiki/frontend/ui-libraries/overlayscrollbars|OverlayScrollbars]] 之类的 JS 库。

> [!example] 四件套用法
> ```css
> .scroll-area {
>   /* 1. 永远预留 scrollbar 空间，避免内容宽度跳动 */
>   scrollbar-gutter: stable both-edges;
>
>   /* 2. 跨浏览器统一颜色 */
>   scrollbar-color: #888 transparent;       /* thumb / track */
>
>   /* 3. 细 scrollbar */
>   scrollbar-width: thin;                    /* auto | thin | none */
> }
>
> /* 4. WebKit/Blink 专属，可做更激进的定制 */
> .scroll-area::-webkit-scrollbar { width: 8px; }
> .scroll-area::-webkit-scrollbar-thumb {
>   background: linear-gradient(#888, #555);
>   border-radius: 4px;
> }
> ```

> [!compare] CSS 方案 vs JS 方案的边界
> | 能力 | CSS 四件套 | [[wiki/frontend/ui-libraries/overlayscrollbars\|OverlayScrollbars]] |
> |---|---|---|
> | 跨浏览器视觉一致 | ⚠️ Firefox 受限于 `scrollbar-color`/`scrollbar-width` 两个属性 | ✅ 完全一致 |
> | thumb 渐变 / 阴影 / 圆角 | ✅ WebKit / ⚠️ Firefox 不支持 | ✅ 全部支持 |
> | hover 加粗 / autoHide | ⚠️ WebKit 可做、Firefox 难 | ✅ 配置项 |
> | 浮层不占布局（overlay 形态） | ❌（`scrollbar-gutter: stable` 是相反方向） | ✅ |
> | 体积成本 | 0 | 15 KB gzip |
> | 维护成本 | 0 | 升级 / 配置 |

**判断口诀**：跨浏览器视觉差异能接受 + thumb 不需要做花活 → 永远 CSS 优先；反之再考虑 [[wiki/frontend/ui-libraries/scrollbar-mock-vs-overlay|Overlay 派 JS 库]]。

> [!warning] 兼容性现状（2026）
> `scrollbar-gutter` Chrome 94+ / Firefox 97+ / Safari 18.2+；`scrollbar-color` / `scrollbar-width` 全部主流浏览器已支持；`::-webkit-scrollbar` 在 Firefox 永远不会有。需要支持 Safari < 18.2 的项目要谨慎。
