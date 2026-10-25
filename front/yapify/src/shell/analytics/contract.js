/**
 * Contract canónico del sistema de huellas (spec 2026-05-14).
 *
 * Toda huella `A_xxx` recibe automáticamente las props globales si no las
 * declara explícitamente. El sistema NO sobrescribe lo declarado — declared > auto.
 *
 * Surfaces canónicas (alineadas a routes.js):
 *   home    → '/dashboard'
 *   explore → '/stores', '/kind'
 *   store   → '/store', '/item'
 *   cart    → '/cart'
 *   profile → '/profile', '/profile/points', '/profile/redemptions',
 *             '/notifications', '/purchases', '/qr'
 *   admin   → '/my-store', '/my-stores'
 *   auth    → '/login', '/onboarding'
 *   unknown → fallback (loguea warning en dev)
 */

const SURFACE_MAP = [
  { prefix: '/dashboard', surface: 'home' },
  { prefix: '/stores', surface: 'explore' },
  { prefix: '/kind', surface: 'explore' },
  { prefix: '/store', surface: 'store' },
  { prefix: '/item', surface: 'store' },
  { prefix: '/cart', surface: 'cart' },
  { prefix: '/profile', surface: 'profile' },
  { prefix: '/notifications', surface: 'profile' },
  { prefix: '/purchases', surface: 'profile' },
  { prefix: '/qr', surface: 'profile' },
  { prefix: '/my-store', surface: 'admin' },
  { prefix: '/my-stores', surface: 'admin' },
  { prefix: '/login', surface: 'auth' },
  { prefix: '/onboarding', surface: 'auth' },
];

/**
 * Mapea una ruta a su surface canónica. Devuelve 'unknown' si no matchea.
 * @param {string} route - ej. '/dashboard', '/store/abc-123'
 * @returns {string}
 */
export function deriveSurface(route) {
  if (!route || typeof route !== 'string') return 'unknown';
  // Match más específico primero (lo logra el orden del array — '/my-store'
  // antes de '/my-stores' no importa porque ambas → 'admin').
  for (const { prefix, surface } of SURFACE_MAP) {
    if (route === prefix || route.startsWith(`${prefix}/`) || route.startsWith(`${prefix}?`)) {
      return surface;
    }
  }
  return 'unknown';
}

/**
 * Lista de props del contract global. El layer las completa si la huella
 * no las trae. Documental — el resolver no la usa programáticamente.
 */
export const CONTRACT_PROPS = ['user_uid', 'surface', 'source', 'item_kind', 'item_id', 'store_id', 'store_category_id'];
