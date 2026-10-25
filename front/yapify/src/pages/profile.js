import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureProfilePe } from 'yapify-feature-profile-pe';

if (!customElements.get(YapifyFeatureProfilePe.is)) {
  customElements.define(YapifyFeatureProfilePe.is, YapifyFeatureProfilePe);
}

export default (CONFIG) => ({
  hash: 'profile',
  route: '/profile',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeatureProfilePe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          out: {
            profile_logout: { bind: 'yapify-feature-profile-pe-logout' },
            profile_delete: { bind: 'yapify-feature-profile-pe-delete' },
            profile_store_mode: {
              bind: 'yapify-feature-profile-pe-store-mode',
              link: { page: 'myStores' },
            },
            profile_open_points: {
              bind: 'yapify-feature-profile-pe-open-points',
              link: { page: 'profilePoints' },
            },
            profile_open_redemptions: {
              bind: 'yapify-feature-profile-pe-open-redemptions',
              link: { page: 'profileRedemptions' },
            },
            profile_open_events: {
              bind: 'yapify-feature-profile-pe-open-events',
              link: { page: 'myEvents' },
            },
          },
        },
      },
    },
  ],
});
