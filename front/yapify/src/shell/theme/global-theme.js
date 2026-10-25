/**
 * Global Theme Manager
 *
 * Aplica las CSS variables del tema directamente en <html>,
 * así TODO componente (Light DOM, Shadow DOM, bottom nav, etc.)
 * hereda el tema automáticamente sin necesitar <yapify-theme-provider>.
 */

const THEME_KEY = 'yapify-theme';

const LIGHT_VARS = {
  // Surfaces — blanco limpio
  '--yp-bg-page': '#FFFFFF',
  '--yp-bg-soft': '#F7F6F4',
  '--yp-bg-card': '#FFFFFF',
  '--yp-bg-hover': 'rgba(17,17,17,0.04)',
  '--yp-bg-primary': '#FFFFFF',
  '--yp-bg-secondary': '#F7F6F4',

  // Borders — hairline neutro
  '--yp-border': 'rgba(17,17,17,0.08)',
  '--yp-border-hard': 'rgba(17,17,17,0.14)',
  '--yp-border-color': 'rgba(17,17,17,0.08)',

  // Text — tinta neutra
  '--yp-text-primary': '#1A1A1A',
  '--yp-text-dim': '#6E6A65',
  '--yp-text-secondary': '#6E6A65',
  '--yp-text-muted': '#A8A39C',
  '--yp-text-inverse': '#FFFFFF',
  '--yp-text-on-accent': '#FFFFFF',
  '--yp-on-image': '#FFFFFF',
  // On-image shadows — invariantes con theme (overlays sobre contenido visual)
  '--yp-on-image-icon': 'rgba(255,255,255,0.55)',
  '--yp-on-image-shadow-sm': '0 4px 10px rgba(0,0,0,0.2)',
  '--yp-on-image-shadow-md': '0 4px 10px rgba(0,0,0,0.3)',
  '--yp-on-image-text-shadow': '0 2px 8px rgba(0,0,0,0.5)',
  '--yp-on-image-text-shadow-strong': '0 2px 10px rgba(0,0,0,0.55)',
  '--yp-on-image-overlay-end': 'rgba(0,0,0,0.75)',
  '--yp-text-link': '#C2410C',

  // Accent (naranja — marca)
  '--yp-accent': '#F97316',
  '--yp-accent-hover': '#EA670C',
  '--yp-accent-ink': '#C2410C',
  '--yp-accent-soft': 'rgba(249,115,22,0.12)',
  '--yp-accent-glow': 'rgba(249,115,22,0.16)',
  '--yp-accent-gradient': 'linear-gradient(135deg,#F97316,#EA670C)',
  '--yp-color-primary': '#F97316',
  '--yp-color-primary-hover': '#EA670C',
  '--yp-color-primary-active': '#C2410C',
  '--yp-color-primary-soft': 'rgba(249,115,22,0.14)',
  '--yp-color-secondary': '#0D9488',
  '--yp-color-secondary-hover': '#0B7C72',

  // Semantic — estados (usados por componentes vía --yp-color-*)
  '--yp-color-success': '#16A34A',
  '--yp-color-warning': '#F59E0B',
  '--yp-color-danger': '#DC2626',
  '--yp-color-danger-hover': '#B91C1C',
  '--yp-color-info': '#0EA5E9',

  // Warm / gold — secundario cálido
  '--yp-warm': '#F59E0B',
  '--yp-warm-soft': 'rgba(245,158,11,0.14)',
  '--yp-warm-glow': 'rgba(245,158,11,0.22)',
  '--yp-gold': '#D97706',

  // State
  '--yp-hot': '#E11D48',
  '--yp-hot-soft': 'rgba(225,29,72,0.12)',
  '--yp-hot-glow': 'rgba(225,29,72,0.18)',
  '--yp-red': '#DC2626',
  '--yp-red-soft': 'rgba(220,38,38,0.12)',
  '--yp-red-glow': 'rgba(220,38,38,0.18)',
  '--yp-success': '#16A34A',

  // Kind accents — color semántico por tipo de item (cupón, flash, etc.)
  // Refinados para leer en blanco; se usan como puntos/labels, no rellenos.
  '--yp-kind-coupon': '#F59E0B',
  '--yp-kind-coupon-soft': 'rgba(245,158,11,0.12)',
  '--yp-kind-flash': '#E11D48',
  '--yp-kind-flash-soft': 'rgba(225,29,72,0.12)',
  '--yp-kind-event': '#0EA5E9',
  '--yp-kind-event-soft': 'rgba(14,165,233,0.12)',
  '--yp-kind-reward': '#8B5CF6',
  '--yp-kind-reward-soft': 'rgba(139,92,246,0.12)',
  '--yp-kind-promotion': '#F97316',
  '--yp-kind-promotion-soft': 'rgba(249,115,22,0.12)',
  '--yp-kind-product': '#F97316',
  '--yp-kind-product-soft': 'rgba(249,115,22,0.12)',

  // Shadows — suaves neutras
  '--yp-shadow-sm': '0 1px 2px rgba(17,17,17,0.05)',
  '--yp-shadow-md': '0 8px 24px rgba(17,17,17,0.06)',
  '--yp-shadow-lg': '0 14px 40px rgba(17,17,17,0.08)',
  '--yp-shadow-xl': '0 22px 56px rgba(17,17,17,0.10)',
  '--yp-shadow-glow': '0 10px 28px rgba(249,115,22,0.16)',

  // Overlays
  '--yp-bg-overlay': 'rgba(17,17,17,0.38)',
  '--yp-overlay-backdrop': 'rgba(17,17,17,0.38)',
  '--yp-overlay-on-image': 'rgba(17,17,17,0.55)',
  '--yp-hero-gradient': 'linear-gradient(135deg,#FFFFFF 0%,#F7F6F4 100%)',

  // Ambient page backdrop — blanco limpio (sin radiales)
  '--yp-bg-page-radials': 'none',

  // Focus
  '--yp-focus-ring': '0 0 0 3px rgba(249,115,22,0.30)',

  // Toast variants
  // Los toasts no cromatizan por semantica: la marca es naranja y un verde
  // o un azul desentonan. Solo el toast de error conserva el rojo.
  '--yp-toast-accent-bg': '#FFF1E6',
  '--yp-toast-accent-text': '#9A3412',
  '--yp-toast-success-bg': '#FFF1E6',
  '--yp-toast-success-text': '#9A3412',
  '--yp-toast-danger-bg': '#FCE8E8',
  '--yp-toast-danger-text': '#991B1B',
  '--yp-toast-warning-bg': '#FFF1E6',
  '--yp-toast-warning-text': '#9A3412',
  '--yp-toast-info-bg': '#FFF1E6',
  '--yp-toast-info-text': '#9A3412',

  // Chips
  '--yp-chip-accent-bg': 'rgba(249,115,22,0.12)',
  '--yp-chip-accent-text': '#C2410C',
  '--yp-chip-success-bg': 'rgba(22,163,74,0.12)',
  '--yp-chip-success-text': '#166534',
  '--yp-chip-warm-bg': 'rgba(245,158,11,0.14)',
  '--yp-chip-warm-text': '#9A6700',

  // Legacy — grises neutros
  '--yp-color-gray-100': '#F5F5F4',
  '--yp-color-gray-300': '#E2E0DC',
  '--yp-color-gray-500': '#A8A39C',
  '--yp-color-gray-700': '#57534E',
  '--yp-color-gray-900': '#1A1A1A',

  // Skeleton (loading placeholders) — base + shimmer sweep highlight
  '--yp-skeleton-base': '#EFEEEB',
  '--yp-skeleton-shimmer': 'rgba(255,255,255,0.85)',
};

