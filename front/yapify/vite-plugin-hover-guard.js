/**
 * Vite plugin — gate every `:hover` rule behind `@media (hover: hover)` at build
 * time, across all bundled Lit `css``` templates (both inline `static styles`
 * and `*.css.js` files).
 *
 * Why: this app ships as a Capacitor (touch) webview. On touch there is no
 * pointer-leave, so a `:hover` style applied on tap stays "stuck" until the user
 * taps elsewhere. Wrapping every hover rule in a hover-capable media query makes
 * hover apply ONLY on devices with a real hovering pointer (desktop web) and
 * disappear on phones — fixing the stuck-hover globally from one place, without
 * editing every feature/component repo.
 *
 * Safe because:
 *   - It only rewrites text INSIDE a `css`...`` tagged template, never the
 *     surrounding JS, so JS braces are untouched.
 *   - Every `css`` template in this codebase is static (no `${}` interpolation),
 *     so the `[^`]*` capture never splits a nested template.
 *   - Hover rules are flat (`selector:hover { decls }`), so the rule regex
 *     isolates each rule between braces.
 * Scoped to first-party packages (path contains `yapify`) so third-party libs
 * (lit, firebase, …) are never touched.
 *
 * IMPORTANTE — listas de selectores mixtas. El patrón canónico del repo para
 * un estado activo es:
 *
 *     .chip--active,
 *     .chip--active:hover { background: var(--yp-accent); }
 *
 * Envolver la regla entera dejaba el estado activo dentro de
 * `@media (hover: hover)`, de modo que en un teléfono (sin puntero que
 * flote) NO se aplicaba ninguna: el chip o el toggle seleccionado se veía
 * igual que los no seleccionados. Por eso la lista se parte en dos: los
 * selectores sin `:hover` se emiten fuera de la media query y solo los de
 * hover quedan protegidos.
 */

const TARGET_ID = /\.js(\?|$)/;
const CSS_TEMPLATE = /\bcss`([^`]*)`/g;
const HOVER_RULE = /([^{}]*:hover[^{}]*?)\{([^{}]*)\}/g;

export function hoverGuardPlugin() {
  return {
    name: 'yapify-hover-guard',
    enforce: 'pre',
    transform(code, id) {
      if (!TARGET_ID.test(id)) return null;
      if (!id.includes('yapify')) return null;
      if (!code.includes(':hover')) return null;
      let changed = false;
      const out = code.replace(CSS_TEMPLATE, (full, cssText) => {
        if (!cssText.includes(':hover')) return full;
        const wrapped = cssText.replace(HOVER_RULE, (rule, selectorList, decls) => {
          const selectors = selectorList.split(',').map((s) => s.trim()).filter(Boolean);
          const hovered = selectors.filter((s) => s.includes(':hover'));
          const plain = selectors.filter((s) => !s.includes(':hover'));
          // Sin selectores de hover reales (p. ej. `:hover` dentro de un
          // comentario): se deja la regla intacta.
          if (!hovered.length) return rule;
          const guarded = `@media (hover: hover){${hovered.join(',')}{${decls}}}`;
          // Los selectores planos de la misma lista conservan su efecto en
          // todo dispositivo; solo el hover queda tras la media query.
          return plain.length ? `${plain.join(',')}{${decls}}${guarded}` : guarded;
        });
        if (wrapped !== cssText) changed = true;
        return 'css`' + wrapped + '`';
      });
      return changed ? { code: out, map: null } : null;
    },
  };
}
