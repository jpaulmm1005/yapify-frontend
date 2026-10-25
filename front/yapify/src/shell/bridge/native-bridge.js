import { yapiBus } from '../event-bus/yapi-bus.js';

/**
 * NativeBridge — Abstraction layer over Capacitor.
 *
 * Responsibilities:
 * - Detect current platform (ios / android / web)
 * - Listen to native events and inject them into the bus as __bridge_* channels
 * - Forward selected bus events to native plugins (forward-to-native pattern)
 * - Register native function handlers accessible from web components
 */
class NativeBridge {
  constructor() {
    this._platform = 'web';
    this._initialized = false;
  }

  get platform() {
    return this._platform;
  }

  get isNative() {
    return this._platform === 'ios' || this._platform === 'android';
  }

  get isIos() {
    return this._platform === 'ios';
  }

  get isAndroid() {
    return this._platform === 'android';
  }

  /**
   * Initialize the bridge. Must be called once at app startup.
   */
  async init() {
    if (this._initialized) return;

    await this._detectPlatform();
    this._setupBackButton();
    this._setupAppStateListeners();
    this._initGoogleAuth();
    await this._setupStatusBar();

    this._initialized = true;
    yapiBus.emit('__bridge_app', { platform: this._platform });
  }

  /**
   * Configures the native status bar so the WebView does not draw under it
   * on Android, and applies a style/background that matches the active theme.
   * On iOS the WebView always extends behind the status bar (immersive); the
   * shell CSS uses env(safe-area-inset-top) to keep content clear.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _setupStatusBar() {
    if (!this.isNative) return;
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');

      const apply = async () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const pageBg = getComputedStyle(document.documentElement).getPropertyValue('--yp-bg-page').trim();
        const background = pageBg || (isDark ? '#16100C' : '#F9EFE3');
        try { await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }); } catch {}
        if (this.isAndroid) {
          try { await StatusBar.setOverlaysWebView({ overlay: false }); } catch {}
          try { await StatusBar.setBackgroundColor({ color: background }); } catch {}
        }
      };

      await apply();
      const observer = new MutationObserver(() => { apply(); });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch { /* @capacitor/status-bar not installed */ }
  }

  /**
   * Detect platform via Capacitor if available, otherwise 'web'.
   */
  async _detectPlatform() {
    try {
      const { Capacitor } = await import('@capacitor/core');
      this._platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
    } catch {
      this._platform = 'web';
    }
  }

  /**
   * Listen to native back button (Android) and inject into bus.
   * Equivalent to glomo-pe's __bridge_cancelled_back_navigation channel.
   */
  async _setupBackButton() {
    if (!this.isNative) return;
    try {
      const { App } = await import('@capacitor/app');
      App.addListener('backButton', ({ canGoBack }) => {
        yapiBus.emit('__bridge_cancelled_back_navigation', { canGoBack });
      });
    } catch { /* Capacitor not available */ }
  }

  /**
   * App foreground/background state listeners.
   */
  async _setupAppStateListeners() {
    if (!this.isNative) return;
    try {
      const { App } = await import('@capacitor/app');
      App.addListener('appStateChange', ({ isActive }) => {
        yapiBus.emit('__bridge_app_state_change', { isActive });
      });
    } catch { /* Capacitor not available */ }
  }

  /**
   * Initialize the Capacitor Google Auth plugin so the native SDK is ready
   * before the user taps "Sign in with Google".
   */
  async _initGoogleAuth() {
    if (!this.isNative) return;
    try {
      const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
      GoogleAuth.initialize();
    } catch { /* plugin not available */ }
  }

  /**
   * Forward a bus channel event to the native layer.
   * Called by component-wirer when a connection has forward-to-native: true.
   *
   * @param {string} channel - Bus channel name
   * @param {*} detail - Event payload
   */
  forwardToNative(channel, detail) {
    // In production, map channels to specific Capacitor plugin calls.
    // For now, log so you can wire up specific plugins as needed.
    yapiBus.emit(`__native_ack_${channel}`, { forwarded: true });
  }

  /**
   * Register a handler to be called when a __bridge_<key> channel fires.
   * Native code can trigger this via JSBridge in the future.
   *
   * @param {string} key
   * @param {Function} handler
   * @returns {() => void} unsubscribe
   */
  register(key, handler) {
    return yapiBus.on(`__bridge_${key}`, (e) => handler(e.detail));
  }

  /**
   * Trigger a named bridge event (for testing or native-initiated flows).
   * @param {string} key
   * @param {*} payload
   */
  trigger(key, payload = {}) {
    yapiBus.emit(`__bridge_${key}`, payload);
  }
}

export const nativeBridge = new NativeBridge();
