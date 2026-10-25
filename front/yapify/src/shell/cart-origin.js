/**
 * Cart Origin — de dónde salió cada item que entra al carrito.
 *
 * Es la mitad cliente de `order_items.source_kind` / `order_items.source_ref`.
 * El backend ya acepta ambos campos por item en `POST /api/orders`, pero hasta
 * ahora el cliente nunca los mandaba: toda compra real caía al default
 * `'browse'` y el capítulo de impacto de la tesis no podía separar lo que
 * vendió el recomendador de lo que se vendió navegando.
 *
 * El vocabulario es el mismo de `libs/common/src/orders/item-source.ts` en
 * `yapify-backend`. Un valor fuera de esa lista es un 400 en el DTO, así que
 * todo lo que sale de acá pasa por `normalizeOrigin` antes de tocar el carrito.
 *
 * ── Por qué hace falta un tracker y no basta el evento de add-to-cart ──
 *
 * Dos de los seis orígenes no se pueden leer del evento que agrega al carrito,
 * porque el descubrimiento pasó en OTRA pantalla:
 *
 *   - Buscar una tienda en /stores y comprarle un producto llega al carrito por
 *     el mismo canal `public_store_product_add` que navegar el catálogo a pelo.
 *   - Abrir la notificación de una venta flash (o de una campaña) aterriza en la
 *     tienda pública, y desde ahí es otra vez el mismo canal.
 *
 * Entonces el shell anota la intención de navegación cuando ocurre («este
 * usuario va a la tienda X viniendo de una búsqueda») y el cart-service la
 * consume cuando el item efectivamente se agrega. El origen se guarda por
 * *scope* de destino (`store` / `item`) y es de un solo uso: si el usuario da
 * la vuelta y vuelve por otro camino, la anotación vieja ya se consumió.
 *
 * Es el mismo patrón que ya usa `navigation-coordinator.js` con
 * `window.__yapifyPublicStoreTab`, pero encapsulado acá para que el origen no
 * ande suelto en `window`.
 */

/**
 * Vocabulario de `order_items.source_kind`. Espejo exacto de
 * `ORDER_ITEM_SOURCE_KINDS` en el backend — si allá se agrega un valor, acá
 * también, si no el POST se va con algo que el DTO rechaza con 400.
 */
export const SOURCE_KINDS = [
  'search',
  'browse',
  'recommendation',
  'campaign',
  'flash_sale_alert',
  'qr_scan',
];

/**
 * Origen que asume el backend cuando el cliente no informa ninguno. No hace
 * falta mandarlo explícitamente; se deja acá para poder comparar.
 */
export const DEFAULT_SOURCE_KIND = 'browse';

/** Largo máximo de `order_items.source_ref` (VARCHAR(64) en el esquema). */
export const SOURCE_REF_MAX = 64;

/**
 * Deja un origen en la forma exacta que el backend acepta.
 *
 * Un `kind` fuera del vocabulario se descarta en vez de propagarse: perder la
 * traza de un item es barato, un 400 en el checkout le cuesta la compra al
 * usuario. Misma lógica con `ref`, que además se recorta a 64 caracteres.
 *
 * El shape `{ kind, ref }` es el mismo de entrada y de salida a propósito: el
 * origen viaja igual desde que lo emite una feature hasta que el cart-service
 * lo baja al item. Recién ahí se renombra a `sourceKind` / `sourceRef`.
 *
 * @param {Object} [origin] - `{ kind, ref }` crudo.
 * @returns {{ kind: String|null, ref: String|null }}
 */
export function normalizeOrigin(origin) {
  const rawKind = origin?.kind;
  // Sin un `kind` válido el `ref` tampoco sirve: es el id de una fuente que ya
  // se descartó. Se caen los dos juntos, nunca una referencia huérfana.
  if (!SOURCE_KINDS.includes(rawKind)) return { kind: null, ref: null };
  const rawRef = origin?.ref;
  const trimmed = typeof rawRef === 'string' ? rawRef.trim() : '';
  return {
    kind: rawKind,
    ref: trimmed ? trimmed.slice(0, SOURCE_REF_MAX) : null,
  };
}

