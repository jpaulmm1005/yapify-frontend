import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSseParser } from '../sse-parser.js';

const collect = () => {
  const events = [];
  return { events, parser: createSseParser((e) => events.push(e)) };
};

test('parses a complete event', () => {
  const { events, parser } = collect();
  parser.push('event: points.changed\ndata: {"store_id":7}\n\n');
  assert.deepEqual(events, [{ event: 'points.changed', data: '{"store_id":7}' }]);
});

test('joins an event split across chunks', () => {
  const { events, parser } = collect();
  parser.push('event: order.upd');
  parser.push('ated\ndata: {"order_id"');
  parser.push(':3}\n');
  assert.equal(events.length, 0);
  parser.push('\n');
  assert.deepEqual(events, [{ event: 'order.updated', data: '{"order_id":3}' }]);
});

test('joins multi-line data with newlines', () => {
  const { events, parser } = collect();
  parser.push('data: a\ndata: b\n\n');
  assert.deepEqual(events, [{ event: 'message', data: 'a\nb' }]);
});

test('ignores comments and id lines', () => {
  const { events, parser } = collect();
  parser.push(': keep-alive\nid: 4\nevent: ping\ndata: {}\n\n');
  assert.deepEqual(events, [{ event: 'ping', data: '{}' }]);
});

test('handles CRLF even when split between chunks', () => {
  const { events, parser } = collect();
  parser.push('event: hello\r');
  parser.push('\ndata: {}\r\n\r\n');
  assert.deepEqual(events, [{ event: 'hello', data: '{}' }]);
});

test('an empty line without data dispatches nothing', () => {
  const { events, parser } = collect();
  parser.push('event: lonely\n\n');
  assert.equal(events.length, 0);
});
