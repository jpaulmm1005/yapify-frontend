import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  channelForSignal,
  NOTIFICATIONS_RESYNC_CHANNEL,
  RESYNC_CHANNELS,
  toPushNotice,
} from '../realtime-channels.js';

test('maps data signals to bus channels', () => {
  assert.equal(channelForSignal('points.changed'), 'points_changed');
  assert.equal(channelForSignal('order.updated'), 'orders_changed');
  assert.equal(channelForSignal('redemption.updated'), 'redemptions_changed');
});

test('hello, ping and unknown signals map to nothing', () => {
  assert.equal(channelForSignal('hello'), null);
  assert.equal(channelForSignal('ping'), null);
  assert.equal(channelForSignal('whatever'), null);
});

test('resync covers every data channel plus the notifications one', () => {
  assert.deepEqual([...RESYNC_CHANNELS], ['points_changed', 'orders_changed', 'redemptions_changed']);
  assert.equal(NOTIFICATIONS_RESYNC_CHANNEL, 'notifications_resync');
});

test('turns notification.created into the push-notice shape', () => {
  const notice = toPushNotice({
    id: 55,
    type: 'points_awarded',
    store_id: 7,
    title: 'Ganaste',
    body: 'Te sumaron',
    click_action: '/profile/points',
    silent: true,
  });
  assert.deepEqual(notice, {
    title: 'Ganaste',
    body: 'Te sumaron',
    data: {
      notification_id: '55',
      notification_type: 'points_awarded',
      store_id: '7',
      clickAction: '/profile/points',
    },
    platform: 'sse',
    silent: true,
  });
});

test('a notice without id or store keeps empty strings, not "null"', () => {
  const notice = toPushNotice({ id: null, type: 'order_paid', store_id: null, title: 'T', body: 'B', click_action: '', silent: false });
  assert.equal(notice.data.notification_id, '');
  assert.equal(notice.data.store_id, '');
  assert.equal(notice.silent, false);
});
