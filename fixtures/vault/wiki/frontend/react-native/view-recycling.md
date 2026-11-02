---
title: View 回收
tags: [performance, react-native]
date: 2026-04-22
sources:
  - "[[sources/posts/frontend/React/React Native/learning/flash-list]]"
last-ingested: 2026-04-22
status: stable
---

长列表性能优化的核心思路：**滚出屏幕的 View 不销毁，放进回收池；新数据滚入时直接复用旧 View，只更新数据**。Android RecyclerView 的设计哲学，被 [[wiki/frontend/react-native/flash-list|FlashList]] 移植到 React Native，用来取代 FlatList 的"销毁重建"模式。

> [!compare] 销毁重建 vs 回收复用
> | | FlatList（销毁重建） | FlashList（回收复用） |
> | --- | --- | --- |
> | 滚出屏幕 | 销毁 View | 放进回收池 |
> | 滚入屏幕 | 重新创建 View | 从池里取一个，绑新数据 |
> | 快速滚动 | 来不及创建，出现白屏 | 复用立刻可用，平滑滚动 |
> | 内存 | 屏幕外为 0 | 池占少量内存 |

## 类型分桶

回收池不是一个池，而是按 **item 类型分桶**。同类型的 View 才会互相回收——这就是 FlashList 的 `getItemType` 存在的原因。如果列表里混有 header、商品卡、广告位、分割线，必须告诉框架谁是谁，否则 header 的 View 可能被拿去渲染商品卡，布局错乱。

> [!warning] 不分桶的代价
> 多类型不设 `getItemType` → 跨类型回收 → 视觉闪烁、布局错位。这是回收机制最常见的踩坑点。

## 隐含约束

回收复用意味着同一个 View 实例会绑定多份数据。这给上层代码加了几个隐含约束：

- **不能用 index 当 key**：回收时旧 index 已失效，会导致数据错绑
- **renderItem 必须是纯函数**：副作用会跨数据残留
- **状态要外置**：item 内部 useState 在回收后状态可能错位，应当把状态提升到 data 里

**哪些场景适合**：长列表（千条以上）滚动卡顿、item 渲染成本高（含图片、动画）、需要 60 FPS 滚动体验。短列表（< 100 条）用 FlatList 就够了，回收带来的复杂度不值得。

**关联**：[[wiki/frontend/react-native/flash-list|FlashList]]（实现） / RN 核心组件（list 选型上下文） / Pressable vs TouchableOpacity（item 内可点击容器）
