import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureNotificationsPe } from 'yapify-feature-notifications-pe';

if (!customElements.get(YapifyFeatureNotificationsPe.is)) {
  customElements.define(YapifyFeatureNotificationsPe.is, YapifyFeatureNotificationsPe);
}

export default (CONFIG) => ({
  hash: 'notifications',
  route: '/notifications',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeatureNotificationsPe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          in: {
            // Llegó un push con la app abierta (`shell/notifications/push-notice.js`).
            // La bandeja tiene que refetchear: la fila que describe ese push ya
            // existe en el backend, pero esta lista se cargó antes. `signal`
            // para que llegue aunque la bandeja esté escondida en el back-stack
            // y para que no se re-dispare cada vez que revive.
            push_notification_received: { bind: 'invalidate', signal: true },
            // El stream de tiempo real se reconectó: pudo llegar algo mientras
            // estaba cortado.
            notifications_resync: { bind: 'invalidate', signal: true },
          },
          out: {
            notifications_back: {
              bind: 'yapify-feature-notifications-pe-back',
              backStep: true,
            },
            // Side-effect navigation handled by navigation-coordinator
            // (sets `__yapifyPublicStoreTab` from `sourceType`).
            notifications_open_source: {
              bind: 'yapify-feature-notifications-pe-open-source',
            },
            notifications_unread_changed: {
              bind: 'yapify-feature-notifications-pe-unread-changed',
            },
          },
        },
      },
    },
  ],
});
