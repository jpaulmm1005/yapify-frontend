import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureKindListPe } from 'yapify-feature-kind-list-pe';
import {
  A_kindListViewed,
  A_itemImpression,
  A_itemClicked,
  A_couponCodeCopied,
  A_eventSubscribed,
} from '../shell/analytics/fingerprints/index.js';

if (!customElements.get(YapifyFeatureKindListPe.is)) {
  customElements.define(YapifyFeatureKindListPe.is, YapifyFeatureKindListPe);
}

function parseHashSubroute() {
  const hash = (location.hash || '').replace(/^#/, '');
  const m = hash.match(/^\/kind\/([a-z-]+)\/?$/i);
  if (!m) return { kind: '' };
  return { kind: m[1] };
}

export default (CONFIG) => {
  const { kind } = parseHashSubroute();
  return {
    hash: 'kind',
    route: '/kind',
    components: [
      {
        zone: 'app__main',
        tag: YapifyFeatureKindListPe.is,
        type: 'UI',
        properties: {
          apiBaseUrl: CONFIG.apiBaseUrl,
          kind,
          yapiConnections: {
            in: {
              kind_list_invalidate: { bind: 'invalidate', signal: true },
              __bridge_page_kind: { bind: 'resume' },
            },
            out: {
              kind_list_back: {
                bind: 'yapify-feature-kind-list-pe-back',
                backStep: true,
              },
              kind_list_open_item: {
                bind: 'yapify-feature-kind-list-pe-open-item',
                link: {
                  page: 'item',
                  params: { kind: 'kind', itemId: 'item.id' },
                },
              },
              kind_list_add_to_cart: {
                bind: 'yapify-feature-kind-list-pe-add-to-cart',
              },
              // Acción del toast de confirmación al inscribirse a un evento:
              // el aviso dice dónde verlo y además lleva.
              kind_list_go_my_events: {
                bind: 'yapify-feature-kind-list-pe-go-my-events',
                link: { page: 'myEvents' },
              },
              event_subscribed: {
                bind: 'event-subscribed',
                analytics: A_eventSubscribed,
                skipBus: true,
              },
              kind_list_coupon_copied: {
                bind: 'yapify-feature-kind-list-pe-coupon-copied',
                analytics: A_couponCodeCopied,
                skipBus: true,
              },
              kind_list_viewed: {
                bind: 'yapify-feature-kind-list-pe-viewed',
                analytics: A_kindListViewed,
                skipBus: true,
              },
              item_impression: {
                bind: 'impression',
                analytics: A_itemImpression,
                skipBus: true,
              },
              item_clicked: {
                bind: 'yapify-feature-kind-list-pe-item-clicked',
                analytics: A_itemClicked,
                skipBus: true,
              },
            },
          },
        },
      },
    ],
  };
};
