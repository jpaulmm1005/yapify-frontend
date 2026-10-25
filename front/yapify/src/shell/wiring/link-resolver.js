import shellRoutes from '../router/routes.js';
import { guardLinkPage } from './wiring-guards.js';

/**
 * Resolves a `link:` declaration from a `yapiConnections.out.<channel>`
 * entry into a concrete URL string the router can navigate to.
 *
 * A link looks like:
 *
 *   link: {
 *     page: 'followed-stores',          // route name OR path with `:placeholders`
 *     params: {
 *       storeId: 'store.id',            // dotted path inside `detail`
 *       tab:     { literal: 'cupones' },
 *       slug:    (detail) => slugFor(detail.store),
 *     },
 *   }
 *
 * `page` resolution:
 *   - If `page` matches a key in `shell/router/routes.js`, the value of
 *     that entry is the base path (e.g. `'followed-stores'` → `/followed-stores`).
 *   - Otherwise `page` is taken as a literal path (e.g. `'/item/:kind/:id'`).
 *     A `page` that is neither a route key nor a `/`-prefixed path is a typo:
 *     it resolves to a URL no route matches (a mute 404), so in development
 *     `wiring-guards.js` reports it. Resolution itself is unchanged, and
 *     production behaviour is identical.
 *
 * `params` resolution:
 *   - `:placeholders` inside the path are substituted in order.
 *   - Params not consumed by placeholders become query-string entries.
 *
 * Param value spec:
 *   - `'a.b.c'`           → `detail.a.b.c` (dotted path lookup).
 *   - `{ literal: 'foo' }`→ string literal.
 *   - `(detail) => ...`   → computed value.
 *   - anything else       → JSON-serialised as-is.
 *
 * @param {Object} link
 * @param {Object} detail
 * @returns {String|null} The resolved URL, or `null` when required pieces resolve to undefined.
 */
export function resolveLink(link, detail) {
  if (!link || typeof link !== 'object' || !link.page) return null;
  const { page, params = {} } = link;

  const routes = shellRoutes.routes ?? {};
  guardLinkPage(page, routes);
  let path = Object.prototype.hasOwnProperty.call(routes, page) ? routes[page] : page;

  const used = new Set();
  path = path.replace(/:(\w+)/g, (_, key) => {
    used.add(key);
    const value = resolveParam(params[key], detail);
    return value == null ? '' : encodeURIComponent(String(value));
  });

  const queryEntries = Object.entries(params)
    .filter(([key]) => !used.has(key))
    .map(([key, spec]) => {
      const value = resolveParam(spec, detail);
      return value == null ? null : [key, value];
    })
    .filter(Boolean);

  if (queryEntries.length === 0) return path;
  const query = queryEntries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${path}?${query}`;
}

function resolveParam(spec, detail) {
  if (spec == null) return undefined;
  if (typeof spec === 'function') return spec(detail);
  if (typeof spec === 'string') return getByPath(detail, spec);
  if (typeof spec === 'object' && 'literal' in spec) return spec.literal;
  return spec;
}

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
