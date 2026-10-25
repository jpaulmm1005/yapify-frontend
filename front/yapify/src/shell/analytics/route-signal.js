import { pageview } from './index.js';

/**
 * Listens to `hashchange` and fires one `pageview(route)` per stable
 * route. Coalesces redirects from route guards so a guard → redirect
 * → land sequence counts as a single pageview, not three.
 *
 * Filename avoids the tokens `pageview` and `tracker`: ad blockers (uBlock,
 * Opera, Brave) match those in the request URL and return ERR_BLOCKED_BY_CLIENT,
 * which kills this module's static import in main.js and blanks the whole app.
 */
export function setupPageviewTracker() {
  let lastRoute = '';
  let timer = null;

  const fire = () => {
    const route = (location.hash || '').replace(/^#/, '').split('?')[0] || '/';
    if (route === lastRoute) return;
    lastRoute = route;
    pageview(route);
  };

  window.addEventListener('hashchange', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fire, 250);
  });
  setTimeout(fire, 500);
}
