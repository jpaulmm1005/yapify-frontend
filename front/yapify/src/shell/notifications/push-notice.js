import 'yapify-components/src/yapify-toast.js';
import { yapiBus } from '../event-bus/yapi-bus.js';
import { createSeenIds } from './seen-ids.js';

/**
 * Qué pasa cuando llega un push CON LA APP ABIERTA.
 *
 * Los dos drivers (web y nativo) terminan acá. Cada uno sabe cómo su
 * plataforma le entrega el push; ninguno de los dos decide qué se ve ni a
 * quién hay que avisar — eso vive en este módulo para que web y nativo se
 * comporten igual.
 *
 * El flujo tiene dos mitades:
 *
 *   1. `emitPushReceived()` — normaliza el payload y lo publica en el canal de
 *      bus `push_notification_received`. Los descriptores de página se enganchan
 *      con `yapiConnections.in` (`src/pages/notifications.js`,
 *      `src/pages/dashboard.js`), así que la bandeja se refresca y el resumen
 *      del dashboard se invalida aunque esas pantallas estén escondidas en el
 *      back-stack del router.
 *
 *   2. `setupPushNoticeCoordinator()` — se suscribe una vez en el boot y decide
 *      si además hay que avisar al usuario con un toast, o si eso sería ruido.
 *
 * Por qué un toast y no una notificación del sistema: en nativo la app está en
 * primer plano por definición (Capacitor solo dispara `pushNotificationReceived`
 * en ese caso) y el shell no tiene `@capacitor/local-notifications`; en web,
 * `onMessage` solo corre cuando hay una pestaña visible. En ambos casos el
 * usuario está mirando la app, y una notificación del SO encima de la pantalla
 * que ya está viendo es justo el ruido que queremos evitar.
 */

/** Canal de bus donde se publica cada push que llega con la app abierta. */
export const PUSH_RECEIVED_CHANNEL = 'push_notification_received';

/** Cuánto dura el toast en pantalla (ms). */
const NOTICE_DURATION = 5000;

/**
 * Cuánto se recuerda un aviso ya atendido. El mismo aviso puede llegar dos
 * veces con la app abierta: por el stream de tiempo real y por el push de
 * Firebase. La segunda copia, con el mismo `notification_id`, se descarta.
 */
const SEEN_TTL_MS = 10 * 60 * 1000;

const _seen = createSeenIds(SEEN_TTL_MS);

/** La bandeja: estando acá cualquier cartel sobra, la lista se refresca sola. */
const INBOX_ROUTE = '/notifications';

let _wired = false;
let _toastEl = null;

/**
 * Ruta actual del router (hash-based), normalizada a `/algo`.
 *
 * @returns {String}
 */
