import { yapiBus } from '../event-bus/yapi-bus.js';
import { emitPushReceived } from '../notifications/push-notice.js';
import { getAccessToken } from '../session/token-store.js';
import { authedFetch } from '../util/authed-fetch.js';
import {
  channelForSignal,
  NOTIFICATIONS_RESYNC_CHANNEL,
  RESYNC_CHANNELS,
  toPushNotice,
} from './realtime-channels.js';
import { createSseParser } from './sse-parser.js';

/**
 * Realtime stream (Server-Sent Events) of the logged-in user.
 *
 * Opens `GET /api/realtime/stream` with `authedFetch`, so the JWT goes in the
 * `Authorization` header and a 401 triggers the shared refresh. Every signal
 * is forwarded to the bus: `notification.created` through `push-notice.js`
 * (same toast, badge bump and inbox invalidation as a foreground push), data
 * signals as `points_changed` / `orders_changed` / `redemptions_changed`.
 *
 * Resilience:
 *   - any drop reconnects with exponential backoff (1 s … 30 s, with jitter);
 *   - 60 s without a byte (the server pings every 25 s) means a dead socket;
 *   - backgrounding the app closes the stream, foregrounding reopens it;
 *   - every reconnect (not the first open) emits the resync channels, so the
 *     screens recover whatever changed while the stream was down.
 *
 * Signals are hints, never the source of truth: if the stream never connects
 * the app behaves as before and each screen loads its data when opened.
 */

const STREAM_PATH = '/api/realtime/stream';
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30000;
const SILENCE_TIMEOUT_MS = 60000;
const NOTIFICATION_SIGNAL = 'notification.created';

let _apiBaseUrl = '';
let _wanted = false;
let _paused = false;
let _controller = null;
let _retryTimer = null;
let _silenceTimer = null;
let _attempt = 0;
let _connectedOnce = false;
let _wired = false;

/**
 * Forwards one parsed stream event to the bus.
 *
 * @param {{ event: String, data: String }} message
 */
function handleMessage({ event, data }) {
  let payload;
  try {
    payload = JSON.parse(data);
  } catch {
    return;
  }
  if (event === NOTIFICATION_SIGNAL) {
    emitPushReceived(toPushNotice(payload));
    return;
  }
  const channel = channelForSignal(event);
  if (channel) yapiBus.emit(channel, payload);
}

/** Asks every realtime consumer to re-pull after a gap in the stream. */
function emitResync() {
  for (const channel of RESYNC_CHANNELS) yapiBus.emit(channel, { reason: 'resync' });
  yapiBus.emit(NOTIFICATIONS_RESYNC_CHANNEL, { reason: 'resync' });
}

/**
 * Restarts the silence watchdog; when it fires, the connection is aborted
 * and the normal reconnect path takes over.
 *
 * @param {AbortController} controller
 */
function armSilenceWatchdog(controller) {
  clearTimeout(_silenceTimer);
  _silenceTimer = setTimeout(() => controller.abort(), SILENCE_TIMEOUT_MS);
}

/**
 * Reads the response body until it ends or the connection is aborted.
 *
 * @param {ReadableStream<Uint8Array>} body
 * @param {AbortController} controller
 * @returns {Promise<void>}
 */
async function readStream(body, controller) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser(handleMessage);
  armSilenceWatchdog(controller);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    armSilenceWatchdog(controller);
    parser.push(decoder.decode(value, { stream: true }));
  }
}

/** Schedules the next connection attempt with capped, jittered backoff. */
function scheduleReconnect() {
  clearTimeout(_retryTimer);
  if (!_wanted || _paused) return;
  const base = Math.min(BACKOFF_BASE_MS * 2 ** _attempt, BACKOFF_MAX_MS);
  _attempt += 1;
  _retryTimer = setTimeout(connect, base * (0.5 + Math.random() * 0.5));
}

/** Opens the stream once; every way it can end leads to `scheduleReconnect`. */
async function connect() {
  if (!_wanted || _paused || _controller || !_apiBaseUrl || !getAccessToken()) return;
  const controller = new AbortController();
  _controller = controller;
  try {
    const res = await authedFetch(`${_apiBaseUrl}${STREAM_PATH}`, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`realtime stream ${res.status}`);
    const isReconnect = _connectedOnce;
    _connectedOnce = true;
    _attempt = 0;
    if (isReconnect) emitResync();
    await readStream(res.body, controller);
  } catch {
    // noop — a failed or dropped stream is retried by scheduleReconnect below.
  } finally {
    clearTimeout(_silenceTimer);
    if (_controller === controller) _controller = null;
    scheduleReconnect();
  }
}

/** Closes the current connection, if any, without cancelling the intent to be connected. */
function closeConnection() {
  clearTimeout(_retryTimer);
  clearTimeout(_silenceTimer);
  _controller?.abort();
  _controller = null;
}

/** Stops streaming while the app is not visible. */
function pause() {
  _paused = true;
  closeConnection();
}

/** Reopens the stream when the app comes back to the foreground. */
function resume() {
  if (!_paused) return;
  _paused = false;
  _attempt = 0;
  connect();
}

/**
 * Wires the lifecycle listeners. Called once from `main.js`, before the
 * session coordinator can call `startRealtime()`.
 *
 * @param {{ apiBaseUrl: String }} options
 */
export function setupRealtimeCoordinator({ apiBaseUrl }) {
  _apiBaseUrl = apiBaseUrl;
  if (_wired) return;
  _wired = true;
  yapiBus.onRaw('__bridge_app_state_change', (e) => {
    if (e.detail?.isActive) resume();
    else pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pause();
    else resume();
  });
}

/** Starts (or keeps) the stream for the current session. Idempotent. */
export function startRealtime() {
  _wanted = true;
  _paused = document.visibilityState === 'hidden';
  connect();
}

/** Closes the stream for good (logout). The next `startRealtime()` starts fresh. */
export function stopRealtime() {
  _wanted = false;
  _connectedOnce = false;
  _attempt = 0;
  closeConnection();
}
