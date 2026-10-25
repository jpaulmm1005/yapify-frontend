import '../shell/polyfills/scoped-registry.js';
import { YapifyFeatureStoresPe } from 'yapify-feature-stores-pe';
import {
  A_adminFlashCreated,
  A_adminFlashUpdated,
  A_adminFlashDeleted,
} from 'yapify-feature-store-flash-sales-pe';
import {
  A_adminEventCreated,
  A_adminEventUpdated,
  A_adminEventDeleted,
} from 'yapify-feature-store-events-pe';
import { A_adminPickupValidated } from 'yapify-feature-store-pickup-pe';
import {
  A_adminCouponCreated,
  A_adminCouponUpdated,
  A_adminCouponDeleted,
  A_adminProductCreated,
  A_adminProductUpdated,
  A_adminProductDeleted,
  A_adminPromotionCreated,
  A_adminPromotionUpdated,
  A_adminPromotionDeleted,
  A_adminPromotionToggled,
  A_adminPointsGranted,
  A_adminPointsScanFailed,
  A_adminStatsPeriodChanged,
} from '../shell/analytics/fingerprints/index.js';

if (!customElements.get(YapifyFeatureStoresPe.is)) {
  customElements.define(YapifyFeatureStoresPe.is, YapifyFeatureStoresPe);
}

export default (CONFIG) => ({
  hash: 'my-store',
  route: '/my-store',
  components: [
    {
      zone: 'app__main',
      tag: YapifyFeatureStoresPe.is,
      type: 'UI',
      properties: {
        apiBaseUrl: CONFIG.apiBaseUrl,
        yapiConnections: {
          in: {
            // Realtime: an order of this owner changed, or a customer redeemed
            // a reward. The root forwards it to the section on screen (sales,
            // rewards), which refetches.
            orders_changed: { bind: 'invalidate', signal: true },
            redemptions_changed: { bind: 'invalidate', signal: true },
          },
          out: {
            // Creating a store makes the owner's store list stale. The channel
            // is named for its consumer: `my-stores.js` binds
            // `my_stores_invalidate` to the list's `invalidate()`.
            my_stores_invalidate: { bind: 'yapify-feature-stores-pe-store-created' },
            // Side-effect navigation (clears selected-store state) handled
            // by the navigation-coordinator.
            stores_back: { bind: 'yapify-feature-stores-pe-back' },
            // Solo-analytics — eventos burbujeados desde sub-features admin
            admin_product_created: {
              bind: 'yapify-feature-store-products-pe-product-created',
              analytics: A_adminProductCreated,
              skipBus: true,
            },
            admin_product_updated: {
              bind: 'yapify-feature-store-products-pe-product-updated',
              analytics: A_adminProductUpdated,
              skipBus: true,
            },
            admin_product_deleted: {
              bind: 'yapify-feature-store-products-pe-product-deleted',
              analytics: A_adminProductDeleted,
              skipBus: true,
            },
            admin_promotion_created: {
              bind: 'yapify-feature-store-promotions-pe-promotion-created',
              analytics: A_adminPromotionCreated,
              skipBus: true,
            },
            admin_promotion_updated: {
              bind: 'yapify-feature-store-promotions-pe-promotion-updated',
              analytics: A_adminPromotionUpdated,
              skipBus: true,
            },
            admin_promotion_deleted: {
              bind: 'yapify-feature-store-promotions-pe-promotion-deleted',
              analytics: A_adminPromotionDeleted,
              skipBus: true,
            },
            // The toggle is confirmed by the promotions orchestrator DM, so
            // the event carries its `-dm-` namespace. The root only re-emits
            // create / update / delete.
            admin_promotion_toggled: {
              bind: 'yapify-feature-store-promotions-pe-dm-promotion-toggled',
              analytics: A_adminPromotionToggled,
              skipBus: true,
            },
            admin_coupon_created: {
              bind: 'yapify-feature-store-coupons-pe-coupon-created',
              analytics: A_adminCouponCreated,
              skipBus: true,
            },
            admin_coupon_updated: {
              bind: 'yapify-feature-store-coupons-pe-coupon-updated',
              analytics: A_adminCouponUpdated,
              skipBus: true,
            },
            admin_coupon_deleted: {
              bind: 'yapify-feature-store-coupons-pe-coupon-deleted',
              analytics: A_adminCouponDeleted,
              skipBus: true,
            },
            admin_flash_created: {
              bind: 'admin-flash-created',
              analytics: A_adminFlashCreated,
              skipBus: true,
            },
            admin_flash_updated: {
              bind: 'admin-flash-updated',
              analytics: A_adminFlashUpdated,
              skipBus: true,
            },
            admin_flash_deleted: {
              bind: 'admin-flash-deleted',
              analytics: A_adminFlashDeleted,
              skipBus: true,
            },
            admin_event_created: {
              bind: 'admin-event-created',
              analytics: A_adminEventCreated,
              skipBus: true,
            },
            admin_event_updated: {
              bind: 'admin-event-updated',
              analytics: A_adminEventUpdated,
              skipBus: true,
            },
            admin_event_deleted: {
              bind: 'admin-event-deleted',
              analytics: A_adminEventDeleted,
              skipBus: true,
            },
            admin_pickup_validated: {
              bind: 'admin-pickup-validated',
              analytics: A_adminPickupValidated,
              skipBus: true,
            },
            // Both events bubble up from `<yapify-feature-store-qr-pe>`, the
            // sub-feature `/my-store/qr` mounts inside this element.
            admin_points_granted: {
              bind: 'admin-points-granted',
              analytics: A_adminPointsGranted,
              skipBus: true,
            },
            admin_points_scan_failed: {
              bind: 'admin-points-scan-failed',
              analytics: A_adminPointsScanFailed,
              skipBus: true,
            },
            // A grant changes the customer's balance, so the points wallet is
            // stale from that moment on. Named for its consumer:
            // `profile-points.js` binds `points_wallet_invalidate` to the
            // wallet's `invalidate()`.
            points_wallet_invalidate: { bind: 'admin-points-granted' },
            admin_stats_period_changed: {
              bind: 'yapify-feature-store-stats-pe-period-changed',
              analytics: A_adminStatsPeriodChanged,
              skipBus: true,
            },
            // Admin sub-sections live at `/my-store/<section>`, so the link is
            // an explicit path with a placeholder. `'my-store'` is not a route
            // key (the key is `myStore`) and resolved to a pathless
            // `my-store?section=campaigns` that matched no route.
            stats_go_campaigns: {
              bind: 'yapify-feature-store-stats-pe-go-campaigns',
              link: {
                page: '/my-store/:section',
                params: { section: { literal: 'campaigns' } },
              },
            },
          },
        },
      },
    },
  ],
});
