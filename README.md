# AllRatesToday MCP Server

[![npm version](https://img.shields.io/npm/v/@allratestoday/mcp-server.svg?style=flat-square)](https://www.npmjs.com/package/@allratestoday/mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@allratestoday/mcp-server.svg?style=flat-square)](https://www.npmjs.com/package/@allratestoday/mcp-server)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](./LICENSE)
[![MCP](https://img.shields.io/badge/Model%20Context%20Protocol-1.x-blue.svg?style=flat-square)](https://modelcontextprotocol.io)

English | [简体中文](./README-zh-CN.md)

> Give your AI coding assistant a live window into the foreign-exchange market.

A Model Context Protocol server that lets **Claude Code**, **Cursor**, **Claude Desktop**, **Windsurf**, and any other MCP-compatible client fetch real-time currency rates, historical data, and multi-currency lookups from the [AllRatesToday API](https://allratestoday.com).

After installation, your assistant can answer questions like:

- *"What's the current USD to EUR rate?"*
- *"Show me how GBP/JPY moved over the last 30 days."*
- *"Convert 250 USD into CAD at a real rate."*
- *"Compare USD against EUR, GBP, and JPY simultaneously."*
- *"List every supported currency."*

---

## Table of contents

- [What you get](#what-you-get)
- [Get an API key (required)](#get-an-api-key-required)
- [Install](#install)
- [Quick setup per client](#quick-setup-per-client)
  - [Claude Code](#claude-code)
  - [Cursor](#cursor)
  - [Claude Desktop](#claude-desktop)
  - [Windsurf](#windsurf)
  - [Generic stdio MCP client](#generic-stdio-mcp-client)
- [Verify it works](#verify-it-works)
- [Tools reference](#tools-reference)
- [Environment variables](#environment-variables)
- [Plans and limits](#plans-and-limits)
- [Troubleshooting](#troubleshooting)
- [Error reference](#error-reference)
- [FAQ](#faq)
- [Development](#development)
- [Changelog](#changelog)
- [Support](#support)
- [License](#license)

---

## What you get

| Capability | Detail |
|---|---|
| **Currencies** | 150+ ISO 4217 codes, all major and most exotics |
| **Update frequency** | Mid-market rates refresh every ~60 seconds |
| **Data source** | Tier-1 financial data providers (Reuters / Refinitiv-class) |
| **Historical depth** | Up to 1 year via `1d` / `7d` / `30d` / `1y` granularity |
| **Tools exposed** | 4 — `get_exchange_rate`, `get_historical_rates`, `get_rates_authenticated`, `list_currencies` |
| **Transport** | stdio (subprocess), MCP 1.x compatible |
| **Runtime** | Node.js ≥18 |

---

## Get an API key (required)

The server **will not start** without a valid `ALLRATES_API_KEY`. A free key is enough for development and personal use — **no credit card required**.

1. Register at [allratestoday.com/register](https://allratestoday.com/register) — 30 seconds
2. Verify your email
3. Copy your key from the dashboard (format: `art_live_xxxxx`)
4. Use it as `ALLRATES_API_KEY` in the configs below

If you forget, the server prints clear registration instructions on stderr and exits with code 1.

---

## Install

The server is published as an npm package. The simplest install is **zero-install via `npx`**, which is what every config below uses.

```bash
# Run without installing (recommended)
npx -y @allratestoday/mcp-server

# Or install globally
npm install -g @allratestoday/mcp-server
allratestoday-mcp
```

Both commands launch the stdio MCP server and wait for a client to connect. They're not meant to be run directly from your shell — your MCP client launches them as a subprocess.

---

## Quick setup per client

Each client reads MCP servers from a different config file. Pick yours below.

### Claude Code

The fastest path uses the built-in CLI:

```bash
claude mcp add allratestoday -- npx -y @allratestoday/mcp-server
claude mcp env allratestoday ALLRATES_API_KEY=art_live_xxxxx
```

Restart Claude Code. Verify by asking it: *"What's the current USD to EUR rate?"*

### Cursor

Edit `~/.cursor/mcp.json` (or `.cursor/mcp.json` inside your project for project-scoped servers):

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

Restart Cursor. The four tools should appear in the MCP tool picker.

### Claude Desktop

Edit the config file (path depends on OS):

| OS | Path |
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

**Fully quit and reopen Claude Desktop** (Cmd+Q on macOS, right-click tray icon → Exit on Windows). Closing the window alone keeps the old config loaded.

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

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

Restart Windsurf.

### Generic stdio MCP client

Any MCP host that supports stdio transport works. The launch command is:

```
npx -y @allratestoday/mcp-server
```

…with the environment variable `ALLRATES_API_KEY` set. The protocol version is MCP 1.x.

---

## Verify it works

After configuring your client, test in this order:

1. **Server starts** — open the client. If the MCP integration shows a red dot or "failed to connect", the API key is missing or wrong (see [Troubleshooting](#troubleshooting)).

2. **Tools are listed** — most clients have a "tools" or "MCP" panel. You should see:
   - `get_exchange_rate`
   - `get_historical_rates`
   - `get_rates_authenticated`
   - `list_currencies`

3. **A live call returns a number** — ask the assistant:

   > *What's the current USD to EUR rate?*

   The assistant will call `get_exchange_rate(source: "USD", target: "EUR")` and reply with a real rate (e.g. `"USD to EUR is currently 0.9214."`). If it fabricates a number without making a tool call, the server isn't connected.

---

## Tools reference

All four tools require `ALLRATES_API_KEY`.

### `get_exchange_rate`

Current mid-market rate between two currencies.

**Input**

| Field | Type | Required | Description |
|---|---|---|---|
| `source` | string | yes | 3-letter ISO 4217 code, e.g. `USD` |
| `target` | string | yes | 3-letter ISO 4217 code, e.g. `EUR` |

**Example call**

```json
{ "source": "USD", "target": "EUR" }
```

**Example response**

```json
{ "rate": 0.92145, "source": "wise" }
```

### `get_historical_rates`

Time-series data points for a currency pair over a fixed period.

**Input**

| Field | Type | Required | Description |
|---|---|---|---|
| `source` | string | yes | Source currency code |
| `target` | string | yes | Target currency code |
| `period` | string | no (default `7d`) | One of `1d`, `7d`, `30d`, `1y` |

**Granularity by period**

| `period` | Data points |
|---|---|
| `1d` | Hourly (24 points) |
| `7d` | Daily (7 points) |
| `30d` | Daily (30 points) |
| `1y` | Weekly (52 points) |

**Example call**

```json
{ "source": "USD", "target": "INR", "period": "30d" }
```

**Example response (truncated)**

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

Multiple targets in one call, with optional historical timestamp or grouping window.

**Input**

| Field | Type | Required | Description |
|---|---|---|---|
| `source` | string | yes | Source currency code |
| `target` | string | yes | One or more codes, comma-separated (`EUR,GBP,JPY`) |
| `time` | string (ISO 8601) | no | Historical point in time |
| `group` | string | no | One of `hour`, `day`, `week`, `month` |

**Example call**

```json
{ "source": "USD", "target": "EUR,GBP,JPY" }
```

**Example response**

```json
[
  { "rate": 0.9214, "source": "USD", "target": "EUR", "time": "2026-04-26T11:00:00Z" },
  { "rate": 0.7891, "source": "USD", "target": "GBP", "time": "2026-04-26T11:00:00Z" },
  { "rate": 151.34, "source": "USD", "target": "JPY", "time": "2026-04-26T11:00:00Z" }
]
```

### `list_currencies`

All supported currencies with codes, names, and symbols. Cached upstream for 24 hours.

**Input** — none.

**Example response (truncated)**

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

## Environment variables

| Variable | Default | Required | Purpose |
|---|---|---|---|
| `ALLRATES_API_KEY` | — | **yes** | Your API key. The server exits at startup if unset. |
| `ALLRATES_BASE_URL` | `https://allratestoday.com/api` | no | Override for self-hosted or staging deployments. |

You set these in your MCP client's config (in the `env` block) — not in your shell — because MCP servers are launched as subprocesses with isolated environments.

---

## Plans

A free tier and paid plans are available. See [allratestoday.com/pricing](https://allratestoday.com/pricing) for current quotas. All plans include the same currency coverage and historical depth — only the request quotas differ.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Client shows "MCP server failed to start" or red dot | `ALLRATES_API_KEY` not set or invalid | Verify the key in your client config; check it matches the dashboard |
| Tools show but every call returns "Invalid AllRatesToday API key" | Key is malformed (missing prefix, truncated, or revoked) | Copy a fresh key from the dashboard |
| Tools return "AllRatesToday API quota exceeded" | Free-tier monthly limit hit | Wait until next month or upgrade plan |
| Historical tool returns "Bad request" | Invalid period or unknown currency code | Period must be `1d`/`7d`/`30d`/`1y`; codes must be 3 letters |
| Server starts but tools never appear in client | Client didn't reload after config change | Fully quit (not just close) and reopen the client |
| `npx` runs but hangs forever | The server is waiting for an MCP client to connect — this is normal when run from a shell | Don't run from a shell; let your MCP client launch it |

### Inspect server logs

To see what the server is doing, run it manually with the API key set:

```bash
ALLRATES_API_KEY=art_live_xxxxx npx -y @allratestoday/mcp-server
```

You should see no output when healthy (stdio is reserved for the MCP protocol). Any errors print to stderr.

---

## Error reference

The server maps API errors to clear, actionable messages.

| HTTP status | Meaning | Tool error message |
|---|---|---|
| 200 | Success | (rate returned) |
| 400 | Bad request — usually unknown currency code | `Bad request — possibly an unknown currency code` |
| 401 | Invalid or missing API key | `Invalid AllRatesToday API key` |
| 429 | Quota exceeded | `AllRatesToday API quota exceeded` |
| 5xx | Server-side issue at allratestoday.com | `HTTP 5xx — <upstream message>` |

The LLM will surface these messages in its response, so a user prompt that hits a 429 results in the assistant saying *"the API quota has been exceeded — please try again next month or upgrade your plan."*

---

## FAQ

**Is the free plan really enough for normal use?**
Yes for personal/dev use. The free tier covers a few daily questions. Heavy interactive use, multiple chat sessions per day, or running the server in production should consider the paid tiers.

**Do you store my conversation or query data?**
No. Only your API key and the request parameters (source, target, period, time) are sent to allratestoday.com — never the LLM's conversation context, sheet contents, or anything else.

**What happens to my API key?**
It's only sent as a `Bearer` token in the `Authorization` header on requests to the AllRatesToday API. It's never logged or transmitted elsewhere.

**Why is my historical request slow on first call?**
Cold-start of `npx` (first run downloads the package) plus the initial AllRatesToday cache miss. Subsequent calls are fast (<200ms typically).

**Can I run this without npm/Node?**
Not currently — Node ≥18 is required. We've considered a standalone binary; if that matters to you, open an issue.

**Is there a self-hosted option?**
Yes, set `ALLRATES_BASE_URL` to your own AllRatesToday instance. Contact support@allratestoday.com for self-hosted licensing.

**Does this work with ChatGPT?**
The Anthropic MCP standard works with any MCP-compatible client. ChatGPT Desktop has experimental MCP support; check OpenAI's docs for current status.

---

## Development

```bash
git clone https://github.com/cahthuranag/mcp-server.git
cd mcp-server
npm install
npm run build
ALLRATES_API_KEY=art_live_xxxxx node dist/index.js
```

The server runs on stdio and waits for an MCP client to connect. Hit Ctrl+C to exit.

To watch and rebuild on changes during development:

```bash
npm run dev
```

To test against a local AllRatesToday instance:

```bash
ALLRATES_BASE_URL=http://localhost:8080/api ALLRATES_API_KEY=test_key node dist/index.js
```

### Project structure

```
src/
├── index.ts      # MCP server, tool registration, request handlers
└── client.ts     # HTTP client for AllRatesToday API + error mapping
dist/             # Compiled JS (gitignored)
server.json       # MCP registry manifest
package.json      # npm metadata, dependencies, scripts
```

### Contributing

Issues and PRs welcome at [github.com/cahthuranag/mcp-server](https://github.com/cahthuranag/mcp-server). Before opening a PR:

1. `npm run build` should succeed with no errors
2. Test against a real AllRatesToday API key (set in `ALLRATES_API_KEY`)
3. Update tool descriptions in `src/index.ts` if you change tool behavior
4. Update this README's "Tools reference" section if you add or rename a tool

---

## Changelog

See [GitHub Releases](https://github.com/cahthuranag/mcp-server/releases) for the full list. Recent highlights:

- **0.3.x** — API key required for all tools; fail-fast at startup with clear error
- **0.2.x** — Removed news tool, required auth on `get_historical_rates`
- **0.1.x** — Initial release with 5 tools

---

## Support

- **API issues**: [support@allratestoday.com](mailto:support@allratestoday.com)
- **Bug reports**: [github.com/cahthuranag/mcp-server/issues](https://github.com/cahthuranag/mcp-server/issues)
- **MCP questions**: [modelcontextprotocol.io](https://modelcontextprotocol.io) — protocol docs
- **Status / uptime**: [allratestoday.com](https://allratestoday.com) (status page in development)

---

## License

MIT — see [LICENSE](./LICENSE).
