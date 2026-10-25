import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureQrPe } from 'yapify-feature-qr-pe';

if (!customElements.get(YapifyFeatureQrPe.is)) {
  customElements.define(YapifyFeatureQrPe.is, YapifyFeatureQrPe);
}

export default (CONFIG) => ({
  hash: 'qr',
  route: '/qr',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeatureQrPe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
      },
    },
  ],
});
