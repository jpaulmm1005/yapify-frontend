import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveLink } from '../link-resolver.js';

/* ── resolución del `page` ── */

test('una clave de routes.js resuelve a su path', () => {
  assert.equal(resolveLink({ page: 'dashboard' }, {}), '/dashboard');
  assert.equal(resolveLink({ page: 'followedStores' }, {}), '/followed-stores');
});

test('un page que no es clave se toma como path literal', () => {
  assert.equal(resolveLink({ page: '/custom/thing' }, {}), '/custom/thing');
});

test('link inválido devuelve null', () => {
  assert.equal(resolveLink(null, {}), null);
  assert.equal(resolveLink({}, {}), null);
  assert.equal(resolveLink({ params: { a: 1 } }, {}), null);
  assert.equal(resolveLink('dashboard', {}), null);
});

/* ── placeholders ── */

test('un placeholder se rellena desde un path punteado del detail', () => {
  const url = resolveLink(
    { page: 'store', params: { slug: 'store.slug' } },
    { store: { slug: 'mi-tienda-1' } },
  );
  assert.equal(url, '/store/mi-tienda-1');
});

test('varios placeholders se rellenan en orden', () => {
  const url = resolveLink(
    { page: 'item', params: { kind: { literal: 'product' }, itemId: 'id' } },
    { id: 42 },
  );
  assert.equal(url, '/item/product/42');
});

test('un placeholder sin valor queda vacío, no como ":slug"', () => {
  const url = resolveLink({ page: 'store', params: { slug: 'no.existe' } }, {});
  assert.equal(url, '/store/');
});

test('los valores de placeholder se codifican para la URL', () => {
  const url = resolveLink(
    { page: 'store', params: { slug: 'store.slug' } },
    { store: { slug: 'café & pan' } },
  );
  assert.equal(url, `/store/${encodeURIComponent('café & pan')}`);
});

/* ── params sobrantes → query string ── */

test('los params que ningún placeholder consume van al query', () => {
  const url = resolveLink(
    { page: 'followedStores', params: { storeId: 'store.id' } },
    { store: { id: 123 } },
  );
  assert.equal(url, '/followed-stores?storeId=123');
});

test('se combinan placeholder y query', () => {
  const url = resolveLink(
    { page: 'store', params: { slug: 'slug', tab: { literal: 'cupones' } } },
    { slug: 'tienda-9' },
  );
  assert.equal(url, '/store/tienda-9?tab=cupones');
});

test('un param que resuelve a null se omite del query', () => {
  const url = resolveLink(
    { page: 'dashboard', params: { a: 'existe', b: 'no.existe' } },
    { existe: 1 },
  );
  assert.equal(url, '/dashboard?a=1');
});

test('sin params utilizables no se agrega "?"', () => {
  const url = resolveLink({ page: 'dashboard', params: { b: 'no.existe' } }, {});
  assert.equal(url, '/dashboard');
});

/* ── especificaciones de param ── */

test('un param puede ser una función del detail', () => {
  const url = resolveLink(
    { page: 'dashboard', params: { n: (detail) => detail.a + detail.b } },
    { a: 2, b: 3 },
  );
  assert.equal(url, '/dashboard?n=5');
});

test('un literal no se busca en el detail', () => {
  const url = resolveLink(
    { page: 'dashboard', params: { src: { literal: 'card' } } },
    { src: 'otro' },
  );
  assert.equal(url, '/dashboard?src=card');
});

test('las claves del query también se codifican', () => {
  const url = resolveLink(
    { page: 'dashboard', params: { 'a b': { literal: 'c d' } } },
    {},
  );
  assert.equal(url, '/dashboard?a%20b=c%20d');
});
