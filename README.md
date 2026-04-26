# AllRatesToday MCP Server

English | [简体中文](./README-zh-CN.md)

MCP server that gives AI coding tools — **Claude Code**, **Cursor**, **Claude Desktop**, and any other Model Context Protocol client — real-time currency exchange rates, historical data, and financial news from [AllRatesToday](https://allratestoday.com).

Ask your assistant things like:

- *"What's the current USD to EUR rate?"*
- *"Show me the GBP/JPY rate over the last 30 days."*
- *"Convert 250 USD into CAD using a real rate."*
- *"List every supported currency."*

## Get an API key first (required)

The MCP server needs an AllRatesToday API key to start. **The free plan is enough** — 300 requests/month, no card required.

1. Register at [allratestoday.com/register](https://allratestoday.com/register) — takes 30 seconds
2. Verify your email
3. Copy your key from the dashboard — it looks like `art_live_xxxxx`
4. Set it as `ALLRATES_API_KEY` in your MCP client config (examples below)

The server will refuse to start without a key and print registration instructions in the console.

## Install

```bash
npm install -g @allratestoday/mcp-server
```

Or run without installing via `npx @allratestoday/mcp-server`.

## Quick setup

### Claude Code

```bash
claude mcp add allratestoday -- npx -y @allratestoday/mcp-server
```

Then set your API key:

```bash
claude mcp env allratestoday ALLRATES_API_KEY=art_live_xxxxx
```

### Cursor

Edit `~/.cursor/mcp.json` (or your project `.cursor/mcp.json`):

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

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Restart the app after editing.

## Plans

The free plan includes 300 requests/month. Paid plans start at €4.99/mo for higher limits and historical data going back years. See [allratestoday.com/pricing](https://allratestoday.com/pricing).

## Tools exposed

All four tools require an `ALLRATES_API_KEY`.

| Tool | Description |
|---|---|
| `get_exchange_rate` | Current mid-market rate between two currencies. |
| `get_historical_rates` | Historical data points over `1d`, `7d`, `30d`, or `1y`. |
| `get_rates_authenticated` | Multi-target rates and higher limits. |
| `list_currencies` | All supported currencies with codes, names, symbols. |

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ALLRATES_API_KEY` | *(required)* | Your AllRatesToday API key. Server will not start without it. |
| `ALLRATES_BASE_URL` | `https://allratestoday.com/api` | Override for self-hosted or staging environments. |

## Development

```bash
git clone https://github.com/cahthuranag/mcp-server.git
cd mcp-server
npm install
npm run build
node dist/index.js    # server runs on stdio — hit Ctrl+C to exit
```

## License

MIT — see [LICENSE](./LICENSE).
