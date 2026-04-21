# AllRatesToday MCP Server

MCP server that gives AI coding tools — **Claude Code**, **Cursor**, **Claude Desktop**, and any other Model Context Protocol client — real-time currency exchange rates, historical data, and financial news from [AllRatesToday](https://allratestoday.com).

Ask your assistant things like:

- *"What's the current USD to EUR rate?"*
- *"Show me the GBP/JPY rate over the last 30 days."*
- *"Convert 250 USD into CAD using a real rate."*
- *"List every supported currency."*

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

## Get an API key

1. Register at [allratestoday.com/register](https://allratestoday.com/register).
2. Verify your email.
3. Copy your key from the dashboard — it looks like `art_live_xxxxx`.

The free plan includes 300 requests/month. Paid plans start at €4.99/mo.

## Tools exposed

| Tool | API key | Description |
|---|---|---|
| `get_exchange_rate` | no | Current mid-market rate between two currencies. |
| `get_historical_rates` | yes | Historical data points over `1d`, `7d`, `30d`, or `1y`. |
| `get_rates_authenticated` | yes | Multi-target rates and higher limits. |
| `list_currencies` | no | All supported currencies with codes, names, symbols. |

Public tools (`get_exchange_rate`, `list_currencies`) work without a key. Set `ALLRATES_API_KEY` for the historical and multi-target endpoints.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ALLRATES_API_KEY` | *(unset)* | Your AllRatesToday API key. Required for `get_rates_authenticated`. |
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
