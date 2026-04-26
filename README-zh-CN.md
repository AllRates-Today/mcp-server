# AllRatesToday MCP 服务器

[English](./README.md) | 简体中文

一个 MCP 服务器，让 AI 编程工具（**Claude Code**、**Cursor**、**Claude Desktop**、**ChatGPT Desktop** 以及任何支持 Model Context Protocol 的客户端）直接访问 [AllRatesToday](https://allratestoday.com) 的实时货币汇率、历史数据以及多币种查询接口。

接入后即可向 AI 助手提问：

- *"现在美元对欧元的汇率是多少？"*
- *"展示最近 30 天的 GBP/JPY 走势"*
- *"将 250 美元按实时汇率换算成加元"*
- *"列出所有支持的货币"*

## 必须先获取 API 密钥

MCP 服务器启动需要 AllRatesToday API 密钥。**免费套餐已足够使用** — 每月 300 次请求，无需信用卡。

1. 访问 [allratestoday.com/register](https://allratestoday.com/register) 注册（30 秒完成）
2. 验证邮箱
3. 在控制台复制密钥，格式类似 `art_live_xxxxx`
4. 在 MCP 客户端配置中将其设为 `ALLRATES_API_KEY`（见下方示例）

未设置密钥时服务器会拒绝启动并在控制台输出注册指引。

## 安装

```bash
npm install -g @allratestoday/mcp-server
```

或者直接通过 `npx @allratestoday/mcp-server` 运行，无需安装。

## 快速配置

### Claude Code

```bash
claude mcp add allratestoday -- npx -y @allratestoday/mcp-server
```

设置 API 密钥（必填）：

```bash
claude mcp env allratestoday ALLRATES_API_KEY=art_live_xxxxx
```

### Cursor

编辑 `~/.cursor/mcp.json`（或项目目录下的 `.cursor/mcp.json`）：

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

### Claude Desktop / ChatGPT Desktop

编辑对应的配置文件：

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

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

编辑完成后重启应用。

## 套餐

免费套餐包含每月 300 次请求。付费套餐从每月 4.99 欧元起，提供更高的限额以及多年的历史数据。详见 [allratestoday.com/pricing](https://allratestoday.com/pricing)。

## 提供的工具

四个工具都需要 `ALLRATES_API_KEY`。

| 工具 | 说明 |
|---|---|
| `get_exchange_rate` | 查询两种货币之间的实时中间价 |
| `get_historical_rates` | 获取 `1d`、`7d`、`30d` 或 `1y` 的历史汇率 |
| `get_rates_authenticated` | 一次查询多个目标货币，限额更高 |
| `list_currencies` | 列出所有受支持货币（币种代码、名称、符号） |

## 环境变量

| 变量 | 默认值 | 用途 |
|---|---|---|
| `ALLRATES_API_KEY` | *(必填)* | AllRatesToday 的 API 密钥。未设置时服务器无法启动 |
| `ALLRATES_BASE_URL` | `https://allratestoday.com/api` | 覆盖默认接口地址（用于自建或预发布环境） |

## 本地开发

```bash
git clone https://github.com/cahthuranag/mcp-server.git
cd mcp-server
npm install
npm run build
node dist/index.js    # 服务通过 stdio 运行 — 使用 Ctrl+C 退出
```

## 开源协议

MIT 协议 — 详见 [LICENSE](./LICENSE) 文件。
