function isActiveInvoice(shipment = {}) {
  return (
    String(shipment.invoiceStatus || "").toUpperCase() !== "CANCELLED" &&
    (shipment.hasInvoice === true || Boolean(shipment.invoiceId))
  );
}

function summarizeTripInvoices(shipments = []) {
  const countedInvoices = new Set();
  let count = 0;
  let totalAmount = 0;

  for (const shipment of shipments) {
    if (!isActiveInvoice(shipment)) continue;

    const invoiceKey = String(
      shipment.invoiceId ||
        shipment.invoiceNumber ||
        shipment.id ||
        shipment.shipmentId ||
        "",
    );
    if (invoiceKey && countedInvoices.has(invoiceKey)) continue;
    if (invoiceKey) countedInvoices.add(invoiceKey);
    count += 1;

    const amount = Number(shipment.invoiceAmount ?? 0);
    if (Number.isFinite(amount)) totalAmount += amount;
  }

  return {
    count,
    totalAmount,
  };
}

export { isActiveInvoice, summarizeTripInvoices };
