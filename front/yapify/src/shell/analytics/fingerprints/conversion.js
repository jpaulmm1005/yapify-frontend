/**
 * Fingerprints de conversión — son el TARGET principal del recomendador.
 *
 * `order_paid`, `reward_redeemed`, `points_received` son positives fuertes
 * y se disparan CLIENT-SIDE cuando el cliente ve la confirmación del backend.
 * Aceptamos ~3-5% de pérdida por crashes/red — para piloto académico es OK.
 */

export const A_cartViewed = {
  event: 'cart_viewed',
  props: {
    items_count: 'itemsCount',
    subtotal: 'subtotal',
    source: { literal: 'cart' },
  },
};

/**
 * Producto/flash sale agregado al carrito. Unifica los antiguos
 * `product_added_to_cart` y `flash_added_to_cart` usando item_kind.
 */
export const A_cartItemAdded = {
  event: 'cart_item_added',
  props: {
    item_kind: 'itemKind',
    item_id: 'itemId',
    product_id: 'productId',          // mantener temporal hasta migrar pipeline
    store_id: 'storeId',
    price: 'effectivePrice',
    quantity: 'quantity',
    source: 'source',
  },
  groups: { store: 'storeId' },
};

export const A_cartItemRemoved = {
  event: 'cart_item_removed',
  props: {
    item_kind: 'itemKind',
    item_id: 'itemId',
    product_id: 'productId',
    store_id: 'storeId',
    source: { literal: 'cart' },
  },
  groups: { store: 'storeId' },
};

export const A_checkoutStarted = {
  event: 'checkout_started',
  props: {
    items_count: 'itemsCount',
    subtotal: 'subtotal',
    payment_method: 'paymentMethod',
    store_id: 'storeId',
    source: { literal: 'cart' },
  },
  groups: { store: 'storeId' },
};

/**
 * Pago confirmado — cliente recibe OK del backend. TARGET principal.
 */
export const A_orderPaid = {
  event: 'order_paid',
  props: {
    order_id: 'orderId',
    store_id: 'storeId',
    total: 'total',
    items_count: 'itemsCount',
    payment_method: 'paymentMethod',
    source: { literal: 'checkout' },
  },
  groups: { store: 'storeId' },
  // Dedup: cliente puede re-renderizar la confirmación. Sin dedup, doble traza.
  // El layer ya dedupa 2s — confiamos en eso. NO declaramos dedup:false.
};

/**
 * Cliente ve la confirmación de pickup (visualmente o via push). Cierra el journey.
 */
export const A_orderPickedUp = {
  event: 'order_picked_up',
  props: {
    order_id: 'orderId',
    store_id: 'storeId',
    source: { literal: 'orders' },
  },
  groups: { store: 'storeId' },
};

/**
 * Canje de reward. Señal MUY fuerte de loyalty.
 */
export const A_rewardRedeemed = {
  event: 'reward_redeemed',
  props: {
    reward_id: 'itemId',
    store_id: 'storeId',
    points_cost: 'pointsCost',
    source: { literal: 'item_detail' },
  },
  groups: { store: 'storeId' },
};

/**
 * Cliente USER ve nuevo balance de puntos tras un scan QR del admin
 * (vía push FCM o refresh manual del balance).
 */
export const A_pointsReceived = {
  event: 'points_received',
  props: {
    store_id: 'storeId',
    points: 'points',
    source: { literal: 'qr_scan' },
  },
  groups: { store: 'storeId' },
};

export const A_couponCodeCopied = {
  event: 'coupon_code_copied',
  props: {
    coupon_id: 'itemId',
    store_id: 'storeId',
    source: { literal: 'item_detail' },
  },
  groups: { store: 'storeId' },
};

export const A_eventSubscribed = {
  event: 'event_subscribed',
  props: {
    event_id: 'itemId',
    store_id: 'storeId',
    source: { literal: 'item_detail' },
  },
  groups: { store: 'storeId' },
};

/**
 * Cliente confirma/aplica una promoción (genera intent de compra con descuento).
 */
export const A_promotionUsed = {
  event: 'promotion_used',
  props: {
    promotion_id: 'itemId',
    store_id: 'storeId',
    discount_pct: 'discountPct',
    source: { literal: 'item_detail' },
  },
  groups: { store: 'storeId' },
};

/**
 * Usuario tap "Canjear ahora" en una card del feed "Para Ti" del dashboard.
 * Negativo si nunca confirma; positivo cuando llega `A_dashboardRewardRedeemed`.
 */
export const A_dashboardRewardRedeemRequested = {
  event: 'reward_redeem_requested',
  props: {
    reward_id: 'item.item_id',
    store_id: 'item.store_id',
    points_cost: 'item.points_cost',
    user_points_at_attempt: 'userPoints',
    position: 'position',
    source: { literal: 'dashboard_foryou' },
  },
  groups: { store: 'item.store_id' },
};

/**
 * Backend confirmó el canje iniciado desde el dashboard. Positive fuerte.
 * Complementa `A_rewardRedeemed` (item_detail source) — mismo evento PostHog
 * pero con `source: 'dashboard_foryou'` para distinguir el flujo.
 */
export const A_dashboardRewardRedeemed = {
  event: 'reward_redeemed',
  props: {
    reward_id: 'reward_id',
    redemption_id: 'id',
    source: { literal: 'dashboard_foryou' },
  },
};

/**
 * Canje desde dashboard falló (backend 4xx/5xx o red). Negative explícito.
 */
export const A_dashboardRewardRedeemFailed = {
  event: 'reward_redeem_failed',
  props: {
    scope: 'scope',
    code: 'code',
    message: 'message',
    source: { literal: 'dashboard_foryou' },
  },
  when: (detail) => detail?.scope === 'redeem',
};
