import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureFollowedStoresPe } from 'yapify-feature-followed-stores-pe';
import {
  A_followedStoresViewed,
  A_itemImpression,
  A_itemClicked,
} from '../shell/analytics/fingerprints/index.js';

if (!customElements.get(YapifyFeatureFollowedStoresPe.is)) {
  customElements.define(YapifyFeatureFollowedStoresPe.is, YapifyFeatureFollowedStoresPe);
}

export default (CONFIG) => ({
  hash: 'followed-stores',
  route: '/followed-stores',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeatureFollowedStoresPe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          in: {
            store_followed:   { bind: 'invalidate', signal: true },
            store_unfollowed: { bind: 'invalidate', signal: true },
          },
          out: {
            store_unfollowed: {
              bind: 'yapify-feature-followed-stores-pe-store-unfollowed',
            },
            followed_stores_back: {
              bind: 'yapify-feature-followed-stores-pe-go-back',
              backStep: true,
            },
            followed_stores_go_store: {
              bind: 'yapify-feature-followed-stores-pe-go-store',
              link: {
                page: 'store',
                params: { slug: 'slug' },
              },
            },
            followed_stores_go_explore: {
              bind: 'yapify-feature-followed-stores-pe-go-explore',
              link: { page: 'stores' },
            },
            followed_stores_viewed: {
              bind: 'yapify-feature-followed-stores-pe-viewed',
              analytics: A_followedStoresViewed,
              skipBus: true,
            },
            item_impression: {
              bind: 'impression',
              analytics: A_itemImpression,
              skipBus: true,
            },
            followed_stores_item_clicked: {
              bind: 'yapify-feature-followed-stores-pe-item-clicked',
              analytics: A_itemClicked,
              skipBus: true,
            },
          },
        },
      },
    },
  ],
});