const DARK_VARS = {
  // Surfaces — neutro charcoal, 3 tiers distinguibles
  '--yp-bg-page': '#121212',
  '--yp-bg-soft': '#1A1A1A',
  '--yp-bg-card': '#1C1C1C',
  '--yp-bg-hover': 'rgba(255,255,255,0.06)',
  '--yp-bg-primary': '#121212',
  '--yp-bg-secondary': '#1C1C1C',

  // Borders
  '--yp-border': 'rgba(255,255,255,0.10)',
  '--yp-border-hard': 'rgba(255,255,255,0.16)',
  '--yp-border-color': 'rgba(255,255,255,0.10)',

  // Text
  '--yp-text-primary': '#F5F5F4',
  '--yp-text-dim': '#A3A3A3',
  '--yp-text-secondary': '#A3A3A3',
  '--yp-text-muted': '#737373',
  '--yp-text-inverse': '#1A1A1A',
  '--yp-text-on-accent': '#1A1A1A',
  '--yp-on-image': '#FFFFFF',
  // On-image shadows — invariantes con theme (overlays sobre contenido visual)
  '--yp-on-image-icon': 'rgba(255,255,255,0.55)',
  '--yp-on-image-shadow-sm': '0 4px 10px rgba(0,0,0,0.2)',
  '--yp-on-image-shadow-md': '0 4px 10px rgba(0,0,0,0.3)',
  '--yp-on-image-text-shadow': '0 2px 8px rgba(0,0,0,0.5)',
  '--yp-on-image-text-shadow-strong': '0 2px 10px rgba(0,0,0,0.55)',
  '--yp-on-image-overlay-end': 'rgba(0,0,0,0.75)',
  '--yp-text-link': '#FDBA74',

  // Accent (naranja en dark)
  '--yp-accent': '#FB8A3C',
  '--yp-accent-hover': '#F97316',
  '--yp-accent-ink': '#FDBA74',
  '--yp-accent-soft': 'rgba(251,138,60,0.16)',
  '--yp-accent-glow': 'rgba(251,138,60,0.22)',
  '--yp-accent-gradient': 'linear-gradient(135deg,#FB8A3C,#F97316)',
  '--yp-color-primary': '#FB8A3C',
  '--yp-color-primary-hover': '#F97316',
  '--yp-color-primary-active': '#FDBA74',
  '--yp-color-primary-soft': 'rgba(251,138,60,0.22)',
  '--yp-color-secondary': '#2DD4BF',
  '--yp-color-secondary-hover': '#14B8A6',

  // Semantic — estados (usados por componentes vía --yp-color-*)
  '--yp-color-success': '#4ADE80',
  '--yp-color-warning': '#FBBF24',
  '--yp-color-danger': '#F87171',
  '--yp-color-danger-hover': '#EF4444',
  '--yp-color-info': '#38BDF8',

  // Warm / gold
  '--yp-warm': '#FBBF24',
  '--yp-warm-soft': 'rgba(251,191,36,0.16)',
  '--yp-warm-glow': 'rgba(251,191,36,0.24)',
  '--yp-gold': '#FCD34D',

  // State
  '--yp-hot': '#FB7185',
  '--yp-hot-soft': 'rgba(251,113,133,0.16)',
  '--yp-hot-glow': 'rgba(251,113,133,0.24)',
  '--yp-red': '#F87171',
  '--yp-red-soft': 'rgba(248,113,113,0.16)',
  '--yp-red-glow': 'rgba(248,113,113,0.24)',
  '--yp-success': '#4ADE80',

  // Kind accents — versiones más claras para dark mode
  '--yp-kind-coupon': '#FBBF24',
  '--yp-kind-coupon-soft': 'rgba(251,191,36,0.16)',
  '--yp-kind-flash': '#FB7185',
  '--yp-kind-flash-soft': 'rgba(251,113,133,0.16)',
  '--yp-kind-event': '#38BDF8',
  '--yp-kind-event-soft': 'rgba(56,189,248,0.16)',
  '--yp-kind-reward': '#C084FC',
  '--yp-kind-reward-soft': 'rgba(192,132,252,0.18)',
  '--yp-kind-promotion': '#FB8A3C',
  '--yp-kind-promotion-soft': 'rgba(251,138,60,0.18)',
  '--yp-kind-product': '#FB8A3C',
  '--yp-kind-product-soft': 'rgba(251,138,60,0.18)',

  // Shadows
  '--yp-shadow-sm': '0 1px 3px rgba(0,0,0,0.3)',
  '--yp-shadow-md': '0 10px 40px rgba(0,0,0,0.45)',
  '--yp-shadow-lg': '0 14px 50px rgba(0,0,0,0.55)',
  '--yp-shadow-xl': '0 20px 50px rgba(0,0,0,0.6)',
  '--yp-shadow-glow': '0 8px 32px rgba(251,138,60,0.24)',

  // Overlays
  '--yp-bg-overlay': 'rgba(0,0,0,0.6)',
  '--yp-overlay-backdrop': 'rgba(0,0,0,0.6)',
  '--yp-overlay-on-image': 'rgba(0,0,0,0.7)',
  '--yp-hero-gradient': 'linear-gradient(135deg,#1A1A1A 0%,#121212 100%)',

  // Ambient page backdrop — neutro (sin radiales)
  '--yp-bg-page-radials': 'none',

  // Focus
  '--yp-focus-ring': '0 0 0 3px rgba(251,138,60,0.35)',

  // Toast variants
  '--yp-toast-accent-bg': '#4A2410',
  '--yp-toast-accent-text': '#FFD9BF',
  '--yp-toast-success-bg': '#4A2410',
  '--yp-toast-success-text': '#FFD9BF',
  '--yp-toast-danger-bg': '#7F1D1D',
  '--yp-toast-danger-text': '#FEE2E2',
  '--yp-toast-warning-bg': '#4A2410',
  '--yp-toast-warning-text': '#FFD9BF',
  '--yp-toast-info-bg': '#0C4A6E',
  '--yp-toast-info-text': '#E0F2FE',

  // Chips
  '--yp-chip-accent-bg': 'rgba(251,138,60,0.18)',
  '--yp-chip-accent-text': '#FDBA74',
  '--yp-chip-success-bg': 'rgba(74,222,128,0.16)',
  '--yp-chip-success-text': '#86EFAC',
  '--yp-chip-warm-bg': 'rgba(251,191,36,0.16)',
  '--yp-chip-warm-text': '#FCD34D',

  // Legacy — grises neutros
  '--yp-color-gray-100': '#1C1C1C',
  '--yp-color-gray-300': '#3A3A3A',
  '--yp-color-gray-500': '#737373',
  '--yp-color-gray-700': '#A3A3A3',
  '--yp-color-gray-900': '#F5F5F4',

  // Skeleton (loading placeholders) — base + shimmer sweep highlight
  '--yp-skeleton-base': '#262626',
  '--yp-skeleton-shimmer': 'rgba(255,255,255,0.08)',
};

