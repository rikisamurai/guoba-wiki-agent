---
title: Obsidian Skills（kepano/obsidian-skills）
date: 2026-03-12
tags:
  - obsidian
  - claude
  - agent-skills
---
# Obsidian Skills

> [!info] 来源
> [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) — 由 Obsidian CEO Kepano 维护的官方 Agent Skills 集合。

## 概述

Obsidian Skills 是一组遵循 [Agent Skills 规范](https://agentskills.io/specification) 的技能包，可被任何兼容的 AI 代理使用，包括 **Claude Code** 和 **Codex CLI**。它们让 AI 代理能够理解并正确操作 Obsidian 特有的文件格式和功能。

## 包含的 Skills

| Skill | 说明 |
| --- | --- |
| **obsidian-markdown** | 创建和编辑 [Obsidian Flavored Markdown](https://help.obsidian.md/obsidian-flavored-markdown)（`.md`）—— 包括 wikilinks、embeds、callouts、properties 等 Obsidian 特有语法 |
| **obsidian-bases** | 创建和编辑 [Obsidian Bases](https://help.obsidian.md/bases/syntax)（`.base`）—— 支持视图、过滤器、公式和汇总，类似数据库视图 |
| **json-canvas** | 创建和编辑 [JSON Canvas](https://jsoncanvas.org/) 文件（`.canvas`）—— 包括节点、边、分组和连接 |
| **obsidian-cli** | 通过 [Obsidian CLI](https://help.obsidian.md/cli) 与 Obsidian vault 交互 —— 包括笔记管理、搜索、插件/主题开发调试 |
| **defuddle** | 使用 [Defuddle CLI](https://github.com/kepano/defuddle-cli) 从网页中提取干净的 Markdown 内容，去除导航和广告等杂项，节省 token |

## 安装方式

### 方式一：Marketplace（推荐）

```
/plugin marketplace add kepano/obsidian-skills
/plugin install obsidian@obsidian-skills
```

### 方式二：npx skills

```
npx skills add git@github.com:kepano/obsidian-skills.git
```

### 方式三：手动安装

根据使用的代理不同，安装路径有所区别：

| 代理 | 安装位置 |
| --- | --- |
| **Claude Code** | 将仓库内容放入 vault 根目录的 `/.claude` 文件夹 |
| **Codex CLI** | 将 `skills/` 目录复制到 `~/.codex/skills` |
| **OpenCode** | 将整个仓库克隆到 `~/.opencode/skills/obsidian-skills`（需保持完整目录结构） |

## 核心价值

1. **标准化**：遵循 Agent Skills 规范，跨代理通用
2. **Obsidian 原生**：让 AI 正确理解 wikilinks、callouts、properties 等 Obsidian 独有语法
3. **减少幻觉**：通过明确的技能文档约束 AI 的输出格式，避免生成不兼容的 Markdown
4. **可扩展**：每个 Skill 独立，可按需安装和组合
