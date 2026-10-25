/**
 * YapiBus — Global Event Bus (Singleton)
 *
 * The communication backbone of the shell. Features know nothing about
 * this bus — only the shell's component-wirer subscribes to channels and
 * routes them to feature properties / public methods.
 *
 * `emit` also caches the last value per channel. Subscribers that join
 * AFTER the value was emitted receive it immediately on subscribe — this
 * is how a feature mounted later (e.g. after navigation) gets the current
 * cart snapshot without the shell pushing `previousState` from a service.
 */
class YapiBus extends EventTarget {
  constructor() {
    super();
    this._lastValueByChannel = new Map();
    this._seqByChannel = new Map();
  }

  /**
   * Emit a message on a named channel. The value is cached so future
   * subscribers receive it on attach, and a per-channel sequence number is
   * bumped so signal consumers can tell one emission from the next.
   *
   * @param {string} channel
   * @param {*} detail
   */
  emit(channel, detail = {}) {
    this._lastValueByChannel.set(channel, detail);
    this._seqByChannel.set(channel, (this._seqByChannel.get(channel) ?? 0) + 1);
    this.dispatchEvent(new CustomEvent(channel, { detail }));
  }

  /**
   * Subscribe to a channel. If a value was emitted before this call, it
   * is replayed synchronously on attach so the new subscriber starts
   * with the current state without polling.
   *
   * @param {string} channel
   * @param {(event: CustomEvent) => void} handler
   * @returns {() => void} unsubscribe function
   */
  on(channel, handler) {
    this.addEventListener(channel, handler);
    if (this._lastValueByChannel.has(channel)) {
      const detail = this._lastValueByChannel.get(channel);
      handler(new CustomEvent(channel, { detail }));
    }
    return () => this.removeEventListener(channel, handler);
  }

  /**
   * Subscribe to a channel WITHOUT the last-value replay. Used for signal
   * channels (e.g. invalidations) where replaying the cached value on every
   * re-subscribe would re-fire a one-shot action; the wirer handles the
   * deliver-once-per-consumer replay itself via {@link seqOf}/{@link peek}.
   *
   * @param {string} channel
   * @param {(event: CustomEvent) => void} handler
   * @returns {() => void} unsubscribe function
   */
  onRaw(channel, handler) {
    this.addEventListener(channel, handler);
    return () => this.removeEventListener(channel, handler);
  }

  /**
   * Current emission count for a channel (0 if never emitted).
   *
   * @param {string} channel
   * @returns {number}
   */
  seqOf(channel) {
    return this._seqByChannel.get(channel) ?? 0;
  }

  /**
   * Whether a value has ever been cached for a channel.
   *
   * @param {string} channel
   * @returns {boolean}
   */
  hasCached(channel) {
    return this._lastValueByChannel.has(channel);
  }

  /**
   * Last cached value for a channel (undefined if never emitted).
   *
   * @param {string} channel
   * @returns {*}
   */
  peek(channel) {
    return this._lastValueByChannel.get(channel);
  }

  /**
   * Subscribe once — auto-unsubscribes after first event. Honors the
   * cached last value if there is one.
   *
   * @param {string} channel
   * @param {(event: CustomEvent) => void} handler
   */
  once(channel, handler) {
    const wrapper = (e) => {
      this.removeEventListener(channel, wrapper);
      handler(e);
    };
    this.addEventListener(channel, wrapper);
    if (this._lastValueByChannel.has(channel)) {
      const detail = this._lastValueByChannel.get(channel);
      wrapper(new CustomEvent(channel, { detail }));
    }
  }
}

export const yapiBus = new YapiBus();

if (import.meta.env?.DEV) {
  window.__yapiBus = yapiBus;
}
