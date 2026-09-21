import test from "node:test";
import assert from "node:assert/strict";

import { withTripInvoiceContext } from "./tripInvoiceContext.mjs";

test("uses the opened trip for invoicing without replacing the shipment's global trip pointer", () => {
  const shipment = {
    id: "SHIP-1",
    currentTripId: "TRIP-2",
    packages: [{ packageId: "PKG-1" }],
  };

  assert.deepEqual(withTripInvoiceContext(shipment, " TRIP-1 "), {
    ...shipment,
    selectedTripId: "TRIP-1",
  });
});

test("does not invent an invoice trip when the trip context is empty", () => {
  const shipment = { id: "SHIP-1", currentTripId: "TRIP-2" };

  assert.deepEqual(withTripInvoiceContext(shipment, ""), shipment);
});

test("keeps another trip's legacy invoice from blocking this trip's packages", () => {
  const packages = [
    { packageId: "PKG-1", hubReceivedOnTrip: "TRIP-1" },
    { packageId: "PKG-2", hubReceivedOnTrip: "TRIP-2" },
    { packageId: "PKG-3", hubReceivedOnTrip: "TRIP-2" },
  ];
  const legacyTripTwoInvoice = {
    id: "INV-2",
    invoiceNumber: "INV-2",
    tripId: "TRIP-2",
    status: "PAID",
    amount: 300,
  };

  const result = withTripInvoiceContext(
    { id: "SHIP-1", currentTripId: "TRIP-2", packages: [packages[0]] },
    "TRIP-1",
    {
      invoices: [legacyTripTwoInvoice],
      allPackages: packages,
      tripPackages: [packages[0]],
      manifestPackageIds: ["PKG-1"],
    },
  );

  assert.equal(result.selectedTripId, "TRIP-1");
  assert.equal(result.hasInvoice, false);
  assert.equal(result.invoiceId, null);
  assert.deepEqual(result.invoiceEligiblePackages, [packages[0]]);
});

test("selects the invoice belonging to each opened trip", () => {
  const packages = [
    { packageId: "PKG-1", loadedOnTrip: "TRIP-1" },
    { packageId: "PKG-2", loadedOnTrip: "TRIP-2" },
  ];
  const invoices = [
    {
      id: "INV-1",
      invoiceNumber: "INV-1",
      tripId: "TRIP-1",
      status: "ISSUED",
      amount: 100,
      packageIds: ["PKG-1"],
    },
    {
      id: "INV-2",
      invoiceNumber: "INV-2",
      tripId: "TRIP-2",
      status: "PAID",
      amount: 200,
      packageIds: ["PKG-2"],
    },
  ];

  const tripOne = withTripInvoiceContext(
    { id: "SHIP-1", currentTripId: "TRIP-2", packages: [packages[0]] },
    "TRIP-1",
    { invoices, allPackages: packages, tripPackages: [packages[0]] },
  );
  const tripTwo = withTripInvoiceContext(
    { id: "SHIP-1", currentTripId: "TRIP-2", packages: [packages[1]] },
    "TRIP-2",
    { invoices, allPackages: packages, tripPackages: [packages[1]] },
  );

  assert.equal(tripOne.invoiceId, "INV-1");
  assert.equal(tripOne.invoiceAmount, 100);
  assert.deepEqual(tripOne.invoiceEligiblePackages, []);
  assert.equal(tripTwo.invoiceId, "INV-2");
  assert.equal(tripTwo.invoiceAmount, 200);
  assert.deepEqual(tripTwo.invoiceEligiblePackages, []);
});
