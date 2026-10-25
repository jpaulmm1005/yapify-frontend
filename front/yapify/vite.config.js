import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { componentAutoImportPlugin } from './vite-plugin-auto-import.js';
import { hoverGuardPlugin } from './vite-plugin-hover-guard.js';
import { eventManifestPlugin } from './vite-plugin-event-manifest.js';

const LOCAL_PACKAGES = [
  'yapify-components',
  'yapify-feature-onboarding-pe',
  'yapify-feature-login-pe',
  'yapify-feature-dashboard-pe',
  'yapify-feature-profile-pe',
  'yapify-feature-stores-pe',
  'yapify-feature-my-stores-pe',
  'yapify-feature-store-products-pe',
  'yapify-feature-explore-stores-pe',
  'yapify-feature-public-store-pe',
  '@yapify-components/yapify-mixin',
  '@local-yapify-dms/local-onboarding-dm',
  '@local-yapify-dms/local-login-dm',
  '@local-yapify-dms/local-public-store-dm',
  '@local-yapify-dms/local-explore-stores-dm',
  '@local-yapify-dms/local-my-stores-dm',
  '@local-yapify-dms/local-stores-dm',
  '@local-yapify-dms/local-profile-dm',
  '@local-yapify-dms/local-dashboard-dm',
  '@local-yapify-dms/local-store-products-dm',
  'yapify-feature-store-promotions-pe',
  '@local-yapify-dms/local-store-promotions-dm',
  'yapify-feature-store-product-categories-pe',
  '@local-yapify-dms/local-store-product-categories-dm',
  'yapify-feature-store-coupons-pe',
  '@local-yapify-dms/local-store-coupons-dm',
  'yapify-feature-store-customers-pe',
  '@local-yapify-dms/local-store-customers-dm',
  'yapify-feature-store-events-pe',
  '@local-yapify-dms/local-store-events-dm',
  'yapify-feature-store-flash-sales-pe',
  '@local-yapify-dms/local-store-flash-sales-dm',
  'yapify-feature-cart-pe',
  '@local-yapify-dms/local-cart-dm',
  'yapify-feature-store-campaigns-pe',
  '@local-yapify-dms/local-store-campaigns-dm',
  'yapify-feature-notifications-pe',
  '@local-yapify-dms/local-notifications-dm',
  'yapify-feature-store-rewards-pe',
  '@local-yapify-dms/local-store-rewards-dm',
  'yapify-feature-store-sales-pe',
  '@local-yapify-dms/local-store-sales-dm',
  'yapify-feature-qr-pe',
  '@local-yapify-dms/local-qr-dm',
  'yapify-feature-store-qr-pe',
  '@local-yapify-dms/local-store-points-dm',
  'yapify-feature-purchases-pe',
  '@local-yapify-dms/local-purchases-dm',
  'yapify-feature-item-detail-pe',
  '@local-yapify-dms/local-item-detail-dm',
  'yapify-feature-kind-list-pe',
  '@local-yapify-dms/local-kind-list-dm',
  'yapify-feature-points-wallet-pe',
  '@local-yapify-dms/local-points-wallet-dm',
  'yapify-feature-redemptions-pe',
  '@local-yapify-dms/local-redemptions-dm',
  'yapify-feature-store-pickup-pe',
  '@local-yapify-dms/local-store-pickup-dm',
  'yapify-feature-followed-stores-pe',
  '@local-yapify-dms/local-followed-stores-dm',
  'yapify-feature-store-stats-pe',
  '@local-yapify-dms/local-store-stats-dm',
  'yapify-feature-store-settings-pe',
  '@local-yapify-dms/local-store-settings-dm',
  'yapify-feature-my-events-pe',
  '@local-yapify-dms/local-my-events-dm',
];

