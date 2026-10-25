/**
 * Cart Service — singleton en el shell.
 *
 * Cada usuario tiene su propio carrito. Persistido en localStorage bajo la key
 * `yapify-cart::<uid>` (o `yapify-cart::anon` cuando no hay sesión). El shell
 * llama a `cartService.setUser(uid)` cada vez que cambia la sesión (login,
 * onboarding, logout) — eso descarga el carrito previo en disco y carga el del
 * usuario activo. Así, cambiar de cuenta en el mismo browser no mezcla items.
 *
 * Mantiene una única instancia en memoria (`__yapifyCart`) y emite
 * `yapify:cart-change` en cada mutación. La FAB y /cart escuchan ese evento.
 *
 * Shape del cart:
 *   {
 *     items: Array<{
 *       storeId, storeName,
 *       productId, name, imageUrl,
 *       basePrice, effectivePrice,
 *       promotionId, flashSaleId,
 *       sourceKind, sourceRef,
 *       quantity, addedAt,
 *     }>,
 *     storeMeta: {
 *       [storeId]: { notes, couponCode }
 *     },
 *     lastStoreId,
 *   }
 *
 * Cada tienda mantiene sus propios notes / couponCode — el carrito es
 * multi-tienda y cada Order se paga por separado. La entrega es siempre
 * recojo en tienda, así que no hay nada que elegir.
 *
 * API:
 *   cart.setUser(uid|null)
 *   cart.get() → snapshot { items, storeMeta, lastStoreId, totalItems, totalSubtotal }
 *   cart.addItem({ product, storeId, storeName, effectivePrice, promotion, flashSale, origin })
 *   cart.incrementItem(key)
 *   cart.decrementItem(key)
 *   cart.setQuantity(key, qty)
 *   cart.removeItem(key)
 *   cart.clear()
 *   cart.clearStore(storeId)
 *   cart.setStoreNotes(storeId, text)
 *   cart.setStoreCoupon(storeId, code)
 *   cart.getStoreMeta(storeId) → { notes, couponCode }
 *   cart.itemKey(item)
 */

import { yapiBus } from './event-bus/yapi-bus.js';
import {
  buildSourceRef,
  currentOriginScope,
  normalizeOrigin,
  setupCartOriginTracker,
  takePendingOrigin,
} from './cart-origin.js';

const STORAGE_PREFIX = 'yapify-cart';
const LEGACY_KEY = 'yapify-cart';

function storageKey(uid) {
  return `${STORAGE_PREFIX}::${uid || 'anon'}`;
}

function emptyStoreMeta() {
  return { notes: '', couponCode: null, pendingOrderId: null };
}

function emptyCart() {
  return { items: [], storeMeta: {}, lastStoreId: null };
}

function load(uid) {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return emptyCart();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return emptyCart();
    const next = { ...emptyCart(), ...parsed };
    // Migración: cart viejo tenía couponCode global. Lo aplicamos a la lastStoreId
    // (la tienda donde se agregó el último item) si existe.
    if (parsed.couponCode && !parsed.storeMeta) {
      next.storeMeta = {};
      const targetStoreId = parsed.lastStoreId
        ?? (parsed.items[0]?.storeId ?? null);
      if (targetStoreId != null) {
        next.storeMeta[targetStoreId] = {
          ...emptyStoreMeta(),
          couponCode: parsed.couponCode,
        };
      }
      delete next.couponCode;
    }
    if (!next.storeMeta || typeof next.storeMeta !== 'object') {
      next.storeMeta = {};
    }
    return next;
  } catch {
    return emptyCart();
  }
}

function save() {
  try {
    localStorage.setItem(storageKey(_currentUid), JSON.stringify(state));
  } catch { /* ignore */ }
}

function itemKey(item) {
  return `${item.storeId}:${item.productId}:${item.promotionId ?? 0}:${item.flashSaleId ?? 0}`;
}

function notify() {
  const detail = snapshot(state);
  yapiBus.emit('cart_change', detail);
  window.dispatchEvent(new CustomEvent('yapify:cart-change', { detail }));
}

function snapshot(s) {
  const totalItems = s.items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const totalSubtotal = +s.items
    .reduce((sum, i) => sum + (i.effectivePrice || 0) * (i.quantity || 0), 0)
    .toFixed(2);
  return { ...s, totalItems, totalSubtotal };
}

function ensureStoreMeta(storeId) {
  if (storeId == null) return null;
  if (!state.storeMeta[storeId]) {
    state.storeMeta[storeId] = emptyStoreMeta();
  }
  return state.storeMeta[storeId];
}

/**
 * Limpia entries de storeMeta que ya no tienen items asociados.
 * Llamar después de mutaciones que pueden vaciar tiendas.
 */
