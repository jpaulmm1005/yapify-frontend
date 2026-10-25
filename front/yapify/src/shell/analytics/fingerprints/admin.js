/**
 * Admin-side analytics fingerprints — declarative `A_xxx` for events
 * emitted by the store-admin features (CRUD on coupons / promotions /
 * products / flash sales / events / pickup).
 *
 * Microfrontends never import this file directly — the my-store page
 * descriptor wires the binds, the resolver fills the props.
 *
 * Every fingerprint declares `source` with a literal: the resolver warns
 * when an event resolves without one, and it lets PostHog segment actions
 * by the surface they came from. Admin CRUD all share `'admin_panel'`;
 * the QR-grant flow keeps its own `'manual_qr'` origin.
 */

export const A_adminCouponCreated = {
  event: 'admin_coupon_created',
  props: {
    coupon_id:    'couponId',
    store_id:     'storeId',
    discount_pct: 'discountPct',
    target_type:  'targetType',
    source:       { literal: 'admin_panel' },
  },
  groups: { store: 'storeId' },
};

export const A_adminCouponUpdated = {
  event: 'admin_coupon_updated',
  props: {
    coupon_id:    'couponId',
    store_id:     'storeId',
    discount_pct: 'discountPct',
    target_type:  'targetType',
    source:       { literal: 'admin_panel' },
  },
  groups: { store: 'storeId' },
};

export const A_adminCouponDeleted = {
  event: 'admin_coupon_deleted',
  props: {
    coupon_id: 'couponId',
    store_id:  'storeId',
    source:    { literal: 'admin_panel' },
  },
  groups: { store: 'storeId' },
};

export const A_adminProductCreated = {
  event: 'admin_product_created',
  props: {
    product_id: 'productId',
    store_id:   'storeId',
    user_uid:   '$session.uid',
    source:     { literal: 'admin_panel' },
  },
  groups: { store: 'storeId' },
};

export const A_adminProductUpdated = {
  event: 'admin_product_updated',
  props: {
    product_id: 'productId',
    store_id:   'storeId',
    user_uid:   '$session.uid',
    source:     { literal: 'admin_panel' },
  },
  groups: { store: 'storeId' },
};

export const A_adminProductDeleted = {
  event: 'admin_product_deleted',
  props: {
    product_id: 'productId',
    store_id:   'storeId',
    user_uid:   '$session.uid',
    source:     { literal: 'admin_panel' },
  },
  groups: { store: 'storeId' },
};

export const A_adminPromotionCreated = {
  event: 'admin_promotion_created',
  props: {
    promotion_id: 'promotionId',
    store_id:     'storeId',
    discount_pct: 'discountPct',
    product_id:   'productId',
    source:       { literal: 'admin_panel' },
  },
  groups: { store: 'storeId' },
};

export const A_adminPromotionUpdated = {
  event: 'admin_promotion_updated',
  props: {
    promotion_id: 'promotionId',
    store_id:     'storeId',
    discount_pct: 'discountPct',
    product_id:   'productId',
    source:       { literal: 'admin_panel' },
  },
  groups: { store: 'storeId' },
};

export const A_adminPromotionDeleted = {
  event: 'admin_promotion_deleted',
  props: {
    promotion_id: 'promotionId',
    store_id:     'storeId',
    source:       { literal: 'admin_panel' },
  },
  groups: { store: 'storeId' },
};

/**
 * Reserved for future use — the feature does not yet expose an
 * active/inactive toggle outside the create/update flow.
 */
export const A_adminPromotionToggled = {
  event: 'admin_promotion_toggled',
  props: {
    promotion_id: 'promotionId',
    is_active:    'isActive',
    store_id:     'storeId',
    source:       { literal: 'admin_panel' },
  },
  groups: { store: 'storeId' },
};

/**
 * Loyalty-grant fingerprints — emitted by the store-qr feature when an
 * owner scans a customer QR and assigns points (or when the scan
 * itself fails before reaching the grant flow).
 */
export const A_adminPointsGranted = {
  event: 'admin_points_granted',
  props: {
    store_id:       'storeId',
    user_uid:       'userUid',
    points:         'points',
    method:         'method',
    source:         { literal: 'manual_qr' },
    granted_by_uid: '$session.uid',
  },
  groups: { store: 'storeId' },
};

export const A_adminPointsScanFailed = {
  event: 'admin_points_scan_failed',
  props: {
    store_id:       'storeId',
    method:         'method',
    reason:         'reason',
    source:         { literal: 'manual_qr' },
    granted_by_uid: '$session.uid',
  },
  groups: { store: 'storeId' },
};

export const A_adminStatsPeriodChanged = {
  event: 'admin_stats_period_changed',
  props: {
    store_id: 'storeId',
    period:   'period',
    user_uid: '$session.uid',
    source:   { literal: 'admin_panel' },
  },
  groups: { store: 'storeId' },
};
