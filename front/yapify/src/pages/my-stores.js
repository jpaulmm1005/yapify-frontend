import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureMyStoresPe } from 'yapify-feature-my-stores-pe';
import {
  A_myStoresListed,
  A_myStoreOpened,
  A_myStoreCreateClicked,
} from '../shell/analytics/fingerprints/index.js';

if (!customElements.get(YapifyFeatureMyStoresPe.is)) {
  customElements.define(YapifyFeatureMyStoresPe.is, YapifyFeatureMyStoresPe);
}

export default (CONFIG) => ({
  hash: 'my-stores',
  route: '/my-stores',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeatureMyStoresPe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          in: {
            // Emitted by `my-store.js` when the owner creates a store, so the
            // list is refetched instead of showing the pre-creation snapshot.
            // `signal` so it lands even while this page sits hidden in the
            // back-stack, and does not re-fire on every revive.
            my_stores_invalidate: { bind: 'invalidate', signal: true },
          },
          out: {
            my_stores_back: {
              bind: 'yapify-feature-my-stores-pe-back',
              link: { page: 'profile' },
            },
            // Both open/create channels carry side-effects (selected-store
            // id + force-create flag) handled by the navigation-coordinator
            // before the route changes.
            my_stores_open_store: {
              bind: 'yapify-feature-my-stores-pe-open-store',
              analytics: A_myStoreOpened,
            },
            my_stores_create_store: {
              bind: 'yapify-feature-my-stores-pe-create-store',
              analytics: A_myStoreCreateClicked,
            },
            // Solo-analytics
            my_stores_listed: {
              bind: 'yapify-feature-my-stores-pe-listed',
              analytics: A_myStoresListed,
              skipBus: true,
            },
          },
        },
      },
    },
  ],
});
