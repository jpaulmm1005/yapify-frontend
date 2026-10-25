/**
 * Fingerprints A_xxx — barrel.
 *
 * Toda fingerprint declarativa vive en este folder y se exporta desde acá.
 * Los page descriptors (yapify/src/pages/*) importan desde 'shell/analytics/fingerprints'.
 * Los microfrontends NUNCA importan nada de este folder.
 *
 * Organización por dominio:
 *   - discovery.js   → impressions, clicks intencionales, search, filtros
 *   - engagement.js  → views, time, follow/unfollow, tab switch
 *   - conversion.js  → cart, checkout, order, points, rewards, cupones
 *   - auth.js        → login, onboarding, my-stores
 *   - admin.js       → CRUD mutations en pantallas /my-store/*
 */

export * from './discovery.js';
export * from './engagement.js';
export * from './conversion.js';
export * from './auth.js';
export * from './admin.js';
