import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AllRatesTodayClient, AllRatesTodayError } from '../dist/client.js';

function stubFetch(status, body, capture = {}) {
  return async (url, init) => {
    capture.url = url;
    capture.init = init;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    };
  };
}

test('success returns parsed body', async () => {
  const client = new AllRatesTodayClient({
    apiKey: 'k',
    fetchImpl: stubFetch(200, { rate: 0.92, source: 'interbank' }),
  });
  const res = await client.getRate('USD', 'EUR');
  assert.equal(res.rate, 0.92);
});

test('sends bearer auth and versioned user-agent', async () => {
  const capture = {};
  const client = new AllRatesTodayClient({
    apiKey: 'secret',
    fetchImpl: stubFetch(200, { rate: 1 }, capture),
  });
  await client.getRate('USD', 'EUR');
  assert.equal(capture.init.headers['Authorization'], 'Bearer secret');
  assert.match(capture.init.headers['User-Agent'], /^allratestoday-mcp\/\d+\.\d+\.\d+$/);
});

test('401 maps to invalid API key message', async () => {
  const client = new AllRatesTodayClient({ apiKey: 'bad', fetchImpl: stubFetch(401, {}) });
  await assert.rejects(
    () => client.getRate('USD', 'EUR'),
    (err) =>
      err instanceof AllRatesTodayError &&
      err.status === 401 &&
      err.message === 'Invalid AllRatesToday API key',
  );
});

test('429 maps to quota message', async () => {
  const client = new AllRatesTodayClient({ apiKey: 'k', fetchImpl: stubFetch(429, {}) });
  await assert.rejects(
    () => client.getRate('USD', 'EUR'),
    (err) => err.message === 'AllRatesToday API quota exceeded',
  );
});

test('400 without upstream error uses currency-code hint', async () => {
  const client = new AllRatesTodayClient({ apiKey: 'k', fetchImpl: stubFetch(400, {}) });
  await assert.rejects(
    () => client.getRate('USD', 'XXX'),
    (err) => err.message === 'Bad request — possibly an unknown currency code',
  );
});

test('400 with upstream error passes it through', async () => {
  const client = new AllRatesTodayClient({
    apiKey: 'k',
    fetchImpl: stubFetch(400, { error: 'Unknown currency: ZZZ' }),
  });
  await assert.rejects(() => client.getRate('USD', 'ZZZ'), (err) => err.message === 'Unknown currency: ZZZ');
});

test('500 includes status and upstream message', async () => {
  const client = new AllRatesTodayClient({
    apiKey: 'k',
    fetchImpl: stubFetch(500, { error: 'upstream down' }),
  });
  await assert.rejects(
    () => client.getRate('USD', 'EUR'),
    (err) => err.status === 500 && err.message === 'HTTP 500 — upstream down',
  );
});

test('keyless getRate falls back to the open ECB endpoint, unauthenticated', async () => {
  const capture = {};
  const client = new AllRatesTodayClient({
    fetchImpl: stubFetch(200, { bank: 'ecb', rate_date: '2026-08-28', rate: 0.86, derived: true }, capture),
  });
  const res = await client.getRate('USD', 'EUR');
  assert.equal(client.keyless, true);
  assert.match(capture.url, /\/open\/central-bank\/ecb\?source=USD&target=EUR$/);
  assert.equal(capture.init.headers.Authorization, undefined);
  assert.match(capture.init.headers['User-Agent'], /keyless/);
  assert.equal(res.rate, 0.86);
  assert.equal(res.rate_date, '2026-08-28');
  assert.match(res.note, /ALLRATES_API_KEY/);
});

test('keyless metered tools explain how to get a free key, without calling out', async () => {
  const client = new AllRatesTodayClient({
    fetchImpl: () => {
      throw new Error('should not be called');
    },
  });
  await assert.rejects(
    () => client.getHistoricalRates('USD', 'EUR', '7d'),
    /needs an AllRatesToday API key on a paid plan[\s\S]*pricing/,
  );
  await assert.rejects(
    () => client.getAuthenticatedRates({ source: 'USD', target: 'EUR' }),
    /needs an AllRatesToday API key/,
  );
});

