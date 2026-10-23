# AllRatesToday MCP Server — @allratestoday/mcp-server

Website: https://allratestoday.com · Hosted endpoint (no install): https://allratestoday.com/api/mcp · Docs: https://allratestoday.com/mcp/

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

- 📡 **Live mid-market rates** — 160+ ISO 4217 currencies, refreshed every ~60 seconds
- 📈 **Historical series built in** — `1d` / `7d` / `30d` / `1y` windows with sensible granularity per period
- 🧰 **Eight focused tools** — `get_exchange_rate`, `get_historical_rates`, `get_rates_authenticated`, `list_currencies`, `list_central_banks`, `get_official_rates`, `get_reference_rate`, `request_trial_key`; small surface, easy for the model to use correctly
- 🔌 **Works everywhere MCP does** — stdio transport, MCP 1.x; Claude Code, Cursor, Claude Desktop, Windsurf, or any generic host
- 🔓 **Works with no API key** — installs and answers out of the box from open official central-bank tables (ECB first, else the bank that issues one of the two currencies); a free key unlocks real-time rates for 160+ currencies
- 🛡️ **Honest about what it returned** — every keyless answer says which rate it is and when it was published; API errors map to clear, actionable messages
- 🔒 **Nothing leaks** — only the request parameters and your API key ever reach allratestoday.com; never conversation context

## ⚖️ Mid-market vs official central-bank rates

