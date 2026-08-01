# AllRatesToday

> AllRatesToday currency API rules and best practices for Cursor

**Tags:** TypeScript · JavaScript · Python · PHP · Rust · React · Node.js · MCP · REST API · Currency · Forex · FX · Caching · Zod

`Add to Cursor`  ·  `Copy`  ·  3 rules

> Modeled on the format at https://cursor.directory/plugins/nextjs — paste the
> section below into a cursor.directory "rules" submission, or save it as
> `.cursor/rules/allratestoday.mdc` in any project that consumes the API.

---

## AllRatesToday Generalist Cursor Rules

This guide outlines conventions and best practices for integrating
**[AllRatesToday](https://allratestoday.com)** — real-time and historical
foreign-exchange rates for 150+ currencies (mid-market, sourced from tier-one
financial data providers, refreshed every ~60 seconds) — into applications and AI agents.

It covers the REST API, the official SDKs, and the MCP server (`@allratestoday/mcp-server`).

### Core Philosophy

- Prefer the **official SDK** for your language over hand-rolled `fetch`/`curl` calls.
- Treat the API key as a **server-side secret** — never ship it to a browser bundle.
- **Cache** rates; they only change every ~60s. Do not call the API on every render.
- Always handle the **rate-limit (429)** and **auth (401)** cases explicitly.
- Use **mid-market rates as a reference**, not as a settlement/trading price.

### Authentication & Secrets

- Get a free key at https://allratestoday.com/register (300 requests/month, no card).
- Key format: `art_live_…`. Store it in the `ALLRATES_API_KEY` environment variable.
- Load it from `process.env` / `os.environ` / `$_ENV` — never inline it in source.
- For browser apps, proxy through your own backend; the browser must never see the key.
- The keyless open endpoint (`/api/rate`) needs no key but requires visible attribution
  (see "Open endpoint & attribution").

```bash
# .env  (never commit)
ALLRATES_API_KEY=art_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Choosing the Right Endpoint

- **Single live pair** → `GET /api/v1/rates?source=USD&targets=EUR` (authenticated) or the
  keyless `GET /api/rate?source=USD&target=EUR`.
- **Multiple targets in one call** → `GET /api/v1/rates?source=USD&targets=EUR,GBP,JPY`.
  Prefer one multi-target call over N single calls — it costs one request, not N.
- **Historical / time series** → add `from`, `to`, and `group=day|week|month`.
- **List supported currencies** → `GET /api/v1/symbols` → `{ currencies: [{ code, name, symbol }] }`.
- Send the API key as a bearer token: `Authorization: Bearer art_live_…`.

### SDKs & Direct Use

Official first-party SDKs are available for **JavaScript/TypeScript, Python, PHP, and Rust**:

```bash
npm install @allratestoday/sdk      # JavaScript / TypeScript / Node / Deno / Bun
pip install allratestoday           # Python
composer require allratestoday/sdk  # PHP
cargo add allratestoday             # Rust
```

```rust
use allratestoday::AllRatesToday;

let client = AllRatesToday::new("art_live_your_api_key");
let rate   = client.get_rate("USD", "EUR")?;                       // single pair
let rates  = client.latest("USD", Some(&["EUR", "GBP", "JPY"]))?;  // multi-target
let conv   = client.convert("USD", "EUR", 100.0)?;                 // convert amount
let syms   = client.symbols()?;                                    // supported currencies
```

- Methods: `latest`, `for_date`, `time_series`, `convert`, `get_rate`,
  `get_historical_rates`, `symbols`. Construct the client once and reuse it.

**JS/TS, Python, PHP, Go, etc.** — there is no first-party package for these yet. Call the
REST API directly (key stays server-side), or use the MCP server (next section) for AI agents:

```ts
// JS/TS — call the REST API directly
const res = await fetch(
  'https://allratestoday.com/api/v1/rates?source=USD&targets=EUR,GBP',
  { headers: { Authorization: `Bearer ${process.env.ALLRATES_API_KEY}` } }
)
const { data } = await res.json()
```

### MCP Server (AI agents in Cursor / Claude)

Give an AI agent live FX access via the MCP server. Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "allratestoday": {
      "command": "npx",
      "args": ["-y", "@allratestoday/mcp-server"],
      "env": { "ALLRATES_API_KEY": "art_live_..." }
    }
  }
}
```

Exposed tools:

| Tool | Purpose |
|---|---|
| `get_exchange_rate` | Current mid-market rate between two currencies (`source`, `target`) |
| `get_historical_rates` | Historical data for a pair over `1d` / `7d` / `30d` / `1y` |
| `get_rates_authenticated` | Multi-target rates with date ranges and grouping (`day`/`week`/`month`) |
| `list_currencies` | List all 150+ supported currencies |

- Restart Cursor after editing `mcp.json`. Verified working with Cursor 0.40+.
- The server fails fast without `ALLRATES_API_KEY` and prints registration instructions —
  set the key first.

### Error Handling & Resilience

- **401 Unauthorized** → missing/invalid key. Surface a clear "check your API key" message;
  do not retry.
- **429 Too Many Requests** → monthly quota or rate limit hit. Back off; respect
  `X-RateLimit-Reset`; suggest upgrading the plan rather than hammering.
- **5xx / network error** → retry with exponential backoff (250ms → 1s → 4s, max 3),
  then fall back to the last cached rate.
- Validate `source`/`target` against `list_currencies` before calling; reject unknown ISO codes early.
- Never silently swallow errors — log the status and the currency pair.

### Caching & Rate Limits

- Cache rates for **at least 60 seconds** (the refresh cadence). Key the cache by `source:target`.
- For dashboards, fetch on an interval (every 60–300s), not per component render.
- Batch with `targets=` to convert many currencies in a single request.
- Free tier = 300 requests/month — budget accordingly; one multi-target call = one request.

### Currency & Amount Handling

- Currency codes are **ISO 4217**, uppercase (`USD`, `EUR`, `JPY`). Normalize input to uppercase.
- Do conversion as `amount * rate`; round **only for display**, keep full precision internally.
- Format for humans with `Intl.NumberFormat(locale, { style: 'currency', currency })`.
- Mid-market rates have no markup/spread — state that in any UI that shows them to end users.

### Security & Compliance

- API key lives server-side only; for client UIs, expose a thin proxy endpoint you control.
- Don't log full API keys; mask to `art_live_…` in logs.
- Rates are a **reference** (mid-market), not a quote you can transact on.

### Open Endpoint & Attribution

- `GET /api/rate?source=USD&target=EUR` is **keyless, CORS-enabled, free**, and ideal for
  static sites, demos, and client-side widgets.
- In return it requires a **visible attribution link**:
  `<a href="https://allratestoday.com">Rates by AllRatesToday</a>`.
- For production apps wanting dedicated quota, historical data, and no attribution, use a
  free API key. See https://allratestoday.com/open-api/.

### Plans

- Free — 300 requests/month · Small — €4.99/mo, 5,000 · Medium — €9.99/mo, 10,000 ·
  Large — €49.99/mo, 100,000. Full pricing: https://allratestoday.com/pricing

### Links

- Website: https://allratestoday.com
- Docs: https://allratestoday.com/docs/
- Register (free key): https://allratestoday.com/register/
- npm (MCP): https://www.npmjs.com/package/@allratestoday/mcp-server
- Existing listing: https://cursor.directory/plugins/allratestoday-currency-api
