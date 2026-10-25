/**
 * Analytics layer — capa que el wirer y los features llaman.
 *
 * Responsabilidad:
 *   - Recibir una "huella" declarativa + el detail del evento DOM
 *   - Resolver props (paths, $session, $page, literal, fn)
 *   - Despachar al driver (PostHog)
 *
 * Es el único punto que sabe del driver. Si mañana cambiamos posthog por
 * mixpanel/snowplow, solo se cambia este archivo.
 */

import { resolveValue, resolveProps } from './analytics-resolver.js';
import { capture, identify, setPersonProperties, group, reset, pageview, isEnabled, alias } from './posthog-driver.js';

/**
 * Props auto-resueltas del contract global (spec 2026-05-14). El layer las
 * agrega ANTES de los props explícitos de la huella — si la huella declara
 * `user_uid` o `surface` con un valor distinto, eso pisa al auto-fill.
 *
 * `source` no se auto-fillea (es contextual al feature). Si la huella no lo
 * declara y estamos en dev, loguea un warning para que el dev lo agregue.
 */
const AUTO_PROPS = {
  user_uid: '$session.uid',
  surface: '$page.surface',
};

/**
 * Dedup: evita capturar el mismo evento+propsKey 2 veces dentro de 2s.
 * Protege contra doble-emit por SWR revalidation, HMR, route guards, etc.
 * NO afecta a eventos legítimamente repetidos (ej. mismo cart_item_removed
 * con product_id distinto pasa porque la key incluye los props).
 */
const DEDUP_WINDOW_MS = 2000;
const _recent = new Map();    // key → timestamp

function _isDuplicate(event, props) {
  const key = `${event}::${JSON.stringify(props)}`;
  const now = Date.now();
  const last = _recent.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  _recent.set(key, now);
  // GC: si el Map crece, limpia entradas viejas
  if (_recent.size > 200) {
    for (const [k, ts] of _recent) {
      if (now - ts > DEDUP_WINDOW_MS) _recent.delete(k);
    }
  }
  return false;
}

/**
 * Captura un evento a partir de una huella declarativa.
 * @param {object} fingerprint - { event, props?, groups?, when?, dedup? }
 * @param {object} detail - payload del CustomEvent que disparó
 */
export function captureFromFingerprint(fingerprint, detail = {}) {
  if (!fingerprint || !fingerprint.event) return;

  // Filtro condicional opcional
  if (typeof fingerprint.when === 'function') {
    try { if (!fingerprint.when(detail)) return; }
    catch { return; }
  }

  // 1) Resolver auto-fills primero
  const autoProps = resolveProps(AUTO_PROPS, detail);

  // 2) Resolver props explícitos de la huella (pisan al auto-fill)
  const declaredProps = resolveProps(fingerprint.props, detail);

  // 3) Merge: declarado > auto
  const props = { ...autoProps, ...declaredProps };

  // Warning DX: si no hay `source`, sugerir que se declare (ayuda a debug).
  if (props.source === undefined && typeof console !== 'undefined') {
    console.warn(
      `[analytics] event '${fingerprint.event}' no declara 'source'. Recomendado: agregarlo en props con un literal.`,
    );
  }

  // Dedup por defecto. Una huella puede optar-out con `dedup: false`
  // (útil para eventos contables donde cada disparo importa, ej. clicks repetidos).
  if (fingerprint.dedup !== false && _isDuplicate(fingerprint.event, props)) {
    return;
  }

  // Groups: identify groups antes de capture (PostHog asocia el grupo al evento)
  if (fingerprint.groups) {
    for (const [groupType, spec] of Object.entries(fingerprint.groups)) {
      const key = resolveValue(spec, detail);
      if (key !== undefined && key !== null) group(groupType, key);
    }
  }

  capture(fingerprint.event, props);
}

/**
 * Captura imperativa — para el caso raro donde no hay un evento DOM
 * (ej: error capturado en un catch que queremos trackear).
 */
export function track(event, props = {}) {
  capture(event, props);
}

/**
 * Re-export de operaciones del driver para uso del shell.
 */
export {
  identify,
  setPersonProperties,
  group,
  reset,
  pageview,
  isEnabled,
  alias,
};