/**
 * Arma un `source_ref` legible a partir de las partes que tenga la fuente,
 * saltándose las vacías. `['recommendation', 'model', 'product', 42]` queda
 * como `'recommendation:model:product:42'`.
 *
 * @param {...(String|Number|null|undefined)} parts
 * @returns {String|null}
 */
export function buildSourceRef(...parts) {
  const ref = parts
    .filter((p) => p !== null && p !== undefined && String(p).trim() !== '')
    .map((p) => String(p).trim())
    .join(':');
  return ref || null;
}

/* ── Anotaciones de navegación pendientes ── */

/**
 * Cuánto vale una anotación antes de considerarla basura. Si el usuario buscó
 * una tienda, se fue a hacer otra cosa y volvió media hora después por el
 * dashboard, esa compra no nació de la búsqueda.
 */
const PENDING_TTL_MS = 10 * 60 * 1000;

/**
 * Las anotaciones viven en `sessionStorage`, no en memoria.
 *
 * Entre «toco la tienda en los resultados de búsqueda» y «agrego el producto»
 * hay un cambio de ruta, y el shell se recarga entero más seguido de lo que
 * parece: un F5 en la tienda, el reload del WebView en Capacitor, o en dev el
 * propio Vite cuando descubre una dependencia nueva. Con el estado en memoria
 * esos casos perdían el origen y la compra caía a `browse`.
 *
 * `sessionStorage` y no `localStorage` a propósito: el origen vale para ESTA
 * visita. Si el usuario cierra la pestaña y vuelve mañana, la búsqueda de ayer
 * ya no explica la compra de hoy.
 *
 * Es el mismo criterio de `session/selected-store.js`, que también persiste su
 * one-shot para sobrevivir al F5.
 */
const STORAGE_KEY = 'yapify-cart-origin';

/**
 * @returns {Object} Mapa `scope → { origin, at }` leído del storage.
 */
function readPending() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {Object} next
 * @returns {void}
 */
function writePending(next) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* ignore — sin storage el origen simplemente cae al default */ }
}

/**
 * Anota de dónde viene la navegación que está por ocurrir.
 *
 * @param {String} scope - `'store'` o `'item'`, según a qué pantalla se va.
 * @param {Object} origin - `{ kind, ref }`.
 * @returns {void}
 */
export function setPendingOrigin(scope, origin) {
  const normalized = normalizeOrigin(origin);
  const next = readPending();
  if (!normalized.kind) delete next[scope];
  else next[scope] = { origin: normalized, at: Date.now() };
  writePending(next);
}

/**
 * Consume la anotación de un scope. Es de un solo uso: la segunda llamada
 * devuelve null aunque la primera haya encontrado algo.
 *
 * @param {String} scope
 * @returns {{ kind: String, ref: String|null }|null}
 */
export function takePendingOrigin(scope) {
  const next = readPending();
  const entry = next[scope];
  if (!entry) return null;
  delete next[scope];
  writePending(next);
  if (Date.now() - entry.at > PENDING_TTL_MS) return null;
  return entry.origin ?? null;
}

/**
 * Scope de destino según la ruta activa. `public_store_product_add` lo emiten
 * tanto la tienda pública como el detalle de item, con el mismo nombre de
 * canal y el mismo shape, así que la ruta es lo único que los distingue.
 *
 * @returns {String} `'item'` en `/item/...`, `'store'` en cualquier otra.
 */
