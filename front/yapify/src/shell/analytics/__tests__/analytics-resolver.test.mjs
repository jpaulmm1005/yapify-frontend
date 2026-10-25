import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// shim window + location — el resolver lee la sesión de window.__yapifyUser
// y la ruta de location.hash.
globalThis.window = {};
globalThis.location = { hash: '' };

const { resolveValue, resolveProps } = await import('../analytics-resolver.js');

beforeEach(() => {
  window.__yapifyUser = null;
  location.hash = '';
});

/* ── paths sobre el detail ── */

test('un string resuelve como path sobre el detail', () => {
  assert.equal(resolveValue('storeId', { storeId: 7 }), 7);
  assert.equal(resolveValue('store.name', { store: { name: 'Café' } }), 'Café');
});

test('un path que no existe devuelve undefined en vez de romper', () => {
  assert.equal(resolveValue('a.b.c', {}), undefined);
  assert.equal(resolveValue('a.b', { a: null }), undefined);
  assert.equal(resolveValue('x', undefined), undefined);
});

/* ── tokens de sesión ── */

test('$session.uid sale del usuario logueado', () => {
  window.__yapifyUser = { dbUser: { uid: 'u-1', role: 'ADMIN' } };
  assert.equal(resolveValue('$session.uid', {}), 'u-1');
  assert.equal(resolveValue('$session.role', {}), 'ADMIN');
});

test('$session sin sesión devuelve null, no explota', () => {
  assert.equal(resolveValue('$session', {}), null);
  assert.equal(resolveValue('$session.uid', {}), undefined);
});

/* ── tokens de página ── */

test('$page.route es el hash sin el "#" y sin query', () => {
  location.hash = '#/store/mi-tienda-1?tab=cupones';
  assert.equal(resolveValue('$page.route', {}), '/store/mi-tienda-1');
});

test('$page.route sin hash cae a "/"', () => {
  assert.equal(resolveValue('$page.route', {}), '/');
});

/* ── specs de objeto ── */

test('un literal se devuelve tal cual', () => {
  assert.equal(resolveValue({ literal: 'card' }, {}), 'card');
  assert.equal(resolveValue({ literal: 0 }, {}), 0);
});

test('una fn recibe detail, session y page', () => {
  window.__yapifyUser = { dbUser: { uid: 'u-9' } };
  location.hash = '#/dashboard';
  const out = resolveValue({
    fn: (ctx) => `${ctx.detail.n}-${ctx.session.uid}-${ctx.page.route}`,
  }, { n: 2 });
  assert.equal(out, '2-u-9-/dashboard');
});

test('una fn que lanza no rompe la captura: devuelve undefined', () => {
  assert.equal(resolveValue({ fn: () => { throw new Error('boom'); } }, {}), undefined);
});

test('un objeto sin literal ni fn devuelve undefined', () => {
  assert.equal(resolveValue({ otra: 'cosa' }, {}), undefined);
});

test('un spec que no es string ni objeto pasa derecho', () => {
  assert.equal(resolveValue(42, {}), 42);
  assert.equal(resolveValue(true, {}), true);
});

/* ── resolveProps ── */

test('resolveProps resuelve el mapa completo', () => {
  window.__yapifyUser = { dbUser: { uid: 'u-1' } };
  const out = resolveProps(
    { item_id: 'itemId', user_uid: '$session.uid', source: { literal: 'card' } },
    { itemId: 5 },
  );
  assert.deepEqual(out, { item_id: 5, user_uid: 'u-1', source: 'card' });
});

test('resolveProps OMITE las props undefined para no contaminar el evento', () => {
  const out = resolveProps({ a: 'existe', b: 'no.existe' }, { existe: 1 });
  assert.deepEqual(out, { a: 1 });
  assert.ok(!('b' in out));
});

test('resolveProps con mapa vacío devuelve objeto vacío', () => {
  assert.deepEqual(resolveProps(), {});
  assert.deepEqual(resolveProps({}, {}), {});
});
