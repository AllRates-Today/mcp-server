import { VERSION } from './version.js';

const DEFAULT_BASE_URL = 'https://allratestoday.com/api';

export interface ClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class AllRatesTodayError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'AllRatesTodayError';
  }
}

/**
 * Thrown when a tool needs an endpoint that sits behind the API key. Carries
 * the sign-up instructions so the assistant relays one actionable sentence
 * rather than a bare 401.
 */
export class NeedsKeyError extends AllRatesTodayError {
  constructor(what: string) {
    super(
      `${what} needs an AllRatesToday API key. The free tier covers it — sign up at ` +
        'https://allratestoday.com/register (no card, under a minute), then set ALLRATES_API_KEY ' +
        "in this MCP server's config and restart. Without a key the server still answers " +
        'get_exchange_rate for ~30 major currencies (official ECB daily reference rate) and ' +
        'list_currencies.',
    );
    this.name = 'NeedsKeyError';
  }
}

function errorMessage(status: number, upstream: string | undefined): string {
  switch (status) {
    case 400:
      return upstream ?? 'Bad request — possibly an unknown currency code';
    case 401:
      return 'Invalid AllRatesToday API key';
    case 429:
      return 'AllRatesToday API quota exceeded';
    default:
      return upstream ? `HTTP ${status} — ${upstream}` : `HTTP ${status}`;
  }
}

export class AllRatesTodayClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, query: Record<string, string | undefined>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, value);
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': this.apiKey
        ? `allratestoday-mcp/${VERSION}`
        : `allratestoday-mcp/${VERSION} (keyless)`,
    };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await this.fetchImpl(url.toString(), { method: 'GET', headers });
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!res.ok) {
      const upstream =
        body && typeof body === 'object' && 'error' in body && typeof (body as any).error === 'string'
          ? (body as any).error
          : undefined;
      throw new AllRatesTodayError(errorMessage(res.status, upstream), res.status, body);
    }

    return body as T;
  }

  /** True when no API key is configured: only the open endpoints are reachable. */
  get keyless(): boolean {
    return !this.apiKey;
  }

  getRate(source: string, target: string) {
    // Keyless: fall back to the open, edge-cached ECB reference table. It is
    // the official daily fixing rather than a live mid-market quote and covers
    // ~30 majors, so the result is labelled for the model to relay honestly.
    if (this.keyless) {
      return this.request<{
        bank: string;
        rate_date: string;
        rate: number;
        derived?: boolean;
      }>('/open/central-bank/ecb', { source, target }).then((r) => ({
        rate: r.rate,
        source: 'ECB official daily reference rate (keyless mode)',
        rate_date: r.rate_date,
        derived: r.derived ?? false,
        note:
          'Keyless mode: this is the European Central Bank reference rate published on ' +
          `${r.rate_date}, not a live mid-market quote, and covers ~30 major currencies. ` +
          'For real-time rates across 160+ currencies set ALLRATES_API_KEY — free tier at ' +
          'https://allratestoday.com/register.',
      }));
    }
    return this.request<{ rate: number; source: string }>('/rate', { source, target });
  }

  getHistoricalRates(source: string, target: string, period: '1d' | '7d' | '30d' | '1y' = '7d') {
    if (this.keyless) return Promise.reject(new NeedsKeyError('Historical time-series'));
    return this.request<{
      source: string;
      target: string;
      period: string;
      source_api?: string;
      data: { date: string; rate: number; timestamp: number }[];
    }>('/historical-rates', { source, target, period });
  }

  getAuthenticatedRates(params: {
    source?: string;
    target?: string;
    time?: string;
    group?: 'hour' | 'day' | 'week' | 'month';
  }) {
    if (this.keyless)
      return Promise.reject(new NeedsKeyError('Multi-target and point-in-time rates'));
    return this.request<
      Array<{ rate: number; source: string; target: string; time: string }>
    >('/v1/rates', params);
  }

  listSymbols() {
    return this.request<{
      currencies: { code: string; name: string; symbol: string }[];
      count: number;
    }>('/v1/symbols', {});
  }
}
