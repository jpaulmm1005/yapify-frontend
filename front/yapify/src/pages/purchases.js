import '../shell/polyfills/scoped-registry.js';
import { YapifyFeaturePurchasesPe } from 'yapify-feature-purchases-pe';

if (!customElements.get(YapifyFeaturePurchasesPe.is)) {
  customElements.define(YapifyFeaturePurchasesPe.is, YapifyFeaturePurchasesPe);
}

export default (CONFIG) => ({
  hash: 'purchases',
  route: '/purchases',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeaturePurchasesPe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          in: {
            // Tiempo real: un pedido cambió de estado (pago confirmado por el
            // webhook, retiro validado, reembolso, liberado por abandono).
            orders_changed: { bind: 'invalidate', signal: true },
          },
        },
      },
    },
  ],
});
