/**
 * PostHog driver — adapter sobre posthog-js.
 *
 * Lazy: si no hay key, todos los métodos son no-ops silenciosos. Esto permite
 * desarrollar sin enviar tracking a producción y permite que el shell arranque
 * sin keys configuradas.
 */

let _posthog = null;
let _enabled = false;
let _bootPromise = null;

/**
 * Init posthog-js. Idempotente. Defer hasta idle para no bloquear el boot.
 * @param {{ key: string, host: string, debug?: boolean }} cfg
 */
export async function initPostHog({ key, host, debug = false } = {}) {
  if (!key) {
    console.info('[analytics] PostHog key not provided — tracking disabled');
    _enabled = false;
    return;
  }
  if (_bootPromise) return _bootPromise;

  _bootPromise = new Promise((resolve) => {
    // Defer hasta que el browser esté idle — no bloquea First Contentful Paint
    const start = async () => {
      try {
        const mod = await import('posthog-js');
        const posthog = mod.default ?? mod.posthog ?? mod;
        posthog.init(key, {
          api_host: host || 'https://us.i.posthog.com',

          // ── Pageviews / autocapture ─────────────────────────
          capture_pageview: false,                  // manual via shell
          capture_pageleave: true,                  // RE-ACTIVADO: barato, da time-on-page
          autocapture: false,                       // sólo eventos declarados (sigue OFF, no es ruido salvaje)

          // ── Session recording: OFF (causa #1 de lag) ────────
          disable_session_recording: true,

          // ── Surveys: OFF (no las usamos) ────────────────────
          disable_surveys: true,

          // ── Web vitals (LCP/FCP/CLS): RE-ACTIVADO, async ────
          capture_performance: true,

          // ── Dead clicks + heatmaps: OFF (listeners globales pesados) ─
          capture_dead_clicks: false,
          enable_heatmaps: false,

          // ── Feature flags: si no usamos, evitamos /decide ───
          advanced_disable_decide: true,
          advanced_disable_feature_flags: true,
          advanced_disable_feature_flags_on_first_load: true,

          // ── Person profiles solo para users identificados ───
          person_profiles: 'identified_only',

          // ── Network: batch agresivo, menos requests ─────────
          batch_flush_interval_ms: 5000,            // flush cada 5s en vez de inmediato
          request_batching: true,

          // ── Debug OFF siempre — no más posthog.debug() ──────
          loaded: () => { /* silent */ },

          // ── Privacidad: limpia query string de URLs ─────────
          sanitize_properties: (props) => {
            if (props.$current_url) {
              try {
                const u = new URL(props.$current_url);
                u.search = '';
                props.$current_url = u.toString();
              } catch { /* noop */ }
            }
            return props;
          },
        });
        _posthog = posthog;
        _enabled = true;
        console.info('[analytics] PostHog ready');
      } catch (err) {
        console.warn('[analytics] PostHog init failed:', err);
        _enabled = false;
      } finally {
        resolve();
      }
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(start, { timeout: 3000 });
    } else {
      setTimeout(start, 1500);
    }
  });

  return _bootPromise;
}

export function isEnabled() { return _enabled; }

export function capture(event, props = {}) {
  if (!_enabled || !_posthog) return;
  try { _posthog.capture(event, props); }
  catch (err) { console.warn('[analytics] capture failed:', event, err); }
}

export function identify(distinctId, traits = {}) {
  if (!_enabled || !_posthog || !distinctId) return;
  try { _posthog.identify(String(distinctId), traits); }
  catch (err) { console.warn('[analytics] identify failed:', err); }
}

/**
 * Alias para vincular el distinctId anónimo actual con un uid conocido.
 *
 * Caso de uso: usuario anónimo navegó la app (impressions/clicks fueron
 * atribuidos a un distinctId aleatorio). Al hacer signup, llamamos
 * `alias(uid)` para que esos eventos pre-signup queden atribuidos al
 * usuario identificado.
 *
 * PostHog usa el `distinctId` actual como source y el `uid` como alias.
 * Idempotente — llamar más de una vez no hace daño.
 */
export function alias(uid) {
  if (!_enabled || !_posthog || !uid) return;
  try { _posthog.alias(String(uid)); }
  catch (err) { console.warn('[analytics] alias failed:', err); }
}

export function setPersonProperties(traits = {}) {
  if (!_enabled || !_posthog) return;
  try { _posthog.setPersonProperties(traits); }
  catch (err) { console.warn('[analytics] setPersonProperties failed:', err); }
}

export function group(groupType, groupKey, traits = {}) {
  if (!_enabled || !_posthog || !groupType || !groupKey) return;
  try { _posthog.group(String(groupType), String(groupKey), traits); }
  catch (err) { console.warn('[analytics] group failed:', err); }
}

export function reset() {
  if (!_enabled || !_posthog) return;
  try { _posthog.reset(); }
  catch (err) { console.warn('[analytics] reset failed:', err); }
}

export function pageview(routeName, props = {}) {
  if (!_enabled || !_posthog) return;
  try {
    _posthog.capture('$pageview', {
      $current_url: location.href,
      route: routeName,
      ...props,
    });
  } catch (err) { console.warn('[analytics] pageview failed:', err); }
}
