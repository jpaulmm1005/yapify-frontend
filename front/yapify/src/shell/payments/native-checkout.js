import { appRouter } from '../router/app-router.js';
import { authedFetch } from '../util/authed-fetch.js';

/**
 * Checkout de Mercado Pago FUERA del WebView.
 *
 * Problema que resuelve
 * ---------------------
 * La app es Capacitor con `server.url` apuntando a la web remota, así que
 * navegar el WebView al `init_point` metía Checkout Pro DENTRO de la app. Eso
 * rompía de dos formas reales, vistas en un teléfono:
 *
 *   1. La página de Mercado Pago sirve su propia CSP con nonce +
 *      `strict-dynamic`. Con los puentes que Capacitor inyecta en el WebView,
 *      alguno de sus scripts queda bloqueado y el checkout revienta.
 *   2. Su cabecera se dibujaba bajo el reloj y la batería (mitigado con
 *      `overlaysWebView: false`, pero la pasarela seguía viviendo en la app).
 *
 * Mercado Pago desaconseja explícitamente embeber Checkout Pro en el WebView de
 * otra app. Aquí se abre en el navegador del sistema: Chrome Custom Tabs en
 * Android, `SFSafariViewController` en iOS. Ese navegador es el de verdad —
 * sin puentes inyectados, con su propia barra de estado — así que ambos fallos
 * desaparecen.
 *
 * La vuelta a la app
 * ------------------
 * Al salir al navegador del sistema el WebView deja de ver la navegación, así
 * que la vuelta hay que provocarla. Dos caminos, y el segundo es la red de
 * seguridad del primero:
 *
 * 1. Deep link (camino principal). El `AndroidManifest.xml` declara el esquema
 *    propio `yapify://checkout/return` (VIEW + BROWSABLE + DEFAULT, sin
 *    `autoVerify`: no es un App Link https). El carrito manda
 *    `native: true` al crear la preference, el backend arma la `back_url` con
 *    `&native=1` y su `/api/payments/return` — que sigue confirmando el pago
 *    contra Mercado Pago igual que siempre — redirige a
 *    `yapify://checkout/return?order=N` en vez de a la web. El sistema saca la
 *    app del segundo plano, Capacitor lo entrega como `appUrlOpen` y aquí se
 *    navega a la pantalla de retorno. La preference NUNCA lleva el esquema
 *    propio: la `back_url` de success sigue siendo https del backend, que es lo
 *    que Mercado Pago valida para aceptar `auto_return`.
 *
 * 2. Sondeo (red de seguridad). Si el deep link no dispara — el usuario cierra
 *    la pestaña antes del redirect, Chrome no sigue el redirect al esquema
 *    propio, o el backend no recibió `native=1` porque la app es vieja — queda
 *    el camino de antes:
 *
 *      - Sondear `GET /api/payments/status?order_id=N` mientras el navegador
 *        está abierto. Ese endpoint es el mismo que confirma de forma perezosa
 *        contra Mercado Pago, así que sondearlo no solo lee: también cierra el
 *        pago si el webhook todavía no llegó.
 *      - Al resolverse, intentar `Browser.close()` (funciona en iOS; en Android
 *        es no-op documentado) y llevar la app a `#/checkout/return?order=N`.
 *      - Escuchar `browserFinished` (el usuario cerró la pestaña) y
 *        `appStateChange` (la app vuelve a primer plano) para forzar una
 *        comprobación inmediata en vez de esperar al siguiente tick.
 *
 * Si el usuario NUNCA vuelve a la app, el pedido se confirma igual: el webhook
 * de Mercado Pago y la `back_url` del backend (`/api/payments/return`) escriben
 * el pago por el mismo camino autoritativo, sin participación del cliente.
 * Además el feature del carrito ya persiste el `pendingOrderId` por tienda y
 * reconcilia al montar (`_checkPendingCheckouts`), así que un arranque en frío
 * posterior también limpia el carrito.
 */

/** Cadencia del sondeo mientras la pasarela está abierta. */
const POLL_INTERVAL_MS = 3000;

