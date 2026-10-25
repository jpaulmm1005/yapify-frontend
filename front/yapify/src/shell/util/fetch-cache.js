import { authedFetch } from './authed-fetch.js';

/**
 * Cache cliente con stale-while-revalidate.
 * Solo cachea GET con respuestas 2xx. POST/PUT/DELETE pasan derecho.
 * LRU implícito: si Map.size > MAX_ENTRIES, descarta la entrada más vieja.
 */

const MAX_ENTRIES = 100;
const _cache = new Map();   // url -> { data, ts }
const _inflight = new Map(); // url -> Promise (deduplica concurrentes)

function _isFresh(entry, ttlMs) {
  return Date.now() - entry.ts < ttlMs;
}

function _isStaleButUsable(entry, ttlMs, swrMs) {
  const age = Date.now() - entry.ts;
  return age >= ttlMs && age < swrMs;
}

function _store(url, data) {
  if (_cache.size >= MAX_ENTRIES && !_cache.has(url)) {
    const firstKey = _cache.keys().next().value;
    if (firstKey !== undefined) _cache.delete(firstKey);
  }
  _cache.set(url, { data, ts: Date.now() });
}

async function _doFetch(url, init) {
  if (_inflight.has(url)) return _inflight.get(url);
  const p = authedFetch(url, init).then(async (r) => {
    if (!r.ok) {
      let body = null;
      try { body = await r.json(); } catch { /* noop — non-JSON / empty error body */ }
      const err = new Error(body?.message || `HTTP ${r.status}`);
      err.status = r.status;
      err.code = body?.code ?? null;
      err.causes = body?.causes ?? [];
      err.payload = body;
      throw err;
    }
    const data = await r.json();
    _store(url, data);
    window.dispatchEvent(new CustomEvent('cache:revalidated', { detail: { url, data } }));
    return data;
  }).finally(() => _inflight.delete(url));
  _inflight.set(url, p);
  return p;
}

/**
 * @param {string} url
 * @param {{ ttlMs?: number, swrMs?: number, signal?: AbortSignal }} [opts]
 */
export async function fetchCached(url, opts = {}) {
  const ttlMs = opts.ttlMs ?? 60_000;
  const swrMs = opts.swrMs ?? Math.max(ttlMs * 5, ttlMs);

  const entry = _cache.get(url);

  if (entry && _isFresh(entry, ttlMs)) {
    return entry.data;
  }

  if (entry && _isStaleButUsable(entry, ttlMs, swrMs)) {
    // SWR: devuelve stale, revalida en bg
    _doFetch(url, { signal: opts.signal }).catch(() => {});
    return entry.data;
  }

  // miss o caducado
  return _doFetch(url, { signal: opts.signal });
}

/**
 * @param {string|RegExp} pattern
 */
export function invalidateCache(pattern) {
  let removed = 0;
  for (const key of [..._cache.keys()]) {
    const matches = pattern instanceof RegExp
      ? pattern.test(key)
      : key.includes(pattern);
    if (matches) {
      _cache.delete(key);
      removed++;
    }
  }
  return removed;
}

/** Para tests: limpia todo. */
export function _resetCache() {
  _cache.clear();
  _inflight.clear();
}

/** Para tests: inspeccionar. */
export function _peek(url) {
  return _cache.get(url);
}
