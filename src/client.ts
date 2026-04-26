const DEFAULT_BASE_URL = 'https://allratestoday.com/api';
const USER_AGENT = `allratestoday-mcp/0.3.1`;

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
      'User-Agent': USER_AGENT,
    };
    if (!this.apiKey) {
      throw new AllRatesTodayError(
        'AllRatesToday API key is required. Sign up free at https://allratestoday.com/register to get a key, then set ALLRATES_API_KEY in your MCP config.',
      );
    }
    headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await this.fetchImpl(url.toString(), { method: 'GET', headers });
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!res.ok) {
      const msg =
        (body && typeof body === 'object' && 'error' in body && typeof (body as any).error === 'string'
          ? (body as any).error
          : `HTTP ${res.status}`);
      throw new AllRatesTodayError(msg, res.status, body);
    }

    return body as T;
  }

  getRate(source: string, target: string) {
    return this.request<{ rate: number; source: string }>('/rate', { source, target });
  }

  getHistoricalRates(source: string, target: string, period: '1d' | '7d' | '30d' | '1y' = '7d') {
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