/** Techo del sondeo: pasado esto se abandona (el webhook sigue su curso). */
const MAX_WATCH_MS = 15 * 60 * 1000;

/**
 * Estados en los que el pago del pedido ya está decidido. `fulfilled` entra
 * porque una orden entregada estuvo pagada antes, y `pending`/`pending_payment`
 * quedan fuera a propósito: son justo el "todavía no se sabe".
 */
const FINAL_STATUSES = new Set(['paid', 'fulfilled', 'cancelled', 'refunded']);

/** Vigilancia activa, o null. Solo puede haber una: un checkout a la vez. */
let watch = null;

/**
 * Prefijo del deep link de vuelta, el mismo que declara el `intent-filter` de
 * `AndroidManifest.xml` y el que arma el backend en `/api/payments/return`.
 */
const RETURN_DEEP_LINK = 'yapify://checkout/return';

/** Evita registrar dos veces el listener de `appUrlOpen`. */
let deepLinkWired = false;

/**
 * Corta la vigilancia en curso (timer + listeners nativos).
 *
 * @returns {void}
 */
function stopWatch() {
  if (!watch) return;
  const current = watch;
  watch = null;
  clearInterval(current.timer);
  for (const handle of current.handles) {
    try { handle.remove(); } catch { /* listener ya retirado */ }
  }
}

/**
 * Lleva la app a la pantalla de retorno del checkout.
 *
 * El router monta las páginas de forma persistente, así que un segundo pago en
 * la misma sesión revivía la instancia anterior sin re-ejecutar su
 * `firstUpdated` — y es ahí donde el carrito arranca el modo retorno. Por eso
 * se tira la ruta antes de navegar: así siempre monta de cero y consulta el
 * estado del pedido correcto.
 *
 * @param {Number} orderId - Pedido cuyo estado debe mostrar la pantalla.
 * @returns {void}
 */
