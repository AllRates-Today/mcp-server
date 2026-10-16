import { VERSION } from './version.js';
import { HOME_BANKS } from './home-banks.js';

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
  constructor(what: string, paid = false) {
    super(
      paid
        ? `${what} needs an AllRatesToday API key on a paid plan (from €4.99/month; free and trial ` +
            'keys get 403 for historical rates and dated tables) — see https://allratestoday.com/pricing, ' +
            "then set ALLRATES_API_KEY in this MCP server's config and restart. Latest rates and the latest " +
            'official tables need no paid plan.'
        : `${what} needs an AllRatesToday API key. The free tier covers it — sign up at ` +
            'https://allratestoday.com/register (no card, under a minute), then set ALLRATES_API_KEY ' +
            "in this MCP server's config and restart. Without a key the server still answers " +
            'get_exchange_rate from official central-bank tables (ECB first, then the issuing bank), ' +
            'list_currencies, list_central_banks and get_official_rates (latest tables).',
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
  private apiKey?: string;
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

  /** Adopt a key at runtime (used after request_trial_key) so the rest of the session is keyed. */
  setApiKey(key: string | undefined): void {
    this.apiKey = key || undefined;
  }

  /**
   * Daily Reference Rate: one never-revised mid-market table per business day,
   * fixed at 16:00 London (median of samples in a 5-minute window). Latest
   * table and single pairs are keyless; a dated table needs a paid-plan key.
   */
  getReferenceRate(params: { source?: string; target?: string; date?: string } = {}) {
    if (Boolean(params.source) !== Boolean(params.target)) {
      return Promise.reject(new AllRatesTodayError('Provide both source and target, or neither.'));
    }
    const pair = { source: params.source?.toUpperCase(), target: params.target?.toUpperCase() };
    if (params.date) {
      if (this.keyless) return Promise.reject(new NeedsKeyError(`The reference-rate table for ${params.date}`, true));
      return this.request<Record<string, unknown>>(`/v1/reference-rate/${encodeURIComponent(params.date)}`, pair);
    }
    return this.request<Record<string, unknown>>('/open/reference-rate', pair);
  }

  /**
   * Self-issue a trial key (100 calls, 7 days, no account) and adopt it for the
   * rest of this process. POST with a JSON body: the site rejects bodiless
   * POSTs as cross-site form submissions.
   */
  async requestTrialKey(params: { agent?: string; purpose?: string } = {}) {
    const res = await this.fetchImpl(`${this.baseUrl}/agent/keys`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': `allratestoday-mcp/${VERSION}`,
      },
      body: JSON.stringify({ agent: params.agent, purpose: params.purpose }),
    });
    const text = await res.text();
    let body: any;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const upstream = body && typeof body === 'object' && typeof body.error === 'string' ? body.error : undefined;
      throw new AllRatesTodayError(upstream ?? `HTTP ${res.status}`, res.status, body);
    }
    const key = body && typeof body === 'object' && typeof body.key === 'string' ? body.key : undefined;
    if (key) this.setApiKey(key);
    return {
      ...(body ?? {}),
      adopted: Boolean(key),
      note:
        'This server now uses the trial key for the rest of this session. To keep it after a restart, ' +
        'put it in the MCP config: "env": { "ALLRATES_API_KEY": "<key>" }. For a lasting key register free ' +
        'at https://allratestoday.com/register (300 calls) or see https://allratestoday.com/pricing.',
    };
  }

  async getRate(source: string, target: string) {
    // Keyless: answer from the open, edge-cached official tables. The ECB
    // reference table goes first; when it does not cover the pair, the central
    // bank that issues one of the two currencies almost always does (same
    // order as the hosted /api/mcp server). Each answer is an official print
    // with a publication date, not a live quote, so it is labelled for the
    // model to relay honestly; `derived` is passed through from the API (true
    // for an inverse or a cross inside that bank's own table).
    if (this.keyless) {
      const candidates: Array<{ code: string; name: string }> = [{ code: 'ecb', name: 'European Central Bank' }];
      for (const c of [target, source]) {
        const home = HOME_BANKS[c];
        if (home && !candidates.some((x) => x.code === home.code)) candidates.push(home);
      }
      let lastErr: unknown;
      for (const bank of candidates) {
        try {
          const r = await this.request<{ bank: string; rate_date: string; rate: number; derived?: boolean }>(
            `/open/central-bank/${bank.code}`,
            { source, target },
          );
          return {
            rate: r.rate,
            source: `${bank.name} official rate (keyless mode)`,
            bank: bank.code,
            rate_date: r.rate_date,
            derived: r.derived ?? false,
            note:
              `Keyless mode: this is the ${bank.name} official rate published on ${r.rate_date}, ` +
              'not a live mid-market quote. For real-time rates across 160+ currencies set ' +
              'ALLRATES_API_KEY — free tier at https://allratestoday.com/register.',
          };
        } catch (err) {
          lastErr = err;
          if (!(err instanceof AllRatesTodayError && err.status === 404)) throw err;
        }
      }
      throw new AllRatesTodayError(
        `No keyless official source covers ${source}/${target}. Real-time rates for 160+ currencies ` +
          'need an API key — set ALLRATES_API_KEY (free tier at https://allratestoday.com/register).' +
          (lastErr instanceof AllRatesTodayError ? ` Last upstream error: ${lastErr.message}` : ''),
        404,
      );
    }
    return this.request<{ rate: number; source: string }>('/rate', { source, target });
  }

  getHistoricalRates(source: string, target: string, period: '1d' | '7d' | '30d' | '1y' = '7d') {
    if (this.keyless) return Promise.reject(new NeedsKeyError('Historical time-series', true));
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

  /** Every covered official source (121 central banks + 3 tax authorities). Keyless. */
  listCentralBanks() {
    return this.request<{
      sources: { code: string; name: string; latest: string | null; stale?: boolean }[];
      stale_count: number;
      checked_at: string;
    }>(this.keyless ? '/open/central-banks' : '/v1/central-banks', {});
  }

  /**
   * Latest OFFICIAL table published by a central bank or tax authority, or one
   * pair from it (cross-computed inside the bank's own table when not published
   * directly, flagged `derived`). Keyless; a dated table needs a paid-plan key.
   */
  getOfficialRates(bank: string, params: { date?: string; source?: string; target?: string } = {}) {
    const code = bank.trim().toLowerCase();
    if (!/^[a-z0-9_-]{2,20}$/.test(code)) {
      return Promise.reject(new AllRatesTodayError(`Unknown source code "${bank}" — call list_central_banks first.`));
    }
    if (Boolean(params.source) !== Boolean(params.target)) {
      return Promise.reject(new AllRatesTodayError('Provide both source and target, or neither.'));
    }
    const pair = { source: params.source?.toUpperCase(), target: params.target?.toUpperCase() };
    if (this.keyless) {
      if (params.date) return Promise.reject(new NeedsKeyError(`The ${code} table for ${params.date}`, true));
      return this.request<Record<string, unknown>>(`/open/central-bank/${encodeURIComponent(code)}`, pair);
    }
    return this.request<Record<string, unknown>>(
      `/v1/central-bank/${encodeURIComponent(code)}/${params.date ?? 'latest'}`,
      pair,
    );
  }

  listSymbols() {
    return this.request<{
      currencies: { code: string; name: string; symbol: string }[];
      count: number;
    }>('/v1/symbols', {});
  }
}
