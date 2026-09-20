import test from "node:test";
import assert from "node:assert/strict";

import {
  invoiceBelongsToTrip,
  invoiceTripId,
} from "./invoiceTripMembership.mjs";

test("uses the trip stored on the invoice before its shipment snapshot", () => {
  const invoice = {
    tripId: "trip-invoiced",
    shipmentSnapshot: { currentTripId: "trip-current" },
  };

  assert.equal(invoiceTripId(invoice), "trip-invoiced");
  assert.equal(invoiceBelongsToTrip(invoice, "trip-invoiced"), true);
  assert.equal(invoiceBelongsToTrip(invoice, "trip-current"), false);
});

test("falls back to the invoice shipment snapshot for legacy records", () => {
  const invoice = {
    shipmentSnapshot: { currentTripId: "trip-current" },
  };

  assert.equal(invoiceBelongsToTrip(invoice, "trip-current"), true);
  assert.equal(invoiceBelongsToTrip(invoice, "trip-other"), false);
});

test("keeps a legacy invoice visible when it has no trip metadata", () => {
  assert.equal(invoiceBelongsToTrip({ status: "PAID" }, "trip-current"), true);
  assert.equal(invoiceBelongsToTrip(null, "trip-current"), false);
});
