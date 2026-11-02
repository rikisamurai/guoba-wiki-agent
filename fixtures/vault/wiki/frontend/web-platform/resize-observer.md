---
title: ResizeObserver
tags: [web-api, web-perf]
date: 2026-04-27
sources:
  - "[[sources/posts/frontend/libraries/overlayscrollbars]]"
last-ingested: 2026-04-27
status: stable
---

ResizeObserver 是 Web 平台 API，**事件驱动地监听 DOM 元素尺寸变化**，取代过去用 `setInterval` 或 `window.resize` 轮询元素尺寸的脏做法。容器变大变小、内容文字换行变多变少，回调里能拿到 `contentRect` 和 `borderBoxSize`。是自定义 scrollbar、虚拟列表、响应式画布等"内容尺寸变 → 重算 X"场景的首选基础设施，跟 [[wiki/frontend/web-platform/mutation-observer|MutationObserver]] 各管一边。

> [!example] 最小用法
> ```js
> const ro = new ResizeObserver((entries) => {
>   for (const entry of entries) {
>     const { width, height } = entry.contentRect;
>     // 重算 thumb 长度 / 重新布局虚拟列表 / 重绘 canvas
>   }
> });
> ro.observe(element);
> // 销毁
> ro.disconnect();
> ```

> [!note] 跟其他观察者 API 的分工
> - **ResizeObserver**：监听**尺寸变化**（content-box / border-box / device-pixel-content-box）
> - **[[wiki/frontend/web-platform/mutation-observer|MutationObserver]]**：监听**DOM 子树变更**（节点增删、属性、文本）
> - **IntersectionObserver**：监听**视口交叉**（元素是否进入可视区）
>
> 三者正交，常组合使用。比如 [[wiki/frontend/ui-libraries/overlayscrollbars|OverlayScrollbars]] 同时挂 ResizeObserver（容器+内容尺寸）和 MutationObserver（DOM 变更），把所有"需要 update scrollbar"的触发源都覆盖。

**典型使用场景**：

- **自定义 scrollbar 的 thumb 长度同步**——容器变大或内容长度变了，thumb 比例要重算
- **虚拟列表的可见行数计算**——容器高度变了要重算 viewport 行数（[[wiki/frontend/react-native/view-recycling|view-recycling]] 的前置依赖）
- **响应式 SVG / Canvas**——监听容器尺寸变化触发重绘
- **`@container` 容器查询的 polyfill**——浏览器原生 container query 普及前的过渡方案

> [!warning] 性能注意点
> 回调在浏览器布局阶段后、绘制阶段前调用，**不要在回调里同步修改被观察元素的尺寸**——会触发 "ResizeObserver loop limit exceeded" 错误（浏览器自动断开本帧的进一步通知）。常见做法是用 `requestAnimationFrame` 异步处理，或者只在回调里更新跟尺寸不耦合的状态。

**降级方案**：旧浏览器（IE / 早期 Safari）用"探测元素 + scroll 事件"trick 模拟（OverlayScrollbars 的 SizeObserverPlugin 就是这个套路），原理是用一个 `position: absolute` 的探测元素监听其 scroll 事件来感知尺寸变化。
