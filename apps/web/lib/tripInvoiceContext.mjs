import { invoiceBelongsToTrip } from "./invoiceTripMembership.mjs";
import {
  inferredInvoicePackageIds,
  invoicePackageIds,
  invoiceTripId,
  isActiveInvoice,
} from "./packageInvoiceScope.mjs";

function packageIdFor(pkg = {}) {
  return String(pkg.packageId || pkg.trackingNumber || "").trim();
}

export function withTripInvoiceContext(
  shipment = {},
  tripId = "",
  { invoices, allPackages, tripPackages, manifestPackageIds = [] } = {},
) {
  const selectedTripId = String(tripId || "").trim();
  if (!selectedTripId) return shipment;

  const scopedShipment = {
    ...shipment,
    selectedTripId,
  };

  if (!Array.isArray(invoices)) return scopedShipment;

  const shipmentPackages = Array.isArray(allPackages)
    ? allPackages
    : Array.isArray(shipment.packages)
      ? shipment.packages
      : [];
  const scopedPackages = Array.isArray(tripPackages)
    ? tripPackages
    : shipmentPackages;
  const activeInvoices = invoices.filter(isActiveInvoice);
  const tripInvoices = activeInvoices.filter((invoice) =>
    invoiceBelongsToTrip(invoice, selectedTripId),
  );
  const selectedInvoice = tripInvoices[0] || null;
  const effectivePackageIds = (invoice) =>
    inferredInvoicePackageIds(
      invoice,
      shipmentPackages,
      invoiceTripId(invoice) === selectedTripId ? manifestPackageIds : [],
    );
  const invoicedPackageIds = new Set(
    activeInvoices.flatMap(effectivePackageIds),
  );
  const hasUnscopedLegacyInvoice = activeInvoices.some(
    (invoice) =>
      invoicePackageIds(invoice).length === 0 &&
      effectivePackageIds(invoice).length === 0,
  );
  const invoiceEligiblePackages = hasUnscopedLegacyInvoice
    ? []
    : scopedPackages.filter(
        (pkg) => !invoicedPackageIds.has(packageIdFor(pkg)),
      );
  const invoiceAmount = Number(selectedInvoice?.amount || 0);

  return {
    ...scopedShipment,
    hasInvoice: Boolean(selectedInvoice),
    invoiceId: selectedInvoice?.id || null,
    invoiceNumber: selectedInvoice?.invoiceNumber || null,
    invoiceStatus: selectedInvoice?.status || null,
    invoiceAmount: Number.isFinite(invoiceAmount) ? invoiceAmount : 0,
    tripInvoices,
    invoiceEligiblePackages,
    hasUninvoicedPackages: invoiceEligiblePackages.length > 0,
  };
}