// Lee la preferencia con migración de 'default' (legacy) → 'light'.
function readPref() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'auto' || saved === 'light' || saved === 'dark') return saved;
    if (saved === 'default') return 'light';
  } catch { /* noop */ }
  return 'auto';
}

function osPrefersDark() {
  return !!(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}

function effectiveFromPref(pref) {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'default';
  return osPrefersDark() ? 'dark' : 'default';
}

const TRANSITION_SUPPRESS_ATTR = 'data-theme-switching';
const TRANSITION_SUPPRESS_STYLE_ID = 'yp-theme-switch-suppress';
const TRANSITION_SUPPRESS_CSS = '*,*::before,*::after{transition:none !important}';

let _suppressSheet = null;

/**
 * Installs the `<head>` stylesheet that kills transitions on light-DOM nodes
 * while a theme swap is in flight. Blink does not re-run transitions when the
 * inherited custom properties change on `<html>`, so any element carrying
 * `transition: background` keeps painting the previous theme's color forever.
 *
 * @returns {void}
 */
function ensureTransitionSuppressor() {
  if (document.getElementById(TRANSITION_SUPPRESS_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TRANSITION_SUPPRESS_STYLE_ID;
  style.textContent =
    `[${TRANSITION_SUPPRESS_ATTR}] *,` +
    `[${TRANSITION_SUPPRESS_ATTR}] *::before,` +
    `[${TRANSITION_SUPPRESS_ATTR}] *::after` +
    `{ transition: none !important; }`;
  document.head.appendChild(style);
}

/**
 * Collects every shadow root currently in the document, depth first. The
 * `<head>` suppressor cannot cross a shadow boundary, so each root needs the
 * suppression sheet adopted individually or its components keep the stale paint.
 *
 * @param {Document|ShadowRoot} root - Tree to walk.
 * @param {Array<ShadowRoot>} acc - Accumulator carried through the recursion.
 * @returns {Array<ShadowRoot>}
 */
function collectShadowRoots(root, acc) {
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) {
      acc.push(el.shadowRoot);
      collectShadowRoots(el.shadowRoot, acc);
    }
  }
  return acc;
}

/**
 * Adopts or drops the shared suppression sheet across every shadow root.
 *
 * @param {Array<ShadowRoot>} roots - Roots to update.
 * @param {Boolean} on - Whether to adopt (true) or drop (false) the sheet.
 * @returns {void}
 */
function setShadowSuppression(roots, on) {
  if (!_suppressSheet) {
    _suppressSheet = new CSSStyleSheet();
    _suppressSheet.replaceSync(TRANSITION_SUPPRESS_CSS);
  }
  for (const root of roots) {
    root.adoptedStyleSheets = on
      ? [...root.adoptedStyleSheets, _suppressSheet]
      : root.adoptedStyleSheets.filter((sheet) => sheet !== _suppressSheet);
  }
}

function applyTheme(theme) {
  const vars = theme === 'dark' ? DARK_VARS : LIGHT_VARS;
  const root = document.documentElement;
  const shadowRoots = collectShadowRoots(document, []);

  ensureTransitionSuppressor();
  root.setAttribute(TRANSITION_SUPPRESS_ATTR, '');
  setShadowSuppression(shadowRoots, true);

  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
  }
  root.setAttribute('data-theme', theme);
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute('content', vars['--yp-bg-page']);

  void root.offsetHeight;
  requestAnimationFrame(() => {
    root.removeAttribute(TRANSITION_SUPPRESS_ATTR);
    setShadowSuppression(shadowRoots, false);
  });
}

