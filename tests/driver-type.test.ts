import { test } from "node:test";
import assert from "node:assert/strict";
import { isCommissionDriver, partnerLedger } from "../src/lib/driver-type.ts";

test("only driver_type 'partner' is a commission driver", () => {
  assert.equal(isCommissionDriver({ driver_type: "partner" }), true);
  assert.equal(isCommissionDriver({ driver_type: "company" }), false);
  assert.equal(isCommissionDriver({}), false);
});

test("partner ledger: commission on cash rides vs driver share of online rides", () => {
  const l = partnerLedger(
    [
      { final_fare: 1000, payment_method: "cash" },
      { estimated_fare: 400, payment_method: "driver_upi" },
      { final_fare: 600, payment_method: "upi" },
    ],
    [],
    15,
  );
  assert.equal(l.cashFare, 1400);
  assert.equal(l.onlineFare, 600);
  assert.equal(l.commissionOnCash, 210); // driver owes the company
  assert.equal(l.driverShareOnline, 510); // company owes the driver (600 - 90)
  assert.equal(l.balance, 210 - 510); // company owes ₹300 net
});

test("partner ledger: recorded payments in both directions settle the balance", () => {
  const l = partnerLedger(
    [{ final_fare: 1000, payment_method: "cash" }],
    [
      { amount: 100, direction: "driver_to_company" },
      { amount: 20 }, // old rows have no direction: driver paid the company
      { amount: 30, direction: "company_to_driver" },
    ],
    15,
  );
  assert.equal(l.balance, 150 - 120 + 30);
});
