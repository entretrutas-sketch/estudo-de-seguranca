import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDiscount, validateDiscounts } from '../lib/commercial-rules.ts';

test('accepts the authorized discount boundaries', () => {
  assert.equal(validateDiscounts(0, 0, { equipment: 40, monthly: 10 }), true);
  assert.equal(validateDiscounts(40, 10, { equipment: 40, monthly: 10 }), true);
  assert.equal(applyDiscount(2999, 40), 1799.4);
  assert.equal(applyDiscount(399, 10), 359.1);
});

test('rejects discounts beyond the commercial policy', () => {
  assert.equal(validateDiscounts(40.01, 0, { equipment: 40, monthly: 10 }), false);
  assert.equal(validateDiscounts(0, 10.01, { equipment: 40, monthly: 10 }), false);
  assert.equal(validateDiscounts(-1, 0, { equipment: 40, monthly: 10 }), false);
  assert.equal(validateDiscounts(Number.NaN, 0, { equipment: 40, monthly: 10 }), false);
});

test('refuses invalid monetary values', () => {
  assert.throws(() => applyDiscount(-1, 10), /Invalid commercial/);
  assert.throws(() => applyDiscount(100, 101), /Invalid commercial/);
});
