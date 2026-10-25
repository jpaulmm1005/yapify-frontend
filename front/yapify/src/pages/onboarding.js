import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureOnboardingPe } from 'yapify-feature-onboarding-pe';
import {
  A_onboardingStarted,
  A_onboardingStepCompleted,
  A_onboardingFinished,
  A_onboardingCategoriesSelected,
} from '../shell/analytics/fingerprints/index.js';

/**
 * Onboarding Page Descriptor
 *
 * Mounts `<yapify-feature-onboarding-pe>` into the main zone.
 * Passes firebaseUser from globalUser and apiBaseUrl from CONFIG.
 *
 * yapiConnections wiring:
 *   OUT:
 *   - onboarding_complete ← 'yapify-feature-onboarding-pe-complete' (registro exitoso → dashboard)
 *   - onboarding_error    ← 'yapify-feature-onboarding-pe-error'    (error en registro)
 *   - onboarding_logout   ← 'yapify-feature-onboarding-pe-step1-back' (flecha back en paso 1 → logout + /login)
 *   - onboarding_started, _step_completed, _categories_selected → solo-analytics
 *
 *   IN:
 *   - onboarding_set_error   → 'errorMessage'
 *   - onboarding_set_loading → 'loading'
 */

if (!customElements.get(YapifyFeatureOnboardingPe.is)) {
  customElements.define(YapifyFeatureOnboardingPe.is, YapifyFeatureOnboardingPe);
}

export default (CONFIG) => ({
  hash: 'onboarding',
  route: '/onboarding',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeatureOnboardingPe.is,
      type: 'UI',
      properties: {
        firebaseUser: window.__yapifyUser?.firebaseUser ?? null,
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          in: {
            onboarding_set_error: { bind: 'errorMessage' },
            onboarding_set_loading: { bind: 'loading' },
          },
          out: {
            onboarding_complete: {
              bind: 'yapify-feature-onboarding-pe-complete',
              analytics: A_onboardingFinished,
            },
            onboarding_error: {
              bind: 'yapify-feature-onboarding-pe-error',
            },
            onboarding_logout: {
              bind: 'yapify-feature-onboarding-pe-step1-back',
            },
            onboarding_started: {
              bind: 'yapify-feature-onboarding-pe-started',
              analytics: A_onboardingStarted,
              skipBus: true,
            },
            onboarding_step_completed: {
              bind: 'yapify-feature-onboarding-pe-step-completed',
              analytics: A_onboardingStepCompleted,
              skipBus: true,
            },
            onboarding_categories_selected: {
              bind: 'yapify-feature-onboarding-pe-categories-selected',
              analytics: A_onboardingCategoriesSelected,
              skipBus: true,
            },
          },
        },
      },
    },
  ],
});
