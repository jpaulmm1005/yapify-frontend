import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from '../session/token-store.js';

let _apiBaseUrl = '';

export function setApiBaseUrl(url) {
  _apiBaseUrl = url;
}

/**
 * Refresco en vuelo, compartido por todos los llamantes concurrentes.
 *
 * El backend ROTA el refresh token con un compare-and-set atómico: ante N
 * refrescos simultáneos con el mismo token, exactamente uno gana y el resto
 * recibe 401. Como la app dispara varias peticiones en paralelo (resumen,
 * contador de no leídos, feed…), al expirar el access token todas fallaban a
 * la vez, todas pedían refresh y las perdedoras borraban los tokens que la
 * ganadora acababa de guardar — cerrando la sesión sola tras ~30 minutos.
 *
 * Con single-flight, solo la primera llamada golpea /auth/refresh; las demás
 * esperan ese mismo resultado y reutilizan el token nuevo.
 *
 * @type {Promise<Boolean>|null}
 */
let _refreshInFlight = null;

/**
 * Ejecuta el intercambio del refresh token. No se llama directamente: pasa
 * siempre por `tryRefresh`, que garantiza una sola ejecución concurrente.
 *
 * @returns {Promise<Boolean>} true si se guardó un par de tokens nuevo.
 */
async function doRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${_apiBaseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      // Solo se limpia la sesión si el token que falló sigue siendo el
      // vigente. Si otro refresco ya lo rotó mientras esta petición viajaba,
      // el 401 es el esperado de la rotación y la sesión sigue sana.
      if (getRefreshToken() === refreshToken) clearTokens();
      return false;
    }
    const data = await res.json();
    saveTokens(data);
    return true;
  } catch {
    // Fallo de red: no se destruye la sesión — puede ser un corte pasajero.
    return false;
  }
}

/**
 * Refresca el par de tokens, coalescando llamadas concurrentes en una sola.
 *
 * @returns {Promise<Boolean>}
 */
function tryRefresh() {
  if (!_refreshInFlight) {
    _refreshInFlight = doRefresh().finally(() => { _refreshInFlight = null; });
  }
  return _refreshInFlight;
}

export async function authedFetch(url, init = {}) {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(url, { ...init, headers });

  if (res.status === 401 && token) {
    const refreshed = await tryRefresh();
    // Aunque este llamante no haya sido el que refrescó, puede haber un token
    // nuevo puesto por el refresco compartido: se reintenta si cambió.
    const newToken = getAccessToken();
    if (refreshed || (newToken && newToken !== token)) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(url, { ...init, headers });
    }
  }

  return res;
}
