/**
 * Selected-store store — la única fuente de verdad del shell sobre QUÉ
 * tienda administra el usuario y, desde el arranque en modo tienda, sobre
 * SI estaba en modo tienda al cerrar la app.
 *
 * `window.__yapifySelectedStoreId` es el espejo volátil que lee la feature
 * de admin; `localStorage['yapify-selected-store-id']` es lo que sobrevive
 * al cierre del WebView. Los dos se escriben y se borran juntos: si se
 * desincronizan, el arranque decide con un dato y la feature con otro.
 *
 * Lo escriben `navigation-coordinator` (entrar/salir del modo tienda) y
 * `session-coordinator` (logout). Lo lee `main.js` al arrancar.
 */

const SELECTED_STORE_KEY = 'yapify-selected-store-id';

/**
 * Lee el id de tienda persistido.
 *
 * @returns {Number} id válido, o `0` si no hay nada usable guardado.
 */
export function readSelectedStoreId() {
  try {
    const raw = localStorage.getItem(SELECTED_STORE_KEY);
    if (!raw) return 0;
    const id = parseInt(raw, 10);
    return Number.isFinite(id) && id > 0 ? id : 0;
  } catch {
    return 0;
  }
}

/**
 * Persiste el id de tienda seleccionada y actualiza el espejo volátil.
 *
 * @param {Number|String} id
 */
export function saveSelectedStoreId(id) {
  window.__yapifySelectedStoreId = id;
  try {
    localStorage.setItem(SELECTED_STORE_KEY, String(id));
  } catch {
    /* localStorage bloqueado — no fatal */
  }
}

/**
 * Borra el id de tienda seleccionada (salir del modo tienda, crear una
 * tienda nueva, logout). Deja también el espejo volátil en `null` para que
 * la feature de admin no resucite el id ya borrado.
 */
export function clearSelectedStoreId() {
  window.__yapifySelectedStoreId = null;
  try {
    localStorage.removeItem(SELECTED_STORE_KEY);
  } catch {
    /* localStorage bloqueado — no fatal */
  }
}