function goToReturnPage(orderId) {
  const target = `#/checkout/return?order=${orderId}`;
  appRouter.dropRoute('checkoutReturn');
  if (window.location.hash === target) {
    // Mismo hash: asignarlo no dispara `hashchange` y el router no se enteraría.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = target;
}

/**
 * Consulta el estado real del pedido una vez y, si ya cerró, lleva la app a la
 * pantalla de retorno (cerrando antes el navegador cuando la plataforma deja).
 *
 * `acceptAnyFinal` distingue quién pregunta, y no es un detalle:
 *
 * - El sondeo periódico corre mientras la pasarela PUEDE seguir abierta, así
 *   que solo reacciona a `paid`. Un `cancelled` intermedio no significa que el
 *   usuario se haya rendido: Mercado Pago deja reintentar con otra tarjeta
 *   dentro del mismo checkout, y la confirmación perezosa del backend toma el
 *   pago más reciente. Saltar a "pago fallido" con el usuario todavía metiendo
 *   datos sería mentirle.
 * - Cuando el usuario ya volvió (cerró la pestaña o la app pasó a primer
 *   plano), cualquier estado definitivo vale: la excursión terminó.
 *
 * Los fallos (red caída mientras paga, 401 transitorio) se tragan a propósito:
 * el siguiente tick reintenta y, en el peor caso, el webhook cierra el pedido
 * sin participación del cliente.
 *
 * @param {Object} state - Vigilancia activa.
 * @param {Boolean} [acceptAnyFinal] - Aceptar cualquier estado definitivo.
 * @returns {Promise<Boolean>} true si se navegó a la pantalla de retorno.
 */
async function pollOnce(state, acceptAnyFinal = false) {
  if (watch !== state || state.busy) return false;
  if (Date.now() > state.deadline) { stopWatch(); return false; }
  state.busy = true;
  try {
    const base = window.__YAPIFY_CONFIG__?.apiBaseUrl ?? '';
    const res = await authedFetch(`${base}/api/payments/status?order_id=${state.orderId}`);
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    const status = String(data?.status ?? '');
    const settled = acceptAnyFinal ? FINAL_STATUSES.has(status) : status === 'paid';
    if (!settled || watch !== state) return false;
    stopWatch();
    try { await state.Browser.close(); } catch { /* no-op en Android */ }
    goToReturnPage(state.orderId);
    return true;
  } catch {
    /* silencioso — reintenta en el siguiente tick */
    return false;
  } finally {
    state.busy = false;
  }
}

/**
 * Arranca la vigilancia del pedido mientras la pasarela está abierta.
 *
 * @param {Object} Browser - Plugin `@capacitor/browser` ya importado.
 * @param {Number} orderId - Pedido en vuelo.
 * @returns {void}
 */
function startWatch(Browser, orderId) {
  stopWatch();
  const state = {
    Browser,
    orderId,
    busy: false,
    backgrounded: false,
    returning: false,
    deadline: Date.now() + MAX_WATCH_MS,
    handles: [],
    timer: 0,
  };
  watch = state;
  state.timer = setInterval(() => { pollOnce(state); }, POLL_INTERVAL_MS);

  const track = (promise) => {
    promise
      .then((handle) => {
        if (watch === state) state.handles.push(handle);
        else try { handle.remove(); } catch { /* ya retirada */ }
      })
      .catch(() => { /* plugin no disponible */ });
  };

  /**
   * El usuario terminó su paso por el navegador. En Android llegan las DOS
   * señales (`browserFinished` y `appStateChange`), así que se coalescen: una
   * sola comprobación final y se suelta la vigilancia pase lo que pase.
   *
   * No se navega a ciegas: si el pedido sigue sin cerrar (se echó atrás), la
   * app se queda en el carrito, que es donde puede reintentar. Mandarlo a una
   * pantalla de "pago fallido" por haber cerrado la pestaña sería inventarse un
   * resultado que el backend no ha dado.
   *
   * @returns {Promise<void>}
   */
  const onUserReturned = async () => {
    if (watch !== state || state.returning) return;
    state.returning = true;
    const navigated = await pollOnce(state, true);
    if (!navigated && watch === state) stopWatch();
  };

  track(Browser.addListener('browserFinished', onUserReturned));

  // La app vuelve a primer plano. En Android el WebView queda en segundo plano
  // mientras la Custom Tab está encima y el sistema puede congelar sus timers,
  // así que este es el disparo fiable. Se exige haber visto antes el paso a
  // segundo plano para no confundir un `isActive: true` de arranque con una
  // vuelta real; en iOS `SFSafariViewController` se presenta DENTRO de la app,
  // que nunca se va a segundo plano, y ahí manda `browserFinished`.
  track(import('@capacitor/app').then(({ App }) =>
    App.addListener('appStateChange', ({ isActive }) => {
      if (watch !== state) return;
      if (!isActive) { state.backgrounded = true; return; }
      if (state.backgrounded) onUserReturned();
    })));
}

/**
 * Abre el checkout de Mercado Pago en el navegador del sistema.
 *
 * Publicado como `window.__yapifyOpenCheckout` — mismo patrón que
 * `window.__yapifyFetch`: el feature del carrito no conoce Capacitor, solo
 * pregunta si el shell sabe abrirlo. Devolver `false` es la señal de que el
 * feature debe redirigir como siempre, y es lo que ocurre SIEMPRE en web.
 *
 * @param {String} url - `init_point` de la preference de Mercado Pago.
 * @param {Object} [options] - Opciones.
 * @param {Number} [options.orderId] - Pedido a reconciliar al volver.
 * @returns {Promise<Boolean>} true si la pasarela se abrió fuera del WebView.
 */
async function openCheckout(url, { orderId } = {}) {
  if (!url) return false;
  let Capacitor;
  try { ({ Capacitor } = await import('@capacitor/core')); } catch { return false; }
  if (!Capacitor.isNativePlatform()) return false;

  let Browser;
  try { ({ Browser } = await import('@capacitor/browser')); } catch { return false; }

  try {
    await Browser.open({ url });
  } catch {
    return false;
  }

  const id = Number(orderId) || 0;
  // Sin id no hay nada que reconciliar, pero la pasarela ya está abierta: se
  // reporta como atendida para no abrirla DOS veces (una fuera y otra dentro).
  if (id) startWatch(Browser, id);
  return true;
}

/**
 * Lee el pedido de un deep link de vuelta del checkout.
 *
 * Se compara el prefijo a mano en vez de con `new URL`: el esquema propio no es
 * uno de los "especiales" del estándar, así que cómo se reparte entre host y
 * path depende del motor. El contrato con el backend es la cadena entera, y eso
 * es lo que se verifica. Mayúsculas al margen: Android normaliza el esquema y
 * el host a minúsculas, pero el path lo deja tal cual.
 *
 * @param {String} rawUrl - URL con la que el sistema despertó la app.
 * @returns {Number} Pedido, o 0 si la URL no es la de vuelta del checkout.
 */
function orderFromDeepLink(rawUrl) {
  const url = String(rawUrl ?? '');
  if (!url.toLowerCase().startsWith(RETURN_DEEP_LINK)) return 0;
  const queryAt = url.indexOf('?');
  if (queryAt === -1) return 0;
  const order = new URLSearchParams(url.slice(queryAt + 1)).get('order');
  return Number(order) || 0;
}

/**
 * Atiende el deep link de vuelta: la app ya está en primer plano, el backend ya
 * confirmó el pago contra Mercado Pago antes de redirigir, así que solo queda
 * soltar la vigilancia y mostrar la pantalla de retorno.
 *
 * Se reusa `stopWatch` + `goToReturnPage` (los mismos que usa el sondeo) a
 * propósito: una sola ruta de navegación. Si el sondeo ya había llegado
 * primero, `watch` es null y `stopWatch` no hace nada; navegar de nuevo al
 * mismo pedido es idempotente porque `goToReturnPage` tira la ruta antes.
 *
 * `Browser.close()` se intenta aunque en Android sea no-op: así en iOS se
 * cierra el `SFSafariViewController`, y en Android la Custom Tab queda detrás
 * de la app — el usuario ya está donde tiene que estar.
 *
 * @param {String} rawUrl - URL con la que el sistema despertó la app.
 * @returns {Promise<void>}
 */
async function handleReturnDeepLink(rawUrl) {
  const orderId = orderFromDeepLink(rawUrl);
  if (!orderId) return;
  stopWatch();
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close();
  } catch { /* plugin ausente o no-op en Android */ }
  goToReturnPage(orderId);
}

