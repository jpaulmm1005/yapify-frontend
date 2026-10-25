import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureDashboardPe } from 'yapify-feature-dashboard-pe';
import {
  A_dashboardViewed,
  A_itemImpression,
  A_itemClicked,
  A_dashboardRewardRedeemRequested,
  A_dashboardRewardRedeemed,
  A_dashboardRewardRedeemFailed,
  A_eventSubscribed,
} from '../shell/analytics/fingerprints/index.js';

if (!customElements.get(YapifyFeatureDashboardPe.is)) {
  customElements.define(YapifyFeatureDashboardPe.is, YapifyFeatureDashboardPe);
}

export default (CONFIG) => ({
  hash: 'dashboard',
  route: '/dashboard',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeatureDashboardPe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          in: {
            notifications_unread_changed: { bind: 'setUnreadCount' },
            store_followed: { bind: 'invalidate', signal: true },
            store_unfollowed: { bind: 'invalidate', signal: true },
            // Tiempo real (`shell/realtime/realtime-coordinator.js`): cambió el
            // saldo en alguna tienda, o el stream se reconectó y hay que
            // recuperar el contador de la campana.
            points_changed: { bind: 'refreshPointsBalances', signal: true },
            notifications_resync: { bind: 'refreshUnreadCount', signal: true },
            // Un push recibido con la app abierta invalida el resumen: las
            // transaccionales (`points_awarded`, `order_paid`,
            // `reward_redeemed`) cambian justo lo que el dashboard muestra.
            // El badge de la campana NO se recalcula por acá — se actualiza por
            // `notifications_unread_changed`, que `push-notice.js` re-emite.
            push_notification_received: { bind: 'invalidate', signal: true },
          },
          out: {
            dashboard_go_notifications: {
              bind: 'yapify-feature-dashboard-pe-go-notifications',
              link: { page: 'notifications' },
            },
            dashboard_go_explore_stores: {
              bind: 'yapify-feature-dashboard-pe-go-explore-stores',
              link: { page: 'stores' },
            },
            dashboard_go_followed_stores: {
              bind: 'yapify-feature-dashboard-pe-go-followed-stores',
              link: { page: 'followedStores' },
            },
            // Acción del toast de confirmación al inscribirse a un evento:
            // el aviso dice dónde verlo y además lleva.
            dashboard_go_my_events: {
              bind: 'yapify-feature-dashboard-pe-go-my-events',
              link: { page: 'myEvents' },
            },
            dashboard_go_store: {
              bind: 'yapify-feature-dashboard-pe-go-store',
              link: {
                page: 'store',
                params: { slug: 'slug' },
              },
            },
            dashboard_go_kind_list: {
              bind: 'yapify-feature-dashboard-pe-go-kind-list',
              link: {
                page: 'kind',
                params: { kind: 'kind' },
              },
            },
            dashboard_go_item_detail: {
              bind: 'yapify-feature-dashboard-pe-go-item-detail',
              link: {
                page: 'item',
                params: { kind: 'kind', itemId: 'item.id' },
              },
            },
            dashboard_add_to_cart: {
              bind: 'yapify-feature-dashboard-pe-add-to-cart',
            },
            dashboard_viewed: {
              bind: 'yapify-feature-dashboard-pe-viewed',
              analytics: A_dashboardViewed,
              skipBus: true,
            },
            item_impression: {
              bind: 'impression',
              analytics: A_itemImpression,
              skipBus: true,
            },
            dashboard_item_clicked: {
              bind: 'yapify-feature-dashboard-pe-item-clicked',
              analytics: A_itemClicked,
              skipBus: true,
            },
            // The redeem intent is dispatched by the For You card itself and
            // bubbles up to the root; the root never re-emits it.
            foryou_redeem_requested: {
              bind: 'dashboard-foryou-card-redeem-request',
              analytics: A_dashboardRewardRedeemRequested,
              skipBus: true,
            },
            // The confirmation comes from the orchestrator DM, so the event
            // carries its `-dm-` namespace — same as the failure entry below.
            dashboard_reward_redeemed: {
              bind: 'yapify-feature-dashboard-pe-dm-reward-redeemed',
              analytics: A_dashboardRewardRedeemed,
              skipBus: true,
            },
            dashboard_reward_redeem_failed: {
              bind: 'yapify-feature-dashboard-pe-dm-error',
              analytics: A_dashboardRewardRedeemFailed,
              skipBus: true,
            },
            event_subscribed: {
              bind: 'event-subscribed',
              analytics: A_eventSubscribed,
              skipBus: true,
            },
          },
        },
      },
    },
  ],
});
