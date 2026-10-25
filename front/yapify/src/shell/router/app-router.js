import routingConfig from './routes.js';
import { evaluateGuards } from './guards.js';
import { wireComponent } from '../wiring/component-wirer.js';
import { nativeBridge } from '../bridge/native-bridge.js';
import { yapiBus } from '../event-bus/yapi-bus.js';

const { routes, defaultRoute } = routingConfig;
const DEFAULT_ROUTE_NAME =
  defaultRoute || Object.keys(routes).find((key) => routes[key] === '/') || Object.keys(routes)[0] || 'login';

/** Strip `:placeholders` from a route path so it can be used for prefix matching. */
function basePathOf(path) {
  const idx = path.indexOf('/:');
  return idx === -1 ? path : path.slice(0, idx);
}

/**
 * Convert a camelCase route name (`myStore`, `profilePoints`, `forYou`)
 * to the kebab-case filename of its page descriptor (`my-store.js`,
 * `profile-points.js`, `for-you.js`). Keys in `routes.js` are camelCase
 * — they have to match `link.page` from feature descriptors — but the
 * `pages/` files keep the kebab-case URL slug as their filename.
 */
function routeNameToFile(routeName) {
  return routeName.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Routes whose bottom-nav is hidden (auth flow + store-owner mode + checkout
 *  focus). `/my-stores` (the owner's store list) and `/my-store` (admin) are
 *  the store-management context — the consumer tabs don't belong there. */
const HIDE_NAV_ON = ['/login', '/onboarding', '/my-stores', '/my-store', '/cart', '/item', '/terms', '/privacy'];

/** Routes where the cart-FAB is allowed to surface (it self-hides when cart is empty). */
const SHOW_FAB_ON = ['/dashboard', '/stores', '/purchases', '/store'];

/** Routes whose top is a flat sticky header (not a full-bleed hero/cover). On
 *  these the status-bar safe-strip must take the flat page color so it matches
 *  the header below instead of showing the body's ambient glow. Hero screens
 *  like the public store (`/store/:slug`) are omitted on purpose. */
const SOLID_TOP_ON = ['/stores', '/dashboard', '/purchases', '/profile', '/my-stores', '/my-events', '/onboarding'];

function activeTabFor(hash) {
  if (hash === '/dashboard') return 'home';
  if (hash === '/profile') return 'profile';
  if (hash === '/purchases') return 'purchases';
  if (hash === '/qr') return 'qr';
  if (hash === '/stores' || hash.startsWith('/store/') || hash === '/my-stores') return 'stores';
  return null;
}

/**
 * AppRouter — Hash-based router.
 *
 * Equivalent to the Cells composer in glomo-pe:
 * - Resolves the current hash to a page descriptor
 * - Lazy-loads the page descriptor module
 * - Mounts/unmounts components into named zones (data-zone="...")
 * - Wires each component's DOM events ↔ bus channels via component-wirer
 * - Emits __bridge_page_<hash> so handle-life-cycle components can init
 */
export class AppRouter {
  constructor() {
    // Persistent mounting: pages mounted permanecen en el DOM (display:none
    // cuando ocultas) hasta logout. El state de cada feature se preserva —
    // cero refetch al volver. La invalidación de data fresh se hace por
    // EVENTO (microfrontend A emite → window event / bus channel → feature B
    // escucha y refresca su slice). No hay cache de respuestas HTTP — la
    // data vive en el state interno de cada componente mounted.
    //
    // Map<routeName, {
    //   page,                    // page descriptor (factory output)
    //   components: [{ el, zone, yapiConnections }],
    //   cleanups: Function[]     // bus wirings activos (solo cuando visible)
    // }>
    this._mountedRoutes = new Map();
    this._currentRoute = null;
    this._currentBase = null;
    this._currentHash = null;
  }

  /**
   * Start the router. Call once at app startup.
   *
   * Fresh-session handling: when the browser is closed and reopened, the URL
   * fragment persists (e.g. `#/my-store/promotions`). We don't want the app
   * to deep-link the user straight into an admin sub-section on a cold start.
   * `sessionStorage` survives tab reloads but clears when the tab/browser is
   * closed — perfect to distinguish "first open this session" from "F5 refresh
   * or in-tab navigation". On fresh sessions we strip sub-routes of admin
   * pages (currently `/mi-tienda/*` → `/mi-tienda`) so users land on the
   * store's home tab, not on whatever deep section they were last editing.
   */
  start() {
    const SESSION_FLAG = 'yapify-session-open';
    const isFreshSession = !sessionStorage.getItem(SESSION_FLAG);
    sessionStorage.setItem(SESSION_FLAG, '1');

    window.addEventListener('hashchange', () => {
      this._navigate();
      this._syncShellChrome();
    });
    window.addEventListener('popstate', () => {
      this._navigate();
      this._syncShellChrome();
    });

    // If the user navigated via path (e.g. /onboarding instead of #/onboarding),
    // redirect the path into the hash so the router can handle it.
    this._redirectPathToHash();

    // Fresh session: strip admin sub-routes back to their base so users don't
    // land inside a section-deep admin view on cold start.
    if (isFreshSession) {
      this._normalizeFreshSessionHash();
    }

    this._setupShellChromeInteractions();

    // Navigate on load
    const hash = location.hash.replace('#', '');
    if (!hash || hash === '/') {
      const defaultPath = basePathOf(routes[DEFAULT_ROUTE_NAME] || '/');
      const guard = evaluateGuards(defaultPath);
      location.hash = `#${guard.allowed ? defaultPath : guard.redirect}`;
    } else {
      this._navigate();
    }
    this._syncShellChrome();
  }

  /* ── Shell chrome (bottom-nav + cart-FAB) ──
   *  Visibility / active-tab / clicks of the chrome mounted in
   *  `index.html` belong to the router because they are a function of
   *  the current route — not feature logic.
   */

  /** Wires the one-off click listeners on the static chrome elements. */
  _setupShellChromeInteractions() {
    const nav = document.getElementById('yapify-nav');
    if (nav) {
      nav.addEventListener('nav-item-click', (e) => {
        const id = e.detail?.id;
        if (!id) return;
        this.navigateTo(id === 'home' ? '/dashboard' : `/${id}`);
      });
    }
    const fab = document.getElementById('yapify-cart-fab');
    if (fab) {
      fab.addEventListener('cart-click', () => this.navigateTo('/cart'));
    }
  }

  /** Toggles bottom-nav + cart-FAB visibility + active-tab + the solid
   *  status-bar safe-strip (data-yp-solid-top) on the current route. */
  _syncShellChrome() {
    const hash = location.hash.replace('#', '') || '/login';
    const nav = document.getElementById('yapify-nav');
    if (nav) {
      const hideNav = HIDE_NAV_ON.some((p) => hash === p || hash.startsWith(p + '/'));
      nav.hidden = hideNav;
      if (!hideNav) {
        const tab = activeTabFor(hash);
        if (tab) nav.active = tab;
      }
    }
    const fab = document.getElementById('yapify-cart-fab');
    if (fab) {
      fab.hidden = !SHOW_FAB_ON.some((p) => hash === p || hash.startsWith(p + '/'));
    }
    const solidTop = SOLID_TOP_ON.some((p) => hash === p || hash.startsWith(p + '/'));
    document.documentElement.toggleAttribute('data-yp-solid-top', solidTop);
  }

  /**
   * On a fresh browser session, collapse sub-routes of admin pages to their
   * base. Public deep-links like `/tienda/slug-id` are preserved.
   * @private
   */
  _normalizeFreshSessionHash() {
    const STRIP_SUBROUTES_FOR = ['/my-store'];
    const hash = location.hash.replace('#', '');
    if (!hash) return;
    for (const base of STRIP_SUBROUTES_FOR) {
      if (hash.startsWith(base + '/')) {
        history.replaceState(null, '', `${location.pathname}${location.search}#${base}`);
        return;
      }
    }
  }

  /**
   * If the browser URL has a real pathname that matches a known route,
   * move it into the hash fragment so hash-based routing picks it up.
   * e.g. localhost:5173/onboarding → localhost:5173/#/onboarding
   */
  _redirectPathToHash() {
    const path = location.pathname;
    if (path && path !== '/' && path !== '/index.html') {
      const matchedRoute = Object.keys(routes).find(
        (key) => basePathOf(routes[key]) === path
      );
      if (matchedRoute) {
        // Replace current URL with the hash-based equivalent
        history.replaceState(null, '', `/${location.search}#${path}`);
      }
    }
  }

  /**
   * Programmatic navigation — equivalent to navigation_to_page bus events.
   * @param {string} path - e.g. '/login'
   * @param {object} [params]
   */
  navigateTo(path, params = {}) {
    // Store params so page descriptors can pick them up
    this._navParams = params;
    location.hash = `#${path}`;
  }

  /**
   * Navigate back (browser history).
   */
  goBack() {
    history.back();
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  async _navigate() {
    let hash = location.hash.replace('#', '');
    if (!hash || hash === '/') {
      hash = basePathOf(routes[DEFAULT_ROUTE_NAME] || '/');
    }
    // Path sin query-string: '/checkout/return?order=6' debe matchear la ruta
    // '/checkout/return'. El query del hash es contrato de la página (lo parsea
    // ella), no del router — matchear con él rompía toda ruta con '?'.
    const path = hash.split('?')[0];

    // Guard: redirigir si la ruta no esta permitida
    const guard = evaluateGuards(path);
    if (!guard.allowed) {
      this._currentHash = guard.redirect;
      location.hash = `#${guard.redirect}`;
      return;
    }

    // Find route name from hash path (exact match first, then prefix match for sub-routes)
    let routeName = Object.keys(routes).find((key) => basePathOf(routes[key]) === path);
    if (!routeName) {
      // Sub-route support: pick the LONGEST matching prefix so nested
      // routes (e.g. `profilePoints: '/profile/points'`) win over their
      // parents (`profile: '/profile'`).
      const matches = Object.keys(routes).filter((key) => {
        const base = basePathOf(routes[key]);
        return path === base || path.startsWith(base + '/');
      });
      if (matches.length > 0) {
        routeName = matches.reduce(
          (best, k) => (basePathOf(routes[k]).length > basePathOf(routes[best]).length ? k : best),
          matches[0],
        );
      }
    }
    if (!routeName) {
      location.hash = `#${basePathOf(routes[DEFAULT_ROUTE_NAME]) || '/'}`;
      return;
    }

    const baseRoute = basePathOf(routes[routeName]);

    if (hash === this._currentHash) return;

    const prevBase = this._currentBase;
    const prevRoute = this._currentRoute;
    this._currentHash = hash;
    this._currentBase = baseRoute;
    this._currentRoute = routeName;

    // SIEMPRE re-evaluar el page descriptor para properties frescas (kind,
    // itemId, etc. derivadas del hash). Sin esto, /item/A → /item/B mostraría
    // los datos de A pegados en el componente persistente.
    let pageFactory;
    try {
      const mod = await import(`../../pages/${routeNameToFile(routeName)}.js`);
      pageFactory = mod.default;
    } catch (e) {
      this._currentHash = null;
      throw e;
    }
    if (typeof pageFactory !== 'function') {
      this._currentHash = null;
      return;
    }
    const cfg = window.__YAPIFY_CONFIG__ ?? {};
    const page = pageFactory({ ...cfg, navParams: this._navParams ?? {} });

    // Misma base route ya mounted (e.g. /tienda/A → /tienda/B, /item/X → /item/Y):
    // re-aplicar properties + sub-route event, sin tocar el mount.
    if (prevBase === baseRoute && this._mountedRoutes.has(routeName)) {
      this._refreshProperties(routeName, page);
      const subPath = path.slice(baseRoute.length);
      yapiBus.emit(`__bridge_subroute_${routeName}`, { route: hash, subPath, base: baseRoute });
      window.dispatchEvent(new CustomEvent('yapify:subroute-change', {
        detail: { route: hash, subPath, base: baseRoute }
      }));
      this._resetScroll();
      return;
    }

    // Distinto route: ocultar el anterior (preserva state interno) — sus
    // wirings de bus se cleanup-ean para no emitir desde un page invisible.
    if (prevRoute && prevRoute !== routeName && this._mountedRoutes.has(prevRoute)) {
      this._hideRoute(prevRoute);
    }

    // Mostrar el target: revivir si ya estaba mounted (con props frescas),
    // montar desde cero si es primera visita.
    const wasMounted = this._mountedRoutes.has(routeName);
    if (wasMounted) {
      this._refreshProperties(routeName, page);
      this._showRoute(routeName);
      yapiBus.emit(`__bridge_page_${routeName}`, { route: hash, resumed: true });
    } else {
      this._mountPage(page, routeName);
      yapiBus.emit(`__bridge_page_${page.hash}`, { route: hash, resumed: false });
    }

    // Sub-path event para casos como /tienda/abc-1 en mount fresh.
    const subPath = hash.slice(baseRoute.length);
    if (subPath) {
      yapiBus.emit(`__bridge_subroute_${routeName}`, { route: hash, subPath, base: baseRoute });
      window.dispatchEvent(new CustomEvent('yapify:subroute-change', {
        detail: { route: hash, subPath, base: baseRoute }
      }));
    }

    // Volver a un route ya mounted (e.g. dashboard ← tienda con history.back):
    // restaurar el scroll capturado en _hideRoute. Mount fresh o forward a un
    // route nuevo: al tope.
    const revivedEntry = this._mountedRoutes.get(routeName);
    if (wasMounted && revivedEntry?.scroll) {
      this._restoreScroll(revivedEntry.scroll);
    } else {
      this._resetScroll();
    }
  }

  /**
   * Reaplica las properties del page descriptor a los componentes mounted.
   * Triggerea la reactividad de Lit — los features con hook updated() reaccionan
   * a cambios de kind/itemId/etc. Excluye yapiConnections (lo manejan _show/_hide).
   */
  _refreshProperties(routeName, page) {
    const entry = this._mountedRoutes.get(routeName);
    if (!entry) return;
    const components = page.components ?? [];
    components.forEach((descriptor, idx) => {
      const c = entry.components[idx];
      if (!c) return;
      const { yapiConnections: _ignored, ...staticProps } = descriptor.properties ?? {};
      for (const [key, val] of Object.entries(staticProps)) {
        c.el[key] = val;
      }
    });
  }

  /** Lleva el viewport y el contenedor principal al tope. Defer a rAF para
   *  que ocurra después de que el browser pinte la nueva página. */
  _resetScroll() {
    const doIt = () => {
      try { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch { window.scrollTo(0, 0); }
      const main = document.querySelector('[data-zone="app__main"]');
      if (main) main.scrollTop = 0;
      // El html/body por si el layout usa scroll en alguno de ellos.
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(doIt);
    else setTimeout(doIt, 0);
  }

  /** Captura la posición de scroll actual (viewport + contenedor principal)
   *  para poder restaurarla al volver a un route ya mounted. */
  _captureScroll() {
    const main = document.querySelector('[data-zone="app__main"]');
    return {
      window: window.scrollY || 0,
      main: main ? main.scrollTop : 0,
    };
  }

  /** Restaura una posición capturada por _captureScroll. Defer a rAF para que
   *  ocurra después de revivir (display) y pintar la página revivida. */
  _restoreScroll(pos) {
    const doIt = () => {
      const main = document.querySelector('[data-zone="app__main"]');
      if (main) main.scrollTop = pos.main || 0;
      try { window.scrollTo({ top: pos.window || 0, left: 0, behavior: 'auto' }); }
      catch { window.scrollTo(0, pos.window || 0); }
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(doIt);
    else setTimeout(doIt, 0);
  }

  _mountPage(page, routeName) {
    const { components = [] } = page;
    const entry = { page, components: [], cleanups: [] };

    for (const descriptor of components) {
      const { zone, tag, properties = {} } = descriptor;
      if (!customElements.get(tag)) continue;
      const zoneEl = document.querySelector(`[data-zone="${zone}"]`);
      if (!zoneEl) continue;

      const el = document.createElement(tag);
      const { yapiConnections, ...staticProps } = properties;
      for (const [key, val] of Object.entries(staticProps)) {
        el[key] = val;
      }
      zoneEl.appendChild(el);
      entry.components.push({ el, zone, yapiConnections });

      if (yapiConnections) {
        const cleanup = wireComponent(el, yapiConnections, {
          onForwardToNative: (channel, detail) => nativeBridge.forwardToNative(channel, detail),
          onBackStep: () => this.goBack(),
          onNavigate: (path) => this.navigateTo(path),
        });
        entry.cleanups.push(cleanup);
      }
    }

    this._mountedRoutes.set(routeName, entry);
  }

  /**
   * Oculta un route: display:none en sus elementos + cleanup de wirings.
   * El state Lit (props, _state, refs, scroll position) se preserva intacto.
   */
  _hideRoute(routeName) {
    const entry = this._mountedRoutes.get(routeName);
    if (!entry) return;
    entry.scroll = this._captureScroll();
    for (const c of entry.components) {
      if (c.priorDisplay === undefined) c.priorDisplay = c.el.style.display ?? '';
      c.el.style.display = 'none';
      c.el.setAttribute('aria-hidden', 'true');
    }
    entry.cleanups.forEach((fn) => fn());
    entry.cleanups = [];
  }

  /**
   * Muestra un route oculto. Restaura display + re-wirea bus connections.
   */
  _showRoute(routeName) {
    const entry = this._mountedRoutes.get(routeName);
    if (!entry) return;
    for (const c of entry.components) {
      c.el.style.display = c.priorDisplay ?? '';
      c.priorDisplay = undefined;
      c.el.removeAttribute('aria-hidden');
    }
    entry.cleanups = entry.components
      .filter((c) => c.yapiConnections)
      .map((c) => wireComponent(c.el, c.yapiConnections, {
        onForwardToNative: (channel, detail) => nativeBridge.forwardToNative(channel, detail),
        onBackStep: () => this.goBack(),
        onNavigate: (path) => this.navigateTo(path),
      }));
  }

  /**
   * Destruye un único route mounted para que la próxima navegación a él lo
   * monte de cero (re-corriendo connectedCallback). Necesario para rutas cuyo
   * estado de entrada depende de un flag one-shot que el feature SOLO lee al
   * montar — p. ej. `/my-store` (key `myStore`), donde `__yapifyForceCreate`
   * y `__yapifySelectedStoreId` deciden entre el form de creación y el
   * dashboard de una tienda existente. Sin esto, el mount persistente revive
   * el estado viejo (la primera tienda) e ignora el flag.
   *
   * @param {String} routeName - Clave camelCase del route en `routes.js`.
   */
  dropRoute(routeName) {
    const entry = this._mountedRoutes.get(routeName);
    if (!entry) return;
    entry.cleanups.forEach((fn) => fn());
    for (const c of entry.components) {
      if (c.el.parentNode) c.el.parentNode.removeChild(c.el);
    }
    this._mountedRoutes.delete(routeName);
    if (this._currentRoute === routeName) {
      this._currentRoute = null;
      this._currentBase = null;
      this._currentHash = null;
    }
  }

  /**
   * Destruye todos los routes mounted — llamado en logout. Sin esto, los
   * componentes mantienen data del usuario anterior cuando entra uno nuevo.
   */
  clearAll() {
    for (const [, entry] of this._mountedRoutes) {
      entry.cleanups.forEach((fn) => fn());
      for (const c of entry.components) {
        if (c.el.parentNode) c.el.parentNode.removeChild(c.el);
      }
    }
    this._mountedRoutes.clear();
    this._currentRoute = null;
    this._currentBase = null;
    this._currentHash = null;
  }
}

export const appRouter = new AppRouter();

// Wire navigation bus channel to the router
yapiBus.on('navigate_to_page', (e) => {
  const { page, params } = e.detail ?? {};
  if (page) appRouter.navigateTo(`/${page}`, params);
});

yapiBus.on('navigate_back', () => appRouter.goBack());
