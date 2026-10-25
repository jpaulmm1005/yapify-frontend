/**
 * Resuelve el valor de una "huella" (path) declarada en analytics props.
 *
 * Sintaxis soportada:
 *   - 'storeId'              → e.detail.storeId
 *   - 'store.name'           → e.detail.store.name (paths anidados)
 *   - '$session.uid'         → window.__yapifyUser?.dbUser?.uid
 *   - '$session.role'        → window.__yapifyUser?.dbUser?.role
 *   - '$page.route'          → location.hash route
 *   - '$page.hash'           → location.hash literal
 *   - '$page.surface'        → surface canónica derivada del route
 *   - { literal: 'foo' }     → 'foo' (valor fijo)
 *   - { fn: (ctx) => ... }   → resultado de la función con { detail, session, route }
 */

import { deriveSurface } from './contract.js';

function getByPath(obj, path) {
  if (obj == null) return undefined;
  if (!path) return undefined;
  const parts = String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function readSession() {
  return window.__yapifyUser?.dbUser ?? null;
}

function readPage() {
  const hash = (location.hash || '').replace(/^#/, '');
  const route = hash.split('?')[0] || '/';
  const surface = deriveSurface(route);
  return { hash, route, surface };
}

/**
 * Resuelve un único valor de prop según el path/spec.
 */
export function resolveValue(spec, detail) {
  if (spec == null) return undefined;
  if (typeof spec === 'object') {
    if ('literal' in spec) return spec.literal;
    if (typeof spec.fn === 'function') {
      try {
        return spec.fn({
          detail,
          session: readSession(),
          page: readPage(),
        });
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
  if (typeof spec !== 'string') return spec;

  if (spec.startsWith('$session.')) {
    return getByPath(readSession(), spec.slice('$session.'.length));
  }
  if (spec === '$session') return readSession();
  if (spec.startsWith('$page.')) {
    return getByPath(readPage(), spec.slice('$page.'.length));
  }
  // path normal sobre el detail
  return getByPath(detail, spec);
}

/**
 * Resuelve un mapa { propName: spec } a { propName: valorResuelto }.
 * Omite undefined para no contaminar el evento.
 */
export function resolveProps(propMap = {}, detail = {}) {
  const out = {};
  for (const [key, spec] of Object.entries(propMap)) {
    const v = resolveValue(spec, detail);
    if (v !== undefined) out[key] = v;
  }
  return out;
}
