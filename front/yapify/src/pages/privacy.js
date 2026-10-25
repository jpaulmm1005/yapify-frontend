import '../shell/polyfills/scoped-registry.js';
import { YapifyLegalPage } from '../shell/legal/yapify-legal-page.js';

/**
 * Privacy Page Descriptor
 *
 * Mounts the shell-owned `<yapify-legal-page>` with the `privacy` document.
 * Reachable from the login screen before any session exists, so the route is
 * neither guest-only nor protected in `router/guards.js`.
 *
 * yapiConnections wiring:
 *   OUT:
 *   - privacy_back  ← 'page-back'  (back arrow → router goes back)
 */

if (!customElements.get(YapifyLegalPage.is)) {
  customElements.define(YapifyLegalPage.is, YapifyLegalPage);
}

export default () => ({
  hash: 'privacy',
  route: '/privacy',
  components: [
    {
      zone: 'app__main',
      tag: YapifyLegalPage.is,
      type: 'UI',
      properties: {
        doc: 'privacy',
        yapiConnections: {
          out: {
            privacy_back: {
              bind: 'page-back',
              backStep: true,
              skipBus: true,
            },
          },
        },
      },
    },
  ],
});