/**
 * Publica `window.__yapifyNative` y engancha el deep link de vuelta.
 *
 * La bandera es lo que el carrito consulta para pedirle al backend una
 * `back_url` con `native=1`: el feature no conoce Capacitor, igual que con
 * `__yapifyOpenCheckout`. Solo se publica en nativo — en web queda
 * `undefined` y el backend sigue redirigiendo al front, que es lo correcto.
 *
 * Resolver la plataforma exige un `import()`, así que la bandera aparece un
 * tick después del arranque. No es carrera: el carrito la lee cuando el usuario
 * toca "pagar", mucho después del boot.
 *
 * @returns {Promise<void>}
 */
async function initNativeReturn() {
  let Capacitor;
  try { ({ Capacitor } = await import('@capacitor/core')); } catch { return; }
  if (!Capacitor.isNativePlatform()) return;
  window.__yapifyNative = true;

  if (deepLinkWired) return;
  deepLinkWired = true;
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('appUrlOpen', ({ url }) => { handleReturnDeepLink(url); });
  } catch {
    // Sin @capacitor/app no hay deep link; el sondeo sigue cubriendo la vuelta.
    deepLinkWired = false;
  }
}

/**
 * Publica el hook de checkout nativo y arma la vuelta por deep link.
 * Idempotente.
 *
 * @returns {void}
 */
export function initNativeCheckout() {
  window.__yapifyOpenCheckout = openCheckout;
  initNativeReturn().catch(() => { /* best-effort: queda el sondeo */ });
}
