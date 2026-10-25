import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageRange, buildPersonProps } from './person-properties.js';

test('ageRange returns null for missing or invalid birth_date', () => {
  assert.equal(ageRange(null), null);
  assert.equal(ageRange(undefined), null);
  assert.equal(ageRange(''), null);
  assert.equal(ageRange('not-a-date'), null);
});

test('ageRange buckets: < 18', () => {
  const today = new Date();
  const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate()).toISOString();
  assert.equal(ageRange(tenYearsAgo), '< 18');
});

test('ageRange buckets: 18-24', () => {
  const today = new Date();
  const twentyAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate()).toISOString();
  assert.equal(ageRange(twentyAgo), '18-24');
});

test('ageRange buckets: 25-34', () => {
  const today = new Date();
  const thirtyAgo = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate()).toISOString();
  assert.equal(ageRange(thirtyAgo), '25-34');
});

test('ageRange buckets: 35-44', () => {
  const today = new Date();
  const fortyAgo = new Date(today.getFullYear() - 40, today.getMonth(), today.getDate()).toISOString();
  assert.equal(ageRange(fortyAgo), '35-44');
});

test('ageRange buckets: 45-54', () => {
  const today = new Date();
  const fiftyAgo = new Date(today.getFullYear() - 50, today.getMonth(), today.getDate()).toISOString();
  assert.equal(ageRange(fiftyAgo), '45-54');
});

test('ageRange buckets: 55-64', () => {
  const today = new Date();
  const sixtyAgo = new Date(today.getFullYear() - 60, today.getMonth(), today.getDate()).toISOString();
  assert.equal(ageRange(sixtyAgo), '55-64');
});

test('ageRange buckets: 65+', () => {
  const today = new Date();
  const seventyAgo = new Date(today.getFullYear() - 70, today.getMonth(), today.getDate()).toISOString();
  assert.equal(ageRange(seventyAgo), '65+');
});

test('buildPersonProps returns empty when dbUser is null/undefined', () => {
  assert.deepEqual(buildPersonProps(null), {});
  assert.deepEqual(buildPersonProps(undefined), {});
});

test('buildPersonProps maps all known fields, omits undefined/null', () => {
  const today = new Date();
  const birth = new Date(today.getFullYear() - 30, 0, 1).toISOString();
  const dbUser = {
    uid: 'u-1',
    email: 'x@y.com',
    name: 'Jean',
    gender: 'male',
    birth_date: birth,
    city: 'Arequipa',
    district: 'Cercado',
    country: 'PE',
    role: 'USER',
    created_at: '2026-03-15T14:22:31.000Z',
    provider_id: 'google.com',
    is_active: true,
    user_preferences: [
      { category: { name: 'Cafeterias' } },
      { category: { name: 'Libros' } },
    ],
  };
  const props = buildPersonProps(dbUser);
  assert.equal(props.email, 'x@y.com');
  assert.equal(props.name, 'Jean');
  assert.equal(props.gender, 'male');
  assert.equal(props.age_range, '25-34');
  assert.equal(props.city, 'Arequipa');
  assert.equal(props.district, 'Cercado');
  assert.equal(props.country, 'PE');
  assert.equal(props.role, 'USER');
  assert.equal(props.signup_at, '2026-03-15T14:22:31.000Z');
  assert.equal(props.provider_id, 'google.com');
  assert.equal(props.is_active, true);
  assert.deepEqual(props.preferred_categories, ['cafeterias', 'libros']);
});

test('buildPersonProps omits keys when source field is missing', () => {
  const dbUser = { uid: 'u-2', email: 'a@b.com' };
  const props = buildPersonProps(dbUser);
  assert.equal(props.email, 'a@b.com');
  assert.equal('age_range' in props, false);
  assert.equal('gender' in props, false);
  assert.equal('preferred_categories' in props, false);
});

test('buildPersonProps with preferred_categories as flat array of strings', () => {
  const dbUser = {
    uid: 'u-3',
    preferred_categories: ['Cafeterias', 'Libros'],
  };
  const props = buildPersonProps(dbUser);
  assert.deepEqual(props.preferred_categories, ['cafeterias', 'libros']);
});

test('buildPersonProps with preferences array of {id, name} (actual backend shape)', () => {
  const dbUser = {
    uid: 'u-4',
    preferences: [
      { id: 3, name: 'Cafeterias' },
      { id: 7, name: 'Libros' },
    ],
  };
  const props = buildPersonProps(dbUser);
  assert.deepEqual(props.preferred_categories, ['cafeterias', 'libros']);
});