let _currentPref = 'auto';
let _mq = null;
let _mqListener = null;

function detachOsListener() {
  if (_mq && _mqListener) {
    _mq.removeEventListener?.('change', _mqListener);
  }
  _mqListener = null;
}

function attachOsListener() {
  detachOsListener();
  if (_currentPref !== 'auto') return;
  _mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!_mq) return;
  _mqListener = () => applyTheme(effectiveFromPref('auto'));
  _mq.addEventListener?.('change', _mqListener);
}

export function initGlobalTheme() {
  _currentPref = readPref();
  applyTheme(effectiveFromPref(_currentPref));
  attachOsListener();

  // Escuchar cambios desde cualquier componente. Acepta `preference` (nuevo
  // 3-state) o `theme` (legacy binario, lo trata como pref explícita).
  document.addEventListener('theme-changed', (e) => {
    const pref = e.detail?.preference;
    const theme = e.detail?.theme;
    if (pref === 'auto' || pref === 'light' || pref === 'dark') {
      _currentPref = pref;
      applyTheme(effectiveFromPref(pref));
      attachOsListener();
    } else if (theme === 'dark' || theme === 'default') {
      _currentPref = theme === 'dark' ? 'dark' : 'light';
      applyTheme(theme);
      attachOsListener();
    }
  });
}