test('keyless official-rate tools hit the open endpoints and validate input locally', async () => {
  const calls = [];
  const client = new AllRatesTodayClient({
    fetchImpl: async (url) => {
      calls.push(url);
      return new Response(JSON.stringify({ bank: 'ecb', rate_date: '2026-09-30', rate: 1.13, sources: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  await client.listCentralBanks();
  await client.getOfficialRates('ECB', { source: 'eur', target: 'usd' });
  assert.equal(calls[0], 'https://allratestoday.com/api/open/central-banks');
  assert.equal(calls[1], 'https://allratestoday.com/api/open/central-bank/ecb?source=EUR&target=USD');
  await assert.rejects(() => client.getOfficialRates('ecb', { source: 'EUR' }), /both source and target/);
  await assert.rejects(() => client.getOfficialRates('ecb', { date: '2026-09-01' }), /needs an AllRatesToday API key/);
  await assert.rejects(() => client.getOfficialRates('not a bank'), /Unknown source code/);
});

test('requestTrialKey POSTs JSON and adopts the key for later calls', async () => {
  const capture = {};
  const client = new AllRatesTodayClient({
    fetchImpl: stubFetch(201, { key: 'art_live_trial', calls: 100, expires_at: '2026-10-18T00:00:00Z' }, capture),
  });
  assert.equal(client.keyless, true);
  const res = await client.requestTrialKey({ agent: 'test' });
  assert.match(capture.url, /\/api\/agent\/keys$/);
  assert.equal(capture.init.method, 'POST');
  assert.equal(capture.init.headers['Content-Type'], 'application/json');
  assert.equal(JSON.parse(capture.init.body).agent, 'test');
  assert.equal(res.adopted, true);
  assert.equal(client.keyless, false);
  // Subsequent requests carry the adopted key.
  const cap2 = {};
  const keyed = new AllRatesTodayClient({ fetchImpl: stubFetch(200, { rate: 1 }, cap2) });
  keyed.setApiKey('art_live_trial');
  await keyed.getRate('USD', 'EUR');
  assert.equal(cap2.init.headers['Authorization'], 'Bearer art_live_trial');
});

test('getReferenceRate: open path keyless, dated path needs key', async () => {
  const capture = {};
  const open = new AllRatesTodayClient({ fetchImpl: stubFetch(200, { rate_date: '2026-10-12' }, capture) });
  await open.getReferenceRate({ source: 'eur', target: 'gbp' });
  assert.match(capture.url, /\/api\/open\/reference-rate\?source=EUR&target=GBP$/);
  await assert.rejects(open.getReferenceRate({ date: '2026-10-12' }), /needs an AllRatesToday API key/);
  const keyed = new AllRatesTodayClient({ apiKey: 'k', fetchImpl: stubFetch(200, {}, capture) });
  await keyed.getReferenceRate({ date: '2026-10-12' });
  assert.match(capture.url, /\/api\/v1\/reference-rate\/2026-10-12$/);
});

function routeFetch(routes, calls) {
  return async (url) => {
    calls.push(url);
    const u = new URL(url);
    const hit = routes[u.pathname];
    const [status, body] = hit ?? [404, { error: 'not found' }];
    return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
  };
}

test('keyless getRate falls back from ECB to the issuing central bank (USD/GBP via BoE, derived)', async () => {
  const calls = [];
  const client = new AllRatesTodayClient({
    fetchImpl: routeFetch(
      {
        '/api/open/central-bank/ecb': [404, { error: 'ecb does not publish a rate covering USD/GBP' }],
        '/api/open/central-bank/boe': [200, { bank: 'boe', rate_date: '2026-10-14', rate: 0.7598784195, derived: true }],
      },
      calls,
    ),
  });
  const res = await client.getRate('USD', 'GBP');
  assert.equal(calls.length, 2);
  assert.match(calls[0], /\/open\/central-bank\/ecb\?source=USD&target=GBP$/);
  assert.match(calls[1], /\/open\/central-bank\/boe\?source=USD&target=GBP$/);
  assert.equal(res.bank, 'boe');
  assert.equal(res.rate, 0.7598784195);
  assert.equal(res.derived, true);
  assert.equal(res.rate_date, '2026-10-14');
  assert.match(res.source, /Bank of England official rate \(keyless mode\)/);
});

test('keyless getRate tries the target-currency bank before the source-currency bank', async () => {
  const calls = [];
  const client = new AllRatesTodayClient({
    fetchImpl: routeFetch(
      {
        '/api/open/central-bank/fed': [200, { bank: 'fed', rate_date: '2026-10-09', rate: 88.7 }],
        '/api/open/central-bank/rbi': [200, { bank: 'rbi', rate_date: '2026-10-16', rate: 95.0194, derived: false }],
      },
      calls,
    ),
  });
  const res = await client.getRate('USD', 'INR');
  assert.deepEqual(calls.map((u) => new URL(u).pathname.split('/').pop()), ['ecb', 'rbi']);
  assert.equal(res.bank, 'rbi');
  assert.equal(res.derived, false);
});

test('keyless getRate refuses a pair no single bank covers, with a key hint', async () => {
  const calls = [];
  const client = new AllRatesTodayClient({ fetchImpl: routeFetch({}, calls) });
  await assert.rejects(
    () => client.getRate('GBP', 'JPY'),
    (err) =>
      err instanceof AllRatesTodayError &&
      err.status === 404 &&
      /No keyless official source covers GBP\/JPY[\s\S]*ALLRATES_API_KEY/.test(err.message),
  );
  assert.deepEqual(calls.map((u) => new URL(u).pathname.split('/').pop()), ['ecb', 'boj', 'boe']);
});

test('keyless getRate does not swallow non-404 upstream errors', async () => {
  const calls = [];
  const client = new AllRatesTodayClient({
    fetchImpl: routeFetch({ '/api/open/central-bank/ecb': [500, { error: 'upstream down' }] }, calls),
  });
  await assert.rejects(() => client.getRate('USD', 'GBP'), (err) => err.status === 500);
  assert.equal(calls.length, 1);
});

test('keyless dated official/reference tables say a paid plan is needed', async () => {
  const client = new AllRatesTodayClient({
    fetchImpl: () => {
      throw new Error('should not be called');
    },
  });
  await assert.rejects(() => client.getOfficialRates('ecb', { date: '2026-09-01' }), /paid plan/);
  await assert.rejects(() => client.getReferenceRate({ date: '2026-09-01' }), /paid plan/);
});
