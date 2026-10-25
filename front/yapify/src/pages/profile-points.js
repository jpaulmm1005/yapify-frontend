import '../shell/polyfills/scoped-registry.js';
import { YapifyFeaturePointsWalletPe } from 'yapify-feature-points-wallet-pe';

if (!customElements.get(YapifyFeaturePointsWalletPe.is)) {
  customElements.define(YapifyFeaturePointsWalletPe.is, YapifyFeaturePointsWalletPe);
}

export default (CONFIG) => ({
  hash: 'profile-points',
  route: '/profile/points',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeaturePointsWalletPe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          in: {
            // Emitted by `my-store.js` when a QR scan grants points, so the
            // balance and the movements list are refetched instead of showing
            // the pre-grant snapshot. `signal` so it lands even while this page
            // sits hidden in the back-stack, and does not re-fire on revive.
            points_wallet_invalidate: { bind: 'invalidate', signal: true },
            // Realtime: the balance changed on the server (QR grant, purchase,
            // redemption, expiration), wherever it was triggered from.
            points_changed: { bind: 'invalidate', signal: true },
          },
          out: {
            points_wallet_back: {
              bind: 'yapify-feature-points-wallet-pe-back',
              link: { page: 'profile' },
            },
          },
        },
      },
    },
  ],
});
