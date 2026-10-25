import { yapiBus } from '../event-bus/yapi-bus.js';
import { captureFromFingerprint } from '../analytics/index.js';
import { resolveLink } from './link-resolver.js';
import { guardInBinding, guardOutBinding } from './wiring-guards.js';

/**
 * ComponentWirer — The heart of the "dumb MFE" pattern.
 *
 * Given a mounted HTMLElement and its `yapiConnections` descriptor, this
 * wirer:
 *
 *   - IN:  subscribes bus channels → assigns property OR calls public method
 *          (when `element[bind]` is a function, it is invoked with the detail
 *          so the feature can parse / validate before committing state).
 *          Mark a channel `signal: true` for one-shot signals (invalidations):
 *          the cached value is replayed to a reviving consumer only once per
 *          emission, never re-firing on subsequent revives.
 *
 *   - OUT: listens to DOM events on the element → fires analytics fingerprint,
 *          re-emits on the bus channel, and executes declarative flags
 *          (`backStep`, `navigate`) so the shell stays a pure orchestrator
 *          and never wires feature-specific `yapiBus.on` handlers.
 *
 * The feature itself has zero knowledge of the bus, channels, the router,
 * or any other feature. Cross-feature coordination happens entirely through
 * the descriptor + bus.
 *
 * Every binding is checked in development by `wiring-guards.js`: an `out:`
 * event nobody emits and an `in:` property the component does not expose are
 * both silent no-ops at runtime, so each gets a console warning. The guards
 * are compiled out of production builds and never throw.
 *
 * Declarative flags supported on an OUT channel:
 *   - `backStep: true`            → `onBackStep()` (the router goes back)
 *   - `link: { page, params }`    → `onNavigate(resolvedUrl)` — see `link-resolver.js`
 *   - `forwardToNative: true`     → `onForwardToNative(channel, detail)`
 *   - `analytics: A_xxx`          → captura PostHog en cada disparo
 *   - `skipBus: true`             → analytics/navigation only; do NOT re-emit on
 *                                   the bus (keeps high-frequency channels out of
 *                                   the last-value cache)
 *
 * @param {HTMLElement} element - The mounted web component.
 * @param {object} yapiConnections - `{ in: {}, out: {} }`.
 * @param {object} [options]
 * @param {Function} [options.onForwardToNative] - Channel + detail forwarded to the native bridge.
 * @param {Function} [options.onBackStep]        - Called when an out channel has `backStep: true`.
 * @param {Function} [options.onNavigate]        - Called with `(path, detail)` when an out channel has `navigate`.
 * @returns {() => void} cleanup — call when unmounting the component.
 */
export function wireComponent(element, yapiConnections = {}, options = {}) {
  const { in: inputs = {}, out: outputs = {} } = yapiConnections;
  const { onForwardToNative, onBackStep, onNavigate } = options;
  const cleanupFns = [];

  // IN — channel → element property OR public method.
  for (const [channel, config] of Object.entries(inputs)) {
    const { bind, signal } = config;

    guardInBinding(element, channel, bind);

    const apply = (value) => {
      const target = element[bind];
      if (typeof target === 'function') {
        target.call(element, value);
      } else {
        element[bind] = value;
      }
    };

    if (signal) {
      // Deliver-once-per-consumer: a signal channel (e.g. an invalidation)
      // must reach a feature that was hidden when it fired, but must NOT
      // re-fire every time that feature revives. We replay the cached value
      // on (re)wire only when its sequence is newer than the last one this
      // element consumed; the seen-seq map lives on the element so it
      // survives the router's re-wiring across revives.
      const seen = (element.__yapiSignalSeq ??= {});
      const handler = (e) => {
        seen[channel] = yapiBus.seqOf(channel);
        apply(e.detail);
      };
      cleanupFns.push(yapiBus.onRaw(channel, handler));
      if (yapiBus.hasCached(channel) && yapiBus.seqOf(channel) > (seen[channel] ?? 0)) {
        seen[channel] = yapiBus.seqOf(channel);
        apply(yapiBus.peek(channel));
      }
      continue;
    }

    const handler = (e) => apply(e.detail);
    const unsub = yapiBus.on(channel, handler);
    cleanupFns.push(unsub);
  }

  // OUT — DOM event → analytics + bus channel + declarative flags.
  for (const [channel, config] of Object.entries(outputs)) {
    const {
      bind: eventName,
      analytics,
      backStep,
      link,
      forwardToNative,
      skipBus,
    } = config;

    const handler = (e) => {
      const detail = e.detail ?? {};

      if (analytics) {
        captureFromFingerprint(analytics, detail);
      }

      if (!skipBus) {
        yapiBus.emit(channel, detail);
      }

      if (backStep && typeof onBackStep === 'function') {
        onBackStep();
      }
      if (link && typeof onNavigate === 'function') {
        const url = resolveLink(link, detail);
        if (url) onNavigate(url);
      }
      if (forwardToNative && typeof onForwardToNative === 'function') {
        onForwardToNative(channel, detail);
      }
    };

    guardOutBinding(element, channel, eventName);

    element.addEventListener(eventName, handler);
    cleanupFns.push(() => element.removeEventListener(eventName, handler));
  }

  return () => cleanupFns.forEach((fn) => fn());
}