/** All local package roots — watches every file inside, not just src/ */
const LOCAL_ROOTS = [
  '../yapify-components',
  '../yapify-feature-onboarding-pe',
  '../yapify-feature-login-pe',
  '../yapify-feature-dashboard-pe',
  '../yapify-feature-profile-pe',
  '../yapify-feature-stores-pe',
  '../yapify-feature-my-stores-pe',
  '../yapify-feature-store-products-pe',
  '../yapify-feature-explore-stores-pe',
  '../yapify-feature-public-store-pe',
  '../yapify-widget-defaults-mixin',
  '../local-onboarding-dm',
  '../local-login-dm',
  '../local-public-store-dm',
  '../local-explore-stores-dm',
  '../local-my-stores-dm',
  '../local-stores-dm',
  '../local-profile-dm',
  '../local-dashboard-dm',
  '../local-store-products-dm',
  '../yapify-feature-store-promotions-pe',
  '../local-store-promotions-dm',
  '../yapify-feature-store-product-categories-pe',
  '../local-store-product-categories-dm',
  '../yapify-feature-store-coupons-pe',
  '../local-store-coupons-dm',
  '../yapify-feature-store-customers-pe',
  '../local-store-customers-dm',
  '../yapify-feature-store-events-pe',
  '../local-store-events-dm',
  '../yapify-feature-store-flash-sales-pe',
  '../local-store-flash-sales-dm',
  '../yapify-feature-cart-pe',
  '../local-cart-dm',
  '../yapify-feature-store-campaigns-pe',
  '../local-store-campaigns-dm',
  '../yapify-feature-notifications-pe',
  '../local-notifications-dm',
  '../yapify-feature-store-rewards-pe',
  '../local-store-rewards-dm',
  '../yapify-feature-store-sales-pe',
  '../local-store-sales-dm',
  '../yapify-feature-qr-pe',
  '../local-qr-dm',
  '../yapify-feature-store-qr-pe',
  '../local-store-points-dm',
  '../yapify-feature-purchases-pe',
  '../local-purchases-dm',
  '../yapify-feature-item-detail-pe',
  '../local-item-detail-dm',
  '../yapify-feature-kind-list-pe',
  '../local-kind-list-dm',
  '../yapify-feature-points-wallet-pe',
  '../local-points-wallet-dm',
  '../yapify-feature-redemptions-pe',
  '../local-redemptions-dm',
  '../yapify-feature-store-pickup-pe',
  '../local-store-pickup-dm',
  '../yapify-feature-followed-stores-pe',
  '../local-followed-stores-dm',
  '../yapify-feature-store-stats-pe',
  '../local-store-stats-dm',
  '../yapify-feature-store-settings-pe',
  '../local-store-settings-dm',
  '../yapify-feature-my-events-pe',
  '../local-my-events-dm',
].map((p) => resolve(__dirname, p));

/**
 * Dev-only: map each local package name to its sibling checkout folder so the
 * running app serves YOUR working copy directly — not the `node_modules` clone
 * npm pulled from GitHub. Edits to the sibling folders then show up instantly
 * and the "two copies drift apart" trap disappears. NOT applied on `build`:
 * production resolves the packages from `node_modules` (cloned from GitHub), so
 * the deployed bundle always reflects what is pushed — GitHub stays the source
 * of truth for prod.
 *
 * Auto-discovers by reading every sibling folder's package.json `name` and
 * keeping the ones declared in LOCAL_PACKAGES, so new local packages need no
 * extra wiring. On CI / Vercel the sibling folders do not exist, so this
 * returns an empty map and resolution falls back to `node_modules`.
 *
 * @returns {Record<String, String>} package name → absolute sibling path.
 */
function localPackageAliases() {
  const root = resolve(__dirname, '..');
  const wanted = new Set(LOCAL_PACKAGES);
  const aliases = {};
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgJsonPath = resolve(root, entry.name, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;
    try {
      const { name } = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      if (wanted.has(name)) aliases[name] = resolve(root, entry.name);
    } catch {
      // noop — skip folders with an unreadable/invalid package.json
    }
  }
  return aliases;
}

