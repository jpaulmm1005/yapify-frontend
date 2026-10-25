/**
 * Fingerprints de descubrimiento.
 *
 * `user_uid` y `surface` son auto-fill — no se declaran. `source` SÍ se declara
 * en cada fingerprint (es contextual al lugar del listado).
 *
 * Spec base: docs/superpowers/specs/2026-05-14-analytics-tagging-design.md sec 2.1.
 */

/**
 * Card visible ≥50% durante ≥500ms. Negativo implícito para el recomendador
 * cuando NO va acompañada de item_clicked subsiguiente.
 *
 * Schema del evento DOM:
 *   { itemKind, itemId, storeId, source, position }
 */
export const A_itemImpression = {
  event: 'item_impression',
  props: {
    item_kind: 'itemKind',
    item_id: 'itemId',
    store_id: 'storeId',
    source: 'source',
    position: 'position',
  },
  groups: { store: 'storeId' },
  when: (detail) => !!detail.itemId,
  // Las impressions se disparan en volumen — sin dedup el feed las multiplica.
  // Tracker ya dedupa por sesión-de-tracker, pero el layer agrega capa extra
  // con su dedup global de 2s. OK por defecto.
};

/**
 * Tap intencional sobre una card. Positivo medio.
 * Reemplaza a `store_detail_opened`, `kind_list_item_clicked`,
 * `followed_store_clicked`, `product_viewed` (lado card).
 */
export const A_itemClicked = {
  event: 'item_clicked',
  props: {
    item_kind: 'itemKind',
    item_id: 'itemId',
    store_id: 'storeId',
    source: 'source',
    position: 'position',
  },
  groups: { store: 'storeId' },
  when: (detail) => !!detail.itemId,
};

/**
 * Búsqueda con query no-vacío (después de debounce del feature).
 */
export const A_searchPerformed = {
  event: 'search_performed',
  props: {
    query: 'query',
    results_count: 'resultsCount',
    source: { literal: 'explore_search' },
  },
  when: (detail) => !!detail.query && detail.query.trim().length > 0,
};

/**
 * Filtro de categoría aplicado en explore.
 */
export const A_categoryFiltered = {
  event: 'category_filtered',
  props: {
    category_id: 'categoryId',
    category_name: 'categoryName',
    source: { literal: 'explore_filter' },
  },
  when: (detail) => detail.categoryId != null,
};

/**
 * Listado por kind abierto (e.g. /kind/promotion).
 */
export const A_kindListViewed = {
  event: 'kind_list_viewed',
  props: {
    kind: 'kind',
    results_count: 'count',
    source: { literal: 'kind_list' },
  },
};

/**
 * Dashboard abierto (al cargar la home post-login).
 */
export const A_dashboardViewed = {
  event: 'dashboard_viewed',
  props: {
    followed_count: 'followedCount',
    source: { literal: 'dashboard' },
  },
};

/**
 * Followed-stores page abierta. El user llega vía "Ver todas" desde el
 * dashboard. Mismo shape que dashboardViewed para que el funnel
 * `dashboard_viewed → followed_stores_viewed` sea trivial de comparar.
 */
export const A_followedStoresViewed = {
  event: 'followed_stores_viewed',
  props: {
    followed_count: 'followedCount',
    source: { literal: 'followed_stores_page' },
  },
};
