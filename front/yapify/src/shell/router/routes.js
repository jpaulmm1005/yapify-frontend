/**
 * Single source of truth for every route in the shell.
 *
 * Each entry is `<camelCaseKey>: '<path[/:placeholder]*>'`. The descriptors
 * of every feature use the camelCase key inside `link.page`; placeholders
 * are filled from `link.params`. Extra params not consumed by placeholders
 * are appended as a query string by `shell/wiring/link-resolver.js`.
 *
 * Example consumer (feature page descriptor):
 *
 * ```js
 *   link: {
 *     page: 'followedStores',
 *     params: { storeId: 'store.id' },
 *   }
 * ```
 *
 * With `followedStores: '/followed-stores'`, the resolved URL is
 * `/followed-stores?storeId=123`. With `'/followed-stores/:storeId'` it is
 * `/followed-stores/123`.
 */
export default {
  routes: {
    login:               '/login',
    dashboard:           '/dashboard',
    onboarding:          '/onboarding',
    profile:             '/profile',
    profilePoints:       '/profile/points',
    profileRedemptions:  '/profile/redemptions',
    myStore:             '/my-store',
    myStores:            '/my-stores',
    myEvents:            '/my-events',
    purchases:           '/purchases',
    followedStores:      '/followed-stores',
    stores:              '/stores',
    store:               '/store/:slug',
    cart:                '/cart',
    checkoutReturn:      '/checkout/return',
    notifications:       '/notifications',
    qr:                  '/qr',
    item:                '/item/:kind/:itemId',
    kind:                '/kind/:kind',
    terms:               '/terms',
    privacy:             '/privacy',
  },
  defaultRoute: 'login',
};
