---
title: FlashList
tags: [react-native, performance]
date: 2026-04-22
sources:
  - "[[sources/posts/frontend/React/React Native/learning/flash-list]]"
last-ingested: 2026-04-22
status: stable
---

Shopify 开源的 React Native 高性能列表组件，用 [[wiki/frontend/react-native/view-recycling|View 回收]] 替代 FlatList 的销毁/重建机制，解决长列表快速滚动时出现的"白屏闪烁"。API 几乎和 FlatList 一致：v1 迁移常见动作是改 import 加 `estimatedItemSize`，v2 已自动测量，但只支持新架构（Fabric）。

> [!note] 一句话定位
> FlashList ≈ FlatList API + Android RecyclerView 思路。已渲染过的 View 不销毁、放进回收池，滚入新数据时直接复用。

## 为什么不是 FlatList

FlatList 在快速滚动时**销毁**屏幕外的 View，再为滚入屏幕的数据重新创建——来不及渲染就看到空白。FlashList 借鉴 Android RecyclerView 的思路，让 View 复用而不是销毁，根本上消除了这个 race。详见 [[wiki/frontend/react-native/view-recycling|View 回收机制]]。

## 关键 props

| Prop | 作用 | 备注 |
| --- | --- | --- |
| `estimatedItemSize` | 估算 item 高度（px），用于预布局 | v1 必填，v2 已不需要 |
| `getItemType` | 多类型 item 时返回类型标识 | 同类型才会互相回收，避免错位 |
| `drawDistance` | 屏幕外预渲染距离（px） | 越大越不易白屏，但占内存 |

> [!example] v1 最小迁移
> ```tsx
> import { FlashList } from '@shopify/flash-list'
>
> <FlashList
>   data={data}
>   renderItem={({ item }) => <Text>{item.title}</Text>}
>   estimatedItemSize={50}
>   keyExtractor={(item) => item.id}
> />
> ```
> 三步：换 import、加 `estimatedItemSize`、有多类型再加 `getItemType`。v2 不再需要 `estimatedItemSize`，迁移时重点检查 item 内显式 `key`、`renderItem` 形态和 props memo。

## 常见坑

- **不设 estimatedItemSize（v1）**：会有 warning + 性能下降。给最常见 item 的高度即可
- **多类型不设 getItemType**：header / 商品 / footer 互相回收，出现布局错乱或闪烁
- **renderItem 用 index 当 key**：和 FlatList 同样禁忌，但 FlashList 违反时数据错位更明显（回收时绑错数据）
- **嵌套滚动**：嵌在外层 ScrollView 里时需要 `renderScrollComponent={NestedScrollView}`
- **v2 只支持新架构（Fabric）**：旧架构项目只能停留在 v1

## v1 vs v2

> [!compare] 版本差异
> | | v1 | v2 |
> | --- | --- | --- |
> | 架构 | 新旧架构都支持 | 仅 Fabric |
> | estimatedItemSize | 必填 | 已废弃，自动测量 |
> | 适用 | 项目未迁移新架构 | 已上 Fabric |

## 延伸阅读

- [FlashList GitHub](https://github.com/Shopify/flash-list)
- [FlashList 官方文档](https://shopify.github.io/flash-list/)
- [从 FlatList 迁移要点](https://shopify.github.io/flash-list/docs/usage/)
