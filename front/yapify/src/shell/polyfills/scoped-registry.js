import '@webcomponents/scoped-custom-element-registry';

/**
 * Carga el polyfill de scoped custom element registries y le agrega un
 * fallback global.
 *
 * Chromium 151 estrenó su propio scoped registry nativo y dejó al polyfill
 * `@webcomponents/scoped-custom-element-registry@0.0.10` (la última publicada)
 * a medio funcionar: define los tags en el registry scopeado pero ya no
 * upgradea los elementos que viven en ese shadow root. El síntoma es mudo —
 * el elemento aparece en el DOM con altura 0, sin shadowRoot y sin un solo
 * error en consola. En esta app eso dejaba a los 31 orquestadores sin su
 * Local DM: el `_dmRef.value?.fetchX?.()` no encontraba el método, nadie
 * hacía fetch y la pantalla se quedaba en esqueletos para siempre.
 *
 * El parche hace que definir un tag en cualquier registry scopeado lo defina
 * también en el global, si nadie lo reclamó antes. Es seguro porque en este
 * repo cada tag pertenece a una sola clase (convención de naming): el registry
 * scopeado sigue mandando donde el polyfill funciona, y donde no, el global
 * levanta el componente igual.
 *
 * Importar este módulo en vez del polyfill pelado.
 */
const registryProto = CustomElementRegistry.prototype;
const nativeDefine = registryProto.define;

registryProto.define = function define(tag, ctor, options) {
  const result = nativeDefine.call(this, tag, ctor, options);
  if (this !== window.customElements && !window.customElements.get(tag)) {
    try {
      nativeDefine.call(window.customElements, tag, ctor, options);
    } catch {
      // noop — el constructor ya estaba tomado por otro tag global; el registry
      // scopeado igual quedó definido, que es el camino normal.
    }
  }
  return result;
};
