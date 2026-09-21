function text(value) {
  return String(value ?? "").trim();
}

function packageIdFor(pkg = {}) {
  return text(pkg.packageId || pkg.trackingNumber);
}

function invoicePackageIds(invoice = {}) {
  const explicit = Array.isArray(invoice.packageIds) ? invoice.packageIds : [];
  const lineItems = Array.isArray(invoice.packageLineItems)
    ? invoice.packageLineItems.map(packageIdFor)
    : [];
  return [...new Set([...explicit, ...lineItems].map(text).filter(Boolean))];
}

function invoicePackagesForDisplay(invoice = {}, liveShipment = null) {
  const snapshotPackages = invoice?.shipmentSnapshot?.packages;
  const livePackages = Array.isArray(liveShipment?.packages)
    ? liveShipment.packages
    : [];
  const effectivePackageIds = inferredInvoicePackageIds(invoice, livePackages);

  if (effectivePackageIds.length > 0) {
    const packageIdSet = new Set(effectivePackageIds);
    const snapshotMatches = Array.isArray(snapshotPackages)
      ? snapshotPackages.filter((pkg) => packageIdSet.has(packageIdFor(pkg)))
      : [];
    if (snapshotMatches.length > 0) return snapshotMatches;

    const liveMatches = livePackages.filter((pkg) =>
      packageIdSet.has(packageIdFor(pkg)),
    );
    if (liveMatches.length > 0) return liveMatches;

    if (Array.isArray(invoice?.packageLineItems)) {
      return invoice.packageLineItems;
    }
  }

  if (Array.isArray(snapshotPackages)) return snapshotPackages;
  if (Array.isArray(invoice?.packageLineItems)) return invoice.packageLineItems;
  return livePackages;
}

function isActiveInvoice(invoice = {}) {
  return text(invoice.status || "DRAFT").toUpperCase() !== "CANCELLED";
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

export {
  invoicePackageIds,
  invoicePackagesForDisplay,
  inferredInvoicePackageIds,
  isActiveInvoice,
  invoiceTripId,
  packageBelongsToTrip,
  packageIdFor,
};
