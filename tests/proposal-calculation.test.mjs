import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateProposalTotals, discountLimitsExceeded, parseBrazilianAmount } from '../lib/proposal-calculation.ts';

test('parses Brazilian and decimal-pad amount formats', () => {
  assert.equal(parseBrazilianAmount('2.999,00'), 2999);
  assert.equal(parseBrazilianAmount('2999.00'), 2999);
  assert.equal(parseBrazilianAmount('R$ 3.999,50'), 3999.5);
  assert.equal(parseBrazilianAmount('abc'), null);
});

test('calculates consolidated equipment and monthly discounts', () => {
  assert.deepEqual(calculateProposalTotals(2999, 40, 399, 10), {
    equipmentDiscountAmount: 1199.6,
    equipmentFinal: 1799.4,
    monthlyDiscountAmount: 39.9,
    monthlyFinal: 359.1,
  });
});

test('uses the configured discount limits for visual feedback', () => {
  assert.equal(discountLimitsExceeded(40, 10, { equipment: 40, monthly: 10 }), false);
  assert.equal(discountLimitsExceeded(40.01, 10, { equipment: 40, monthly: 10 }), true);
});
