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
  description: 'ISO 4217 currency code (e.g. USD, EUR, GBP).',
  minLength: 3,
  maxLength: 3,
} as const;

const tools = [
  {
    name: 'get_exchange_rate',
    description:
      'Get the current mid-market exchange rate between two currencies. Returns a single rate number. Requires a free AllRatesToday API key (ALLRATES_API_KEY) — sign up at https://allratestoday.com/register.',
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
      'Get historical exchange-rate data points for a currency pair over a period. Periods: 1d (hourly), 7d (daily), 30d (daily), 1y (weekly). Requires an AllRatesToday API key (ALLRATES_API_KEY).',
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
          description: 'Time period to fetch history for.',
        },
      },
      required: ['source', 'target'],
    },
  },
  {
    name: 'get_rates_authenticated',
    description:
      'Get rates with higher limits and multi-target support. Requires an AllRatesToday API key (ALLRATES_API_KEY). Supports comma-separated targets like "EUR,GBP,JPY".',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        source: CCY,
        target: {
          type: 'string',
          description: 'One or more target codes, comma-separated.',
        },
        time: {
          type: 'string',
          format: 'date-time',
          description: 'Optional historical ISO 8601 timestamp.',
        },
        group: {
          type: 'string',
          enum: ['hour', 'day', 'week', 'month'],
          description: 'Optional grouping window.',
        },
      },
      required: ['source', 'target'],
    },
  },
  {
    name: 'list_currencies',
    description:
      'List all supported currencies with code, name, and symbol. Requires a free AllRatesToday API key (ALLRATES_API_KEY) — sign up at https://allratestoday.com/register. Cached 24h upstream.',
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
        '  1. Sign up free at https://allratestoday.com/register (300 requests/month, no card required)',
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
