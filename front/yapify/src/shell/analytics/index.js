/**
 * Analytics — public API del shell.
 *
 * Uso desde main.js:
 *   import { initAnalytics, identifyUser, resetAnalytics, pageview } from './shell/analytics';
 *   await initAnalytics({ key: CONFIG.posthogKey, host: CONFIG.posthogHost });
 *
 * El componentWirer importa internamente captureFromFingerprint.
 * Los features NO deben importar nada de aquí — todo va por descriptors.
 */

import { initPostHog } from './posthog-driver.js';
import { captureFromFingerprint, track, identify, setPersonProperties, group, reset, pageview, isEnabled, alias } from './analytics-layer.js';

export async function initAnalytics(cfg) {
  await initPostHog(cfg);
}

export function identifyUser(uid, traits = {}) {
  identify(uid, traits);
}

export function aliasUser(uid) {
  alias(uid);
}

export function setUserTraits(traits = {}) {
  setPersonProperties(traits);
}

export function identifyGroup(groupType, key, traits = {}) {
  group(groupType, key, traits);
}

export function resetAnalytics() {
  reset();
}

export {
  captureFromFingerprint,
  track,
  pageview,
  isEnabled,
};
