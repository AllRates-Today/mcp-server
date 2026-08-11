# AllRatesToday MCP Server — @allratestoday/mcp-server

[![npm version](https://img.shields.io/npm/v/@allratestoday/mcp-server.svg)](https://www.npmjs.com/package/@allratestoday/mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@allratestoday/mcp-server.svg)](https://www.npmjs.com/package/@allratestoday/mcp-server)
[![license](https://img.shields.io/npm/l/@allratestoday/mcp-server.svg)](./LICENSE)
[![MCP](https://img.shields.io/badge/Model%20Context%20Protocol-1.x-blue.svg)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg)](https://www.typescriptlang.org/)

English | [简体中文](./README-zh-CN.md)

**Give your AI assistant a live window into the foreign-exchange market. A Model Context Protocol server that lets Claude Code, Cursor, Claude Desktop, Windsurf, and any MCP-compatible client fetch real-time currency rates, historical series, and multi-currency lookups from the [AllRatesToday API](https://allratestoday.com).**

After installation, your assistant can answer questions like:

- *"What's the current USD to EUR rate?"*
- *"Show me how GBP/JPY moved over the last 30 days."*
- *"Convert 250 USD into CAD at a real rate."*
- *"Compare USD against EUR, GBP, and JPY simultaneously."*

## 🚀 Why this server?

- 📡 **Live mid-market rates** — 150+ ISO 4217 currencies, refreshed every ~60 seconds from institutional interbank data
- 📈 **Historical series built in** — `1d` / `7d` / `30d` / `1y` windows with sensible granularity per period
- 🧰 **Four focused tools** — `get_exchange_rate`, `get_historical_rates`, `get_rates_authenticated`, `list_currencies`; small surface, easy for the model to use correctly
- 🔌 **Works everywhere MCP does** — stdio transport, MCP 1.x; Claude Code, Cursor, Claude Desktop, Windsurf, or any generic host
- 🛡️ **Fail-fast and honest** — refuses to start without a key, maps API errors to clear actionable messages the assistant can relay
- 🔒 **Nothing leaks** — only the request parameters and your API key ever reach allratestoday.com; never conversation context

## 🔑 Get your API key

The server **will not start** without a valid `ALLRATES_API_KEY`. A free key is enough for development and personal use — **no credit card required**.

1. Register at [allratestoday.com/register](https://allratestoday.com/register) — 30 seconds
2. Verify your email
3. Copy your key from the dashboard (format: `art_live_xxxxx`)
4. Use it as `ALLRATES_API_KEY` in the configs below

If you forget, the server prints registration instructions on stderr and exits with code 1.

## 📦 Installation

The simplest install is **zero-install via `npx`**, which is what every config below uses:

```bash
# Run without installing (recommended)
npx -y @allratestoday/mcp-server
```

```bash
# Or install globally
npm install -g @allratestoday/mcp-server
allratestoday-mcp
```

Both commands launch the stdio MCP server and wait for a client to connect — they're not meant to be run interactively from your shell; your MCP client launches them as a subprocess.

## 🏁 Quick setup per client

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

Edit `~/.codeium/windsurf/mcp_config.json` with the same `mcpServers` block as above, then restart Windsurf.

### Generic stdio MCP client

Any MCP host that supports stdio transport works. The launch command is:

```
npx -y @allratestoday/mcp-server
```

…with the environment variable `ALLRATES_API_KEY` set. The protocol version is MCP 1.x.

## ✅ Verify it works

After configuring your client, test in this order:

1. **Server starts** — open the client. A red dot or "failed to connect" means the API key is missing or wrong (see Troubleshooting below).
2. **Tools are listed** — most clients have a "tools" or "MCP" panel showing the four tools.
3. **A live call returns a number** — ask: *"What's the current USD to EUR rate?"* The assistant should call `get_exchange_rate(source: "USD", target: "EUR")` and reply with a real rate. If it fabricates a number without a tool call, the server isn't connected.

## 📚 Tools reference

- [`get_exchange_rate`](#get_exchange_rate) — current rate for one pair
- [`get_historical_rates`](#get_historical_rates) — time series over a preset period
- [`get_rates_authenticated`](#get_rates_authenticated) — multiple targets in one call, optional point-in-time
- [`list_currencies`](#list_currencies) — all supported currency codes, names, symbols

All four tools require `ALLRATES_API_KEY`.

---

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

**Response:**

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

**Response (truncated):**

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

**Response:**

```json
[
  { "rate": 0.9214, "source": "USD", "target": "EUR", "time": "2026-04-26T11:00:00Z" },
  { "rate": 0.7891, "source": "USD", "target": "GBP", "time": "2026-04-26T11:00:00Z" },
  { "rate": 151.34, "source": "USD", "target": "JPY", "time": "2026-04-26T11:00:00Z" }
]
```

### `list_currencies`

All supported currencies with codes, names, and symbols. Cached upstream for 24 hours — cheap to call for validating user input before the other tools.

**Input** — none.

**Response (truncated):**

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

## ⚙️ Environment variables

| Variable | Default | Required | Purpose |
|---|---|---|---|
| `ALLRATES_API_KEY` | — | **yes** | Your API key. The server exits at startup if unset. |
| `ALLRATES_BASE_URL` | `https://allratestoday.com/api` | no | Override for self-hosted or staging deployments. |

Set these in your MCP client's config (in the `env` block) — not in your shell — because MCP servers are launched as subprocesses with isolated environments.

## 💳 Plans

A free tier and paid plans are available — see [allratestoday.com/pricing](https://allratestoday.com/pricing) for current quotas. All plans include the same currency coverage and historical depth; only the request quotas differ.

## 🛠️ Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Client shows "MCP server failed to start" or red dot | `ALLRATES_API_KEY` not set or invalid | Verify the key in your client config; check it matches the dashboard |
| Every call returns "Invalid AllRatesToday API key" | Key is malformed (missing prefix, truncated, or revoked) | Copy a fresh key from the dashboard |
| Tools return "AllRatesToday API quota exceeded" | Monthly limit hit | Wait until next month or upgrade plan |
| Historical tool returns "Bad request" | Invalid period or unknown currency code | Period must be `1d`/`7d`/`30d`/`1y`; codes must be 3 letters |
| Server starts but tools never appear | Client didn't reload after config change | Fully quit (not just close) and reopen the client |
| `npx` runs but hangs forever | The server is waiting for an MCP client to connect — normal when run from a shell | Let your MCP client launch it |

To inspect what the server is doing, run it manually with the key set:

```bash
ALLRATES_API_KEY=art_live_xxxxx npx -y @allratestoday/mcp-server
```

No output means healthy (stdio is reserved for the MCP protocol); errors print to stderr.

## 🛡️ Error reference

The server maps API errors to clear, actionable messages the assistant can relay to the user:

| HTTP status | Meaning | Tool error message |
|---|---|---|
| 200 | Success | (rate returned) |
| 400 | Bad request — usually unknown currency code | `Bad request — possibly an unknown currency code` |
| 401 | Invalid or missing API key | `Invalid AllRatesToday API key` |
| 429 | Quota exceeded | `AllRatesToday API quota exceeded` |
| 5xx | Server-side issue at allratestoday.com | `HTTP 5xx — <upstream message>` |

## ❓ FAQ

**Is the free plan really enough for normal use?**
Yes for personal/dev use. Heavy interactive use, multiple chat sessions per day, or production should consider the paid tiers.

**Do you store my conversation or query data?**
No. Only your API key and the request parameters (source, target, period, time) are sent to allratestoday.com — never the LLM's conversation context.

**What happens to my API key?**
It's only sent as a `Bearer` token in the `Authorization` header on requests to the AllRatesToday API. It's never logged or transmitted elsewhere.

**Why is my first call slow?**
Cold-start of `npx` (first run downloads the package) plus the initial cache miss. Subsequent calls are typically <200ms.

**Can I run this without npm/Node?**
Not currently — Node ≥18 is required. If a standalone binary matters to you, open an issue.

**Is there a self-hosted option?**
Set `ALLRATES_BASE_URL` to your own AllRatesToday instance. Contact support@allratestoday.com for self-hosted licensing.

**Does this work with ChatGPT?**
MCP works with any MCP-compatible client. ChatGPT Desktop has experimental MCP support; check OpenAI's docs for current status.

## 👩‍💻 Development

```bash
git clone https://github.com/cahthuranag/mcp-server.git
cd mcp-server
npm install
npm run build
ALLRATES_API_KEY=art_live_xxxxx node dist/index.js
```

The server runs on stdio and waits for an MCP client to connect; Ctrl+C to exit. `npm run dev` watches and rebuilds. To test against a local AllRatesToday instance:

```bash
ALLRATES_BASE_URL=http://localhost:8080/api ALLRATES_API_KEY=test_key node dist/index.js
```

**Project structure**

```
src/
├── index.ts      # MCP server, tool registration, request handlers
└── client.ts     # HTTP client for AllRatesToday API + error mapping
dist/             # Compiled JS (gitignored)
server.json       # MCP registry manifest
```

**Contributing** — issues and PRs welcome at [github.com/cahthuranag/mcp-server](https://github.com/cahthuranag/mcp-server). Before opening a PR: `npm run build` must succeed, test against a real API key, and update the tool descriptions in `src/index.ts` plus this README's tools reference if you change tool behavior.

## 📝 Changelog

See [GitHub Releases](https://github.com/cahthuranag/mcp-server/releases) for the full list. Recent highlights:

- **0.4.x** — README overhaul; registry metadata updates
- **0.3.x** — API key required for all tools; fail-fast at startup with clear error
- **0.2.x** — Removed news tool, required auth on `get_historical_rates`
- **0.1.x** — Initial release with 5 tools

## 🔗 Links

- [API documentation](https://allratestoday.com/docs/) · [Interactive reference](https://allratestoday.com/api-reference/)
- [Register (free)](https://allratestoday.com/register) · [Pricing](https://allratestoday.com/pricing)
- [MCP protocol docs](https://modelcontextprotocol.io)
- [GitHub](https://github.com/cahthuranag/mcp-server) · [Bug reports](https://github.com/cahthuranag/mcp-server/issues)
- Support: [support@allratestoday.com](mailto:support@allratestoday.com)

## 📜 License

MIT — see [LICENSE](./LICENSE).
