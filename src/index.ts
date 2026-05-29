#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { AllRatesTodayClient, AllRatesTodayError } from './client.js';

const CCY = {
  type: 'string',
  description:
    "ISO 4217 currency code, uppercase 3 letters (e.g. 'USD', 'EUR', 'GBP', 'JPY'). For a source/target pair, the returned rate is how much 1 unit of source is worth in target. Fiat only — no crypto, no commodities. Call list_currencies if unsure whether a code is supported.",
  minLength: 3,
  maxLength: 3,
} as const;

const tools = [
  {
    name: 'get_exchange_rate',
    description:
      "Use this when the user asks 'what is X in Y?', 'convert X to Y', 'current rate of EUR/USD', or any single fiat-to-fiat live exchange rate question. Returns the latest mid-market rate as a JSON object like { rate: 0.9234, source } meaning 1 source = 0.9234 target. Does NOT support cryptocurrencies, commodities, or arithmetic on amounts. For multiple targets in one call use get_rates_authenticated; for a past date or fixed lookback (7d/30d/1y) use get_historical_rates.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        source: CCY,
        target: CCY,
      },
      required: ['source', 'target'],
    },
  },
  {
    name: 'get_historical_rates',
    description:
      "Use this for fixed-window time-series questions like 'how has EUR/USD moved this week', 'show me the last month of GBP/JPY', or 'chart 1-year history of AUD/USD'. Returns { source, target, period, data: [{ date, rate, timestamp }, ...] } — sampling is fixed per period (1d=hourly, 7d/30d=daily, 1y=weekly) and the window always ends NOW. For a specific past datetime use get_rates_authenticated with `time`. For a single live rate use get_exchange_rate.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        source: CCY,
        target: CCY,
        period: {
          type: 'string',
          enum: ['1d', '7d', '30d', '1y'],
          default: '7d',
          description:
            "Lookback window ending NOW. '1d' returns ~24 hourly points, '7d' returns 7 daily points, '30d' returns 30 daily points, '1y' returns ~52 weekly points. Defaults to '7d' if omitted.",
        },
      },
      required: ['source', 'target'],
    },
  },
  {
    name: 'get_rates_authenticated',
    description:
      "Use this for (a) one source against multiple targets in a single call ('USD vs EUR, GBP, JPY'), or (b) the rate at a specific past datetime ('EUR/USD at 2025-03-14T12:00Z'), optionally bucketed by hour/day/week/month. Returns an array [{ rate, source, target, time }, ...] — one row per target × time bucket. For a single live pair use get_exchange_rate. For fixed lookback windows (1d/7d/30d/1y ending now) use get_historical_rates.",
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        source: CCY,
        target: {
          type: 'string',
          description:
            "One or more ISO 4217 codes, comma-separated, no spaces. Examples: 'EUR' (single) or 'EUR,GBP,JPY' (multi). Each target becomes a separate row in the response.",
        },
        time: {
          type: 'string',
          format: 'date-time',
          description:
            "Single point-in-time ISO 8601 UTC timestamp (e.g. '2025-03-14T12:00:00Z'). Omit for the latest rate.",
        },
        group: {
          type: 'string',
          enum: ['hour', 'day', 'week', 'month'],
          description:
            "Aggregation bucket: 'hour', 'day', 'week', or 'month'. Useful when time is omitted to return rolling averages. Omit for raw single-point output.",
        },
      },
      required: ['source', 'target'],
    },
  },
  {
    name: 'list_currencies',
    description:
      "Call this BEFORE other tools when you are unsure whether a currency code is supported, or when the user asks 'what currencies do you support?', 'is X a valid currency?', or 'what is the symbol for X?'. Returns { currencies: [{ code: 'USD', name: 'US Dollar', symbol: '$' }, ...], count } covering 150+ ISO 4217 fiat currencies. Does NOT include cryptocurrencies. Cheap to call (cached 24h upstream) — use it to validate user input and prevent downstream errors in get_exchange_rate / get_rates_authenticated / get_historical_rates.",
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
] as const;

function text(s: unknown) {
  const out = typeof s === 'string' ? s : JSON.stringify(s, null, 2);
  return { content: [{ type: 'text', text: out }] };
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

  const server = new Server(
    { name: 'allratestoday-mcp', version: '0.3.1' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    try {
      switch (name) {
        case 'get_exchange_rate': {
          const { source, target } = args as { source: string; target: string };
          return text(await client.getRate(source, target));
        }
        case 'get_historical_rates': {
          const { source, target, period = '7d' } = args as {
            source: string; target: string; period?: '1d' | '7d' | '30d' | '1y';
          };
          return text(await client.getHistoricalRates(source, target, period));
        }
        case 'get_rates_authenticated': {
          return text(await client.getAuthenticatedRates(args as any));
        }
        case 'list_currencies': {
          return text(await client.listSymbols());
        }
        default:
          return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
      }
    } catch (err) {
      const message =
        err instanceof AllRatesTodayError
          ? `AllRatesToday error${err.status ? ` (${err.status})` : ''}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      return { content: [{ type: 'text', text: message }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep process alive; stdio transport handles shutdown.
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal:', err);
  process.exit(1);
});