function pruneStoreMeta() {
  const activeStoreIds = new Set(state.items.map((i) => String(i.storeId)));
  for (const sid of Object.keys(state.storeMeta)) {
    if (!activeStoreIds.has(String(sid))) delete state.storeMeta[sid];
  }
}

function migrateLegacy() {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    const anonKey = storageKey(null);
    if (LEGACY_KEY === anonKey) return;
    if (!localStorage.getItem(anonKey)) {
      localStorage.setItem(anonKey, legacy);
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* ignore */ }
}

migrateLegacy();

let _currentUid = null;
let state = load(null);

// Seed the bus on boot so features mounted later receive the current cart
// snapshot through `cart_change` (replayed from the bus cache).
yapiBus.emit('cart_change', snapshot(state));

export const cartService = {
  itemKey,

  setUser(uid) {
    const next = uid || null;
    if (next === _currentUid) return;
    _currentUid = next;
    state = load(_currentUid);
    notify();
  },

  getUserUid() {
    return _currentUid;
  },

  get() {
    return snapshot(state);
  },

  addItem({
    product, storeId, storeName, effectivePrice,
    promotion = null, flashSale = null, origin = null,
  }) {
    if (!product || !storeId) return;
    const imageUrl = product.image_url
      || (product.images?.[0]?.image_url ?? product.images?.[0]?.url ?? null)
      || null;
    const base = Number(product.price ?? 0);
    const eff = Number(effectivePrice ?? base);
    const promoId = promotion?.id ?? null;
    const flashId = flashSale?.id ?? null;
    // `{ kind, ref }` es el shape con el que viaja el origen por todo el shell;
    // el item del carrito lo guarda ya con los nombres del backend.
    const { kind: sourceKind, ref: sourceRef } = normalizeOrigin(origin);

    const key = itemKey({ storeId, productId: product.id, promotionId: promoId, flashSaleId: flashId });
    const existing = state.items.find((i) => itemKey(i) === key);
    if (existing) {
      // ── Atribución de primer toque ──
      // `itemKey` deduplica por tienda+producto+promo+flash A PROPÓSITO, sin el
      // origen: dos líneas del mismo producto en el carrito se leen como un bug.
      // Al fusionar gana el origen ya guardado, nunca el nuevo. Es decir: manda
      // quien causó el descubrimiento, no el último clic.
      //
      // Para la tesis es deliberadamente el criterio MENOS favorable al
      // recomendador. Si el feed "Para ti" lo mostró y después el usuario lo
      // buscó por nombre, el mérito queda en el feed (fue el feed el que se lo
      // hizo conocer); pero si lo encontró navegando y recién después apareció
      // en el feed, el mérito NO es del feed. Cualquier otra regla — último
      // toque, o dejar que `recommendation` pise — le regalaría ventas al
      // módulo que justamente se está tratando de medir.
      state.items = state.items.map((i) =>
        itemKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i,
      );
    } else {
      state.items.push({
        storeId,
        storeName: storeName || '',
        productId: product.id,
        name: product.name,
        imageUrl,
        basePrice: base,
        effectivePrice: eff,
        promotionId: promoId,
        flashSaleId: flashId,
        sourceKind,
        sourceRef,
        quantity: 1,
        addedAt: Date.now(),
      });
    }
    state.lastStoreId = storeId;
    ensureStoreMeta(storeId);
    save();
    notify();
  },

  incrementItem(key) {
    const it = state.items.find((i) => itemKey(i) === key);
    if (!it) return;
    // Immutable: produce a NEW item object so <cart-item>'s identity-based
    // change detection re-renders the quantity (in-place mutation kept the same
    // reference and Lit skipped the update).
    state.items = state.items.map((i) =>
      itemKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i,
    );
    save();
    notify();
  },

  decrementItem(key) {
    const it = state.items.find((i) => itemKey(i) === key);
    if (!it) return;
    const nextQty = Math.max(0, it.quantity - 1);
    if (nextQty === 0) {
      state.items = state.items.filter((i) => itemKey(i) !== key);
    } else {
      state.items = state.items.map((i) =>
        itemKey(i) === key ? { ...i, quantity: nextQty } : i,
      );
    }
    pruneStoreMeta();
    save();
    notify();
  },

  setQuantity(key, qty) {
    const q = Math.max(0, Math.floor(Number(qty) || 0));
    const it = state.items.find((i) => itemKey(i) === key);
    if (!it) return;
    if (q === 0) state.items = state.items.filter((i) => itemKey(i) !== key);
    else state.items = state.items.map((i) => (itemKey(i) === key ? { ...i, quantity: q } : i));
    pruneStoreMeta();
    save();
    notify();
  },

  removeItem(key) {
    state.items = state.items.filter((i) => itemKey(i) !== key);
    pruneStoreMeta();
    save();
    notify();
  },

  clear() {
    state.items = [];
    state.storeMeta = {};
    state.lastStoreId = null;
    save();
    notify();
  },

  clearStore(storeId) {
    state.items = state.items.filter((i) => String(i.storeId) !== String(storeId));
    delete state.storeMeta[storeId];
    save();
    notify();
  },

  setStoreNotes(storeId, text) {
    const meta = ensureStoreMeta(storeId);
    if (!meta) return;
    meta.notes = String(text || '').slice(0, 500);
    save();
    notify();
  },

  setStoreCoupon(storeId, code) {
    const meta = ensureStoreMeta(storeId);
    if (!meta) return;
    meta.couponCode = code?.trim() || null;
    save();
    notify();
  },

  setStorePendingOrder(storeId, orderId) {
    const meta = ensureStoreMeta(storeId);
    if (!meta) return;
    meta.pendingOrderId = orderId ?? null;
    save();
    notify();
  },

  clearStorePendingOrder(storeId) {
    const meta = state.storeMeta[storeId];
    if (!meta || meta.pendingOrderId == null) return;
    meta.pendingOrderId = null;
    save();
    notify();
  },

  getStoreMeta(storeId) {
    if (storeId == null) return emptyStoreMeta();
    return state.storeMeta[storeId] || emptyStoreMeta();
  },
};

