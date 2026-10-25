import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// shim sessionStorage + location — el módulo persiste las anotaciones en
// sessionStorage y lee location.hash para decidir el scope.
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
globalThis.sessionStorage = new MemoryStorage();
globalThis.location = { hash: '' };

const {
  SOURCE_KINDS,
  SOURCE_REF_MAX,
  normalizeOrigin,
  buildSourceRef,
  setPendingOrigin,
  takePendingOrigin,
  currentOriginScope,
  setupCartOriginTracker,
} = await import('../cart-origin.js');

/** Bus de mentira: guarda los handlers de `onRaw` para dispararlos a mano. */
function fakeBus() {
  const handlers = new Map();
  return {
    onRaw(channel, handler) { handlers.set(channel, handler); },
    emit(channel, detail) { handlers.get(channel)?.({ detail }); },
    has(channel) { return handlers.has(channel); },
  };
}

beforeEach(() => {
  sessionStorage.clear();
  location.hash = '';
});

/* ── normalizeOrigin ── */

test('normalizeOrigin acepta los kinds del vocabulario', () => {
  for (const kind of SOURCE_KINDS) {
    assert.equal(normalizeOrigin({ kind }).kind, kind);
  }
});

test('normalizeOrigin descarta un kind fuera del vocabulario', () => {
  assert.deepEqual(normalizeOrigin({ kind: 'inventado' }), { kind: null, ref: null });
  assert.deepEqual(normalizeOrigin({}), { kind: null, ref: null });
  assert.deepEqual(normalizeOrigin(undefined), { kind: null, ref: null });
});

test('normalizeOrigin nunca deja una ref huérfana: sin kind válido, cae la ref', () => {
  const out = normalizeOrigin({ kind: 'no-existe', ref: 'campaign:42' });
  assert.equal(out.ref, null, 'una ref sin kind sería basura en la base');
});

test('normalizeOrigin recorta la ref al límite de la columna (64)', () => {
  const larga = 'x'.repeat(200);
  const out = normalizeOrigin({ kind: 'campaign', ref: larga });
  assert.equal(out.ref.length, SOURCE_REF_MAX);
});

test('normalizeOrigin limpia espacios y convierte la ref vacía en null', () => {
  assert.equal(normalizeOrigin({ kind: 'search', ref: '  abc  ' }).ref, 'abc');
  assert.equal(normalizeOrigin({ kind: 'search', ref: '   ' }).ref, null);
  assert.equal(normalizeOrigin({ kind: 'search', ref: 123 }).ref, null);
});

/* ── buildSourceRef ── */

test('buildSourceRef une las partes con dos puntos', () => {
  assert.equal(buildSourceRef('recommendation', 'model', 'product', 42), 'recommendation:model:product:42');
});

test('buildSourceRef saltea partes vacías, nulas e indefinidas', () => {
  assert.equal(buildSourceRef('foryou', null, 'product', undefined, 7), 'foryou:product:7');
  assert.equal(buildSourceRef('foryou', '  ', 'product'), 'foryou:product');
});

test('buildSourceRef devuelve null cuando no queda nada', () => {
  assert.equal(buildSourceRef(), null);
  assert.equal(buildSourceRef(null, undefined, ''), null);
});

/* ── anotaciones pendientes ── */

test('la anotación se guarda y se recupera', () => {
  setPendingOrigin('store', { kind: 'search' });
  assert.deepEqual(takePendingOrigin('store'), { kind: 'search', ref: null });
});

test('la anotación es de UN SOLO USO', () => {
  setPendingOrigin('item', { kind: 'recommendation', ref: 'foryou:product:1' });
  assert.ok(takePendingOrigin('item'));
  assert.equal(takePendingOrigin('item'), null, 'la segunda lectura ya no devuelve nada');
});

test('los scopes no se pisan entre sí', () => {
  setPendingOrigin('store', { kind: 'search' });
  setPendingOrigin('item', { kind: 'recommendation' });
  assert.equal(takePendingOrigin('store').kind, 'search');
  assert.equal(takePendingOrigin('item').kind, 'recommendation');
});

test('anotar un origen inválido BORRA la anotación previa', () => {
  setPendingOrigin('store', { kind: 'search' });
  setPendingOrigin('store', null);
  assert.equal(takePendingOrigin('store'), null);
});

