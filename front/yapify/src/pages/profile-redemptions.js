import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureRedemptionsPe } from 'yapify-feature-redemptions-pe';

if (!customElements.get(YapifyFeatureRedemptionsPe.is)) {
  customElements.define(YapifyFeatureRedemptionsPe.is, YapifyFeatureRedemptionsPe);
}

export default (CONFIG) => ({
  hash: 'profile-redemptions',
  route: '/profile/redemptions',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeatureRedemptionsPe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          in: {
            // Bridge absorbs `window 'yapify:redemption-created'` and emits
            // here with reason='redemption_created'. The feature filters
            // by AFFECTED_BY inside `invalidate(reason)`.
            kind_list_invalidate: { bind: 'invalidate', signal: true },
            // Realtime: a redemption was validated at the counter.
            redemptions_changed: { bind: 'refreshRedemptions', signal: true },
          },
          out: {
            redemptions_back: {
              bind: 'yapify-feature-redemptions-pe-back',
              link: { page: 'profile' },
            },
            redemptions_explore: {
              bind: 'yapify-feature-redemptions-pe-explore',
              link: {
                page: 'kind',
                params: { kind: { literal: 'rewards' } },
              },
            },
          },
        },
      },
    },
  ],
});
