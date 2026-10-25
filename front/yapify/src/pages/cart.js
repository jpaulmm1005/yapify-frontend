import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureCartPe } from 'yapify-feature-cart-pe';
import {
  A_cartViewed,
  A_cartItemRemoved,
  A_checkoutStarted,
  A_orderPaid,
} from '../shell/analytics/fingerprints/index.js';

if (!customElements.get(YapifyFeatureCartPe.is)) {
  customElements.define(YapifyFeatureCartPe.is, YapifyFeatureCartPe);
}

export default (CONFIG) => ({
  hash: 'cart',
  route: '/cart',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeatureCartPe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          in: {
            cart_change: { bind: 'setCart' },
          },
          out: {
            cart_back: {
              bind: 'yapify-feature-cart-pe-go-back',
              backStep: true,
            },
            cart_explore: {
              bind: 'yapify-feature-cart-pe-explore',
              link: { page: 'stores' },
            },
            cart_viewed: {
              bind: 'yapify-feature-cart-pe-viewed',
              analytics: A_cartViewed,
              skipBus: true,
            },
            cart_item_removed: {
              bind: 'yapify-feature-cart-pe-item-removed',
              analytics: A_cartItemRemoved,
              skipBus: true,
            },
            checkout_started: {
              bind: 'yapify-feature-cart-pe-checkout-started',
              analytics: A_checkoutStarted,
              skipBus: true,
            },
            order_paid: {
              bind: 'yapify-feature-cart-pe-order-paid',
              analytics: A_orderPaid,
              skipBus: true,
            },
          },
        },
      },
    },
  ],
});
