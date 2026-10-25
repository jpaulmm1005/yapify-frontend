const SESSION_KEY = 'yapify-session';

/**
 * Verifica si el usuario tiene sesion activa en localStorage.
 */
function isAuthenticated() {
  try {
    const session = localStorage.getItem(SESSION_KEY);
    return !!session && session !== 'null';
  } catch {
    return false;
  }
}

/**
 * Evalua guards de navegacion antes de permitir el cambio de ruta.
 *
 * @param {string} targetHash - ruta destino, ej. '/login'
 * @returns {{ allowed: boolean, redirect?: string }}
 */
export function evaluateGuards(targetHash) {
  const guestOnlyRoutes = ['/login', '/onboarding'];
  const protectedRoutes = ['/dashboard', '/profile', '/my-store', '/purchases', '/my-stores', '/my-events', '/followed-stores', '/stores', '/store', '/notifications', '/qr', '/item', '/kind'];

  // Usuario autenticado intentando ir a login/onboarding → al dashboard
  if (isAuthenticated() && guestOnlyRoutes.some(r => targetHash === r || targetHash.startsWith(r + '/'))) {
    return { allowed: false, redirect: '/dashboard' };
  }

  // Usuario NO autenticado intentando ir a ruta protegida → al login
  if (!isAuthenticated() && protectedRoutes.some(r => targetHash === r || targetHash.startsWith(r + '/'))) {
    return { allowed: false, redirect: '/login' };
  }

  return { allowed: true };
}
