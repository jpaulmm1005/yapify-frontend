/**
 * Dev-only wiring guards.
 *
 * `addEventListener` accepts any string, and assigning `element[bind]` creates
 * the property when it does not exist. Both make a mistyped descriptor entry
 * fail completely silently — the channel is dead for good and nothing in the
 * console ever says so. These guards turn each of those silent failures into a
 * console warning during development.
 *
 * Everything here is gated on `import.meta.env.DEV`. In a production build the
 * exported functions return immediately, `virtual:yapi-emitted-events`
 * resolves to an empty list, and no guard ever throws — a wrong descriptor
 * still behaves exactly as it does today, it just gets reported in dev.
 *
 * How `out:` is validated: components document what they emit with `@fires`
 * JSDoc, which is a comment — it does not survive to runtime, and no component
 * exposes a `static get events()`. So the shell's Vite plugin
 * (`vite-plugin-event-manifest.js`) statically analyses the installed feature
 * packages at dev-server start and exposes the resulting list of event names
 * here. If a component ever does grow a `static get events()`, that takes
 * precedence over the manifest — see `guardOutBinding`.
 */

const DEV = import.meta.env?.DEV ?? false;

/** Max edit distance for a name to be offered as "did you mean". */
const SUGGESTION_MAX_DISTANCE = 6;

/** Console prefix so every guard message is greppable/filterable. */
const TAG = '[yapi-wiring]';

/** @type {Set<String>|null} Known emitted event names; `null` until loaded. */
let emittedEvents = null;

/** @type {Array<Function>} Checks queued while the manifest is still loading. */
let deferred = [];

/** @type {Set<String>} Already-reported messages, so a revive does not re-warn. */
const reported = new Set();

if (DEV) {
  import('virtual:yapi-emitted-events')
    .then((mod) => {
      const names = mod.default ?? [];
      emittedEvents = names.length ? new Set(names) : null;
      const queued = deferred;
      deferred = [];
      queued.forEach((fn) => fn());
    })
    .catch(() => {
      emittedEvents = null;
      deferred = [];
    });
}

/**
 * Warns once per distinct message. Repeated wirings of the same page (the
 * router re-wires on every revive) must not spam the console.
 *
 * @param {String} message - Full message text.
 * @returns {void}
 */
function warnOnce(message) {
  if (reported.has(message)) return;
  reported.add(message);
  console.warn(message);
}

/**
 * Levenshtein distance, capped: returns `max + 1` as soon as it is exceeded so
 * scanning a few hundred candidate names stays cheap.
 *
 * @param {String} a - First string.
 * @param {String} b - Second string.
 * @param {Number} max - Distance beyond which the exact value stops mattering.
 * @returns {Number} The distance, or `max + 1` when it is larger.
 */
function boundedDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (row[j] < best) best = row[j];
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/**
 * Finds the closest known name to `name`, so the warning can point straight at
 * the intended event instead of only saying "not found".
 *
 * @param {String} name - The name that was not found.
 * @param {Iterable<String>} candidates - Known names.
 * @returns {String|null} The closest candidate, or `null` when none is close.
 */
function closestMatch(name, candidates) {
  let best = null;
  let bestDistance = SUGGESTION_MAX_DISTANCE + 1;
  for (const candidate of candidates) {
    const distance = boundedDistance(name, candidate, bestDistance - 1);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/**
 * Returns the event names a component declares it can emit, when it declares
 * them at all. This is the contract the repo should converge on: a
 * `static get events()` on the component class makes the `@fires` JSDoc
 * available at runtime and removes the need for any static analysis.
 *
 * @param {HTMLElement} element - The mounted component.
 * @returns {Set<String>|null} Declared names, or `null` when undeclared.
 */
function declaredEvents(element) {
  const declared = element.constructor?.events;
  if (!declared) return null;
  return new Set(declared);
}

/**
 * Checks that an `out:` channel binds a DOM event some component actually
 * emits. A typo here is invisible: the listener attaches, nothing ever
 * dispatches that name, and the channel — plus its analytics and its
 * navigation — is dead forever.
 *
 * @param {HTMLElement} element - The mounted component.
 * @param {String} channel - Bus channel name from the descriptor.
 * @param {String} eventName - The `bind:` value being listened for.
 * @returns {void}
 */
export function guardOutBinding(element, channel, eventName) {
  if (!DEV) return;

  const own = declaredEvents(element);
  if (own) {
    if (own.has(eventName)) return;
    const suggestion = closestMatch(eventName, own);
    warnOnce(
      `${TAG} out "${channel}" binds "${eventName}", which <${element.localName}> does not list in its static events().` +
        (suggestion ? ` Did you mean "${suggestion}"?` : ''),
    );
    return;
  }

  if (emittedEvents === null) {
    deferred.push(() => guardOutBinding(element, channel, eventName));
    return;
  }
  if (emittedEvents.has(eventName)) return;

  const suggestion = closestMatch(eventName, emittedEvents);
  warnOnce(
    `${TAG} out "${channel}" binds "${eventName}", which no Yapify component emits — the listener is dead.` +
      (suggestion ? ` Did you mean "${suggestion}"?` : ''),
  );
}

/**
 * Checks that an `in:` channel targets a property or method the component
 * really has. Without this, a typo silently creates a brand-new property on
 * the element and the feature never sees the value.
 *
 * @param {HTMLElement} element - The mounted component.
 * @param {String} channel - Bus channel name from the descriptor.
 * @param {String} bind - The property or method name from the descriptor.
 * @returns {void}
 */
export function guardInBinding(element, channel, bind) {
  if (!DEV) return;
  if (bind in element) return;

  const candidates = new Set();
  for (let proto = element; proto; proto = Object.getPrototypeOf(proto)) {
    if (proto === HTMLElement.prototype) break;
    Object.getOwnPropertyNames(proto).forEach((name) => candidates.add(name));
  }
  const suggestion = closestMatch(bind, candidates);
  warnOnce(
    `${TAG} in "${channel}" binds "${bind}", which <${element.localName}> does not expose —` +
      ' the shell would create a new property nothing reads.' +
      (suggestion ? ` Did you mean "${suggestion}"?` : ''),
  );
}

/**
 * Checks that a `link.page` is a known route key or an explicit path. A bare
 * word that is not a route key is used verbatim as the path, which navigates
 * to a URL no route matches — a mute 404.
 *
 * @param {String} page - The `link.page` value from the descriptor.
 * @param {Object} routes - The route-name → path map from `router/routes.js`.
 * @returns {void}
 */
export function guardLinkPage(page, routes) {
  if (!DEV) return;
  if (Object.prototype.hasOwnProperty.call(routes, page)) return;
  if (page.startsWith('/')) return;

  const suggestion = closestMatch(page, Object.keys(routes));
  warnOnce(
    `${TAG} link.page "${page}" is not a route key and is not a path (it does not start with "/"),` +
      ` so it is used verbatim and navigates nowhere.` +
      (suggestion ? ` Did you mean "${suggestion}"?` : ''),
  );
}
