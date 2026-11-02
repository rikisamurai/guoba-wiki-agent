---
title: MutationObserver
tags: [web-api, web-perf]
date: 2026-04-27
sources:
  - "[[sources/posts/frontend/libraries/overlayscrollbars]]"
last-ingested: 2026-04-27
status: stable
---

MutationObserver 是 Web 平台 API，**事件驱动地监听 DOM 子树变更**——节点增删、属性变化、文本变化、子树变化都能捕获。取代过去用 `setInterval` 轮询 DOM 状态的做法，是"DOM 变了重新计算 X"类场景的标准基础设施，跟 [[wiki/frontend/web-platform/resize-observer|ResizeObserver]] 各管一边。

> [!example] 最小用法
> ```js
> const mo = new MutationObserver((mutations) => {
>   for (const m of mutations) {
>     // m.type: 'childList' | 'attributes' | 'characterData'
>     // m.addedNodes / m.removedNodes / m.target / m.attributeName
>   }
> });
> mo.observe(target, {
>   childList: true,        // 子节点增删
>   subtree: true,          // 递归监听整棵子树
>   attributes: true,       // 属性变化
>   attributeFilter: ['class', 'style'],  // 只监听特定属性，省事件量
>   characterData: true,    // 文本变化
> });
> mo.disconnect();
> ```

**配置粒度的关键开关**是 `attributeFilter`——不加这个就会监听所有属性变化，每次 className 抖动都触发回调，量级很容易爆。

> [!note] 跟其他观察者 API 的分工
> - **MutationObserver**：监听**DOM 子树变更**（节点 / 属性 / 文本）
> - **[[wiki/frontend/web-platform/resize-observer|ResizeObserver]]**：监听**元素尺寸变化**
> - **IntersectionObserver**：监听**视口交叉**
>
> 三者正交。[[wiki/frontend/ui-libraries/overlayscrollbars|OverlayScrollbars]] 同时用 ResizeObserver + MutationObserver 是 [[wiki/frontend/ui-libraries/overlay-scrollbar-pattern|Overlay Scrollbar 范式]] 的标准依赖：尺寸变化和 DOM 变化是 scrollbar 需要 update 的两类正交触发源。

**典型使用场景**：

- **自定义 scrollbar update**——子节点增删 / 文本变更都可能改变内容总尺寸，触发 thumb 重算
- **MutationObserver 的"文本变更追踪"**——所见即所得编辑器、协作编辑里探测局部内容变更
- **第三方脚本注入检测**——监听 `<head>` / `<body>` 节点增删，安全场景常用
- **CSS-in-JS 库的 className 同步**——监听样式 attribute 变更触发主题重应用

> [!warning] 性能陷阱
> 回调是异步批量调用（microtask 调度），高频 DOM 变更会聚合成一批。但**回调里如果再触发 DOM 变更**，可能死循环。OverlayScrollbars 的 `update.debounce` 配置（默认 0ms，可调到 33ms 等量级）就是把高频变更聚合成更稀疏的触发，避免回调风暴。
>
> 另一个坑：`attributes: true` 不加 `attributeFilter` 时，hover / focus 这种 className 切换都会触发，量极大。**默认就该加 `attributeFilter`**。
