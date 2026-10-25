/**
 * Translation table between the realtime stream and the shell bus.
 *
 * Data signals become bus channels that page descriptors wire to feature
 * methods (`yapiConnections.in`). `notification.created` is not here: it
 * goes through `push-notice.js`, the same path a foreground push takes.
 * Payloads keep the backend snake_case (rule 11).
 */

const SIGNAL_CHANNELS = Object.freeze({
  'points.changed': 'points_changed',
  'order.updated': 'orders_changed',
  'redemption.updated': 'redemptions_changed',
});

/** Channels re-emitted with `{ reason: 'resync' }` after the stream reconnects. */
export const RESYNC_CHANNELS = Object.freeze(Object.values(SIGNAL_CHANNELS));

/** Channel that asks the bell and the inbox to re-pull after a reconnect. */
export const NOTIFICATIONS_RESYNC_CHANNEL = 'notifications_resync';

/**
 * Bus channel for a data signal, or `null` for `hello`, `ping` and anything unknown.
 *
 * @param {String} event - Signal name from the stream.
 * @returns {String|null}
 */
export function channelForSignal(event) {
  return SIGNAL_CHANNELS[event] ?? null;
}

/**
 * Shapes a `notification.created` payload as `emitPushReceived()` expects,
 * with the same data-bag keys an FCM push carries so both dedupe on the id.
 *
 * @param {Object} data - Signal payload `{ id, type, store_id, title, body, click_action, silent }`.
 * @returns {Object}
 */
export function toPushNotice(data) {
  return {
    title: data.title,
    body: data.body,
    data: {
      notification_id: data.id != null ? String(data.id) : '',
      notification_type: data.type,
      store_id: data.store_id != null ? String(data.store_id) : '',
      clickAction: data.click_action,
    },
    platform: 'sse',
    silent: data.silent === true,
  };
}
