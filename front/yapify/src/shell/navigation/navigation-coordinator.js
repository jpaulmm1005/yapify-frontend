import { yapiBus } from '../event-bus/yapi-bus.js';
import { appRouter } from '../router/app-router.js';
import { clearSelectedStoreId, saveSelectedStoreId } from '../session/selected-store.js';

/**
 * Cross-feature navigation channels that need a side-effect (read by the
 * target feature when it mounts) before the route changes. Pure-navigation
 * channels (where the descriptor has `link:` or `backStep: true`) are wired
 * by the component wirer and don't pass through here.
 *
 * The pattern mirrors `session-coordinator.js`: a single `setup*` call
 * subscribes a handful of bus channels and emits navigations through
 * `appRouter`. The shell stays a pure orchestrator — features never import
 * the router or the bus directly.
 */

/** Slugify a store name for legacy `/store/<slug>-<id>` paths. */
function slugify(value) {
  return String(value || 'store')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'store';
}

/** Returns the path piece for `/store/<piece>`. Prefers the opaque public_id
 *  when present; falls back to `<slug>-<id>` for legacy emitters. */
function storePathOf({ publicId, storeId, storeName } = {}) {
  if (publicId) return publicId;
  return `${slugify(storeName)}-${storeId}`;
}

export function setupNavigationCoordinator() {
  // ── Item detail → public store ──
  // Sets the initial tab the public-store feature will land on (it reads
  // `window.__yapifyPublicStoreTab` in connectedCallback and clears it).
  yapiBus.on('item_open_store', (e) => {
    const { storeId, storeName, publicId, tab } = e.detail ?? {};
    if (!storeId && !publicId) return;
    window.__yapifyPublicStoreTab = tab || 'productos';
    appRouter.navigateTo(`/store/${storePathOf({ publicId, storeId, storeName })}`);
  });

  // ── Notifications → source store ──
  // Same pattern, with the tab derived from the notification's source_type.
  yapiBus.on('notifications_open_source', (e) => {
    const { storeId, storeName, publicId, sourceType } = e.detail ?? {};
    if (!storeId && !publicId) return;
    const tabBySource = {
      promotion: 'productos',
      product: 'productos',
      coupon: 'cupones',
      flash_sale: 'flash',
      event: 'eventos',
    };
    window.__yapifyPublicStoreTab = tabBySource[sourceType] || 'productos';
    appRouter.navigateTo(`/store/${storePathOf({ publicId, storeId, storeName })}`);
  });

  // ── My stores → open existing store admin dashboard ──
  // The admin store feature reads `window.__yapifySelectedStoreId` (with a
  // localStorage fallback for F5 survival) to know which store to load.
  yapiBus.on('my_stores_open_store', (e) => {
    const { storeId } = e.detail ?? {};
    if (!storeId) return;
    window.__yapifyForceCreate = false;
    saveSelectedStoreId(storeId);
    appRouter.dropRoute('myStore');
    appRouter.navigateTo('/my-store');
  });

  // ── My stores → create a new store ──
  // One-shot flag tells the admin feature to skip the auto-pick of the
  // first existing store and land on the creation form.
  yapiBus.on('my_stores_create_store', () => {
    clearSelectedStoreId();
    window.__yapifyForceCreate = true;
    appRouter.dropRoute('myStore');
    appRouter.navigateTo('/my-store');
  });

  // ── Admin store → exit back to user mode ──
  // Clears the selected-store state so the next admin entry goes through
  // the auto-resolve path again.
  yapiBus.on('stores_back', () => {
    clearSelectedStoreId();
    appRouter.navigateTo('/dashboard');
  });
}
