import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureExploreStoresPe } from 'yapify-feature-explore-stores-pe';
import {
  A_searchPerformed,
  A_categoryFiltered,
  A_storeFollowed,
  A_storeUnfollowed,
  A_storeNotificationsToggled,
  A_itemImpression,
  A_itemClicked,
} from '../shell/analytics/fingerprints/index.js';

if (!customElements.get(YapifyFeatureExploreStoresPe.is)) {
  customElements.define(YapifyFeatureExploreStoresPe.is, YapifyFeatureExploreStoresPe);
}

export default (CONFIG) => ({
  hash: 'stores',
  route: '/stores',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeatureExploreStoresPe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          in: {
            // Sync per-card follow state when a follow/unfollow happens in
            // another feature (e.g. the public store page) while this list is
            // mounted-but-hidden. Marked `signal` so each change is applied
            // exactly once when this list next revives, instead of re-applying
            // the cached value (which could re-stamp stale state) every revive.
            store_followed: { bind: 'applyFollowSignal', signal: true },
            store_unfollowed: { bind: 'applyUnfollowSignal', signal: true },
          },
          out: {
            explore_go_store: {
              bind: 'yapify-feature-explore-stores-pe-go-store',
              link: {
                page: 'store',
                params: { slug: 'slug' },
              },
            },
            explore_go_login: {
              bind: 'yapify-feature-explore-stores-pe-go-login',
              link: { page: 'login' },
            },
            item_impression: {
              bind: 'impression',
              analytics: A_itemImpression,
              skipBus: true,
            },
            explore_stores_item_clicked: {
              bind: 'yapify-feature-explore-stores-pe-item-clicked',
              analytics: A_itemClicked,
              skipBus: true,
            },
            // NO lleva `skipBus`: además de la huella de analítica, el
            // cart-origin del shell necesita ver la búsqueda para poder marcar
            // como `search` los items que se agreguen en la tienda que el
            // usuario abra desde los resultados. Es el único camino real hacia
            // `source_kind = 'search'` — no existe buscador de productos.
            search_performed: {
              bind: 'yapify-feature-explore-stores-pe-search-performed',
              analytics: A_searchPerformed,
            },
            category_filtered: {
              bind: 'yapify-feature-explore-stores-pe-category-filtered',
              analytics: A_categoryFiltered,
              skipBus: true,
            },
            store_followed: {
              bind: 'yapify-feature-explore-stores-pe-store-followed',
              analytics: A_storeFollowed,
            },
            store_unfollowed: {
              bind: 'yapify-feature-explore-stores-pe-store-unfollowed',
              analytics: A_storeUnfollowed,
            },
            store_notifications_toggled: {
              bind: 'yapify-feature-explore-stores-pe-store-notifications-toggled',
              analytics: A_storeNotificationsToggled,
              skipBus: true,
            },
          },
        },
      },
    },
  ],
});
