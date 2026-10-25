/**
 * Fingerprints de engagement (views profundos, time, follows, tabs).
 *
 * `user_uid` y `surface` son auto-fill. Cada fingerprint store-scoped declara
 * `groups: { store: 'storeId' }` para asociarlo a la tienda en PostHog.
 */

/**
 * Detail abierto. Positivo fuerte. Reemplaza a `public_store_opened`,
 * `product_viewed` (lado detail). Dispara en `connectedCallback` del feature.
 */
export const A_itemViewed = {
  event: 'item_viewed',
  props: {
    item_kind: 'itemKind',
    item_id: 'itemId',
    store_id: 'storeId',
    source: 'source',
  },
  groups: { store: 'storeId' },
  when: (detail) => !!detail.itemId,
};

/**
 * Tiempo total en el detail. Dispara en `disconnectedCallback`.
 * Filtra rebotes (<1s) y abandonos (>30min).
 */
export const A_timeOnItem = {
  event: 'time_on_item',
  props: {
    item_kind: 'itemKind',
    item_id: 'itemId',
    store_id: 'storeId',
    duration_ms: 'durationMs',
    source: { literal: 'detail' },
  },
  groups: { store: 'storeId' },
  when: (detail) =>
    typeof detail.durationMs === 'number' &&
    detail.durationMs >= 1000 &&
    detail.durationMs <= 30 * 60 * 1000,
};

/**
 * Usuario sigue una tienda. Señal fuerte de afinidad.
 */
export const A_storeFollowed = {
  event: 'store_followed',
  props: {
    store_id: 'storeId',
    store_name: 'storeName',
    source: 'source',
  },
  groups: { store: 'storeId' },
};

/**
 * Usuario deja de seguir. Negativo explícito.
 */
export const A_storeUnfollowed = {
  event: 'store_unfollowed',
  props: {
    store_id: 'storeId',
    store_name: 'storeName',
    source: 'source',
  },
  groups: { store: 'storeId' },
};

/**
 * Toggle de notificaciones de una tienda seguida. Unifica los 2 eventos
 * antiguos (`store_notifications_enabled` / `_disabled`) usando un bool.
 */
export const A_storeNotificationsToggled = {
  event: 'store_notifications_toggled',
  props: {
    store_id: 'storeId',
    enabled: 'enabled',
    source: 'source',
  },
  groups: { store: 'storeId' },
};

/**
 * Tab interno del perfil público de tienda (about/products/promos/etc).
 * Señal de interés por kind agregado.
 */
export const A_publicStoreTabSwitched = {
  event: 'public_store_tab_switched',
  props: {
    store_id: 'storeId',
    tab: 'tab',
    source: { literal: 'store_detail' },
  },
  groups: { store: 'storeId' },
};

/**
 * Usuario va de un item a la tienda dueña. Señal de contexto de navegación.
 * Pre-existe — mantiene su semántica, solo se mueve al shell.
 */
export const A_itemOpenedStore = {
  event: 'item_opened_store',
  props: {
    item_kind: 'kind',
    item_id: 'itemId',
    store_id: 'storeId',
    source: { literal: 'item_detail' },
  },
  groups: { store: 'storeId' },
};