test('una anotación de más de 10 minutos ya no explica la compra', () => {
  const realNow = Date.now;
  setPendingOrigin('store', { kind: 'search' });
  Date.now = () => realNow() + 11 * 60 * 1000;
  try {
    assert.equal(takePendingOrigin('store'), null);
  } finally {
    Date.now = realNow;
  }
});

test('takePendingOrigin sobrevive un sessionStorage corrupto', () => {
  sessionStorage.setItem('yapify-cart-origin', 'no-es-json');
  assert.equal(takePendingOrigin('store'), null);
});

/* ── scope según la ruta ── */

test('currentOriginScope distingue el detalle de item de todo lo demás', () => {
  location.hash = '#/item/product/42';
  assert.equal(currentOriginScope(), 'item');
  location.hash = '#/store/mi-tienda-1';
  assert.equal(currentOriginScope(), 'store');
  location.hash = '';
  assert.equal(currentOriginScope(), 'store');
});

/* ── tracker sobre el bus ── */

test('buscar y entrar a la tienda marca el origen como search', () => {
  const bus = fakeBus();
  setupCartOriginTracker(bus);
  bus.emit('search_performed', { query: 'panadería' });
  bus.emit('explore_go_store', {});
  assert.deepEqual(takePendingOrigin('store'), { kind: 'search', ref: null });
});

test('entrar a una tienda SIN buscar no la marca como search', () => {
  const bus = fakeBus();
  setupCartOriginTracker(bus);
  bus.emit('explore_go_store', {});
  assert.equal(takePendingOrigin('store'), null, 'debe caer al default browse del backend');
});

test('la búsqueda se consume: la segunda tienda ya no cuenta como search', () => {
  const bus = fakeBus();
  setupCartOriginTracker(bus);
  bus.emit('search_performed', { query: 'café' });
  bus.emit('explore_go_store', {});
  takePendingOrigin('store');
  bus.emit('explore_go_store', {});
  assert.equal(takePendingOrigin('store'), null);
});

test('la alerta de venta flash gana sobre la campaña', () => {
  const bus = fakeBus();
  setupCartOriginTracker(bus);
  bus.emit('notifications_open_source', { sourceType: 'flash_sale', sourceId: 9, campaignId: 5 });
  assert.deepEqual(takePendingOrigin('store'), { kind: 'flash_sale_alert', ref: 'flash_sale:9' });
});

test('un aviso de campaña marca campaign con su id', () => {
  const bus = fakeBus();
  setupCartOriginTracker(bus);
  bus.emit('notifications_open_source', { sourceType: 'other', campaignId: 5 });
  assert.deepEqual(takePendingOrigin('store'), { kind: 'campaign', ref: 'campaign:5' });
});

test('un aviso transaccional no es descubrimiento', () => {
  const bus = fakeBus();
  setupCartOriginTracker(bus);
  bus.emit('notifications_open_source', { sourceType: 'points_granted' });
  assert.equal(takePendingOrigin('store'), null);
});

test('abrir un item del feed Para ti lo marca como recomendación', () => {
  const bus = fakeBus();
  setupCartOriginTracker(bus);
  bus.emit('dashboard_go_item_detail', { item: { id: 42 }, bucket: 'model', itemKind: 'product' });
  assert.deepEqual(takePendingOrigin('item'), {
    kind: 'recommendation',
    ref: 'foryou:model:product:42',
  });
});

test('el carrusel del detalle también es recomendación', () => {
  const bus = fakeBus();
  setupCartOriginTracker(bus);
  bus.emit('item_go_item', { item: { id: 7 }, bucket: 'popular', itemKind: 'promotion' });
  assert.equal(takePendingOrigin('item').kind, 'recommendation');
});

test('la lista por tipo es browse y pisa una anotación previa del feed', () => {
  const bus = fakeBus();
  setupCartOriginTracker(bus);
  bus.emit('dashboard_go_item_detail', { item: { id: 1 }, bucket: 'model', itemKind: 'product' });
  bus.emit('kind_list_open_item', {});
  assert.deepEqual(takePendingOrigin('item'), { kind: 'browse', ref: null },
    'si no pisara, una compra por catálogo se contaría como del recomendador');
});
