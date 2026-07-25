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
    fetchImpl: stubFetch(200, { rate: 0.92, source: 'wise' }),
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

test('missing API key throws before any request', async () => {
  const client = new AllRatesTodayClient({
    fetchImpl: () => {
      throw new Error('should not be called');
    },
  });
  await assert.rejects(() => client.getRate('USD', 'EUR'), /API key is required/);
});
