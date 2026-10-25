/* eslint-env serviceworker */
/* global importScripts firebase clients */

/**
 * Service Worker de Firebase Cloud Messaging (Web).
 *
 * Tiene que estar en `/firebase-messaging-sw.js` (raíz pública del shell) para
 * que el SDK Firebase Messaging del cliente lo encuentre automáticamente. Vite
 * sirve `public/` en la raíz, así que esta ubicación es correcta.
 *
 * Recibe push notifications cuando la app está cerrada o en background.
 * Cuando la app está abierta (foreground), el listener `onMessage` del cliente
 * en `push-driver.js` se ocupa.
 *
 * Los firebaseConfig que están abajo son **datos públicos** (igual que los de
 * Auth) — no son secretos. Coincide con el `firebaseConfig` de
 * `src/shell/config/app-config.js`. Si lo cambian allá, copien acá también.
 *
 * ── ORDEN DE REGISTRO: no muevas el `notificationclick` de abajo ──
 *
 * `firebase.messaging()` registra sus PROPIOS listeners de `push`,
 * `pushsubscriptionchange` y `notificationclick`. El suyo de `notificationclick`
 * arranca con un `stopImmediatePropagation()` cuando la notificación viene
 * envuelta en `FCM_MSG` (o sea: toda notificación que el SDK pintó solo, que
 * son todas las de background). Los listeners corren en orden de registro, así
 * que si registramos el nuestro DESPUÉS de `firebase.messaging()`, el de
 * Firebase corre primero, corta la propagación y el nuestro no se ejecuta nunca
 * en background — el destino lo terminaba resolviendo Firebase con
 * `webpush.fcmOptions.link`, que el backend llena con el clickAction crudo
 * (`/profile/points`). Ese path no existe como URL real: el router del shell es
 * por hash, así que abría una pestaña nueva en el fallback del SPA y aterrizaba
 * en la pantalla por defecto.
 *
 * Por eso registramos el nuestro ANTES y cortamos nosotros la propagación: un
 * solo handler decide el destino, para background y para foreground, y no se
 * abren dos ventanas por el mismo push.
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBpRFl6z-cfPnds4C52YEmjROmclh5Bp-Y',
  authDomain: 'yapify-beb54.firebaseapp.com',
  projectId: 'yapify-beb54',
  storageBucket: 'yapify-beb54.firebasestorage.app',
  messagingSenderId: '513281754901',
  appId: '1:513281754901:web:2e9cc18110334ec4accb1c',
});

/**
 * Aplana el `data` de una notificación a un solo objeto.
 *
 * El bag llega en dos formas según quién pintó la notificación:
 *   - la pintó el SDK (background) → `data = { FCM_MSG: { data: {...} } }`
 *   - la pintamos nosotros desde `push-driver.js` (foreground) → `data = {...}`
 *
 * @param {Notification} notification - `event.notification`.
 * @returns {Object} El data bag con las claves del push al primer nivel.
 */
function pushDataOf(notification) {
  const data = (notification && notification.data) || {};
  const inner = (data.FCM_MSG && data.FCM_MSG.data) || {};
  return Object.assign({}, inner, data);
}

/**
 * Resuelve a qué URL del shell tiene que ir un click en la notificación.
 *
 * El backend manda el destino en `data.clickAction`
 * (`libs/common/src/notifications/notifications.service.ts`), y lo escribe como
 * una ruta del router: `/profile/points`, `/my-store`, `/?campaign=12`. El
 * router del shell es por HASH (`src/shell/router/routes.js`), así que una ruta
 * como `/profile/points` hay que servirla como `/#/profile/points` — tal cual
 * como la trata el driver nativo en `navigateFromPush()`.
 *
 * Reglas:
 *   - sin `clickAction` → se mantiene el comportamiento viejo (`/?campaign=X`
 *     si hay campaña, si no la raíz);
 *   - `clickAction` que ya trae hash → se respeta tal cual;
 *   - `clickAction` que apunta a la raíz (`/?campaign=12`) → se usa tal cual,
 *     porque el query param es lo que `consumeCampaignFromUrl()` lee al cargar;
 *   - cualquier otro path → pasa a ser hash, conservando el query en la raíz
 *     (`/tienda/5?focus=points` → `/?focus=points#/tienda/5`);
 *   - otro origen → se descarta y se usa el fallback. El data bag de un push
 *     es input remoto: nunca abrimos una URL externa con él.
 *
 * @param {Object} data - Data bag aplanado por {@link pushDataOf}.
 * @returns {String} URL relativa al origen del shell.
 */