With a key, `get_exchange_rate`, `get_historical_rates` and `get_rates_authenticated` return a **mid-market rate**, refreshed every ~60 seconds — the right number for price display, conversion, and anything that should track the market. It is *not* the official rate a tax authority or auditor may require. For those, call **`get_official_rates`**: the latest table published by any of [122 central banks and 4 tax authorities](https://allratestoday.com/central-bank-rates-api/institutions/) (ECB, Fed, HMRC, US Treasury, Swiss BAZG, …), fixed once published and carrying the institution's own `rate_date`, no key needed. `list_central_banks` gives the codes. Dated official tables (a past `date`) need an API key on a **paid plan** — a free key gets `403 Historical central bank rates require a paid plan`. Mid-market history (`get_historical_rates`, and `time` on `get_rates_authenticated`) is paid-plan too — free and trial keys get `403`. See the [central bank REST API](https://allratestoday.com/docs/#central-bank) and [per-bank npm SDKs](https://allratestoday.com/central-bank-rates-api/). The two can diverge by several percent, so pick by use case, not convenience.

## 🔑 Get your API key (free)

A key unlocks **real-time mid-market rates across 160+ currencies** and
multi-target lookups. The free tier is enough for development and trying it out — **no credit card required**.
Historical series, point-in-time lookups and dated official and reference-rate
tables need a paid plan from €4.99/month.

1. Register at [allratestoday.com/register](https://allratestoday.com/register) — 30 seconds
2. Verify your email
3. Copy your key from the dashboard (format: `art_live_xxxxx`)
4. Use it as `ALLRATES_API_KEY` in the configs below

Without one the server prints a short summary of keyless mode (below) on stderr and
keeps running — it never exits, because an MCP server that exits breaks the
host client's whole configuration.

## 🔓 Keyless mode — what works with no setup

Install it with no configuration at all and it starts, connects, and answers:

| Tool | Keyless | What you get |
|---|---|---|
| `get_exchange_rate` | ✅ | An **official central-bank rate**: the ECB reference table first, else the central bank that issues the target or source currency (USD/GBP → Bank of England, USD/INR → Reserve Bank of India). The response carries `bank`, `rate_date`, `derived` and a note saying so, so the assistant never passes it off as a live quote. Only pairs one bank publishes, or their inverses (flagged `derived: true`), work keyless; other crosses are refused with a pointer to the key. |
| `list_currencies` | ✅ | All 160+ supported ISO 4217 codes. |
| `list_central_banks` | ✅ | Codes, names and latest publication date of all [122 central banks and 4 tax authorities](https://allratestoday.com/central-bank-rates-api/institutions/). |
| `get_official_rates` | ✅ | Latest **official table** (or one pair) published by any of them. A dated table needs a paid-plan key. |
| `get_reference_rate` | ✅ | The **Daily Reference Rate**: one never-revised table per business day, fixed at 16:00 London. A past date needs a paid-plan key. |
| `request_trial_key` | ✅ | Self-issues a 100-call, 7-day key with no account and adopts it for the session. |
| `get_historical_rates` | 🔑 | Returns one sentence explaining how to get a key. Needs a paid plan. |
| `get_rates_authenticated` | 🔑 | Same. |

The keyless path reads the open, edge-cached `/api/open/central-bank/{bank}`
endpoints — no upstream cost, no rate limit to trip over, nothing to sign up for.

**Attribution.** Keyless use requires a visible, followable link to AllRatesToday wherever the rates are shown (a footer, an about page, a README). With an API key it is appreciated but not required.

```html
<a href="https://allratestoday.com">Exchange rates by AllRatesToday</a>
```

Markdown: `Exchange rates by [AllRatesToday](https://allratestoday.com)`. Full wording: <https://allratestoday.com/terms/#attribution>.

## 🧩 Easiest install: the Claude Code plugin

If you use Claude Code, install the plugin instead of configuring this server by
hand — it bundles both AllRatesToday MCP servers, two skills, and five slash
commands (`/rate`, `/convert`, `/official-rate`, `/fx-history`,
`/add-currency-support`):

```
/plugin marketplace add AllRates-Today/claude-code-plugin
/plugin install allratestoday@allratestoday
```

Everything below still applies for other MCP clients.

## ☁️ Hosted endpoint — nothing to install

The same tools also run as a hosted **Streamable HTTP** MCP server, which lists **11 tools**: the 8 of this stdio package plus `get_official_rate_history`, `compare_official_rates` and `get_publication_calendar` from the sibling central-bank server. Paste the URL into any client that supports remote MCP — Claude.ai and Claude Desktop connectors, ChatGPT, Cursor, VS Code, Codex, Gemini CLI:

```
https://allratestoday.com/api/mcp
```

```bash
claude mcp add --transport http allratestoday https://allratestoday.com/api/mcp
```

Works keyless. With a key, send `Authorization: Bearer art_live_…` or, where the client only takes a URL, connect to `https://allratestoday.com/api/mcp?api_key=art_live_…`. That puts the key in the URL, where client configs, logs and screenshots can expose it: prefer the header when your client supports it, never share or commit that URL, and rotate the key at https://allratestoday.com/profile if it leaks. Registry name: `com.allratestoday/mcp`. One-click Cursor / VS Code buttons: https://allratestoday.com/mcp/#hosted

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

Restart Cursor. The eight tools should appear in the MCP tool picker.

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

1. **Server starts** — open the client. The server starts with or without a key (no key ⇒ keyless mode), so a red dot or "failed to connect" means the client could not launch it — usually `npx` or Node ≥18 (see Troubleshooting below). A wrong key does not stop it starting; calls then return `Invalid AllRatesToday API key`.
2. **Tools are listed** — most clients have a "tools" or "MCP" panel showing the eight tools.
3. **A live call returns a number** — ask: *"What's the current USD to EUR rate?"* The assistant should call `get_exchange_rate(source: "USD", target: "EUR")` and reply with a real rate. If it fabricates a number without a tool call, the server isn't connected.

More prompts that exercise the other tools:

- *"What was the ECB's official USD rate on the latest published table?"* → `get_official_rates`
- *"Give me today's 16:00 London reference rate for EUR, GBP and JPY."* → `get_reference_rate`
- *"Which central banks can you get official rates from?"* → `list_central_banks`
- *"Convert 250 USD to CAD."* → `get_exchange_rate`

## 🧪 Test with MCP Inspector

To check the server on its own, without any AI client in the way, run it under the official [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector):

```bash
npx @modelcontextprotocol/inspector npx -y @allratestoday/mcp-server
```

1. Open the URL it prints and click **Connect**. The **Tools** tab should list the eight tools.
2. Call `get_exchange_rate` with `source: USD`, `target: EUR` — it answers keyless with an official rate.
3. Set `ALLRATES_API_KEY` in the Inspector's environment panel, reconnect, and call it again — now it returns the live mid-market rate.

If this works but your client doesn't, the problem is the client's config (path to `npx`, Node version, JSON syntax), not the server.

## 📚 Tools reference

- [`get_exchange_rate`](#get_exchange_rate) — current rate for one pair
- [`get_historical_rates`](#get_historical_rates) — time series over a preset period
- [`get_rates_authenticated`](#get_rates_authenticated) — multiple targets in one call, optional point-in-time
- [`list_currencies`](#list_currencies) — all supported currency codes, names, symbols
- [`list_central_banks`](#list_central_banks) — every covered central bank / tax authority with its code and latest publication date
- [`get_official_rates`](#get_official_rates) — the official table (or one pair) a named institution published
- [`get_reference_rate`](#get_reference_rate) — the Daily Reference Rate, one fixed mid-market table per business day (16:00 London)
- [`request_trial_key`](#request_trial_key) — self-issue a 100-call, 7-day trial key, no account needed

`get_historical_rates` and `get_rates_authenticated` require `ALLRATES_API_KEY`; the other six of the eight work keyless. History (`get_historical_rates`, and `time` on `get_rates_authenticated`) needs a paid plan.

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

**Response (with a key):**

```json
{ "rate": 0.888889, "source": "mid-market" }
```

**Response (keyless — `USD` → `GBP`, not in the ECB table, so the Bank of England table answers):**

```json
{
  "rate": 0.7598784195,
  "source": "Bank of England official rate (keyless mode)",
  "bank": "boe",
  "rate_date": "2026-10-14",
  "derived": true,
  "note": "Keyless mode: this is the Bank of England official rate published on 2026-10-14, not a live mid-market quote. For real-time rates across 160+ currencies set ALLRATES_API_KEY — free tier at https://allratestoday.com/register."
}
```

`derived: true` means the bank publishes the inverse (GBP→USD) and the rate was inverted. A pair no single bank publishes is refused keyless with `No keyless official source covers …` and a pointer to the key.

### `get_historical_rates`

Time-series data points for a currency pair over a fixed period. Needs an API key on a paid plan (free and trial keys get a 403).

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
    { "date": "2026-09-17", "rate": 96.1006, "timestamp": 1789603200000 },
    { "date": "2026-09-18", "rate": 95.8142, "timestamp": 1789689600000 },
    "...",
    { "date": "2026-10-16", "rate": 94.9643, "timestamp": 1792108800000 }
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
| `time` | string (ISO 8601) | no | Historical point in time (paid plans) |
| `group` | string | no | One of `hour`, `day`, `week`, `month` |

**Example call**

```json
{ "source": "USD", "target": "EUR,GBP,JPY" }
```

**Response:**

```json
{
  "rates": [
    { "rate": 0.888889, "source": "USD", "target": "EUR", "time": "2026-10-16T12:16:01+0000" },
    { "rate": 0.749766, "source": "USD", "target": "GBP", "time": "2026-10-16T12:16:01+0000" },
    { "rate": 157.985, "source": "USD", "target": "JPY", "time": "2026-10-16T12:16:01+0000" }
  ]
}
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
  "count": 163
}
```

---

### `list_central_banks`

Every official source the server can quote — [122 central banks](https://allratestoday.com/central-bank-rates-api/institutions/) plus HMRC, the US Treasury, Swiss BAZG and India's CBIC — with the `code` that `get_official_rates` takes as `bank`, the institution's name, its latest publication date, `age_days`, its publication `cadence` and a `stale` flag when it is behind its own schedule. Keyless.

**Input** — none.

**Response (truncated):**

```json
{
  "sources": [
    { "code": "ecb", "name": "European Central Bank", "latest": "2026-10-15", "age_days": 1, "stale": false, "cadence": "daily" },
    { "code": "fed", "name": "US Federal Reserve (H.10)", "latest": "2026-10-09", "age_days": 7, "stale": false, "cadence": "weekly" },
    "..."
  ],
  "stale_count": 3,
  "checked_at": "2026-10-16T12:16:46.232Z"
}
```

---

### `get_official_rates`

The fixed, citable rate an institution published — for invoices, VAT and tax returns, customs, transfer pricing and audit. Not a live market rate.

**Input:**

| Field | Type | Required | Description |
|---|---|---|---|
| `bank` | string | yes | Source code from `list_central_banks`, e.g. `ecb`, `fed`, `boe`, `rbi`, `hmrc` |
| `date` | string | no | `YYYY-MM-DD`. Omit for the latest table (keyless). Needs an API key on a **paid plan** — a free key gets `403 Historical central bank rates require a paid plan`. Weekends/holidays roll back to the last published date. |
| `source` | string | no | With `target`, narrows to one pair |
| `target` | string | no | With `source`, narrows to one pair |

**Response (one pair):**

```json
{
  "bank": "ecb",
  "rate_date": "2026-10-15",
  "source": "EUR",
  "target": "USD",
  "rate": 1.1208,
  "rate_type": "reference",
  "derived": false,
  "method": "published",
  "age_days": 1,
  "stale": false,
  "cadence": "daily",
  "attribution": { "source": "Official rates published by ECB, served by AllRatesToday", "url": "https://allratestoday.com/central-bank-rates-api/ecb/", "terms": "Free to use with visible attribution linking to allratestoday.com" }
}
```

Omit `source`/`target` for the whole table as `rates: [{ base, quote, type, value }]`. Keyless, only pairs the bank publishes and their inverses (flagged `derived: true`) are served; other crosses are refused. With a key, pairs the bank does not publish directly are cross-computed inside its own table and flagged `derived: true`. Always cite `rate_date`.

---

### `get_reference_rate`

AllRatesToday's **Daily Reference Rate**: the per-currency median of samples taken in a five-minute window centred on 16:00 London, published once per business day and never revised. Use it when a report, index or research series needs *one* reproducible rate per day. It is not the WM/Refinitiv fix and not a registered benchmark; every response carries a disclaimer and the `rate_date`.

**Input**

| Field | Type | Required | Description |
|---|---|---|---|
| `source` | string | no | With `target`, narrows to one pair (crossed via USD, flagged `derived`) |
| `target` | string | no | See above |
| `date` | string | no | Past business day `YYYY-MM-DD` (API key on a paid plan). Omit for the latest table |

**Output** — `{ rate_date, base, time, rates }` for the table, or `{ rate_date, source, target, rate, derived }` for a pair, plus `method` and `disclaimer`. Keyless for the latest table. Docs: https://allratestoday.com/reference-rate/

---

### `request_trial_key`

Self-issues an API key with 100 lifetime calls, valid 7 days, with no account and no email, and switches this server to it for the rest of the session. The reply tells the user to copy the key into the MCP config as `ALLRATES_API_KEY` to keep it across restarts. Capped at 3 keys per IP per day.

**Input** — `agent` (string, optional), `purpose` (string, optional).

**Output** — `{ key, calls, expires_at, adopted, note }`.

---

## ⚙️ Environment variables

| Variable | Default | Required | Purpose |
|---|---|---|---|
| `ALLRATES_API_KEY` | — | no | Your API key, sent as `Authorization: Bearer`. Unset ⇒ keyless mode (see above); set ⇒ real-time rates and multi-target lookups (the historical tools need a paid-plan key). |
| `ALLRATES_BASE_URL` | `https://allratestoday.com/api` | no | Override for self-hosted or staging deployments. |

Set these in your MCP client's config (in the `env` block) — not in your shell — because MCP servers are launched as subprocesses with isolated environments.

## 💳 Plans

A free tier and paid plans are available — see [allratestoday.com/pricing](https://allratestoday.com/pricing) for current quotas. The free tier covers real-time rates and multi-target lookups. All history and dated rates — mid-market history, point-in-time lookups, dated official and reference-rate tables — need a paid plan (free and trial keys get `403 historical_requires_paid_plan`). The Official Rates plan covers official central-bank and tax-authority rates only (no market rates).

## 🛠️ Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Client shows "MCP server failed to start" or red dot | Not a missing key — 0.5.0+ starts fine without one. Usually `npx` cannot reach the registry, or Node is older than 18 | Run `npx -y @allratestoday/mcp-server` in a shell and read stderr |
| Rates look like yesterday's, response mentions "keyless mode" | No key set, so answers come from an official central-bank table (see `bank` and `rate_date`) | Set `ALLRATES_API_KEY` for real-time mid-market rates |
| `No keyless official source covers X/Y` | Keyless mode, and no single central bank publishes that pair or its inverse | Set `ALLRATES_API_KEY` (free) |
| `HTTP 403 — Historical rates require a paid plan` | `get_historical_rates`, or `time` on `get_rates_authenticated`, on a free or trial key | Upgrade at /pricing — history is paid-only |
| `HTTP 403 — Historical central bank rates require a paid plan` | `date` given to `get_official_rates` / `get_reference_rate` on a free key | Omit `date` for the latest table, or upgrade at /pricing |
| Every call returns "Invalid AllRatesToday API key" | Key is malformed (missing prefix, truncated, or revoked) | Copy a fresh key from the dashboard |
| Tools return "AllRatesToday API quota exceeded" | Quota used up — the free tier does not reset; paid plans are monthly | Upgrade at [/pricing](https://allratestoday.com/pricing) |
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
| 401 | Invalid API key (a missing key does not cause this — the server runs keyless) | `Invalid AllRatesToday API key` |
| 403 | Plan does not include it (e.g. a dated official table on a free key) | `HTTP 403 — <upstream message>` |
| 404 (keyless) | No keyless official source covers the pair | `No keyless official source covers X/Y. …` |
| 429 | Quota exceeded | `AllRatesToday API quota exceeded` |
| 5xx | Server-side issue at allratestoday.com | `HTTP 5xx — <upstream message>` |

## ❓ FAQ

**Is the free plan really enough for normal use?**
For trying it out and light dev use. It does not reset monthly; regular use or production needs a paid tier. Keyless mode costs nothing and has no quota.

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
Yes, through the hosted endpoint: add `https://allratestoday.com/api/mcp` as a connector (custom MCP / remote server) in ChatGPT. This npm package is the local stdio server, for clients that launch a command — Claude Code, Cursor, Claude Desktop, Windsurf.

## 👩‍💻 Development

```bash
git clone https://github.com/AllRates-Today/mcp-server.git
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
├── client.ts     # HTTP client for AllRatesToday API + error mapping
└── home-banks.ts # currency → issuing central bank, for the keyless get_exchange_rate fallback
dist/             # Compiled JS (gitignored)
server.json       # MCP registry manifest
```

**Contributing** — issues and PRs welcome at [github.com/AllRates-Today/mcp-server](https://github.com/AllRates-Today/mcp-server). Before opening a PR: `npm run build` must succeed, test against a real API key, and update the tool descriptions in `src/index.ts` plus this README's tools reference if you change tool behavior.

## 📝 Changelog

Recent changes. Full history: [GitHub Releases](https://github.com/AllRates-Today/mcp-server/releases).

- **0.7.9** — README: changelog trimmed to the 0.7.x line
- **0.7.8** — README: MCP Inspector test guide, example prompts for every tool, hosted `?api_key=` security note, ChatGPT FAQ and 401 row corrected, history consistently paid-plan
- **0.7.6** — Keyless `get_rates_authenticated` with `time` now says a paid plan is needed; README: free tier no longer listed as covering history, `source` example is `mid-market`
- **0.7.4** — Keyless `get_exchange_rate` falls back from the ECB table to the central bank that issues the target or source currency (USD/GBP, GBP/JPY, USD/INR now answer keyless), same as the hosted endpoint; response adds `bank`. Dated-table errors say a paid plan is needed. README: real response shapes, tool counts, lifetime free tier
- **0.7.0** — `get_reference_rate` (Daily Reference Rate, 16:00 London, keyless latest table) and `request_trial_key` (self-issued 100-call trial key adopted for the session)

## 🔗 Links

- [API documentation](https://allratestoday.com/docs/) · [Interactive reference](https://allratestoday.com/api-reference/)
- [Register (free)](https://allratestoday.com/register) · [Pricing](https://allratestoday.com/pricing)
- [MCP protocol docs](https://modelcontextprotocol.io)
- [GitHub](https://github.com/AllRates-Today/mcp-server) · [Bug reports](https://github.com/AllRates-Today/mcp-server/issues)
- Support: [support@allratestoday.com](mailto:support@allratestoday.com)
- [Dashboard](https://allratestoday.com/profile)
- [Status](https://allratestoday.com/status)

## 📜 License

MIT — see [LICENSE](./LICENSE).
