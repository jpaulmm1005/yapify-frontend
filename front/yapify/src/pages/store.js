import '../shell/polyfills/scoped-registry.js';
import { YapifyFeaturePublicStorePe } from 'yapify-feature-public-store-pe';
import {
  A_itemViewed,
  A_timeOnItem,
  A_publicStoreTabSwitched,
  A_storeFollowed,
  A_storeUnfollowed,
  A_storeNotificationsToggled,
  A_cartItemAdded,
  A_itemImpression,
  A_itemClicked,
  A_couponCodeCopied,
  A_eventSubscribed,
  A_rewardRedeemed,
} from '../shell/analytics/fingerprints/index.js';

if (!customElements.get(YapifyFeaturePublicStorePe.is)) {
  customElements.define(YapifyFeaturePublicStorePe.is, YapifyFeaturePublicStorePe);
}

export default (CONFIG) => ({
  hash: 'store',
  route: '/store',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeaturePublicStorePe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          in: {
            __bridge_subroute_store: { bind: 'handleSubrouteChange' },
            // Tiempo real: la tienda escaneó el QR (o cambió el saldo por otra vía).
            points_changed: { bind: 'refreshPoints', signal: true },
          },
          out: {
            public_store_back: {
              bind: 'yapify-feature-public-store-pe-back',
              backStep: true,
            },
            // Acción del toast de confirmación al inscribirse a un evento:
            // el aviso dice dónde verlo y además lleva.
            public_store_go_my_events: {
              bind: 'yapify-feature-public-store-pe-go-my-events',
              link: { page: 'myEvents' },
            },
            // Tarjeta de evento tocada → detalle del evento.
            public_store_go_item_detail: {
              bind: 'yapify-feature-public-store-pe-go-item-detail',
              link: {
                page: 'item',
                params: { kind: 'kind', itemId: 'item.id' },
              },
            },
            // Item-level (la tienda misma)
            item_viewed: {
              bind: 'item-viewed',
              analytics: A_itemViewed,
              skipBus: true,
            },
            time_on_item: {
              bind: 'time-on-item',
              analytics: A_timeOnItem,
              skipBus: true,
            },
            // Cards internas (productos, canjes, cupones, eventos, flash sales)
            item_impression: {
              bind: 'impression',
              analytics: A_itemImpression,
              skipBus: true,
            },
            item_clicked: {
              bind: 'item-clicked',
              analytics: A_itemClicked,
              skipBus: true,
            },
            public_store_product_add: {
              bind: 'public-store-product-add',
            },
            cart_item_added: {
              bind: 'public-store-product-add',
              analytics: A_cartItemAdded,
              skipBus: true,
            },
            // Engagement con la tienda
            // NOT skipBus: these propagate on the bus so other mounted features
            // (explore list, etc.) can sync their per-store follow state live —
            // fixes the "follow in /store not reflected back in /stores" bug.
            store_followed: {
              bind: 'store-followed',
              analytics: A_storeFollowed,
            },
            store_unfollowed: {
              bind: 'store-unfollowed',
              analytics: A_storeUnfollowed,
            },
            public_store_tab_switched: {
              bind: 'tab-switched',
              analytics: A_publicStoreTabSwitched,
              skipBus: true,
            },
            store_notifications_toggled: {
              bind: 'store-notifications-toggled',
              analytics: A_storeNotificationsToggled,
              skipBus: true,
            },
            // Conversion signals (loyalty / engagement con items)
            coupon_code_copied: {
              bind: 'coupon-copied',
              analytics: A_couponCodeCopied,
              skipBus: true,
            },
            event_subscribed: {
              bind: 'event-subscribed',
              analytics: A_eventSubscribed,
              skipBus: true,
            },
            reward_redeemed: {
              bind: 'reward-redeemed',
              analytics: A_rewardRedeemed,
              skipBus: true,
            },
          },
        },
      },
    },
  ],
});
