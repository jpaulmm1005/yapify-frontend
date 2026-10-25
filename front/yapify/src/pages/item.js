import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureItemDetailPe } from 'yapify-feature-item-detail-pe';
import {
  A_itemViewed,
  A_timeOnItem,
  A_itemOpenedStore,
  A_couponCodeCopied,
  A_cartItemAdded,
  A_rewardRedeemed,
  A_eventSubscribed,
  A_promotionUsed,
} from '../shell/analytics/fingerprints/index.js';

if (!customElements.get(YapifyFeatureItemDetailPe.is)) {
  customElements.define(YapifyFeatureItemDetailPe.is, YapifyFeatureItemDetailPe);
}

/**
 * Parse `#/item/<kind>/<id>` from the current hash.
 * Returns { kind, id } or empty when malformed.
 */
function parseHashSubroute() {
  const hash = (location.hash || '').replace(/^#/, '');
  const m = hash.match(/^\/item\/([a-z-]+)\/(\d+)\/?$/i);
  if (!m) return { kind: '', id: null };
  return { kind: m[1], id: Number(m[2]) };
}

export default (CONFIG) => {
  const { kind, id } = parseHashSubroute();
  // No carry vía window var: el feature fetcha el item por kind+id al backend.
  // Funciona igual en cold reload, navegación interna o deep-link compartido.

  return {
    hash: 'item',
    route: '/item',
    components: [
      {
        zone: 'app__main',
        tag: YapifyFeatureItemDetailPe.is,
        type: 'UI',
        properties: {
          apiBaseUrl: CONFIG.apiBaseUrl,
          kind,
          itemId: id,
          yapiConnections: {
            out: {
              // Navigation: history.back when possible.
              item_back: {
                bind: 'yapify-feature-item-detail-pe-back',
                backStep: true,
              },
              // Side-effect navigation handled by navigation-coordinator
              // (sets `__yapifyPublicStoreTab` before the route changes).
              item_open_store: { bind: 'yapify-feature-item-detail-pe-open-store' },
              // Acción del toast de confirmación al inscribirse a un evento:
              // el aviso dice dónde verlo y además lleva.
              item_go_my_events: {
                bind: 'yapify-feature-item-detail-pe-go-my-events',
                link: { page: 'myEvents' },
              },
              // "Para ti" recommendation tapped → open that item's detail.
              item_go_item: {
                bind: 'yapify-feature-item-detail-pe-go-item',
                link: {
                  page: 'item',
                  params: { kind: 'kind', itemId: 'item.id' },
                },
              },
              // item_opened_store — analytics-only sobre el mismo DOM event
              item_opened_store: {
                bind: 'yapify-feature-item-detail-pe-open-store',
                analytics: A_itemOpenedStore,
                skipBus: true,
              },
              // Cart side-effect via bus (main.js escucha y agrega al carrito).
              // El tracking sale por cart_item_added (canal aparte, skipBus).
              public_store_product_add: {
                bind: 'public-store-product-add',
              },
              // Engagement: view + tiempo en el item con kind dinámico
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
              // Conversion signals por kind específico
              coupon_code_copied: {
                bind: 'coupon-code-copied',
                analytics: A_couponCodeCopied,
                skipBus: true,
              },
              cart_item_added: {
                bind: 'cart-item-added',
                analytics: A_cartItemAdded,
                skipBus: true,
              },
              reward_redeemed: {
                bind: 'reward-redeemed',
                analytics: A_rewardRedeemed,
                skipBus: true,
              },
              event_subscribed: {
                bind: 'event-subscribed',
                analytics: A_eventSubscribed,
                skipBus: true,
              },
              promotion_used: {
                bind: 'promotion-used',
                analytics: A_promotionUsed,
                skipBus: true,
              },
            },
          },
        },
      },
    ],
  };
};
