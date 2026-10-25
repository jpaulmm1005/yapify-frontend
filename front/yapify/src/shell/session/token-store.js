const TOKEN_KEY = 'yapify-tokens';

let _tokens = null;

function load() {
  if (_tokens) return _tokens;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    _tokens = raw ? JSON.parse(raw) : null;
  } catch {
    _tokens = null;
  }
  return _tokens;
}

export function getAccessToken() {
  return load()?.access_token ?? null;
}

export function getRefreshToken() {
  return load()?.refresh_token ?? null;
}

export function saveTokens(tokens) {
  _tokens = tokens;
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens)); }
  catch { /* noop — localStorage blocked */ }
}

export function clearTokens() {
  _tokens = null;
  try { localStorage.removeItem(TOKEN_KEY); }
  catch { /* noop — localStorage blocked */ }
}
