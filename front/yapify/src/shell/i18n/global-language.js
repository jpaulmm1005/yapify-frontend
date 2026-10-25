/**
 * Global Language Manager
 *
 * Aplica el idioma activo en `<html lang>` y lo persiste, así TODO componente
 * construido con `YapifyMixin` resuelve `t()` contra el locale correcto desde
 * el primer render. Es el espejo de `global-theme.js`: el shell aplica el
 * idioma al document, el mixin persiste la preferencia y reacciona al cambio.
 *
 * Flujo: un componente llama `_setLanguagePreference(lang)` (mixin) → persiste
 * en localStorage y emite `language-changed` al document → este manager lo
 * aplica a `<html lang>` y cada instancia del mixin actualiza su `language`.
 */

const LANGUAGE_KEY = 'yapify-language';
const SUPPORTED = ['es-PE', 'en-EN'];
const DEFAULT_LANGUAGE = 'es-PE';

/**
 * Lee la preferencia de idioma persistida, validándola contra los locales
 * soportados. Cae al default si está ausente o es inválida.
 *
 * @returns {String} `es-PE` | `en-EN`
 */
function readLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (SUPPORTED.includes(saved)) return saved;
  } catch { /* noop — localStorage bloqueado */ }
  return DEFAULT_LANGUAGE;
}

/**
 * Escribe el idioma en `<html lang>`. Sanea contra los soportados.
 *
 * @param {String} language
 */
function applyLanguage(language) {
  const lang = SUPPORTED.includes(language) ? language : DEFAULT_LANGUAGE;
  document.documentElement.lang = lang;
}

/**
 * Aplica el idioma persistido al boot y escucha `language-changed` para
 * reaplicarlo cuando cualquier componente cambia la preferencia. Llamar una
 * sola vez desde `main.js`, antes de montar features.
 *
 * @returns {void}
 */
export function initGlobalLanguage() {
  applyLanguage(readLanguage());
  document.addEventListener('language-changed', (e) => {
    const language = e.detail?.language;
    if (SUPPORTED.includes(language)) applyLanguage(language);
  });
}