export function currentOriginScope() {
  const hash = (typeof location !== 'undefined' && location.hash) || '';
  return hash.replace(/^#/, '').startsWith('/item') ? 'item' : 'store';
}

/* ── Suscripciones al bus ── */

/**
 * Clave de `sessionStorage` donde queda si el usuario tiene una búsqueda de
 * tiendas activa en /stores. Persistida por el mismo motivo que las
 * anotaciones: entre tipear y tocar la tienda puede haber una recarga.
 *
 * Ojo con el borde: el botón "limpiar" de `<explore-search>` no emite
 * `search_performed`, así que si el usuario busca, limpia con la X y después
 * navega el grid, esa visita queda marcada como `search` sin serlo. Es una
 * imprecisión conocida, y cae del lado seguro para la tesis: confunde `search`
 * con `browse`, que son los dos grupos de control — nunca infla al
 * recomendador, que es lo único que invalidaría la comparación.
 */
const QUERY_KEY = 'yapify-cart-origin-query';

/**
 * @returns {String} La búsqueda activa, o '' si no hay.
 */
function readExploreQuery() {
  try {
    return sessionStorage.getItem(QUERY_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * @param {String} query
 * @returns {void}
 */
function writeExploreQuery(query) {
  try {
    if (query) sessionStorage.setItem(QUERY_KEY, query);
    else sessionStorage.removeItem(QUERY_KEY);
  } catch { /* ignore */ }
}

/**
 * Suscribe el tracker a los canales de navegación que sí cambian el origen.
 * Se llama sola al importar el módulo, igual que hace `cart-service.js`.
 *
 * @param {Object} bus - El `yapiBus`.
 * @returns {void}
 */
export function setupCartOriginTracker(bus) {
  // ── /stores: búsqueda de tiendas ──
  // Es el ÚNICO buscador de cara al usuario en toda la app (busca tiendas, no
  // productos). Comprar dentro de una tienda que apareció por una búsqueda es
  // el único camino real hacia `source_kind = 'search'`.
  bus.onRaw('search_performed', (e) => {
    writeExploreQuery(String(e.detail?.query ?? '').trim());
  });

  bus.onRaw('explore_go_store', () => {
    // Sin `ref`: la fuente es el texto que tipeó el usuario, no un id. El
    // backend pide "el id de la fuente concreta" y mandar la query cruda sería
    // basura (además de meter texto libre del usuario en la base).
    setPendingOrigin('store', readExploreQuery() ? { kind: 'search' } : null);
    writeExploreQuery('');
  });

  // ── Bandeja de notificaciones → tienda pública ──
  // `navigation-coordinator.js` ya rutea este canal; acá solo se anota el
  // origen. La alerta de venta flash gana sobre la campaña porque es la más
  // específica de las dos y el vocabulario tiene un valor propio para ella.
  bus.onRaw('notifications_open_source', (e) => {
    const { sourceType, sourceId, campaignId } = e.detail ?? {};
    if (sourceType === 'flash_sale') {
      setPendingOrigin('store', {
        kind: 'flash_sale_alert',
        ref: buildSourceRef('flash_sale', sourceId),
      });
      return;
    }
    if (campaignId != null) {
      setPendingOrigin('store', {
        kind: 'campaign',
        ref: buildSourceRef('campaign', campaignId),
      });
      return;
    }
    // Un aviso transaccional (puntos otorgados, pedido listo) no es una fuente
    // de descubrimiento: se deja caer al default `browse`.
    setPendingOrigin('store', null);
  });

  // ── Feed "Para ti" → detalle de item ──
  // Tocar una card del feed y comprar desde el detalle es el mismo click que
  // comprar desde la card: lo descubrió el recomendador.
  bus.onRaw('dashboard_go_item_detail', (e) => {
    const { item, bucket, itemKind } = e.detail ?? {};
    setPendingOrigin('item', {
      kind: 'recommendation',
      ref: buildSourceRef('foryou', bucket, itemKind, item?.id),
    });
  });

  // El carrusel "Para ti" del propio detalle de item pega al mismo
  // `/api/recommendations/feed`, así que item → item también es recomendación.
  bus.onRaw('item_go_item', (e) => {
    const { item, bucket, itemKind } = e.detail ?? {};
    setPendingOrigin('item', {
      kind: 'recommendation',
      ref: buildSourceRef('foryou', bucket, itemKind, item?.id),
    });
  });

  // Las listas por tipo son navegación por catálogo dentro de las tiendas que
  // el usuario ya sigue, no recomendación. Se anota explícitamente para pisar
  // cualquier anotación previa que hubiera quedado del feed.
  bus.onRaw('kind_list_open_item', () => {
    setPendingOrigin('item', { kind: 'browse' });
  });
}
