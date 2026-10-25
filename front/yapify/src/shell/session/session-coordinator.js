import { yapiBus } from '../event-bus/yapi-bus.js';
import { appRouter } from '../router/app-router.js';
import {
  globalUser,
  saveDbUser,
  saveFirebaseUser,
  clearFirebaseUser,
  clearSession,
} from './session-store.js';
import { saveTokens, clearTokens } from './token-store.js';
import { clearSelectedStoreId } from './selected-store.js';
import {
  identifyUser,
  aliasUser,
  resetAnalytics,
} from '../analytics/index.js';
import { buildPersonProps } from '../analytics/person-properties.js';
import { initPush, teardownPush } from '../notifications/push-driver.js';
import { startRealtime, stopRealtime } from '../realtime/realtime-coordinator.js';
import { initNativePush, teardownNativePush } from '../notifications/native-push-driver.js';

/**
 * Wires every auth-related bus channel to the shell's session state and
 * navigation. main.js calls `setupSessionCoordinator({ config })` once
 * after `initConfig` resolves — from then on every login / onboarding /
 * logout event flows through here without main.js seeing a single
 * `yapiBus.on('login_*')` handler.
 *
 * @param {Object} params
 * @param {Object} params.config - Resolved shell config (`firebaseConfig`, `apiBaseUrl`, `fcmVapidKey`).
 */
/**
 * Clave donde se guarda el ID token de Firebase del usuario que esta en medio
 * del onboarding. Es un credencial de corta vida (1 hora) y se borra apenas se
 * canjea por los tokens de la app.
 */
const ONBOARDING_ID_TOKEN_KEY = 'yapify-onboarding-id-token';

/**
 * Guarda el ID token con el que se canjearan los tokens al terminar el
 * onboarding. En sessionStorage y no en localStorage: muere con la pestania,
 * que es justo lo que dura el onboarding.
 *
 * @param {String|null} idToken
 * @returns {void}
 */
function saveOnboardingIdToken(idToken) {
  try {
    if (idToken) sessionStorage.setItem(ONBOARDING_ID_TOKEN_KEY, idToken);
    else sessionStorage.removeItem(ONBOARDING_ID_TOKEN_KEY);
  } catch { /* noop — sessionStorage bloqueado */ }
}

/**
 * Lee el ID token guardado para el onboarding.
 *
 * @returns {String|null}
 */
function readOnboardingIdToken() {
  try { return sessionStorage.getItem(ONBOARDING_ID_TOKEN_KEY); }
  catch { return null; }
}

export function setupSessionCoordinator({ config }) {
  const startPush = (uid) => {
    if (!uid) return;
    // Web Push (browser) and native push (Capacitor) — each is a no-op on the
    // other platform, so calling both is safe and covers desktop + the app.
    initPush({
      firebaseConfig: config.firebaseConfig,
      vapidKey: config.fcmVapidKey,
      apiBaseUrl: config.apiBaseUrl,
      userUid: uid,
    }).catch(() => { /* silent */ });
    initNativePush({
      apiBaseUrl: config.apiBaseUrl,
      userUid: uid,
    }).catch(() => { /* silent */ });
    startRealtime();
  };

  const tearDown = () => {
    stopRealtime();
    clearTokens();
    saveOnboardingIdToken(null);
    teardownPush(config.apiBaseUrl).catch(() => { /* silent */ });
    teardownNativePush(config.apiBaseUrl).catch(() => { /* silent */ });
    resetAnalytics();
    clearSession();
    // La tienda seleccionada es parte de la sesión: si sobrevive al logout,
    // el siguiente dueño que entre en esta misma instalación arranca en la
    // tienda del anterior (y el arranque en modo tienda la respetaría).
    clearSelectedStoreId();
    yapiBus.emit('cart_set_user', null);
    appRouter.clearAll();
    appRouter.navigateTo('/login');
  };

  yapiBus.on('login_registered', (e) => {
    const { user, dbUser, tokens } = e.detail ?? {};
    if (tokens) saveTokens(tokens);
    globalUser.firebaseUser = user;
    saveDbUser(dbUser);
    yapiBus.emit('cart_set_user', dbUser?.uid ?? null);
    if (dbUser?.uid) {
      identifyUser(dbUser.uid, buildPersonProps(dbUser));
    }
    startPush(dbUser?.uid);
    appRouter.navigateTo('/dashboard');
  });

  yapiBus.on('login_new_user', (e) => {
    const { user, idToken } = e.detail ?? {};
    globalUser.dbUser = null;
    saveFirebaseUser(user);
    // El usuario que llega aca va serializado (objeto plano, sin `getIdToken`),
    // asi que esta es la unica credencial de Firebase que sobrevive hasta el
    // final del onboarding, que es cuando recien se pueden pedir los tokens.
    saveOnboardingIdToken(idToken ?? null);
    appRouter.navigateTo('/onboarding');
  });

  yapiBus.on('login_error', () => {
    yapiBus.emit('login_set_loading', false);
  });

  yapiBus.on('onboarding_complete', async (e) => {
    const { user, tokens } = e.detail ?? {};
    // El registro (`POST /api/users`) devuelve el usuario, nunca tokens, asi
    // que este camino es el normal y no un respaldo excepcional: recien ahora
    // el usuario existe en la base y `/auth/login` puede responder.
    if (tokens) {
      saveTokens(tokens);
    } else if (!(await exchangeIdTokenForTokens(config.apiBaseUrl))) {
      // Sin tokens no hay sesion: el usuario entraria al dashboard y la
      // primera accion autenticada (comprar, canjear) moriria con un error de
      // token sin explicacion. Se le manda a entrar de nuevo, que ahora si
      // funciona porque la cuenta ya quedo creada.
      // `tearDown` ya limpia sesion, firebaseUser y el ID token guardado.
      tearDown();
      return;
    }
    saveOnboardingIdToken(null);
    saveDbUser(user);
    yapiBus.emit('cart_set_user', user?.uid ?? null);
    if (user?.uid) {
      aliasUser(user.uid);
      identifyUser(user.uid, buildPersonProps(user));
    }
    clearFirebaseUser();
    startPush(user?.uid);
    appRouter.navigateTo('/dashboard');
  });

  /**
   * Canjea el ID token de Firebase guardado al entrar por los tokens de la
   * app. Se llama una sola vez, al terminar el onboarding.
   *
   * @param {String} apiBaseUrl
   * @returns {Promise<Boolean>} true si quedo una sesion valida.
   */
  async function exchangeIdTokenForTokens(apiBaseUrl) {
    const idToken = readOnboardingIdToken();
    if (!idToken) return false;
    try {
      const res = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });
      if (!res.ok) return false;
      saveTokens(await res.json());
      return true;
    } catch {
      return false;
    }
  }

  yapiBus.on('onboarding_error', (e) => {
    const { error } = e.detail ?? {};
    yapiBus.emit(
      'onboarding_set_error',
      typeof error === 'string' ? error : 'Error al registrar',
    );
  });

  yapiBus.on('dashboard_logout', tearDown);
  yapiBus.on('profile_logout', tearDown);
  yapiBus.on('onboarding_logout', tearDown);

  yapiBus.on('profile_delete', async () => {
    const uid = globalUser.dbUser?.uid;
    if (uid) {
      try {
        const apiFetch = window.__yapifyFetch ?? fetch;
        await apiFetch(`${config.apiBaseUrl}/api/users/${uid}`, { method: 'DELETE' });
      } catch { /* best effort */ }
    }
    tearDown();
  });
}
