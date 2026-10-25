/**
 * Set of ids that forgets each entry after `ttlMs`. Used to drop the second
 * copy of a notification that arrives through both the realtime stream and
 * FCM.
 *
 * @param {Number} ttlMs - How long an id stays remembered.
 * @param {() => Number} [now] - Clock, injectable for tests.
 * @returns {{ has: (id: String) => Boolean, add: (id: String) => void }}
 */
export function createSeenIds(ttlMs, now = () => Date.now()) {
  const expiresAt = new Map();
  const prune = () => {
    const t = now();
    for (const [id, until] of expiresAt) if (until <= t) expiresAt.delete(id);
  };
  return {
    has(id) {
      prune();
      return Boolean(id) && expiresAt.has(id);
    },
    add(id) {
      prune();
      if (id) expiresAt.set(id, now() + ttlMs);
    },
  };
}
