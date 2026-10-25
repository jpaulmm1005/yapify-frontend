import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// shim localStorage — los guards leen la sesión persistida de ahí.
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
globalThis.localStorage = new MemoryStorage();

const { evaluateGuards } = await import('../guards.js');

const login = () => localStorage.setItem('yapify-session', JSON.stringify({ uid: 'u1' }));

beforeEach(() => localStorage.clear());

/* ── sin sesión ── */

test('sin sesión, una ruta protegida manda al login', () => {
  assert.deepEqual(evaluateGuards('/dashboard'), { allowed: false, redirect: '/login' });
  assert.deepEqual(evaluateGuards('/profile'), { allowed: false, redirect: '/login' });
  assert.deepEqual(evaluateGuards('/my-store'), { allowed: false, redirect: '/login' });
});

test('sin sesión, las sub-rutas de una protegida también caen', () => {
  assert.equal(evaluateGuards('/profile/points').redirect, '/login');
  assert.equal(evaluateGuards('/my-store/products').redirect, '/login');
});

test('sin sesión, login y onboarding se permiten', () => {
  assert.deepEqual(evaluateGuards('/login'), { allowed: true });
  assert.deepEqual(evaluateGuards('/onboarding'), { allowed: true });
});

test('las rutas legales son públicas con o sin sesión', () => {
  assert.deepEqual(evaluateGuards('/terms'), { allowed: true });
  assert.deepEqual(evaluateGuards('/privacy'), { allowed: true });
  login();
  assert.deepEqual(evaluateGuards('/terms'), { allowed: true });
});

test('el carrito y el retorno del checkout no exigen sesión', () => {
  assert.deepEqual(evaluateGuards('/cart'), { allowed: true });
  assert.deepEqual(evaluateGuards('/checkout/return'), { allowed: true },
    'Mercado Pago devuelve al usuario acá y el guard no puede interceptarlo');
});

/* ── con sesión ── */

test('con sesión, login y onboarding rebotan al dashboard', () => {
  login();
  assert.deepEqual(evaluateGuards('/login'), { allowed: false, redirect: '/dashboard' });
  assert.deepEqual(evaluateGuards('/onboarding'), { allowed: false, redirect: '/dashboard' });
});

test('con sesión, las rutas protegidas se permiten', () => {
  login();
  assert.deepEqual(evaluateGuards('/dashboard'), { allowed: true });
  assert.deepEqual(evaluateGuards('/my-store/products'), { allowed: true });
});

/* ── bordes de la detección de sesión ── */

test('la cadena "null" no cuenta como sesión', () => {
  localStorage.setItem('yapify-session', 'null');
  assert.equal(evaluateGuards('/dashboard').redirect, '/login');
});

test('un prefijo parecido no se confunde con una ruta protegida', () => {
  assert.deepEqual(evaluateGuards('/storefront-publico'), { allowed: true },
    'el match es por segmento exacto o "/ruta/...", no por startsWith crudo');
});

/* ── documenta el estado actual: /store exige sesión ── */

test('la tienda pública HOY exige sesión', () => {
  assert.equal(evaluateGuards('/store/mi-tienda-1').redirect, '/login',
    'si se quiere que un deep-link a tienda sea visitable sin cuenta, hay que sacar /store de protectedRoutes');
});
