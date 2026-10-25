/**
 * Push notifications driver — Web Push vía Firebase Cloud Messaging.
 *
 * Responsabilidades:
 *   - Registrar el service worker `firebase-messaging-sw.js` (raíz pública).
 *   - Pedir permiso de notificaciones.
 *   - Obtener el token FCM del dispositivo.
 *   - POST al backend `/api/users/:uid/fcm-tokens` para registrarlo.
 *   - Listener `onMessage` para foreground (cuando la app está abierta).
 *   - Listener de mensajes del SW para reportar clicks/dismisses al backend.
 *
 * Uso desde main.js — después de un login exitoso:
 *   await initPush({ firebaseConfig, vapidKey, apiBaseUrl, userUid });
 *
 * Si el browser no soporta push (ej. Safari iOS sin HTTPS), todo queda en
 * silent no-op — no rompe la app.
 */

import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
  isSupported,
} from 'firebase/messaging';
import { emitPushReceived } from './push-notice.js';

let _initialized = false;
let _apiBaseUrl = '';
let _userUid = '';
let _messaging = null;

/** ¿El navegador soporta Web Push + Service Workers? */
async function envSupported() {
  if (!('serviceWorker' in navigator)) return false;
  if (!('Notification' in window)) return false;
  try { return await isSupported(); } catch { return false; }
}

/**
 * Reporta un evento de campaña al backend (opened | clicked | dismissed).
 * Idempotente — el backend preserva el primer timestamp.
 */
