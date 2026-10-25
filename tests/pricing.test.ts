import { test } from "node:test";
import assert from "node:assert/strict";
import { calcFare, normalizePricing, DEFAULT_PRICING, surgeOf } from "../src/lib/fare.ts";

// Same cases as the rider app's tests/pricing.test.ts and the database fn_fare_quote test.
const SIGNATURE = { base_fare: 99, per_km: 18, minimum_fare: 149 };
const SEDAN = { base_fare: 59, per_km: 15, minimum_fare: 129 };
const CASES: Array<[string, typeof SIGNATURE, number, Partial<typeof DEFAULT_PRICING>, number]> = [
  [
    "surge + tax + platform fee",
    SIGNATURE,
    40,
    { tax_percent: 5, platform_fee: 20, surge_enabled: true, surge_multiplier: 1.5 },
    1310,
  ],
  ["minimum fare + tax", SIGNATURE, 2, { tax_percent: 5, platform_fee: 0 }, 156],
  ["no tax, no fee", SEDAN, 10, { tax_percent: 0, platform_fee: 0 }, 209],
  [
    "surge configured but switched off",
    SEDAN,
    10,
    { tax_percent: 0, platform_fee: 0, surge_enabled: false, surge_multiplier: 2 },
    209,
  ],
];

for (const [name, v, km, s, total] of CASES) {
  test(`fare matches the server formula: ${name}`, () => {
    assert.equal(calcFare(v, km, s).total, total);
  });
}

test("settings rows from the database are normalised safely", () => {
  const s = normalizePricing({ tax_percent: "5.0", surge_enabled: true, surge_multiplier: "1.2" });
  assert.equal(s.tax_percent, 5);
  assert.equal(s.platform_fee, DEFAULT_PRICING.platform_fee);
  assert.equal(surgeOf(s), 1.2);
  assert.equal(surgeOf({ surge_enabled: false, surge_multiplier: 3 }), 1);
});
