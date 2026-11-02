---
title: Scrollbar Mock 派 vs Overlay 派
tags: [scrollbar, ui-library]
date: 2026-04-27
sources:
  - "[[sources/posts/frontend/libraries/overlayscrollbars]]"
last-ingested: 2026-04-27
status: draft
---

定制滚动条有两条互斥的实现路线：**Mock 派**接管整个滚动行为，自己用事件 + transform 重新实现一遍滚动引擎；**Overlay 派**只换皮，原生 scroll 引擎不动，浮层 thumb 被动跟随原生 scroll 事件。代表前者是 react-custom-scrollbars / react-scrollbars-custom，代表后者是 [[wiki/frontend/ui-libraries/overlayscrollbars|OverlayScrollbars]] 和 simplebar，对应 [[wiki/frontend/ui-libraries/overlay-scrollbar-pattern|Overlay Scrollbar 范式]]。

> [!compare] 两派分水岭
> | 维度 | Mock 派 | Overlay 派 |
> |---|---|---|
> | 容器 overflow | `hidden` | `scroll`（原生 scrollbar 隐藏） |
> | 滚动行为来源 | 自己监听 wheel/touch/key 重新实现 | 浏览器原生 |
> | 键盘 PageDown/Home/End | 要自己补 | ✅ 免费 |
> | 触屏惯性 / Trackpad 双指 | 要自己实现 | ✅ 免费 |
> | 屏幕阅读器朗读位置 | ⚠️ 易踩坑 | ✅ 免费 |
> | `scroll-behavior: smooth` / `scroll-snap` | 要自己适配 | ✅ 免费 |
> | 自定义滚动惯性 | ✅ 可以 | ❌ 受限于原生 |
> | 跟虚拟列表深度集成 | ✅ 灵活 | ⚠️ 受限 |

> [!tip] 选型建议
> 默认选 Overlay 派——把"滚动行为正确性"这件事完全外包给浏览器，是 21 世纪 a11y / 多输入设备时代的政治正确选择。**只有**当业务确实需要"自定义惯性曲线"或"跟虚拟列表手动同步 transform"这种非常规需求时，才上 Mock 派，且要做好补齐键盘 / a11y / 触屏惯性这些 corner case 的心理准备。

实际工程里，社区维护的 Mock 派老库（perfect-scrollbar、react-custom-scrollbars）因为 a11y / 维护活跃度问题已陆续被 Overlay 派替代——这不是技术品味问题，是**重新实现浏览器引擎的成本太高、回报太低**导致的自然淘汰。
