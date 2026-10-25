// El polyfill de scoped custom elements DEBE cargarse antes que CUALQUIER
// custom element. Si un componente corre customElements.define con el registro
// nativo (antes de que el polyfill lo parchee), su clase nunca entra al mapa
// interno del polyfill y al usarla en un scoped registry lanza
// "Illegal constructor (... must be registered with global customElements registry)".
// Por eso va en la PRIMERA línea del entry, antes de los componentes de abajo.
import './shell/polyfills/scoped-registry.js';

import 'yapify-components/src/yapify-bottom-nav.js';
import 'yapify-components/src/yapify-cart-fab.js';

import { initConfig } from './shell/config/app-config.js';
import { nativeBridge } from './shell/bridge/native-bridge.js';
import { appRouter } from './shell/router/app-router.js';
import { yapiBus } from './shell/event-bus/yapi-bus.js';
import { initGlobalTheme } from './shell/theme/global-theme.js';
import { initGlobalLanguage } from './shell/i18n/global-language.js';
import { fetchCached, invalidateCache } from './shell/util/fetch-cache.js';
import { authedFetch, setApiBaseUrl } from './shell/util/authed-fetch.js';
import { initAnalytics, identifyUser } from './shell/analytics/index.js';
import { setupPageviewTracker } from './shell/analytics/route-signal.js';
import { buildPersonProps } from './shell/analytics/person-properties.js';
import { initPush } from './shell/notifications/push-driver.js';
import { initNativePush } from './shell/notifications/native-push-driver.js';
import { setupPushNoticeCoordinator } from './shell/notifications/push-notice.js';
import { setupRealtimeCoordinator, startRealtime } from './shell/realtime/realtime-coordinator.js';
import { globalUser, clearSession } from './shell/session/session-store.js';
import { getAccessToken } from './shell/session/token-store.js';
import { setupSessionCoordinator } from './shell/session/session-coordinator.js';
import { setupNavigationCoordinator } from './shell/navigation/navigation-coordinator.js';
import { readSelectedStoreId, clearSelectedStoreId } from './shell/session/selected-store.js';
import { setupListInvalidationBridge } from './shell/wiring/list-invalidation-bridge.js';
import { initNativeCheckout } from './shell/payments/native-checkout.js';
import './shell/cart-service.js';

/**
 * Arranque en modo tienda tras un cierre en frío.
 *
 * El modo tienda no vive en ningún estado propio: se deduce del hash. En el
 * navegador `#/my-store` sobrevive un F5 porque lo guarda el navegador; en el
 * teléfono, al cerrar la app se mata el WebView y `index.html` vuelve sin
 * hash, así que `appRouter.start()` cae en la ruta por defecto (`login`), el
 * guard ve sesión y rebota a `/dashboard` — el dueño acaba en modo usuario sin
 * haber pedido salir. Como la tienda seleccionada SÍ se persiste, y solo se
 * guarda al entrar en modo tienda (se borra en "Volver a usuario", al crear
 * tienda nueva, al fallar la resolución y en el logout), su presencia es
 * exactamente la señal de "estaba en modo tienda".
 *
 * Solo actúa con la URL sin destino: hash vacío Y sin path de ruta (que
 * `_redirectPathToHash` convertiría en hash). Cualquier enlace directo manda.
 *
 * Se llama ANTES de `appRouter.start()`, y con `replaceState` para no disparar
 * un `hashchange` extra: el router lee `location.hash` al arrancar y navega
 * una sola vez.
 *
 * @param {String|null} uid - uid persistido, o `null` si no hay sesión válida.
 */
function restoreStoreModeOnColdStart(uid) {
  if (!uid) return;
  const hash = location.hash.replace('#', '');
  if (hash && hash !== '/') return;
  const path = location.pathname;
  if (path && path !== '/' && path !== '/index.html') return;
  if (!readSelectedStoreId()) return;
  history.replaceState(null, '', `${path || '/'}${location.search}#/my-store`);
}

/**
 * Shell boot — pure orchestrator. Loads config, initializes the analytics
 * SDK and the native bridge, restores the persisted session (if any),
 * wires the coordinators that own every cross-feature bus channel, and
 * starts the router. No feature-specific logic lives here.
 */
async function boot() {
  initGlobalTheme();
  initGlobalLanguage();
  const config = await initConfig();

  setApiBaseUrl(config.apiBaseUrl);
  window.__yapifyFetch = authedFetch;
  window.__yapifyFetchCached = fetchCached;
  window.__yapifyInvalidateCache = invalidateCache;
  // Publica __yapifyOpenCheckout ANTES del primer render: el carrito lo
  // consulta al recibir el init_point y, si no está, redirige el WebView a
  // Mercado Pago (que es justo lo que este cambio evita en nativo). De paso
  // publica __yapifyNative (la bandera con la que el carrito pide la back_url
  // nativa) y engancha el deep link `yapify://checkout/return`.
  initNativeCheckout();

  let persistedUid = globalUser.dbUser?.uid;
  if (persistedUid && !getAccessToken()) {
    clearSession();
    clearSelectedStoreId();
    persistedUid = null;
  }

  restoreStoreModeOnColdStart(persistedUid);

  setupRealtimeCoordinator({ apiBaseUrl: config.apiBaseUrl });
  setupSessionCoordinator({ config });
  setupNavigationCoordinator();
  setupListInvalidationBridge();
  setupPushNoticeCoordinator();
  setupPageviewTracker();

  yapiBus.emit('cart_set_user', persistedUid ?? null);

  // El router NO espera a analytics, push ni al bridge nativo. Son init de
  // red / idle-bound: PostHog difiere su carga a requestIdleCallback + un
  // import() dinámico que un bloqueador de rastreo o la optimización on-the-fly
  // de Vite pueden colgar o demorar. Si quedaran en el camino crítico, un
  // tropiezo ahí deja la UI en blanco (solo el fondo del tema, ya pintado
  // arriba). Arrancamos el router primero — la UI SIEMPRE renderiza — y todo
  // lo best-effort corre detrás sin bloquear el primer paint.
  appRouter.start();

  nativeBridge.init().catch(() => { /* silent — setup nativo, no crítico */ });

  initAnalytics({
    key: config.posthogKey,
    host: config.posthogHost,
    debug: config.env === 'development',
  })
    .then(() => {
      if (persistedUid) identifyUser(persistedUid, buildPersonProps(globalUser.dbUser));
    })
    .catch(() => { /* silent — analytics es best-effort */ });

  if (persistedUid) {
    startRealtime();
    initPush({
      firebaseConfig: config.firebaseConfig,
      vapidKey: config.fcmVapidKey,
      apiBaseUrl: config.apiBaseUrl,
      userUid: persistedUid,
    }).catch(() => { /* silent */ });
    initNativePush({
      apiBaseUrl: config.apiBaseUrl,
      userUid: persistedUid,
    }).catch(() => { /* silent */ });
  }
}

boot();
