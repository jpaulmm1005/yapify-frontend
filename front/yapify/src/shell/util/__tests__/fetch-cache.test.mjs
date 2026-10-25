import { test } from 'node:test';
import assert from 'node:assert/strict';

// shim window + fetch
globalThis.window = { dispatchEvent: () => {} };
globalThis.CustomEvent = class { constructor(name, init){ this.type=name; this.detail=init?.detail; } };

let fetchCalls = 0;
let fetchResponse = { ok: true, json: async () => ({ pong: 1 }) };
globalThis.fetch = async () => { fetchCalls++; return fetchResponse; };

const { fetchCached, invalidateCache, _resetCache, _peek } =
  await import('../fetch-cache.js');

test('miss: fetches and caches', async () => {
  _resetCache();
  fetchCalls = 0;
  const r = await fetchCached('http://x/a');
  assert.deepEqual(r, { pong: 1 });
  assert.equal(fetchCalls, 1);
  assert.ok(_peek('http://x/a'));
});

test('hit fresh: no fetch', async () => {
  _resetCache();
  fetchCalls = 0;
  await fetchCached('http://x/a', { ttlMs: 60_000 });
  await fetchCached('http://x/a', { ttlMs: 60_000 });
  assert.equal(fetchCalls, 1, 'second call should be served from cache');
});

test('hit stale (SWR): returns stale, fires bg fetch', async () => {
  _resetCache();
  fetchCalls = 0;
  await fetchCached('http://x/b', { ttlMs: 1, swrMs: 60_000 });
  await new Promise(r => setTimeout(r, 5));   // expirar TTL
  fetchResponse = { ok: true, json: async () => ({ pong: 2 }) };
  const r = await fetchCached('http://x/b', { ttlMs: 1, swrMs: 60_000 });
  assert.deepEqual(r, { pong: 1 }, 'returns stale immediately');
  // background fetch happens — wait for it
  await new Promise(r => setTimeout(r, 20));
  assert.equal(fetchCalls, 2);
  assert.deepEqual(_peek('http://x/b').data, { pong: 2 }, 'cache revalidated');
});

test('miss caducado (más allá de SWR): fetch nuevo', async () => {
  _resetCache();
  fetchCalls = 0;
  fetchResponse = { ok: true, json: async () => ({ pong: 'a' }) };
  await fetchCached('http://x/c', { ttlMs: 1, swrMs: 2 });
  await new Promise(r => setTimeout(r, 10));
  fetchResponse = { ok: true, json: async () => ({ pong: 'b' }) };
  const r = await fetchCached('http://x/c', { ttlMs: 1, swrMs: 2 });
  assert.deepEqual(r, { pong: 'b' });
  assert.equal(fetchCalls, 2);
});

test('invalidateCache by string', async () => {
  _resetCache();
  fetchResponse = { ok: true, json: async () => ({}) };
  await fetchCached('http://x/stores/1');
  await fetchCached('http://x/stores/1/products');
  await fetchCached('http://x/users/1');
  const removed = invalidateCache('stores');
  assert.equal(removed, 2);
  assert.ok(_peek('http://x/users/1'));
});

test('invalidateCache by regex', async () => {
  _resetCache();
  fetchResponse = { ok: true, json: async () => ({}) };
  await fetchCached('http://x/stores/1/products?cursor=10');
  await fetchCached('http://x/stores/1/products?cursor=20');
  await fetchCached('http://x/stores/2/products');
  const removed = invalidateCache(/\/stores\/1\/products/);
  assert.equal(removed, 2);
});

test('non-2xx no se cachea, throws', async () => {
  _resetCache();
  fetchCalls = 0;
  fetchResponse = { ok: false, status: 500, json: async () => ({}) };
  await assert.rejects(() => fetchCached('http://x/err'));
  assert.equal(_peek('http://x/err'), undefined);
});

test('concurrent calls al mismo url se deduplican', async () => {
  _resetCache();
  fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls++;
    return new Promise(res => setTimeout(() => res({ ok: true, json: async () => ({ ok: 1 }) }), 10));
  };
  const [a, b] = await Promise.all([fetchCached('http://x/dup'), fetchCached('http://x/dup')]);
  assert.deepEqual(a, b);
  assert.equal(fetchCalls, 1, 'only one network call for two concurrent reads');
});
