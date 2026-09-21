import test from "node:test";
import assert from "node:assert/strict";

import {
  invoicePackageIds,
  invoicePackagesForDisplay,
  inferredInvoicePackageIds,
  isActiveInvoice,
  packageBelongsToTrip,
} from "./packageInvoiceScope.mjs";

test("keeps invoice package scope separate across trips", () => {
  const packages = [
    { packageId: "PKG-1", loadedOnTrip: "TRIP-1" },
    { packageId: "PKG-2", loadedOnTrip: "TRIP-2" },
  ];
  assert.deepEqual(
    packages
      .filter((pkg) => packageBelongsToTrip(pkg, "TRIP-1"))
      .map((pkg) => pkg.packageId),
    ["PKG-1"],
  );
});

test("reads package ids from explicit ids or immutable line items", () => {
  assert.deepEqual(
    invoicePackageIds({
      packageIds: ["PKG-1"],
      packageLineItems: [{ packageId: "PKG-2" }],
    }),
    ["PKG-1", "PKG-2"],
  );
  assert.equal(isActiveInvoice({ status: "PAID" }), true);
  assert.equal(isActiveInvoice({ status: "CANCELLED" }), false);
});

test("invoice display never expands a scoped invoice to every live package", () => {
  const invoice = {
    shipmentSnapshot: { packages: [{ packageId: "PKG-1" }] },
    packageLineItems: [{ packageId: "PKG-1" }],
  };
  const liveShipment = {
    packages: [{ packageId: "PKG-1" }, { packageId: "PKG-2" }],
  };

  assert.deepEqual(invoicePackagesForDisplay(invoice, liveShipment), [
    { packageId: "PKG-1" },
  ]);
  assert.deepEqual(
    invoicePackagesForDisplay(
      { packageLineItems: [{ packageId: "PKG-2" }] },
      liveShipment,
    ),
    [{ packageId: "PKG-2" }],
  );
});

test("infers package ids from the recorded trip for a legacy invoice", () => {
  const packages = [
    { packageId: "PKG-1", loadedOnTrip: "TRIP-1" },
    { packageId: "PKG-2", loadedOnTrip: "TRIP-2" },
  ];
  assert.deepEqual(
    inferredInvoicePackageIds({ tripId: "TRIP-1" }, packages),
    ["PKG-1"],
  );
  assert.deepEqual(
    invoicePackagesForDisplay(
      { tripId: "TRIP-1", shipmentSnapshot: { packages } },
      { packages },
    ).map((pkg) => pkg.packageId),
    ["PKG-1"],
  );
});
