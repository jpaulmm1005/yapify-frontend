import { yapiBus } from '../event-bus/yapi-bus.js';

/**
 * Bridges the legacy cross-feature window signals
 * (`yapify:redemption-created`, `yapify:purchase-completed`) into the
 * `kind_list_invalidate` bus channel with a normalised reason string.
 *
 * Why: features must never call `addEventListener` themselves (regla
 * "features aisladas"). Until every emitter is migrated to dispatch on
 * the bus directly, the shell absorbs the window events here and
 * re-emits as a bus channel that feature page descriptors can wire via
 * `yapiConnections.in: { kind_list_invalidate: { bind: 'invalidate' } }`.
 *
 * Reasons emitted on the channel:
 *   - 'redemption_created'  ← window 'yapify:redemption-created'
 *   - 'purchase_completed'  ← window 'yapify:purchase-completed'
 */

const SIGNAL_TO_REASON = Object.freeze({
  'yapify:redemption-created': 'redemption_created',
  'yapify:purchase-completed': 'purchase_completed',
});

export function setupListInvalidationBridge() {
  for (const [signal, reason] of Object.entries(SIGNAL_TO_REASON)) {
    window.addEventListener(signal, () => {
      yapiBus.emit('kind_list_invalidate', reason);
    });
  }
}