async function reportEvent(campaignId, event) {
  if (!_apiBaseUrl || !_userUid || !campaignId) return;
  try {
    await (window.__yapifyFetch ?? fetch)(`${_apiBaseUrl}/api/campaigns/${campaignId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_uid: _userUid, event }),
      keepalive: true,
    });
  } catch (err) {
    console.warn('[push] reportEvent failed:', err);
  }
}

/**
 * Lee `?campaign=<id>` de la URL al cargar y reporta como `clicked` (lo
 * disparó el SW al abrir la ventana desde la notificación).
 */
function consumeCampaignFromUrl() {
  try {
    const url = new URL(window.location.href);
    const campaignId = url.searchParams.get('campaign');
    if (campaignId) {
      reportEvent(campaignId, 'clicked');
      // Limpiar query param (sin recargar).
      url.searchParams.delete('campaign');
      const newUrl = url.pathname + url.search + url.hash;
      window.history.replaceState({}, '', newUrl);
    }
  } catch { /* noop */ }
}

/**
 * Listener de mensajes del SW para clicks/dismisses cuando la app ya estaba
 * abierta y el SW le hizo postMessage.
 *
 * También atiende `push-navigate`: el SW navega la pestaña él mismo con
 * `WindowClient.navigate()`, pero eso falla en clientes que el SW no controla
 * (y algunos browsers lo bloquean). Cuando eso pasa nos manda el destino acá y
 * navegamos desde el cliente. Es la rama de respaldo — si `navigate()` funcionó,
 * este mensaje no se envía, así que no hay doble navegación.
 */
function attachSwBridge() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg) return;

    if (msg.type === 'push-navigate' && typeof msg.url === 'string') {
      try {
        const target = new URL(msg.url, window.location.origin);
        if (target.origin === window.location.origin) {
          window.location.assign(target.href);
        }
      } catch { /* noop */ }
      return;
    }

    if (!msg.campaign_id) return;
    if (msg.type === 'campaign-click') reportEvent(msg.campaign_id, 'clicked');
    if (msg.type === 'campaign-dismiss') reportEvent(msg.campaign_id, 'dismissed');
  });
}

/**
 * Inicializa Firebase Messaging y registra el SW. No pide permiso todavía.
 * El permiso se pide en `requestAndRegisterToken()`.
 */
async function ensureInit(firebaseConfig) {
  if (_initialized) return _messaging;
  if (!(await envSupported())) {
    console.info('[push] Browser no soporta web push — driver en silent no-op.');
    return null;
  }

  // Reusar la app Firebase ya inicializada por el login si existe (mismo project).
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

  // Registrar el SW manualmente (Firebase también lo hace solo si no se le pasa,
  // pero hacerlo explícito da más control y evita dobles registros).
  let registration;
  try {
    registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
  } catch (err) {
    console.warn('[push] service worker registration failed:', err);
    return null;
  }
  _messaging = getMessaging(app);
  _initialized = true;

  // Foreground messages — si llega un push con la app abierta, FCM no muestra
  // nada por su cuenta: nos lo entrega acá y el aviso lo decidimos nosotros.
  //
  // `onMessage` solo corre cuando hay una pestaña VISIBLE, así que casi siempre
  // el usuario está mirando la app y una notificación del SO encima sobra. Pero
  // "visible" no es "en foco": la pestaña puede estar visible en una ventana que
  // el usuario dejó de fondo mientras trabaja en otra cosa, y ahí el aviso del
  // sistema sí es la única forma de que se entere.
  //
  // De ahí las dos ramas, excluyentes entre sí para que el mismo push no se
  // anuncie dos veces:
  //   - pestaña visible Y con foco  → nada del SO; `push-notice.js` decide si
  //     toca un toast in-app o si sería ruido;
  //   - pestaña sin foco            → notificación del SO (como antes), y le
  //     avisamos al coordinador con `osNotificationShown` para que NO agregue
  //     el toast encima.
  //
  // En las dos, el push se publica en el bus: la bandeja y el contador tienen
  // que enterarse aunque no se muestre ningún cartel.
  onMessage(_messaging, (payload) => {
    console.debug('[push] foreground message:', payload);
    const focused = document.visibilityState === 'visible' && document.hasFocus();
    const data = payload.data || {};
    let osNotificationShown = false;

    if (!focused && registration && payload.notification) {
      const campaignId = data.campaign_id;
      registration.showNotification(payload.notification.title || 'Yapify', {
        body: payload.notification.body || '',
        icon: '/favicon.svg',
        data,
        tag: campaignId ? `campaign-${campaignId}` : undefined,
      });
      osNotificationShown = true;
    }

    emitPushReceived({
      title: payload.notification?.title,
      body: payload.notification?.body,
      data,
      platform: 'web',
      osNotificationShown,
    });
  });

  attachSwBridge();
  consumeCampaignFromUrl();
  return _messaging;
}

/**
 * Pide permiso al user. Devuelve 'granted' | 'denied' | 'default'.
 * No hace nada si ya está respondido.
 */
export async function requestPushPermission() {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * Flujo completo: si el user ya dio permiso, obtiene token y lo registra en
 * el backend. Si no dio permiso, pide. Si lo deniega, queda en no-op.
 *
 * Llamar después del login (cuando sabemos el `userUid`).
 */
export async function initPush({ firebaseConfig, vapidKey, apiBaseUrl, userUid }) {
  if (!firebaseConfig || !vapidKey) return;
  _apiBaseUrl = apiBaseUrl;
  _userUid = userUid;

  const messaging = await ensureInit(firebaseConfig);
  if (!messaging) return;

  const permission = await requestPushPermission();
  if (permission !== 'granted') {
    console.info('[push] permiso de notificaciones:', permission);
    return;
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    let token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
    if (!token) {
      console.warn('[push] FCM returned no token (may be a browser without gms).');
      return;
    }

    // Desync detection: if the Firebase Messaging SDK returned a token that
    // does not match the browser's real PushSubscription, force a reset
    // (deleteToken + getToken). This typically happens when the SW updates,
    // or when the user blocks/unblocks notifs and the FCM/browser records
    // drift apart — resulting in FCM accepting the push but the browser never
    // showing it because it is enrolled under a different subscription.
    const synced = await isTokenSynced(reg, token);
    if (!synced) {
      console.warn('[push] desync detected between SDK token and PushSubscription — regenerating');
      try {
        await deleteToken(messaging);
      } catch (err) {
        console.debug('[push] deleteToken failed during desync recovery', err);
      }
      token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
      if (!token) return;
    }

    await registerTokenWithBackend(token);
  } catch (err) {
    console.warn('[push] getToken failed:', err);
  }
}

/**
 * Compares the `device id` (the part before the `:`) of the FCM token with
 * the one in the PushSubscription endpoint. If they match, the SDK and the
 * browser point to the same real subscription — push is deliverable. If not,
 * there is a desync.
 */
async function isTokenSynced(registration, token) {
  try {
    if (!registration || !token) return false;
    const sub = await registration.pushManager.getSubscription();
    if (!sub || !sub.endpoint) return false;
    const tokenDeviceId = String(token).split(':')[0];
    const endpointMatch = sub.endpoint.match(/\/fcm\/send\/([^:/]+)/);
    const subDeviceId = endpointMatch?.[1] ?? null;
    return Boolean(tokenDeviceId && subDeviceId && tokenDeviceId === subDeviceId);
  } catch {
    return false;
  }
}

async function registerTokenWithBackend(token) {
  if (!_apiBaseUrl || !_userUid) return;
  try {
    const res = await (window.__yapifyFetch ?? fetch)(`${_apiBaseUrl}/api/users/${_userUid}/fcm-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        platform: 'web',
        user_agent: navigator.userAgent.slice(0, 250),
      }),
    });
    if (!res.ok && res.status !== 204) {
      console.warn('[push] backend rejected the token registration:', res.status);
    } else {
      console.info('[push] FCM token registered in backend');
    }
  } catch (err) {
    console.warn('[push] backend token registration failed:', err);
  }
}

/**
 * Llamar al logout para limpiar el token de este device en el backend.
 */
export async function teardownPush(apiBaseUrl) {
  if (!_messaging) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const token = await getToken(_messaging, { serviceWorkerRegistration: reg }).catch(() => null);
    if (token && apiBaseUrl) {
      await (window.__yapifyFetch ?? fetch)(`${apiBaseUrl}/api/users/fcm-tokens/${encodeURIComponent(token)}`, {
        method: 'DELETE',
        keepalive: true,
      });
    }
  } catch { /* noop */ }
}
