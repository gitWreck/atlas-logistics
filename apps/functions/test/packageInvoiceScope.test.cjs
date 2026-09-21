"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyInvoiceToPackages,
  inferredInvoicePackageIds,
  invoicePackageIds,
  isLegacyWholeShipmentInvoice,
  packageBelongsToTrip,
  packageReservationId,
  releaseInvoiceFromPackages,
  shipmentInvoicingSummary,
} = require("../src/invoices/packageInvoiceScope.cjs");

const packages = [
  { packageId: "PKG-1", loadedOnTrip: "TRIP-1", quantity: 2 },
  { packageId: "PKG-2", currentTripId: "TRIP-1", quantity: 1 },
  { packageId: "PKG-3", loadedOnTrip: "TRIP-2", quantity: 4 },
];

test("selects only packages loaded on the requested trip", () => {
  assert.deepEqual(
    packages
      .filter((pkg) => packageBelongsToTrip(pkg, "TRIP-1"))
      .map((pkg) => pkg.packageId),
    ["PKG-1", "PKG-2"],
  );
});

test("uses stable per-package reservations and invoice line identifiers", () => {
  assert.equal(
    packageReservationId("SHIP-1", "PKG-1"),
    packageReservationId("SHIP-1", "PKG-1"),
  );
  assert.notEqual(
    packageReservationId("SHIP-1", "PKG-1"),
    packageReservationId("SHIP-1", "PKG-2"),
  );
  assert.deepEqual(
    invoicePackageIds({
      packageLineItems: [{ packageId: "PKG-1" }, { packageId: "PKG-2" }],
    }),
    ["PKG-1", "PKG-2"],
  );
});

test("marks a shipment partially invoiced until every package is invoiced", () => {
  const partiallyInvoiced = applyInvoiceToPackages(packages, ["PKG-1", "PKG-2"], {
    invoiceId: "INV-1",
    invoiceStatus: "ISSUED",
    tripId: "TRIP-1",
  });

  assert.deepEqual(shipmentInvoicingSummary(partiallyInvoiced), {
    invoicingStatus: "PARTIALLY_INVOICED",
    invoicedPackageCount: 2,
    uninvoicedPackageCount: 1,
  });

  const fullyInvoiced = applyInvoiceToPackages(partiallyInvoiced, ["PKG-3"], {
    invoiceId: "INV-2",
    invoiceStatus: "DRAFT",
    tripId: "TRIP-2",
  });
  assert.equal(shipmentInvoicingSummary(fullyInvoiced).invoicingStatus, "FULLY_INVOICED");
});

test("cancelling an invoice releases only its packages", () => {
  const withFirstInvoice = applyInvoiceToPackages(packages, ["PKG-1", "PKG-2"], {
    invoiceId: "INV-1",
    invoiceStatus: "ISSUED",
    tripId: "TRIP-1",
  });
  const withBothInvoices = applyInvoiceToPackages(withFirstInvoice, ["PKG-3"], {
    invoiceId: "INV-2",
    invoiceStatus: "PAID",
    tripId: "TRIP-2",
  });
  const released = releaseInvoiceFromPackages(withBothInvoices, "INV-1");

  assert.equal(released[0].billingStatus, "NOT_INVOICED");
  assert.equal(released[1].billingStatus, "NOT_INVOICED");
  assert.equal(released[2].invoiceId, "INV-2");
  assert.equal(shipmentInvoicingSummary(released).invoicingStatus, "PARTIALLY_INVOICED");
});

test("legacy invoices without package references remain whole-shipment invoices", () => {
  assert.equal(isLegacyWholeShipmentInvoice({ status: "PAID" }), true);
  assert.equal(
    isLegacyWholeShipmentInvoice({ status: "ISSUED", packageIds: ["PKG-1"] }),
    false,
  );
  assert.equal(isLegacyWholeShipmentInvoice({ status: "CANCELLED" }), false);
});

test("infers package scope for a legacy invoice that recorded its trip", () => {
  const packages = [
    { packageId: "PKG-1", loadedOnTrip: "TRIP-1" },
    { packageId: "PKG-2", loadedOnTrip: "TRIP-2" },
  ];

  assert.deepEqual(
    inferredInvoicePackageIds({ tripId: "TRIP-1" }, packages),
    ["PKG-1"],
  );
  assert.deepEqual(inferredInvoicePackageIds({}, packages), []);
});
