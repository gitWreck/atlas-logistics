"use strict";

const crypto = require("node:crypto");

function text(value) {
  return String(value ?? "").trim();
}

function packageIdFor(pkg = {}) {
  return text(pkg.packageId || pkg.trackingNumber);
}

function invoicePackageIds(invoice = {}) {
  const explicit = Array.isArray(invoice.packageIds) ? invoice.packageIds : [];
  const lineItems = Array.isArray(invoice.packageLineItems)
    ? invoice.packageLineItems.map((item) => packageIdFor(item))
    : [];

  return [...new Set([...explicit, ...lineItems].map(text).filter(Boolean))];
}

function isActiveInvoice(invoice = {}) {
  return text(invoice.status || "DRAFT").toUpperCase() !== "CANCELLED";
}

function isLegacyWholeShipmentInvoice(invoice = {}) {
  return isActiveInvoice(invoice) && invoicePackageIds(invoice).length === 0;
}

function invoiceTripId(invoice = {}) {
  return text(
    invoice.tripId ||
      invoice.truckTripId ||
      invoice.shipmentSnapshot?.currentTripId,
  );
}

function packageBelongsToTrip(pkg = {}, tripId = "", manifestPackageIds = []) {
  const trip = text(tripId);
  const packageId = packageIdFor(pkg);
  if (!trip || !packageId) return false;

  const packageTripIds = [
    pkg.loadedOnTrip,
    pkg.currentTripId,
    pkg.hubReceivedOnTrip,
  ]
    .map(text)
    .filter(Boolean);

  if (packageTripIds.includes(trip)) return true;
  if (packageTripIds.some((value) => value !== trip)) return false;

  return new Set(manifestPackageIds.map(text).filter(Boolean)).has(packageId);
}

function packageReservationId(shipmentId, packageId) {
  const scope = `${text(shipmentId)}:${text(packageId)}`;
  if (scope === ":") return "";
  return crypto.createHash("sha256").update(scope).digest("hex");
}

function inferredInvoicePackageIds(
  invoice = {},
  packages = [],
  manifestPackageIds = [],
) {
  const explicit = invoicePackageIds(invoice);
  if (explicit.length > 0) return explicit;

  const tripId = invoiceTripId(invoice);
  if (!tripId) return [];

  return packages
    .filter((pkg) => packageBelongsToTrip(pkg, tripId, manifestPackageIds))
    .map(packageIdFor)
    .filter(Boolean);
}

function packageLineItem(pkg = {}, tripId = "") {
  const packageId = packageIdFor(pkg);
  return {
    packageId,
    tripPackageAssignmentId: `${text(tripId)}:${packageId}`,
    description: text(pkg.description) || null,
    packagingType: text(pkg.packagingType || pkg.type) || null,
    quantity: Math.max(Number(pkg.quantity) || 1, 1),
    weight: Number(pkg.weight) || 0,
    tripId: text(tripId) || null,
  };
}

function applyInvoiceToPackages(
  packages = [],
  packageIds = [],
  { invoiceId, invoiceNumber, invoiceStatus, tripId } = {},
) {
  const selected = new Set(packageIds.map(text).filter(Boolean));
  return packages.map((pkg) => {
    const packageId = packageIdFor(pkg);
    if (!packageId || !selected.has(packageId)) return pkg;
    return {
      ...pkg,
      billingStatus: "INVOICED",
      invoiceId: text(invoiceId) || null,
      invoiceNumber: text(invoiceNumber) || text(invoiceId) || null,
      invoiceStatus: text(invoiceStatus || "DRAFT").toUpperCase(),
      invoicedTripId: text(tripId) || null,
    };
  });
}

function releaseInvoiceFromPackages(packages = [], invoiceId = "") {
  const target = text(invoiceId);
  return packages.map((pkg) => {
    if (!target || text(pkg.invoiceId || pkg.invoiceNumber) !== target) {
      return pkg;
    }

    const next = { ...pkg };
    delete next.invoiceId;
    delete next.invoiceNumber;
    delete next.invoiceStatus;
    delete next.invoicedTripId;
    next.billingStatus = "NOT_INVOICED";
    return next;
  });
}

function updatePackageInvoiceStatus(packages = [], packageIds = [], status = "") {
  const selected = new Set(packageIds.map(text).filter(Boolean));
  const nextStatus = text(status).toUpperCase();
  return packages.map((pkg) => {
    const packageId = packageIdFor(pkg);
    if (!packageId || !selected.has(packageId)) return pkg;
    return {
      ...pkg,
      billingStatus: nextStatus === "CANCELLED" ? "NOT_INVOICED" : "INVOICED",
      invoiceStatus: nextStatus || pkg.invoiceStatus || null,
    };
  });
}

function shipmentInvoicingSummary(packages = []) {
  const packageIds = packages.map(packageIdFor).filter(Boolean);
  const invoicedCount = packages.filter(
    (pkg) =>
      packageIdFor(pkg) &&
      text(pkg.billingStatus).toUpperCase() === "INVOICED" &&
      text(pkg.invoiceStatus).toUpperCase() !== "CANCELLED",
  ).length;
  const total = packageIds.length;

  return {
    invoicingStatus:
      invoicedCount === 0
        ? "NOT_INVOICED"
        : invoicedCount >= total
          ? "FULLY_INVOICED"
          : "PARTIALLY_INVOICED",
    invoicedPackageCount: invoicedCount,
    uninvoicedPackageCount: Math.max(total - invoicedCount, 0),
  };
}

module.exports = {
  applyInvoiceToPackages,
  inferredInvoicePackageIds,
  invoicePackageIds,
  invoiceTripId,
  isActiveInvoice,
  isLegacyWholeShipmentInvoice,
  packageBelongsToTrip,
  packageIdFor,
  packageLineItem,
  packageReservationId,
  releaseInvoiceFromPackages,
  shipmentInvoicingSummary,
  updatePackageInvoiceStatus,
};
