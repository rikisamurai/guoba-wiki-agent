# 0011 默认使用 DeepSeek Flash，评测后再定长期默认值

- 状态：已接受
- 日期：2026-11-02

## 背景

用户使用 DeepSeek API。Pi 1.4.0 内置 `deepseekProvider()`：走 OpenAI Chat Completions 兼容协议，`baseUrl` 为 `https://api.deepseek.com`，API Key 读取 `DEEPSEEK_API_KEY`。DeepSeek 的思考参数格式与 `reasoning_content` 回放由 pi-ai 的 compat 配置自动处理。

Pi 1.4.0 内置目录中的两个模型（来自 npm 包 `dist/providers/data/deepseek.json`，单位为美元/百万 token，未与官网核对）：

| 模型                           | 输入 | 输出 | 缓存读取 | 上下文 | 思考档位         |
| ------------------------------ | ---- | ---- | -------- | ------ | ---------------- |
| `deepseek-flash`（V4.1 Flash） | 0.3  | 1.2  | 0.006    | 100 万 | low / high / max |
| `deepseek-v4-pro`（V4 Pro）    | 1.32 | 3.96 | 0.044    | 100 万 | high / max       |

## 决策

- 默认模型为 `deepseek-flash`，思考档位 `high`。
- 模型与思考档位都可以在配置和命令行中覆盖。
- API Key 只从环境变量 `DEEPSEEK_API_KEY` 读取，不写入配置文件。本地开发可以用 Node 24 的 `--env-file=.env`，`.env` 加入 `.gitignore`。
- 长期默认值由评测决定：同一批历史 ingest 在两个模型上各跑一遍，比较 Invariant 通过率、Warning 数、费用和耗时。

## 影响

- 开发期以低成本反复运行。
- `deepseek-flash` 不支持中途插入 system 消息（目录中没有 `supportsMidConvoSystemMessages`）。运行中不能改动 system prompt 或工具集；Skill Catalog 和运行上下文都在运行开始时一次性放进开头的 system 消息。
- 只接入 DeepSeek 一家，评测对比也限于 DeepSeek 的模型。以后要和其他家对比，需要另加 provider 配置。
