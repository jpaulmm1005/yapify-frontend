/**
 * Native push notifications driver (Capacitor — Android/iOS).
 *
 * The web driver (`push-driver.js`) uses the Firebase JS SDK + a service worker.
 * Inside a Capacitor WebView that flow does NOT raise the native OS permission
 * dialog (Android 13+ `POST_NOTIFICATIONS`) and never produces a native FCM
 * device token, so pushes never arrive on the installed app. On native we must
 * use the `@capacitor/push-notifications` plugin:
 *
 *   1. request permission (native dialog),
 *   2. `register()` → the `registration` event carries the device FCM token,
 *   3. POST that token to the backend (`/api/users/:uid/fcm-tokens`, platform
 *      'android'|'ios') using the authenticated fetch so it passes the guard,
 *   4. on a notification tap, route to the deep link / notifications inbox.
 *
 * No-op on web — the web build still bundles the plugin (it ships a web stub),
 * but every call is gated behind `Capacitor.isNativePlatform()`.
 *
 * Requires the native side: `@capacitor/push-notifications` synced into the
 * Android project (`npx cap sync android`) + an APK rebuild, and Firebase
 * `google-services.json` already present (it is, for Google sign-in).
 */

import { Capacitor } from '@capacitor/core';
import { emitPushReceived, routeOfClickAction } from './push-notice.js';

let _wired = false;

/**
 * Routes the app to the notification's deep link, or the notifications inbox.
 * The router is hash-based, so a `location.hash` assignment drives navigation.
 *
 * El `clickAction` del backend viene como ruta del router (`/profile/points`,
 * `/my-store`) o, en las campañas, como `/?campaign=12` — que no es una ruta
 * sino la raíz con un query param para la web. `routeOfClickAction()` devuelve
 * `''` en ese segundo caso, y ahí el destino sensato en el teléfono es la
 * bandeja: es donde la campaña quedó listada.
 *
 * @param {Object} data - The push `notification.data` payload.
 * @returns {void}
 */
function navigateFromPush(data) {
  const route = routeOfClickAction(data?.clickAction || data?.click_action);
  window.location.hash = `#${route || '/notifications'}`;
}

/**
 * Registers the device FCM token with the backend through the authenticated
 * fetch (the endpoint is guarded + asserts self). Falls back to plain fetch.
 *
 * @param {String} apiBaseUrl
 * @param {String} userUid
 * @param {String} token - FCM device token from the `registration` event.
 * @param {String} platform - 'android' | 'ios'.
 * @returns {Promise<void>}
 */
async function registerTokenWithBackend(apiBaseUrl, userUid, token, platform) {
  if (!token || !apiBaseUrl || !userUid) return;
  const doFetch = window.__yapifyFetch ?? fetch;
  try {
    const res = await doFetch(`${apiBaseUrl}/api/users/${userUid}/fcm-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        platform,
        user_agent: `capacitor-${platform}`,
      }),
    });
    if (res && !res.ok && res.status !== 204) {
      console.warn('[native-push] backend rejected the token:', res.status);
    } else {
      console.info('[native-push] native FCM token registered');
    }
  } catch (err) {
    console.warn('[native-push] token registration failed:', err);
  }
}

/**
 * Requests native push permission and registers the device token. Call after a
 * successful login (when `userUid` is known). No-op off native.
 *
 * @param {{ apiBaseUrl: String, userUid: String }} opts
 * @returns {Promise<void>}
 */
export async function initNativePush({ apiBaseUrl, userUid }) {
  if (!Capacitor.isNativePlatform()) return;
  if (!apiBaseUrl || !userUid) return;

  const { PushNotifications } = await import('@capacitor/push-notifications');
  const platform = Capacitor.getPlatform();

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') {
    console.info('[native-push] permission not granted:', perm.receive);
    return;
  }

  if (!_wired) {
    _wired = true;
    await PushNotifications.addListener('registration', (token) => {
      registerTokenWithBackend(apiBaseUrl, userUid, token.value, platform);
    });
    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('[native-push] registrationError:', err?.error);
    });

    // El push que llega CON LA APP ABIERTA. En Android, Capacitor no lo manda a
    // la bandeja del sistema cuando la app está en primer plano: lo entrega
    // solo acá. Sin este listener el push se descartaba entero — ni aviso, ni
    // fila en la bandeja, ni contador — y ese es justo el caso típico de esta
    // app: el cliente delante del mostrador, con la app abierta, mientras el
    // dueño le suma puntos.
    //
    // No pintamos notificación del SO (el shell no trae
    // `@capacitor/local-notifications`, y encima sería un cartel del sistema
    // sobre la pantalla que el usuario ya está mirando). El aviso in-app y el
    // refresco de bandeja/contador los resuelve `push-notice.js`, que es el
    // mismo camino que usa el driver de web.
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      emitPushReceived({
        title: notification?.title,
        body: notification?.body,
        data: notification?.data ?? {},
        platform,
      });
    });

    // El tap sobre la notificación de la bandeja. No se solapa con el listener
    // de arriba: Android dispara `pushNotificationReceived` solo en primer
    // plano (donde no hay notificación que tocar) y `pushNotificationActionPerformed`
    // solo al tocar una que ya estaba en la bandeja.
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      navigateFromPush(action?.notification?.data ?? {});
    });
  }

  await PushNotifications.register();
}

/**
 * Removes this device's native push token from the backend on logout.
 *
 * @param {String} apiBaseUrl
 * @returns {Promise<void>}
 */
export async function teardownNativePush(apiBaseUrl) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await import('@capacitor/push-notifications').then(({ PushNotifications }) =>
      PushNotifications.removeAllListeners(),
    );
    _wired = false;
  } catch { /* noop — best-effort */ }
  void apiBaseUrl;
}
