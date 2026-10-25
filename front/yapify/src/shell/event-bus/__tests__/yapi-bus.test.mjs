import { test } from 'node:test';
import assert from 'node:assert/strict';

import { yapiBus } from '../yapi-bus.js';

/** Canal único por test — el bus es un singleton con caché por canal. */
let n = 0;
const channel = () => `test_channel_${++n}`;

test('on() entrega los emits posteriores', () => {
  const c = channel();
  const seen = [];
  yapiBus.on(c, (e) => seen.push(e.detail));
  yapiBus.emit(c, { a: 1 });
  assert.deepEqual(seen, [{ a: 1 }]);
});

test('on() REPLICA el último valor al que llega tarde', () => {
  const c = channel();
  yapiBus.emit(c, { snapshot: 'carrito' });
  const seen = [];
  yapiBus.on(c, (e) => seen.push(e.detail));
  assert.deepEqual(seen, [{ snapshot: 'carrito' }],
    'un feature montado después debe recibir el estado actual sin polling');
});

test('on() devuelve una función que desuscribe', () => {
  const c = channel();
  const seen = [];
  const off = yapiBus.on(c, (e) => seen.push(e.detail));
  yapiBus.emit(c, 1);
  off();
  yapiBus.emit(c, 2);
  assert.deepEqual(seen, [1]);
});

test('onRaw() NO replica el valor cacheado', () => {
  const c = channel();
  yapiBus.emit(c, { invalidar: true });
  const seen = [];
  yapiBus.onRaw(c, (e) => seen.push(e.detail));
  assert.deepEqual(seen, [],
    'si replicara, una señal de un solo uso se volvería a disparar en cada revive');
});

test('onRaw() sí entrega los emits posteriores', () => {
  const c = channel();
  const seen = [];
  yapiBus.onRaw(c, (e) => seen.push(e.detail));
  yapiBus.emit(c, 'x');
  assert.deepEqual(seen, ['x']);
});

test('seqOf() cuenta las emisiones y arranca en 0', () => {
  const c = channel();
  assert.equal(yapiBus.seqOf(c), 0);
  yapiBus.emit(c, 1);
  yapiBus.emit(c, 2);
  assert.equal(yapiBus.seqOf(c), 2, 'el wirer compara esta secuencia para entregar una señal una sola vez');
});

test('hasCached() y peek() reflejan el último valor', () => {
  const c = channel();
  assert.equal(yapiBus.hasCached(c), false);
  assert.equal(yapiBus.peek(c), undefined);
  yapiBus.emit(c, { v: 9 });
  assert.equal(yapiBus.hasCached(c), true);
  assert.deepEqual(yapiBus.peek(c), { v: 9 });
});

test('emit() sin detail cachea un objeto vacío, no undefined', () => {
  const c = channel();
  yapiBus.emit(c);
  assert.equal(yapiBus.hasCached(c), true);
  assert.deepEqual(yapiBus.peek(c), {});
});

test('once() se auto-desuscribe tras el primer evento', () => {
  const c = channel();
  const seen = [];
  yapiBus.once(c, (e) => seen.push(e.detail));
  yapiBus.emit(c, 1);
  yapiBus.emit(c, 2);
  assert.deepEqual(seen, [1]);
});

test('once() honra el valor cacheado y dispara al suscribirse', () => {
  const c = channel();
  yapiBus.emit(c, 'ya-estaba');
  const seen = [];
  yapiBus.once(c, (e) => seen.push(e.detail));
  assert.deepEqual(seen, ['ya-estaba']);
});

test('los canales están aislados entre sí', () => {
  const a = channel();
  const b = channel();
  const seen = [];
  yapiBus.on(a, (e) => seen.push(e.detail));
  yapiBus.emit(b, 'otro');
  assert.deepEqual(seen, []);
});
