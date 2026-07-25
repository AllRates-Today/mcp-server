#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AllRatesTodayClient, AllRatesTodayError } from './client.js';
import { VERSION } from './version.js';

const CCY_DESC =
  "ISO 4217 currency code, 3 letters, case-insensitive (e.g. 'USD', 'EUR', 'GBP', 'JPY'). For a source/target pair, the returned rate is how much 1 unit of source is worth in target. Fiat only — no crypto, no commodities. Call list_currencies if unsure whether a code is supported.";

const ccy = z
  .string()
  .regex(/^[A-Za-z]{3}$/, 'must be a 3-letter ISO 4217 currency code')
  .describe(CCY_DESC);

const ccyList = z
  .string()
  .regex(
    /^[A-Za-z]{3}(,[A-Za-z]{3})*$/,
    'must be one or more 3-letter ISO 4217 codes, comma-separated, no spaces',
  )
  .describe(
    "One or more ISO 4217 codes, comma-separated, no spaces, case-insensitive. Examples: 'EUR' (single) or 'EUR,GBP,JPY' (multi). Each target becomes a separate row in the response.",
  );

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

function ok(structured: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(structured, null, 2) }],
    structuredContent: structured,
  };
}

function fail(err: unknown) {
  const message =
    err instanceof AllRatesTodayError
      ? `AllRatesToday error${err.status ? ` (${err.status})` : ''}: ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

async function main() {
  const apiKey = process.env.ALLRATES_API_KEY;
  if (!apiKey) {
    console.error(
      [
        '',
        '  AllRatesToday MCP server requires an API key.',
        '',
        '  1. Sign up free at https://allratestoday.com/register (free tier — no card required)',
        '  2. Copy your API key from the dashboard',
        '  3. Set ALLRATES_API_KEY in your MCP client config:',
        '',
        '     "allratestoday": {',
        '       "command": "npx",',
        '       "args": ["-y", "@allratestoday/mcp-server"],',
        '       "env": { "ALLRATES_API_KEY": "art_live_..." }',
        '     }',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  const client = new AllRatesTodayClient({
    apiKey,
    baseUrl: process.env.ALLRATES_BASE_URL,
  });

  const server = new McpServer({ name: 'allratestoday-mcp', version: VERSION });

  server.registerTool(
    'get_exchange_rate',
    {
      title: 'Get live exchange rate',
      description:
        "Use this when the user asks 'what is X in Y?', 'convert X to Y', 'current rate of EUR/USD', or any single fiat-to-fiat live exchange rate question. Returns the latest mid-market rate as a JSON object like { rate: 0.9234, source } meaning 1 source = 0.9234 target. Does NOT support cryptocurrencies, commodities, or arithmetic on amounts. For multiple targets in one call use get_rates_authenticated; for a past date or fixed lookback (7d/30d/1y) use get_historical_rates.",
      inputSchema: { source: ccy, target: ccy },
      outputSchema: {
        rate: z.number().describe('How much 1 unit of source is worth in target'),
        source: z.string().describe('Upstream data provider the rate came from'),
      },
      annotations: READ_ONLY,
    },
    async ({ source, target }) => {
      try {
        return ok(await client.getRate(source.toUpperCase(), target.toUpperCase()));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'get_historical_rates',
    {
      title: 'Get historical rate time-series',
      description:
        "Use this for fixed-window time-series questions like 'how has EUR/USD moved this week', 'show me the last month of GBP/JPY', or 'chart 1-year history of AUD/USD'. Returns { source, target, period, data: [{ date, rate, timestamp }, ...] } — sampling is fixed per period (1d=hourly, 7d/30d=daily, 1y=weekly) and the window always ends NOW. For a specific past datetime use get_rates_authenticated with `time`. For a single live rate use get_exchange_rate.",
      inputSchema: {
        source: ccy,
        target: ccy,
        period: z
          .enum(['1d', '7d', '30d', '1y'])
          .default('7d')
          .describe(
            "Lookback window ending NOW. '1d' returns ~24 hourly points, '7d' returns 7 daily points, '30d' returns 30 daily points, '1y' returns ~52 weekly points. Defaults to '7d' if omitted.",
          ),
      },
      outputSchema: {
        source: z.string(),
        target: z.string(),
        period: z.string(),
        source_api: z.string().optional().describe('Upstream data provider'),
        data: z.array(
          z.object({
            date: z.string(),
            rate: z.number(),
            timestamp: z.number(),
          }),
        ),
      },
      annotations: READ_ONLY,
    },
    async ({ source, target, period }) => {
      try {
        return ok(
          await client.getHistoricalRates(source.toUpperCase(), target.toUpperCase(), period),
        );
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'get_rates_authenticated',
    {
      title: 'Get multi-target or point-in-time rates',
      description:
        "Use this for (a) one source against multiple targets in a single call ('USD vs EUR, GBP, JPY'), or (b) the rate at a specific past datetime ('EUR/USD at 2025-03-14T12:00Z'), optionally bucketed by hour/day/week/month. Returns { rates: [{ rate, source, target, time }, ...] } — one row per target × time bucket. For a single live pair use get_exchange_rate. For fixed lookback windows (1d/7d/30d/1y ending now) use get_historical_rates.",
      inputSchema: {
        source: ccy,
        target: ccyList,
        time: z
          .string()
          .datetime({ offset: true })
          .optional()
          .describe(
            "Single point-in-time ISO 8601 UTC timestamp (e.g. '2025-03-14T12:00:00Z'). Omit for the latest rate.",
          ),
        group: z
          .enum(['hour', 'day', 'week', 'month'])
          .optional()
          .describe(
            "Aggregation bucket: 'hour', 'day', 'week', or 'month'. Useful when time is omitted to return rolling averages. Omit for raw single-point output.",
          ),
      },
      outputSchema: {
        rates: z.array(
          z.object({
            rate: z.number(),
            source: z.string(),
            target: z.string(),
            time: z.string(),
          }),
        ),
      },
      annotations: READ_ONLY,
    },
    async ({ source, target, time, group }) => {
      try {
        const rates = await client.getAuthenticatedRates({
          source: source.toUpperCase(),
          target: target.toUpperCase(),
          time,
          group,
        });
        return ok({ rates });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'list_currencies',
    {
      title: 'List supported currencies',
      description:
        "Call this BEFORE other tools when you are unsure whether a currency code is supported, or when the user asks 'what currencies do you support?', 'is X a valid currency?', or 'what is the symbol for X?'. Returns { currencies: [{ code: 'USD', name: 'US Dollar', symbol: '$' }, ...], count } covering 150+ ISO 4217 fiat currencies. Does NOT include cryptocurrencies. Cheap to call (cached 24h upstream) — use it to validate user input and prevent downstream errors in get_exchange_rate / get_rates_authenticated / get_historical_rates.",
      inputSchema: {},
      outputSchema: {
        currencies: z.array(
          z.object({
            code: z.string(),
            name: z.string(),
            symbol: z.string(),
          }),
        ),
        count: z.number(),
      },
      annotations: READ_ONLY,
    },
    async () => {
      try {
        return ok(await client.listSymbols());
      } catch (err) {
        return fail(err);
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
