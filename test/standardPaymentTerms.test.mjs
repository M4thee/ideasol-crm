import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateStandardPaymentAmounts,
  STANDARD_DEPOSIT_PERCENT,
} from "../lib/standardPaymentTerms.ts";

test("standardowa zaliczka wynosi 50% kwoty brutto", () => {
  assert.equal(STANDARD_DEPOSIT_PERCENT, 50);
  assert.deepEqual(calculateStandardPaymentAmounts(100_000), {
    depositGross: 50_000,
    finalPaymentGross: 50_000,
  });
});

test("zaliczka jest liczona do grosza, a płatności sumują się do kwoty brutto", () => {
  const result = calculateStandardPaymentAmounts(39_999.99);

  assert.deepEqual(result, {
    depositGross: 20_000,
    finalPaymentGross: 19_999.99,
  });
  assert.equal(
    Math.round(result.depositGross * 100) +
      Math.round(result.finalPaymentGross * 100),
    Math.round(39_999.99 * 100)
  );
});

test("brak prawidłowej kwoty brutto nie tworzy zaliczki", () => {
  assert.deepEqual(calculateStandardPaymentAmounts(null), {
    depositGross: 0,
    finalPaymentGross: 0,
  });
  assert.deepEqual(calculateStandardPaymentAmounts(-1), {
    depositGross: 0,
    finalPaymentGross: 0,
  });
});