export default defineConfig(({ command }) => ({
  plugins: [
    componentAutoImportPlugin(),
    hoverGuardPlugin(),
    eventManifestPlugin(),
    {
      name: 'watch-local-packages',
      configureServer(server) {
        const normalize = (p) => p.replace(/\\/g, '/').toLowerCase();
        const watchPaths = LOCAL_ROOTS.map(normalize);

        // Watch entire package dirs (src/, index.js, styles/, etc.)
        for (const dir of LOCAL_ROOTS) {
          server.watcher.add(dir);
        }

        const reload = (file) => {
          const f = normalize(file);
          // Skip node_modules inside local packages
          if (f.includes('/node_modules/')) return;
          if (watchPaths.some((d) => f.startsWith(d))) {
            server.moduleGraph.invalidateAll();
            server.ws.send({ type: 'full-reload' });
          }
        };

        server.watcher.on('change', reload);
        server.watcher.on('add', reload);
        server.watcher.on('unlink', reload);
      },
    },
  ],
  resolve: {
    alias: {
      '@shell': resolve(__dirname, 'src/shell'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@components': resolve(__dirname, 'src/components'),
      ...(command === 'serve' ? localPackageAliases() : {}),
    },
    // Cada microfrontend (feature, local-dm, yapify-components, yapify-mixin)
    // vive en su propio repo de GitHub y se declara como `github:` dep. En dev
    // los carpetas hermanas de D:/Tesis/<paquete>/ se resuelven por filesystem
    // vía LOCAL_PACKAGES/LOCAL_ROOTS arriba. preserveSymlinks: false deja que
    // Vite siga el realpath cuando un dep transitivo se hoistea en node_modules.
    preserveSymlinks: false,
    // Forzar una sola copia para paquetes que se importan desde múltiples
    // packages locales. Sin esto, los singletons internos (Firebase Apps,
    // lucide icon set) se duplican en runtime y rompen.
    dedupe: ['lit', 'lit-element', 'lit-html', 'lucide', 'firebase', '@firebase/app', '@firebase/auth', '@firebase/messaging'],
  },
  build: {
    outDir: 'dist',
    target: ['es2020', 'chrome89', 'safari13'],
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/pages/loading')) return 'page-loading';
          if (id.includes('/pages/login')) return 'page-login';
          if (id.includes('/pages/dashboard')) return 'page-dashboard';
          if (id.includes('/pages/profile')) return 'page-profile';
          if (id.includes('/pages/stores')) return 'page-stores';
          if (id.includes('/pages/tienda.')) return 'page-store';
          if (id.includes('/pages/my-store')) return 'page-my-store';
          if (id.includes('/pages/my-stores')) return 'page-my-stores';
          if (id.includes('/pages/notifications')) return 'page-notifications';
          if (id.includes('/pages/qr')) return 'page-qr';
          if (id.includes('/pages/purchases')) return 'page-purchases';
          if (id.includes('/components/')) return 'components';
        },
      },
    },
  },
  appType: 'spa',
  server: {
    port: 5173,
    fs: {
      allow: ['..'],
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cache-Control': 'no-store',
    },
    watch: {
      // Follow symlinks into local packages
      followSymlinks: true,
    },
  },
  optimizeDeps: {
    exclude: LOCAL_PACKAGES,
    // Pre-bundlear paquetes pesados o sensibles a singletons como un único
    // chunk para evitar que Vite resuelva sub-módulos individualmente.
    // Deps de terceros que usan los features locales. Hay que listarlos acá
    // porque en dev los features se sirven desde las carpetas hermanas (alias),
    // y Vite no encuentra estos paquetes subiendo desde la hermana — sí los
    // resuelve desde el root al pre-bundlearlos. Si un feature nuevo usa una
    // lib de terceros nueva, agregala a esta lista.
    include: [
      '@open-wc/scoped-elements/lit-element.js',
      'lucide',
      'firebase/app',
      'firebase/auth',
      'firebase/messaging',
      'qrcode',
      'jsqr',
      'chart.js',
      // Se importan con import() dinámico en el boot (posthog-driver,
      // app-config, native-bridge). Si NO están pre-bundleados, el primer
      // import los hace optimizar a Vite al vuelo, lo que puede stallear el
      // arranque en navegadores no-Chrome. Pre-bundlearlos lo evita.
      'posthog-js',
      '@capacitor/core',
    ],
    force: true,
  },
}));