function destinationFor(data) {
  const bag = data || {};
  const campaignId = bag.campaign_id;
  const fallback = campaignId ? `/?campaign=${encodeURIComponent(campaignId)}` : '/';

  const rawAction = bag.clickAction || bag.click_action;
  const raw = typeof rawAction === 'string' ? rawAction.trim() : '';
  if (!raw) return fallback;

  let url;
  try {
    url = new URL(raw, self.location.origin);
  } catch {
    return fallback;
  }
  if (url.origin !== self.location.origin) return fallback;

  if (url.hash) return `${url.pathname}${url.search}${url.hash}`;
  if (url.pathname === '/' || url.pathname === '') return `/${url.search}`;
  return `/${url.search}#${url.pathname}`;
}

/**
 * Click en la notificación → llevar la app al destino que mandó el backend y
 * propagar el `campaign_id` para que el cliente reporte el evento `clicked`.
 *
 * Si ya hay una ventana abierta la reusamos: la enfocamos y la navegamos. Los
 * destinos que solo cambian el hash son una navegación de fragmento — no
 * recargan, así que el estado de los microfrontends montados se conserva. Solo
 * abrimos ventana nueva cuando no hay ninguna.
 */
self.addEventListener('notificationclick', (event) => {
  // Cortamos acá: el handler propio de firebase-messaging-compat es el
  // siguiente en la lista y abriría una SEGUNDA ventana con el clickAction
  // crudo. Ver el bloque "ORDEN DE REGISTRO" arriba.
  event.stopImmediatePropagation();
  event.notification.close();

  const data = pushDataOf(event.notification);
  const campaignId = data.campaign_id;
  const url = destinationFor(data);

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      const own = allClients.filter((c) => c.url.startsWith(self.location.origin));
      // Preferimos la pestaña que el usuario ya está mirando.
      const target = own.find((c) => c.focused) || own.find((c) => c.visibilityState === 'visible') || own[0];

      if (target) {
        // El postMessage va primero: si la navegación termina siendo una
        // recarga completa (cambia el path o el query), el mensaje se pierde y
        // el reporte lo levanta `consumeCampaignFromUrl()` desde la URL. Si es
        // solo cambio de hash, el mensaje es el único camino.
        if (campaignId) {
          target.postMessage({ type: 'campaign-click', campaign_id: campaignId });
        }
        try { await target.focus(); } catch { /* algunos browsers lo bloquean */ }

        let navigated = false;
        if ('navigate' in target) {
          try {
            await target.navigate(url);
            navigated = true;
          } catch { /* clientes no controlados no se dejan navegar */ }
        }
        if (!navigated) {
          // Último recurso: que el cliente se navegue solo. `push-driver.js`
          // escucha este mensaje.
          target.postMessage({ type: 'push-navigate', url, campaign_id: campaignId });
        }
        return;
      }

      await clients.openWindow(url);
    })(),
  );
});

/**
 * Dismiss → idem, propagamos para que el cliente reporte el evento.
 */
self.addEventListener('notificationclose', (event) => {
  const data = pushDataOf(event.notification);
  const campaignId = data.campaign_id;
  if (!campaignId) return;
  // Notificar al cliente vía postMessage si está abierto.
  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of allClients) {
        c.postMessage({ type: 'campaign-dismiss', campaign_id: campaignId });
      }
    })(),
  );
});

// A partir de acá se registran los listeners internos del SDK — todo lo que
// tenga que ganarle en orden va ARRIBA de esta línea.
const messaging = firebase.messaging();

/**
 * Background message handler. Si el server manda payload con `notification`,
 * FCM ya muestra la notificación nativa automáticamente — este handler corre
 * para que podamos reportar `delivered` o agregar lógica custom. No hace falta
 * llamar a `showNotification` cuando el payload trae `notification`: hacerlo
 * pintaría la misma notificación dos veces.
 */
messaging.onBackgroundMessage((payload) => {
  // Hook para futuras métricas: aquí se podría disparar fetch al endpoint
  // /api/campaigns/:id/events con event=delivered. Por ahora no hacemos nada
  // porque `delivered` ya queda en el row de campaign_sends al crearse.
  // eslint-disable-next-line no-console
  console.debug('[fcm-sw] background message:', payload);
});
