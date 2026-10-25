import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeenIds } from '../seen-ids.js';

test('remembers an id until it expires', () => {
  let now = 0;
  const seen = createSeenIds(1000, () => now);
  seen.add('55');
  assert.equal(seen.has('55'), true);
  now = 999;
  assert.equal(seen.has('55'), true);
  now = 1000;
  assert.equal(seen.has('55'), false);
});

test('unknown and empty ids are never seen', () => {
  const seen = createSeenIds(1000, () => 0);
  seen.add('');
  assert.equal(seen.has('1'), false);
  assert.equal(seen.has(''), false);
});
