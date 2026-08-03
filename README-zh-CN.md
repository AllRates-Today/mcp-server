# AllRatesToday MCP 服务器

[![npm version](https://img.shields.io/npm/v/@allratestoday/mcp-server.svg?style=flat-square)](https://www.npmjs.com/package/@allratestoday/mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@allratestoday/mcp-server.svg?style=flat-square)](https://www.npmjs.com/package/@allratestoday/mcp-server)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](./LICENSE)
[![MCP](https://img.shields.io/badge/Model%20Context%20Protocol-1.x-blue.svg?style=flat-square)](https://modelcontextprotocol.io)

[English](./README.md) | 简体中文

> 让你的 AI 编程助手获得通往外汇市场的实时窗口。

一个 Model Context Protocol（模型上下文协议）服务器，让 **Claude Code**、**Cursor**、**Claude Desktop**、**Windsurf** 以及任何其他 MCP 兼容客户端都能从 [AllRatesToday API](https://allratestoday.com) 获取实时货币汇率、历史数据和多币种查询。

接入后，AI 助手可以直接回答这类问题：

- *"现在美元对欧元的汇率是多少？"*
- *"展示最近 30 天 GBP/JPY 的走势"*
- *"按真实汇率把 250 美元换算成加元"*
- *"同时对比美元兑欧元、英镑、日元的汇率"*
- *"列出所有支持的货币"*

---

## 目录

- [核心能力](#核心能力)
- [获取 API 密钥（必需）](#获取-api-密钥必需)
- [安装](#安装)
- [各客户端快速配置](#各客户端快速配置)
  - [Claude Code](#claude-code)
  - [Cursor](#cursor)
  - [Claude Desktop](#claude-desktop)
  - [Windsurf](#windsurf)
  - [通用 stdio MCP 客户端](#通用-stdio-mcp-客户端)
- [验证是否生效](#验证是否生效)
- [工具说明](#工具说明)
- [环境变量](#环境变量)
- [套餐与限额](#套餐与限额)
- [故障排查](#故障排查)
- [错误代码对照](#错误代码对照)
- [常见问题](#常见问题)
- [本地开发](#本地开发)
- [更新日志](#更新日志)
- [支持与反馈](#支持与反馈)
- [开源协议](#开源协议)

---

## 核心能力

| 能力 | 说明 |
|---|---|
| **货币种类** | 150+ 种 ISO 4217 货币代码，覆盖所有主要货币和大部分小币种 |
| **更新频率** | 中间价大约每 60 秒刷新一次 |
| **数据来源** | 机构级银行间市场数据 |
| **历史深度** | 最长 1 年，提供 `1d` / `7d` / `30d` / `1y` 四种时间粒度 |
| **暴露的工具** | 4 个 — `get_exchange_rate`、`get_historical_rates`、`get_rates_authenticated`、`list_currencies` |
| **传输方式** | stdio（子进程），兼容 MCP 1.x |
| **运行环境** | Node.js ≥18 |

---

## 获取 API 密钥（必需）

未设置有效的 `ALLRATES_API_KEY` 时，**服务器无法启动**。免费密钥已足够开发与个人使用 — **无需信用卡**。

1. 访问 [allratestoday.com/register](https://allratestoday.com/register) 注册（30 秒完成）
2. 验证邮箱
3. 在控制台复制密钥（格式形如 `art_live_xxxxx`）
4. 在下方配置中将其设为 `ALLRATES_API_KEY`

如果忘记设置，服务器会在 stderr 输出清晰的注册指引并以退出码 1 退出。

---

## 安装

服务器已发布为 npm 包。**通过 `npx` 零安装**是最简单的方式，下方所有配置都使用此方式。

```bash
# 无需安装，直接运行（推荐）
npx -y @allratestoday/mcp-server

# 或全局安装
npm install -g @allratestoday/mcp-server
allratestoday-mcp
```

这两个命令都会启动 stdio MCP 服务器并等待客户端连接，**不应**直接在终端中运行 — 而是由 MCP 客户端作为子进程启动。

---

## 各客户端快速配置

不同客户端从不同的配置文件读取 MCP 服务器，请选择对应的配置方式。

### Claude Code

最简单的方式是使用 Claude Code 自带的 CLI：

```bash
claude mcp add allratestoday -- npx -y @allratestoday/mcp-server
claude mcp env allratestoday ALLRATES_API_KEY=art_live_xxxxx
```

重启 Claude Code，向其提问 *"现在美元对欧元的汇率是多少？"* 进行验证。

### Cursor

编辑 `~/.cursor/mcp.json`（或在项目下的 `.cursor/mcp.json` 进行项目级配置）：

```json
{
  "mcpServers": {
    "allratestoday": {
      "command": "npx",
      "args": ["-y", "@allratestoday/mcp-server"],
      "env": {
        "ALLRATES_API_KEY": "art_live_xxxxx"
      }
    }
  }
}
```

重启 Cursor，4 个工具应当出现在 MCP 工具选择器中。

### Claude Desktop

编辑配置文件（路径因系统而异）：

| 系统 | 路径 |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "allratestoday": {
      "command": "npx",
      "args": ["-y", "@allratestoday/mcp-server"],
      "env": {
        "ALLRATES_API_KEY": "art_live_xxxxx"
      }
    }
  }
}
```

**完全退出并重新打开 Claude Desktop**（macOS 使用 Cmd+Q，Windows 在系统托盘图标上右键 → 退出）。仅关闭窗口不会重新加载配置。

### Windsurf

编辑 `~/.codeium/windsurf/mcp_config.json`：

```json
{
  "mcpServers": {
    "allratestoday": {
      "command": "npx",
      "args": ["-y", "@allratestoday/mcp-server"],
      "env": {
        "ALLRATES_API_KEY": "art_live_xxxxx"
      }
    }
  }
}
```

重启 Windsurf。

### 通用 stdio MCP 客户端

任何支持 stdio 传输的 MCP 宿主都可以接入。启动命令为：

```
npx -y @allratestoday/mcp-server
```

…并设置环境变量 `ALLRATES_API_KEY`。协议版本为 MCP 1.x。

---

## 验证是否生效

完成客户端配置后，按以下顺序进行测试：

1. **服务器成功启动** — 打开客户端，如果 MCP 集成显示红点或"连接失败"，则 API 密钥缺失或错误（参见[故障排查](#故障排查)）。

2. **工具已被识别** — 大多数客户端有"工具"或"MCP"面板，应能看到：
   - `get_exchange_rate`
   - `get_historical_rates`
   - `get_rates_authenticated`
   - `list_currencies`

3. **实际调用返回真实数据** — 向 AI 助手提问：

   > *现在美元对欧元的汇率是多少？*

   助手会调用 `get_exchange_rate(source: "USD", target: "EUR")` 并返回真实汇率（例如 *"美元兑欧元当前为 0.9214"*）。如果它给出数字但**没有发起工具调用**，说明服务器并未真正连接。

---

## 工具说明

所有 4 个工具都需要 `ALLRATES_API_KEY`。

### `get_exchange_rate`

获取两种货币之间的实时中间价。

**输入参数**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `source` | string | 是 | 3 位 ISO 4217 货币代码，例如 `USD` |
| `target` | string | 是 | 3 位 ISO 4217 货币代码，例如 `EUR` |

**调用示例**

```json
{ "source": "USD", "target": "EUR" }
```

**响应示例**

```json
{ "rate": 0.92145, "source": "wise" }
```

### `get_historical_rates`

某币种对在固定周期内的历史时间序列数据。

**输入参数**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `source` | string | 是 | 源货币代码 |
| `target` | string | 是 | 目标货币代码 |
| `period` | string | 否（默认 `7d`） | `1d` / `7d` / `30d` / `1y` 之一 |

**不同周期对应的数据点密度**

| `period` | 数据点 |
|---|---|
| `1d` | 每小时（24 个点） |
| `7d` | 每天（7 个点） |
| `30d` | 每天（30 个点） |
| `1y` | 每周（52 个点） |

**调用示例**

```json
{ "source": "USD", "target": "INR", "period": "30d" }
```

**响应示例（已截断）**

```json
{
  "source": "USD",
  "target": "INR",
  "period": "30d",
  "data": [
    { "date": "2026-03-27T00:00:00Z", "rate": 83.42, "timestamp": 1743033600000 },
    { "date": "2026-03-28T00:00:00Z", "rate": 83.51, "timestamp": 1743120000000 },
    "..."
  ]
}
```

### `get_rates_authenticated`

一次查询多个目标货币，可选指定历史时间或聚合窗口。

**输入参数**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `source` | string | 是 | 源货币代码 |
| `target` | string | 是 | 一个或多个目标货币代码，逗号分隔（`EUR,GBP,JPY`） |
| `time` | string（ISO 8601） | 否 | 历史时间点 |
| `group` | string | 否 | `hour` / `day` / `week` / `month` 之一 |

**调用示例**

```json
{ "source": "USD", "target": "EUR,GBP,JPY" }
```

**响应示例**

```json
[
  { "rate": 0.9214, "source": "USD", "target": "EUR", "time": "2026-04-26T11:00:00Z" },
  { "rate": 0.7891, "source": "USD", "target": "GBP", "time": "2026-04-26T11:00:00Z" },
  { "rate": 151.34, "source": "USD", "target": "JPY", "time": "2026-04-26T11:00:00Z" }
]
```

### `list_currencies`

列出所有受支持货币的代码、名称和符号，上游缓存 24 小时。

**输入参数** — 无。

**响应示例（已截断）**

```json
{
  "currencies": [
    { "code": "USD", "name": "US Dollar", "symbol": "$" },
    { "code": "EUR", "name": "Euro", "symbol": "€" },
    { "code": "GBP", "name": "British Pound", "symbol": "£" },
    "..."
  ],
  "count": 162
}
```

---

## 环境变量

| 变量 | 默认值 | 必填 | 用途 |
|---|---|---|---|
| `ALLRATES_API_KEY` | — | **是** | AllRatesToday 的 API 密钥。未设置时服务器启动即退出。 |
| `ALLRATES_BASE_URL` | `https://allratestoday.com/api` | 否 | 覆盖默认接口地址（用于自建或预发布环境）。 |

这些变量需要在 MCP 客户端配置（`env` 块）中设置，**不是**在你的 shell 中 — 因为 MCP 服务器是以独立环境的子进程方式启动的。

---

## 套餐

提供免费套餐与付费套餐。当前配额详见 [allratestoday.com/pricing](https://allratestoday.com/pricing)。所有套餐的货币覆盖与历史深度一致 — 仅请求配额不同。

---

## 故障排查

| 现象 | 可能原因 | 解决方法 |
|---|---|---|
| 客户端提示"MCP 服务器启动失败"或显示红点 | `ALLRATES_API_KEY` 未设置或不正确 | 在客户端配置中核对密钥；确认与控制台显示一致 |
| 工具显示出来，但每次调用都返回 "Invalid AllRatesToday API key" | 密钥格式错误（前缀缺失、被截断、或已撤销） | 在控制台重新复制完整密钥 |
| 工具返回 "AllRatesToday API quota exceeded" | 已超出免费套餐月度限额 | 等待下个月或升级套餐 |
| 历史工具返回 "Bad request" | period 参数无效或货币代码错误 | period 必须为 `1d`/`7d`/`30d`/`1y`；货币代码必须为 3 个字母 |
| 服务器启动了但客户端始终看不到工具 | 客户端未在配置变更后重新加载 | 完全退出（不仅是关闭窗口）然后重新打开客户端 |
| 直接运行 `npx` 时进程一直挂起 | 服务器在等待 MCP 客户端连接 — 这是正常行为 | 不要从 shell 直接运行；让 MCP 客户端启动它 |

### 查看服务器日志

要观察服务器运行状态，在设置好密钥的情况下手动启动：

```bash
ALLRATES_API_KEY=art_live_xxxxx npx -y @allratestoday/mcp-server
```

健康状态下应当没有任何输出（stdio 通道是 MCP 协议专用的）。错误信息会输出到 stderr。

---

## 错误代码对照

服务器会把 API 错误映射为清晰、可执行的提示信息。

| HTTP 状态码 | 含义 | 工具错误信息 |
|---|---|---|
| 200 | 成功 | （返回汇率） |
| 400 | 请求错误 — 通常是货币代码无效 | `Bad request — possibly an unknown currency code` |
| 401 | API 密钥无效或缺失 | `Invalid AllRatesToday API key` |
| 429 | 超出配额 | `AllRatesToday API quota exceeded` |
| 5xx | allratestoday.com 上游故障 | `HTTP 5xx — <上游消息>` |

LLM 会把这些信息直接展示给用户。例如用户问题触发 429 后，助手会回答 *"API 配额已用完 — 请等到下月或升级套餐"*。

---

## 常见问题

**免费套餐够日常用吗？**
个人/开发场景足够。免费套餐覆盖日常少量询问。重度交互、多会话并行使用，或在生产环境运行的场景应考虑付费套餐。

**会保留我的对话或查询数据吗？**
不会。只有 API 密钥和请求参数（source、target、period、time）会发送到 allratestoday.com — 永远不会传输 LLM 的对话内容、表格内容或其他无关数据。

**我的 API 密钥会被怎么处理？**
仅作为 `Authorization: Bearer` 头部发送给 AllRatesToday API，不会被记录或转发到任何其他地方。

**为什么第一次历史查询比较慢？**
`npx` 冷启动（首次运行需要下载包）加上 AllRatesToday 首次缓存未命中导致。后续调用通常 <200ms。

**能在没有 npm/Node 的环境下运行吗？**
目前不行 — 需要 Node ≥18。我们考虑过提供独立可执行文件，如果对你重要请提交 issue。

**有自托管方案吗？**
有，将 `ALLRATES_BASE_URL` 设置为你自己的 AllRatesToday 实例即可。如需自托管授权请联系 support@allratestoday.com。

**能配合 ChatGPT 使用吗？**
Anthropic 的 MCP 标准适用于任何兼容 MCP 的客户端。ChatGPT Desktop 已有实验性 MCP 支持，请参考 OpenAI 的文档了解最新进展。

---

## 本地开发

```bash
git clone https://github.com/cahthuranag/mcp-server.git
cd mcp-server
npm install
npm run build
ALLRATES_API_KEY=art_live_xxxxx node dist/index.js
```

服务器通过 stdio 运行并等待 MCP 客户端连接，按 Ctrl+C 退出。

监听文件变化并自动重新构建：

```bash
npm run dev
```

针对本地 AllRatesToday 实例进行调试：

```bash
ALLRATES_BASE_URL=http://localhost:8080/api ALLRATES_API_KEY=test_key node dist/index.js
```

### 项目结构

```
src/
├── index.ts      # MCP 服务器、工具注册、请求处理
└── client.ts     # AllRatesToday API 的 HTTP 客户端 + 错误映射
dist/             # 编译后的 JS（gitignored）
server.json       # MCP 注册表清单
package.json      # npm 元数据、依赖、脚本
```

### 贡献指南

欢迎在 [github.com/cahthuranag/mcp-server](https://github.com/cahthuranag/mcp-server) 提交 issue 与 PR。开 PR 前请确保：

1. `npm run build` 无错误
2. 用真实 AllRatesToday API 密钥（设置 `ALLRATES_API_KEY`）测试通过
3. 如修改了工具行为，请同步更新 `src/index.ts` 中的工具描述
4. 如新增/重命名工具，请同步更新本 README 的"工具说明"章节

---

## 更新日志

完整版本历史见 [GitHub Releases](https://github.com/cahthuranag/mcp-server/releases)。近期亮点：

- **0.3.x** — 所有工具均需 API 密钥；启动时立即报错并给出清晰提示
- **0.2.x** — 移除新闻工具，`get_historical_rates` 改为需要鉴权
- **0.1.x** — 初版发布，包含 5 个工具

---

## 支持与反馈

- **API 相关问题**：[support@allratestoday.com](mailto:support@allratestoday.com)
- **Bug 反馈**：[github.com/cahthuranag/mcp-server/issues](https://github.com/cahthuranag/mcp-server/issues)
- **MCP 协议问题**：[modelcontextprotocol.io](https://modelcontextprotocol.io) — 协议官方文档
- **状态/可用性**：[allratestoday.com](https://allratestoday.com)（状态页正在搭建中）

---

## 开源协议

MIT 协议 — 详见 [LICENSE](./LICENSE) 文件。
