---
title: OverlayScrollbars · 隐藏原生滚动条的覆盖层方案
tags: [scrollbar, ui-library, web-perf]
date: 2026-04-27
source: https://github.com/KingSora/OverlayScrollbars
type: post
status: draft
ingested-at: 2026-04-27
---
> [!tip] TL;DR
> [OverlayScrollbars](https://github.com/KingSora/OverlayScrollbars) 是一个 15 KB 的 vanilla JS 库，用"隐藏原生滚动条 + 浮层覆盖一根自定义 scrollbar"的方式给 Web 应用加跨浏览器一致的滚动条样式。它的核心区别于 react-custom-scrollbars / perfect-scrollbar 这类"全 mock"方案——不接管滚动行为，只换皮，原生滚动引擎、键盘、触屏、a11y 全免费继承。**适合**那些 CSS 原生 `scrollbar-gutter` / `scrollbar-color` 兜不住、需要在 thumb 上做花活、又不想自己实现一个滚动引擎的场景。

## 它解决什么问题

原生滚动条有三个老问题：

- **跨平台样式不一致**：Windows 默认是粗边条，macOS 是细线 overlay，Linux 看 GTK 主题，移动端干脆隐藏
- **占用布局空间**：Windows 上滚动条永远占 ~15 px，导致内容宽度跳动
- **定制能力受限**：`::-webkit-scrollbar` 仅 WebKit 内核能用，Firefox 只有 `scrollbar-width`/`scrollbar-color` 两个属性，跨浏览器统一困难

CSS 这几年补了 `scrollbar-gutter: stable`、`scrollbar-color` 进规范，**简单场景已经够用**。但只要需求里出现"thumb 要做渐变/动画"、"轨道要带阴影"、"鼠标 hover 时滚动条加粗"、"自动隐藏 + 可拖拽"这类要求，CSS 就开始捉襟见肘。

OverlayScrollbars 的切入点很特别：**不替换原生滚动引擎，只换皮**。它把原生 scrollbar 用 CSS 隐藏掉，然后在容器边缘叠一层完全自定义的 DOM scrollbar，靠监听原生 scroll 事件把这层"皮"的位置同步过去。

## 核心技术原理

### "Overlay" 三个字怎么来的

字面意思——滚动条以**浮层**形式覆盖在内容右侧或底部，**不占布局空间**，跟 macOS/iOS 默认的 overlay scrollbar 行为一致。这是它跟"占位 scrollbar"方案的第一层差异。

更深的差异是：**它沿用浏览器原生滚动引擎**。

> [!compare] Overlay 派 vs Mock 派
> - **Mock 派**（react-custom-scrollbars、react-scrollbars-custom）：把容器 `overflow: hidden`，自己监听滚轮/触屏/键盘事件，手动 `transform: translateY()` 移动内容
> - **Overlay 派**（OverlayScrollbars、simplebar）：容器保持 `overflow: scroll`，把原生 scrollbar 用 `::-webkit-scrollbar` + 负 margin 等手段藏掉，浮层 thumb 通过监听 `scroll` 事件被动跟随
>
> Mock 派可以做更激进的定制（自定义滚动惯性、虚拟列表深度集成），但代价是要**自己重新实现一遍滚动引擎**——键盘 PageDown/Home/End、触屏惯性、Trackpad 双指、屏幕阅读器朗读位置、`scroll-behavior: smooth`、`scroll-snap`，每一项都要补。Overlay 派直接白嫖浏览器，所有这些都是免费的。

### DOM 结构

初始化后，OverlayScrollbars 会把目标元素包成三层结构：

- **host**：最外层，承载样式/CSS 变量
- **viewport**：实际带 `overflow: scroll` 的层，原生 scrollbar 在这里被隐藏
- **content**：用户原始内容
- **scrollbar 浮层**：跟 viewport 平级、`position: absolute` 浮在右侧/底部，内含 `track` + `handle`（thumb）

scrollbar 浮层不占据 viewport 的滚动尺寸，所以拖动 thumb 不会引发布局抖动。

### 观察者驱动的零轮询同步

最难的不是"画一根 scrollbar"，而是**让它跟内容尺寸/容器尺寸/DOM 变更保持同步**。OverlayScrollbars 的处理方式是把这件事完全外包给浏览器观察者 API：

- **`ResizeObserver`**：监听 host 与 content 两边的尺寸变化。容器变大变小、内容文字换行变多变少，都会触发 thumb 长度重算。
- **`MutationObserver`**：监听 content 子树的 DOM 变更（节点增删、属性变化、文本变更）。新加一段长内容、动态改了某个元素的 `display`，都通过这条路径触发整体 update。MutationObserver 配置里 `attributes` / `attributeFilter` 可以限定关注的属性，避免每次 className 抖动都全量 update。
- **降级方案**：库内置 `SizeObserverPlugin`，在不支持 ResizeObserver 的旧浏览器上用一个经典 hack——往容器里塞一个 `position: absolute` 的探测元素，借它的 `scroll` 事件触发 size detection。

> [!note] 为什么不轮询？
> requestAnimationFrame 轮询是早期同类库（包括 perfect-scrollbar 早版本）的常见做法，但即使空闲时也每帧跑一次代码，对电池和长尾性能不友好。观察者方案是"事件驱动"——只在真正变化时唤醒，配合 `update.debounce` 防抖配置（默认 0ms，可调到 33ms 等量级），把高频 DOM 变更聚合成一次重算。

### 滚动事件 → 浮层位置同步

scroll 事件以 passive listener 注册（`{ passive: true }`），监听器内部读 `viewport.scrollTop` / `viewport.scrollLeft` 算出 thumb 在 track 上的占比，再用 CSS `transform: translate3d()` 移动 thumb——`transform` 走 GPU 合成层，不触发 layout/paint。整个 scroll-tick 的 JS 工作量是 O(1)，不会成为滚动性能瓶颈。

新版 v2 还加了 `instance.sleep()` API：在已知短期内不需要 update（比如正在播一段固定动画）的场景，临时挂起所有观察者，等动画结束再 `instance.update()` 一次性同步，省掉中间帧的开销。

## API 与框架适配

核心 API 围绕单例展开：

```js
import { OverlayScrollbars } from 'overlayscrollbars';
import 'overlayscrollbars/overlayscrollbars.css';

const osInstance = OverlayScrollbars(
  document.querySelector('#scroll-container'),
  {
    overflow: { x: 'hidden', y: 'scroll' },           // 仅纵向滚
    scrollbars: { autoHide: 'leave', theme: 'os-theme-dark' },
  }
);
```

实例上的常用方法：

- `.options(newOpts)` —— 运行时改配置
- `.update(force)` —— 手动触发尺寸/可见性重算
- `.state()` —— 读当前 overflow 状态、scrollbars 可见性
- `.on(eventName, fn) / .off(...)` —— `scroll` / `updated` / `destroyed` 等事件
- `.sleep() / .destroy()` —— 临时挂起 / 彻底销毁

配置项分三大族：

- **`overflow`**：x/y 轴各自的 `hidden | scroll | visible | scroll-hidden`
- **`scrollbars`**：`visibility`（auto/hidden/visible）、`autoHide`（never/leave/move/scroll）、`theme`、`dragScroll`、`clickScroll`
- **`update`**：MutationObserver 的 `attributes` / `debounce` / `ignoreMutation` 钩子

官方框架适配包覆盖 React / Vue / Angular / Svelte / Solid，全 TypeScript。React 版本提供 Hook 形态：

```jsx
import { useOverlayScrollbars } from 'overlayscrollbars-react';
import 'overlayscrollbars/overlayscrollbars.css';

function ChatList() {
  const [initialize] = useOverlayScrollbars({
    options: { scrollbars: { autoHide: 'scroll' } },
    defer: true,                                        // 推迟到首帧后初始化，避免阻塞 hydration
  });
  return <div ref={initialize}>{/* 长内容 */}</div>;
}
```

`defer: true` 是 React 适配里专门为 SSR 加的开关——首屏直接交给原生 scrollbar，hydration 完成后再切到自定义 scrollbar，避免 first paint 抖动。

## 跟同类方案横评

| 维度 | 原生 | CSS-only<br/>(`scrollbar-gutter` + `scrollbar-color`) | OverlayScrollbars | simplebar | perfect-scrollbar |
|------|------|------|------|------|------|
| 滚动行为来源 | 原生 | 原生 | **原生** | 原生 | 部分 mock |
| 键盘可达 / a11y | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| 体积 (gzip) | 0 | 0 | 15 KB | 6 KB | 8 KB |
| TypeScript | — | — | ✅ 完整类型 | 社区 | 社区 |
| 框架包 | — | — | ✅ React/Vue/Angular/Svelte/Solid | ✅ React/Vue | ⚠️ 仅社区维护 |
| 维护活跃度 (2026-04) | — | — | **活跃**（v2.15 / 2025-04） | 活跃 | 低活跃 |
| 浏览器兼容 | — | 现代浏览器 | Chrome 55+ / FF 59+ / Safari 10+ | 类似 | 类似 |
| 定制深度 | 低 | 中 | 高 | 中 | 高 |

**Mock 派 vs Overlay 派**的取舍上面已经说了；**CSS-only vs OverlayScrollbars** 的分水岭是定制深度——只要能接受"跨浏览器视觉略有差异 + thumb 形态由浏览器决定"，CSS 永远是首选；要做超出浏览器范畴的视觉效果，再上 JS 库。

## 关键卖点

- **体积**：15.2 KB gzipped，零依赖，tree-shakable
- **TypeScript**：库本体和所有框架包全是 fully typed
- **浏览器兼容**：Firefox 59+ / Chrome 55+ / Safari 10+ / Edge 15+，更老的可装 SizeObserverPlugin 降级
- **a11y 与 i18n**：保留原生滚动 = 屏幕阅读器自然兼容；RTL、`writing-mode: vertical-rl` 等非常规文字方向都支持
- **现状**：v2.15.0（2025-04 发版），4.8k stars，MIT；已知用户 Spotify、IntelliJ IDEA、Storybook、AdminLTE、Scramble.cloud

## 局限与适用边界

> [!warning] 不要无脑装
> 现代浏览器上 `scrollbar-gutter: stable both-edges` + `scrollbar-color: #888 transparent` + `scrollbar-width: thin` 三件套已能覆盖 70-80% 的"我想要好看一点的滚动条"需求。15 KB 不是没成本，特别是首屏关键路径上。

注意点：

- **SSR 兼容但要谨慎**：库支持 Node / Deno / Bun 渲染，但首屏 hydration 前的瞬时显示会是原生 scrollbar，hydration 后切换到自定义版会有视觉跳动——React 适配的 `defer: true` 是缓解手段
- **不适合海量瞬时实例**：每个实例都挂了 `ResizeObserver` + `MutationObserver`，频繁创建销毁（比如虚拟列表里每行包一个 scroll 容器）会有内存压力。需要这种场景请优先复用单例
- **跟虚拟列表的关系**：OverlayScrollbars 解决"滚动条样式"，**不解决"列表性能"**。长列表性能问题该用 [[wiki/frontend/react-native/view-recycling|view-recycling]] / [[wiki/frontend/react-native/flash-list|FlashList]] 这类虚拟化方案处理，两者完全正交可以叠加

> [!tip] 判断口诀
> **跨浏览器视觉一致 + thumb 上要做花活 + 内容会高频动态变更** → 用 OverlayScrollbars；
> 三条满足两条以上就考虑，只满足一条优先试 CSS。

## 相关 wiki 页面

- [[wiki/frontend/ui-libraries/headless-ui]] —— OverlayScrollbars 也是典型的 headless 库（核心逻辑无样式，主题靠 CSS 类切换）
- [[wiki/frontend/react-native/view-recycling]] —— 虚拟列表跟自定义 scrollbar 的正交关系参考
- [[wiki/frontend/react-native/flash-list]] —— RN 侧的 view-recycling 落地

## 参考链接

- [GitHub 仓库](https://github.com/KingSora/OverlayScrollbars)
- [官网与 demo](https://kingsora.github.io/OverlayScrollbars/)
- [npm 包](https://www.npmjs.com/package/overlayscrollbars)
- [Bundlephobia 体积分析](https://bundlephobia.com/package/overlayscrollbars)
- [中文非官方文档](https://docs.namichong.com/overlayscrollbars/)
