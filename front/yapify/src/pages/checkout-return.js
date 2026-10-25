import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureCartPe } from 'yapify-feature-cart-pe';

if (!customElements.get(YapifyFeatureCartPe.is)) {
  customElements.define(YapifyFeatureCartPe.is, YapifyFeatureCartPe);
}

export default (CONFIG) => ({
  hash: 'checkoutReturn',
  route: '/checkout/return',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeatureCartPe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
        returnMode: true,
        yapiConnections: {
          out: {
            checkout_return_back: {
              bind: 'yapify-feature-cart-pe-go-back',
              link: { page: 'stores' },
            },
          },
        },
      },
    },
  ],
});
