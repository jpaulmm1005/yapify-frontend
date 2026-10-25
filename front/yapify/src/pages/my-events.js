import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureMyEventsPe } from 'yapify-feature-my-events-pe';

if (!customElements.get(YapifyFeatureMyEventsPe.is)) {
  customElements.define(YapifyFeatureMyEventsPe.is, YapifyFeatureMyEventsPe);
}

export default (CONFIG) => ({
  hash: 'my-events',
  route: '/my-events',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeatureMyEventsPe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          out: {
            my_events_back: {
              bind: 'yapify-feature-my-events-pe-back',
              link: { page: 'profile' },
            },
            // The feature only knows the event id; the `events` slug is the
            // shell's URL contract, so it stays here as a literal.
            my_events_open_event: {
              bind: 'yapify-feature-my-events-pe-open-event',
              link: {
                page: 'item',
                params: { kind: { literal: 'events' }, itemId: 'itemId' },
              },
            },
            my_events_explore: {
              bind: 'yapify-feature-my-events-pe-explore',
              link: {
                page: 'kind',
                params: { kind: { literal: 'events' } },
              },
            },
          },
        },
      },
    },
  ],
});
