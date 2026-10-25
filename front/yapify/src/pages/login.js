import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureLoginPe } from 'yapify-feature-login-pe';
import { A_userLoggedIn } from '../shell/analytics/fingerprints/index.js';

/**
 * Login Page Descriptor
 *
 * Mounts the `<yapify-feature-login-pe>` MFE into the main zone. Passes
 * firebaseConfig and apiBaseUrl from the global CONFIG.
 *
 * yapiConnections wiring:
 *   OUT:
 *   - login_registered   ← 'yapify-feature-login-pe-registered'   (user exists → dashboard)
 *   - login_new_user     ← 'yapify-feature-login-pe-new-user'     (new user → onboarding)
 *   - login_error        ← 'yapify-feature-login-pe-error'        (auth/verify failed)
 *   - login_go_terms     ← 'yapify-feature-login-pe-go-terms'     (→ /terms)
 *   - login_go_privacy   ← 'yapify-feature-login-pe-go-privacy'   (→ /privacy)
 *
 *   IN:
 *   - login_set_error    → 'errorMessage'        (shell pushes error to component)
 *   - login_set_loading  → 'loading'             (shell controls loading state)
 */

if (!customElements.get(YapifyFeatureLoginPe.is)) {
  customElements.define(YapifyFeatureLoginPe.is, YapifyFeatureLoginPe);
}

export default (CONFIG) => ({
  hash: 'login',
  route: '/login',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeatureLoginPe.is,
      type: 'UI',
      properties: {
        firebaseConfig: CONFIG.firebaseConfig,
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          in: {
            login_set_error: { bind: 'errorMessage' },
            login_set_loading: { bind: 'loading' },
          },
          out: {
            login_registered: {
              bind: 'yapify-feature-login-pe-registered',
              analytics: A_userLoggedIn,
            },
            login_new_user: { bind: 'yapify-feature-login-pe-new-user' },
            login_error: { bind: 'yapify-feature-login-pe-error' },
            // Legal documents shown before sign-up. They are shell routes, not
            // an external site: the Capacitor build must not push the user out
            // to a browser mid sign-up, and nothing else publishes them.
            login_go_terms: {
              bind: 'yapify-feature-login-pe-go-terms',
              link: { page: 'terms' },
              skipBus: true,
            },
            login_go_privacy: {
              bind: 'yapify-feature-login-pe-go-privacy',
              link: { page: 'privacy' },
              skipBus: true,
            },
          },
        },
      },
    },
  ],
});
