import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SERVER = fileURLToPath(new URL('../dist/index.js', import.meta.url));

// Minimal newline-delimited JSON-RPC client over the server's stdio transport.
function rpcSession(env) {
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let buffer = '';
  const pending = new Map();
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    }
  });
  return {
    child,
    request(method, params, id) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 10_000);
        pending.set(id, (msg) => {
          clearTimeout(timer);
          resolve(msg);
        });
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      });
    },
    notify(method, params) {
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
    },
    kill() {
      child.kill();
    },
  };
}

test('starts in keyless mode when ALLRATES_API_KEY is missing', async () => {
  // A missing key must not kill the process: an MCP server that exits breaks
  // the host client's whole config. It announces keyless mode and keeps serving.
  const session = rpcSession({ ALLRATES_API_KEY: '' });
  let stderr = '';
  session.child.stderr.on('data', (c) => (stderr += c.toString()));
  try {
    const init = await session.request(
      'initialize',
      {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '0' },
      },
      1,
    );
    assert.equal(init.result.serverInfo.name, 'allratestoday-mcp');
    const tools = await session.request('tools/list', {}, 2);
    assert.equal(tools.result.tools.length, 4);
  } finally {
    session.kill();
  }
  assert.match(stderr, /KEYLESS mode/);
  assert.match(stderr, /allratestoday\.com\/register/);
});

test('initializes and lists 4 read-only tools with schemas', async () => {
  const session = rpcSession({ ALLRATES_API_KEY: 'art_test_dummy' });
  try {
    const init = await session.request(
      'initialize',
      {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'smoke-test', version: '0.0.0' },
      },
      1,
    );
    assert.equal(init.result.serverInfo.name, 'allratestoday-mcp');
    assert.match(init.result.serverInfo.version, /^\d+\.\d+\.\d+$/);
    session.notify('notifications/initialized', {});

    const list = await session.request('tools/list', {}, 2);
    const tools = list.result.tools;
    assert.deepEqual(
      tools.map((t) => t.name).sort(),
      ['get_exchange_rate', 'get_historical_rates', 'get_rates_authenticated', 'list_currencies'],
    );
    for (const tool of tools) {
      assert.equal(tool.annotations.readOnlyHint, true, `${tool.name} should be read-only`);
      assert.ok(tool.inputSchema, `${tool.name} missing inputSchema`);
      assert.ok(tool.outputSchema, `${tool.name} missing outputSchema`);
      assert.ok(tool.description.length > 50, `${tool.name} missing description`);
    }

    const rate = tools.find((t) => t.name === 'get_exchange_rate');
    assert.match(rate.inputSchema.properties.source.pattern, /A-Za-z/);
  } finally {
    session.kill();
  }
});

test('tool call with invalid currency code is rejected by schema', async () => {
  const session = rpcSession({ ALLRATES_API_KEY: 'art_test_dummy' });
  try {
    await session.request(
      'initialize',
      { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '0' } },
      1,
    );
    session.notify('notifications/initialized', {});
    const res = await session.request(
      'tools/call',
      { name: 'get_exchange_rate', arguments: { source: 'DOLLARS', target: 'EUR' } },
      2,
    );
    const failed = res.error !== undefined || res.result?.isError === true;
    assert.ok(failed, 'expected invalid currency code to be rejected');
  } finally {
    session.kill();
  }
});
