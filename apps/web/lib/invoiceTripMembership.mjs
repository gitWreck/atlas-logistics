function text(value) {
  return String(value || "").trim();
}

function invoiceTripId(invoice = {}) {
  return text(
    invoice.tripId ||
      invoice.truckTripId ||
      invoice.shipmentSnapshot?.currentTripId,
  );
}

function invoiceBelongsToTrip(invoice, tripId) {
  if (!invoice) return false;

  const linkedTripId = invoiceTripId(invoice);
  return !linkedTripId || linkedTripId === text(tripId);
}

export { invoiceBelongsToTrip, invoiceTripId };
