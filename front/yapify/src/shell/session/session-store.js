/**
 * Session store — singleton del shell. Mantiene en memoria el
 * `firebaseUser` y el `dbUser` actuales y los persiste en localStorage
 * para que sobrevivan a F5.
 *
 * El coordinator de sesión (`session-coordinator.js`) muta este store
 * en respuesta a los eventos de auth del bus. main.js solo lee `globalUser`
 * para el bootstrap de analytics + push al arranque.
 */

const SESSION_KEY = 'yapify-session';
const FIREBASE_USER_KEY = 'yapify-firebase-user';

function safeRead(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export const globalUser = {
  firebaseUser: safeRead(FIREBASE_USER_KEY),
  dbUser: safeRead(SESSION_KEY),
};

if (typeof window !== 'undefined') {
  window.__yapifyUser = globalUser;
}

export function saveDbUser(user) {
  globalUser.dbUser = user;
  safeWrite(SESSION_KEY, user);
}

export function saveFirebaseUser(user) {
  globalUser.firebaseUser = user;
  safeWrite(FIREBASE_USER_KEY, user);
}

export function clearFirebaseUser() {
  globalUser.firebaseUser = null;
  safeRemove(FIREBASE_USER_KEY);
}

export function clearSession() {
  globalUser.firebaseUser = null;
  globalUser.dbUser = null;
  safeRemove(SESSION_KEY);
  safeRemove(FIREBASE_USER_KEY);
}