function currentRoute() {
  const hash = String(window.location.hash || '').replace(/^#/, '');
  return hash || '/';
}

/**
 * Traduce el `clickAction` del backend a la ruta del router a la que apunta.
 * Devuelve `''` cuando el destino es la raíz (las campañas mandan
 * `/?campaign=12`, que no identifica ninguna pantalla concreta).
 *
 * @param {String} clickAction
 * @returns {String}
 */
export function routeOfClickAction(clickAction) {
  const raw = typeof clickAction === 'string' ? clickAction.trim() : '';
  if (!raw) return '';
  let url;
  try {
    url = new URL(raw, window.location.origin);
  } catch {
    return '';
  }
  if (url.hash) return url.hash.replace(/^#/, '');
  if (url.pathname === '/' || url.pathname === '') return '';
  return url.pathname;
}

/**
 * ¿Vale la pena interrumpir al usuario con un cartel?
 *
 * No, en dos casos:
 *   - está en la bandeja de notificaciones: la lista se refresca en el sitio y
 *     el aviso nuevo aparece solo, taparlo con un toast es redundante;
 *   - está justo en la pantalla a la que apunta el push (le sumaron puntos y
 *     está en `/profile/points`, le compraron y está en `/my-store`): la
 *     pantalla se invalida y el dato entra solo.
 *
 * @param {String} targetRoute - Ruta destino del push, o `''` si no apunta a una.
 * @returns {Boolean}
 */
function shouldAnnounce(targetRoute) {
  const route = currentRoute();
  if (route === INBOX_ROUTE) return false;
  if (!targetRoute || targetRoute === '/') return true;
  return !(route === targetRoute || route.startsWith(`${targetRoute}/`));
}

/**
 * Monta (una sola vez) el `yapify-toast` del shell en la zona transaccional.
 * La zona ya existe en `index.html` reservada para modales y toasts.
 *
 * @returns {HTMLElement|null}
 */
function ensureToast() {
  if (_toastEl && _toastEl.isConnected) return _toastEl;
  const zone = document.querySelector('[data-zone="app__transactional"]') || document.body;
  if (!zone) return null;
  _toastEl = document.createElement('yapify-toast');
  _toastEl.position = 'top';
  zone.appendChild(_toastEl);
  return _toastEl;
}

/**
 * Publica en el bus un push recibido con la app abierta.
 *
 * Llamado por los dos drivers. `detail.osNotificationShown` le dice al
 * coordinador que la plataforma YA avisó al usuario por su cuenta (el driver
 * web lo hace cuando la pestaña está visible pero sin foco), para que no se
 * sume un toast encima del aviso del sistema.
 *
 * También lo llama el coordinador de tiempo real (`platform: 'sse'`). Si el
 * `notification_id` ya se atendió por el otro camino, no se publica nada.
 *
 * @param {Object} input
 * @param {String} [input.title] - Título del push.
 * @param {String} [input.body] - Cuerpo del push.
 * @param {Object} [input.data] - Data bag del push (`clickAction`, `campaign_id`, `notification_id`, …).
 * @param {String} [input.platform] - 'web' | 'android' | 'ios' | 'sse'.
 * @param {Boolean} [input.osNotificationShown] - Si ya se mostró aviso del SO.
 * @param {Boolean} [input.silent] - Actualizar contador y bandeja sin mostrar el cartel (tienda silenciada).
 * @returns {void}
 */
export function emitPushReceived({ title, body, data, platform, osNotificationShown, silent } = {}) {
  const bag = data || {};
  const notificationId = bag.notification_id != null ? String(bag.notification_id) : '';
  if (notificationId && _seen.has(notificationId)) return;
  _seen.add(notificationId);
  yapiBus.emit(PUSH_RECEIVED_CHANNEL, {
    title: title || '',
    body: body || '',
    data: bag,
    platform: platform || 'web',
    clickAction: bag.clickAction || bag.click_action || '',
    campaignId: bag.campaign_id ?? null,
    notificationType: bag.notification_type ?? null,
    notificationId,
    osNotificationShown: Boolean(osNotificationShown),
    silent: Boolean(silent),
    receivedAt: Date.now(),
  });
}

/**
 * Suscribe el coordinador que traduce un push recibido en aviso al usuario.
 *
 * Se llama UNA vez desde `main.js`. Usa `onRaw` a propósito: el canal es una
 * señal de un solo disparo, y `on()` reproduce el último valor cacheado al
 * suscribirse — con eso, un re-setup volvería a lanzar el toast de un push
 * viejo.
 *
 * @returns {void}
 */
export function setupPushNoticeCoordinator() {
  if (_wired) return;
  _wired = true;

  yapiBus.onRaw(PUSH_RECEIVED_CHANNEL, (event) => {
    const detail = event.detail ?? {};
    const targetRoute = routeOfClickAction(detail.clickAction);
    const announce = !detail.osNotificationShown && shouldAnnounce(targetRoute);

    if (announce) {
      // Tienda silenciada: el aviso existe (y el contador sube), pero sin
      // cartel — la misma regla que el backend aplica al push.
      if (!detail.silent) {
        const message = [detail.title, detail.body].filter(Boolean).join(' — ') || detail.body;
        if (message) {
          ensureToast()?.show(message, { variant: 'info', duration: NOTICE_DURATION });
        }
      }
      // Bump optimista del contador: la campana vive en el dashboard y su
      // fuente es el canal `notifications_unread_changed`. Si la bandeja no
      // está montada (nunca se visitó en esta sesión) nadie va a recalcular el
      // número, y el badge se quedaría igual pese al push. Sumamos uno sobre el
      // último valor cacheado; en cuanto la bandeja carga de verdad re-emite el
      // conteo autoritativo y corrige cualquier deriva.
      //
      // Solo cuando anunciamos: si el usuario está en la bandeja, la lista se
      // refresca y emite el número real — bumpear ahí sería un parpadeo inútil.
      const cached = yapiBus.peek('notifications_unread_changed');
      const count = Number(cached?.count);
      yapiBus.emit('notifications_unread_changed', {
        count: (Number.isFinite(count) ? count : 0) + 1,
      });
    }
  });
}
