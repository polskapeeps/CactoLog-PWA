import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp, addDays, diffDays, sortBy, groupBy, uid, toISODate, monthMatrix } from '../js/utils.js';

test('clamp limits numbers', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
});

test('addDays and diffDays work with ISO dates', () => {
  const res = addDays('2024-01-10', 5);
  assert.equal(res, '2024-01-15');
  assert.equal(diffDays('2024-01-15', '2024-01-10'), 5);
});

test('sortBy sorts by key', () => {
  const arr = sortBy([{ n: 2 }, { n: 1 }], 'n');
  assert.deepEqual(arr.map(o => o.n), [1, 2]);
});

test('groupBy groups items', () => {
  const res = groupBy([{ a: 1 }, { a: 2 }, { a: 1 }], 'a');
  assert.deepEqual(Object.keys(res).sort(), ['1', '2']);
  assert.equal(res['1'].length, 2);
});

test('uid generates unique ids with prefix', () => {
  const a = uid('x_');
  const b = uid('x_');
  assert.ok(a.startsWith('x_'));
  assert.ok(b.startsWith('x_'));
  assert.notEqual(a, b);
});

test('toISODate formats dates', () => {
  assert.equal(toISODate('2024-03-05'), '2024-03-05');
});

test('monthMatrix returns 6 weeks of 7 days', () => {
  const m = monthMatrix(2024, 0);
  assert.equal(m.length, 6);
  assert.ok(m.every(week => week.length === 7));
});