if (typeof window !== 'undefined') {
  window.__yapifyCart = cartService;
}

/* ── Bus command channels ──
 * Features push commands at the cart-service through the bus. main.js
 * never sees these channels — the service subscribes itself at boot.
 */

// Lo emiten DOS features con el mismo nombre y el mismo shape: la tienda
// pública (catálogo, venta flash, evento de pago) y el detalle de item. El
// origen sale de la anotación que dejó la navegación hacia esa pantalla, y la
// ruta activa es lo único que distingue a cuál de las dos pertenece el evento.
//
// `sourceKind` en el detail gana sobre la anotación: lo usa el carrusel "Para
// ti" del detalle de item, donde la card ES la recomendación y no importa cómo
// llegó el usuario a esa pantalla.
yapiBus.on('public_store_product_add', (e) => {
  const {
    product, promotion, flashSale, effectivePrice, storeId, storeName,
    sourceKind, sourceRef,
  } = e.detail ?? {};
  if (!product?.id || !storeId) return;
  const origin = sourceKind
    ? { kind: sourceKind, ref: sourceRef }
    : takePendingOrigin(currentOriginScope());
  cartService.addItem({
    product,
    storeId,
    storeName: storeName || '',
    effectivePrice,
    promotion: promotion ?? null,
    flashSale: flashSale ?? null,
    origin,
  });
});

/**
 * @param {CustomEvent} e - Detail de una `<yapify-foryou-card>`.
 * @param {Object} origin - `{ kind, ref }` a atribuirle al item.
 * @returns {void}
 */
function addFromForyouCard(e, origin) {
  const { product, storeId, storeName, kind, itemId, discountPercent } = e.detail ?? {};
  if (!product?.id || !storeId) return;
  const base = Number(product.price ?? 0);
  const off = Number(discountPercent ?? 0);
  const effectivePrice = off > 0
    ? Math.max(0, +(base * (1 - off / 100)).toFixed(2))
    : base;
  const promotion = kind === 'promotion' && itemId ? { id: itemId } : null;
  const flashSale = kind === 'flash_sale' && itemId ? { id: itemId } : null;
  cartService.addItem({
    product,
    storeId,
    storeName: storeName || '',
    effectivePrice,
    promotion,
    flashSale,
    origin,
  });
}

// Both the dashboard "Para Ti" feed and the kind lists use <yapify-foryou-card>,
// so both add-to-cart channels share the same handler — pero NO comparten
// origen: el feed del dashboard es la única superficie del recomendador, y las
// listas por tipo son navegación por catálogo de tiendas ya seguidas.
//
// El `bucket` del feed (`model`, `popular`, `fresh`, `followed`, `category`,
// `cold_start`) viaja dentro del ref porque es lo único que distingue una
// recomendación del modelo de IA de una heurística de respaldo — sin eso, la
// tesis no puede separar el aporte del modelo del de "lo más popular".
yapiBus.on('dashboard_add_to_cart', (e) => {
  const { bucket, kind, itemId } = e.detail ?? {};
  addFromForyouCard(e, {
    kind: 'recommendation',
    ref: buildSourceRef('foryou', bucket, kind, itemId),
  });
});

yapiBus.on('kind_list_add_to_cart', (e) => {
  addFromForyouCard(e, { kind: 'browse' });
});

setupCartOriginTracker(yapiBus);

yapiBus.on('cart_set_user', (e) => {
  cartService.setUser(e.detail ?? null);
});
