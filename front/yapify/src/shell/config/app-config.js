/**
 * App Config — Platform detection and global configuration.
 *
 * Equivalent to _common.js + _cells.js in glomo-pe.
 * Exposes window.__YAPIFY_CONFIG__ for page descriptors to consume.
 */

const BASE_CONFIG = {
  appName: 'Yapify',
  version: '0.1.0',
  defaultRoute: '/loading',
  sessionTimeout: {
    foreground: 5,
    background: 5,
  },
  i18n: {
    defaultLang: 'es-PE',
    languages: ['es-PE', 'en-US'],
  },
  /** Firebase project configuration – consumed by login MFE */
  firebaseConfig: {
    apiKey: 'AIzaSyBpRFl6z-cfPnds4C52YEmjROmclh5Bp-Y',
    authDomain: 'yapify-beb54.firebaseapp.com',
    projectId: 'yapify-beb54',
    storageBucket: 'yapify-beb54.firebasestorage.app',
    messagingSenderId: '513281754901',
    appId: '1:513281754901:web:2e9cc18110334ec4accb1c',
    measurementId: 'G-ZK08QRYNYN',
  },
  /**
   * Backend API base URL. Resolved per platform at runtime by `initConfig`:
   *   - web        → VITE_API_URL ?? 'http://127.0.0.1:8000'
   *   - Android    → VITE_API_URL_ANDROID ?? 'http://10.0.2.2:8000' (emulator alias for the host)
   *   - iOS        → VITE_API_URL_IOS ?? 'http://127.0.0.1:8000'
   * Override per environment with the matching VITE_ var in `.env.local`.
   */
  apiBaseUrl: 'http://127.0.0.1:8000',
  /**
   * PostHog analytics — pasa el Project API Key (phc_xxx) y el host
   * (https://us.i.posthog.com o https://eu.i.posthog.com).
   * Si key === '', el tracking queda en silent no-op (útil en dev/local).
   */
  posthogKey: import.meta.env.VITE_POSTHOG_KEY ?? '',
  posthogHost: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
  /**
   * VAPID public key para Web Push (FCM). Se genera en Firebase Console
   * → Project settings → Cloud Messaging → Web push certificates.
   * La clave privada queda en Firebase y no se usa desde el cliente.
   */
  fcmVapidKey: import.meta.env.VITE_FCM_VAPID_KEY ?? '',
};

async function detectPlatform() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    const platform = Capacitor.getPlatform();
    return {
      platform,
      native: platform !== 'web',
      nativeIos: platform === 'ios',
      nativeAndroid: platform === 'android',
    };
  } catch {
    return { platform: 'web', native: false, nativeIos: false, nativeAndroid: false };
  }
}

function resolveApiBaseUrl(platformInfo) {
  const fallback = BASE_CONFIG.apiBaseUrl;
  if (platformInfo.nativeAndroid) {
    return import.meta.env.VITE_API_URL_ANDROID ?? 'http://10.0.2.2:8000';
  }
  if (platformInfo.nativeIos) {
    return import.meta.env.VITE_API_URL_IOS ?? fallback;
  }
  return import.meta.env.VITE_API_URL ?? fallback;
}

export async function initConfig() {
  const platformInfo = await detectPlatform();

  const config = {
    ...BASE_CONFIG,
    ...platformInfo,
    apiBaseUrl: resolveApiBaseUrl(platformInfo),
    env: import.meta.env.MODE, // 'development' | 'production'
  };

  // Make globally available for page descriptors
  window.__YAPIFY_CONFIG__ = config;

  return config;
}

export function getConfig() {
  return window.__YAPIFY_CONFIG__ ?? BASE_CONFIG;
}
