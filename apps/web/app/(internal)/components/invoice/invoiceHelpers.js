import {
  getShipmentTripId,
  getShipmentTripIdsLabel,
} from "../shipments/shipmentHelpers";

const EMPTY_INVOICE_VALUE = "-";

const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PAID", "CANCELLED"];

function buildInvoiceRouteLabel(source = {}, fallback = EMPTY_INVOICE_VALUE) {
  const origin = source.origin || source.shipment?.origin || fallback;
  const destination =
    source.destination || source.shipment?.destination || fallback;

  return `${origin} -> ${destination}`;
}

function formatInvoiceContactAddress(contact = {}) {
  if (typeof contact === "string") return contact.trim();
  if (contact.formattedAddress) return contact.formattedAddress;

  const address = contact.address || contact.details || contact;
  if (typeof address === "string") return address.trim();

  return [
    address.unit,
    address.street,
    address.barangay,
    address.city,
    address.province,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
}

function resolveInvoiceContact(source = {}, type = "sender") {
  const nestedContact =
    source?.[type] && typeof source[type] === "object" ? source[type] : {};
  const legacyAddress =
    nestedContact.address ||
    nestedContact.details ||
    source?.[`${type}Address`] ||
    {};

  return {
    ...nestedContact,
    name:
      nestedContact.name ||
      source?.[`${type}Name`] ||
      (type === "sender" ? source?.customerName : "") ||
      "",
    phone:
      nestedContact.phone ||
      source?.[`${type}Phone`] ||
      (type === "sender" ? source?.customerPhoneNumber : "") ||
      "",
    address: legacyAddress,
    formattedAddress:
      nestedContact.formattedAddress ||
      (typeof source?.[`${type}Address`] === "string"
        ? source[`${type}Address`]
        : ""),
  };
}

function buildInitialForm(shipment, invoice, mode) {
  const sender = resolveInvoiceContact(shipment, "sender");
  const recipient = resolveInvoiceContact(shipment, "recipient");
  const senderName =
    sender.name ||
    (shipment?.id || shipment?.shipmentId ? "Unknown Sender" : "");

  if (mode === "edit" && invoice) {
    return {
      shipmentId:
        shipment?.shipmentId || invoice.shipmentId || shipment?.id || "",
      shipmentTrackingNumber:
        shipment?.shipmentId ||
        shipment?.id ||
        invoice.shipmentTrackingNumber ||
        "",
      invoiceNumber: invoice.invoiceNumber || "",
      invoiceDate: invoice.invoiceDate || "",
      dueDate: invoice.dueDate || "",
      billingName: invoice.billingName || senderName,
      billingAddress:
        invoice.billingAddress || formatInvoiceContactAddress(sender),
      senderName: invoice.senderName || senderName,
      senderPhone: invoice.senderPhone || sender.phone || "",
      recipientName: invoice.recipientName || recipient.name || "",
      recipientPhone:
        invoice.recipientPhone || recipient.phone || "",
      origin: invoice.origin || shipment?.origin || "",
      destination: invoice.destination || shipment?.destination || "",
      routeLabel:
        invoice.routeLabel ||
        buildInvoiceRouteLabel({
          origin: shipment?.origin || "Unknown",
          destination: shipment?.destination || "Unknown",
        }),
      shipmentStatus: invoice.shipmentStatus || shipment?.status || "",
      truckTripId:
        invoice.truckTripId || getShipmentTripId(shipment) || "",
      totalPackages: invoice.totalPackages || shipment?.packages?.length || 0,
      totalItems: invoice.totalItems || shipment?.totals?.totalItems || 0,
      amount: invoice.amount ?? 0,
      notes: invoice.notes || "",
      status: invoice.status || "DRAFT",
      correctionReason: "",
      shipmentSnapshot: invoice.shipmentSnapshot || shipment || null,
    };
  }

  return {
    shipmentId: shipment?.id || shipment?.shipmentId || "",
    shipmentTrackingNumber: shipment?.shipmentId || shipment?.id || "",
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    billingName: senderName,
    billingAddress: formatInvoiceContactAddress(sender),
    senderName,
    senderPhone: sender.phone || "",
    recipientName: recipient.name || "",
    recipientPhone: recipient.phone || "",
    origin: shipment?.origin || "",
    destination: shipment?.destination || "",
    routeLabel: buildInvoiceRouteLabel({
      origin: shipment?.origin || "Unknown",
      destination: shipment?.destination || "Unknown",
    }),
    shipmentStatus: shipment?.status || "",
    truckTripId: getShipmentTripId(shipment) || "",
    totalPackages: shipment?.packages?.length || 0,
    totalItems: shipment?.totals?.totalItems || 0,
    amount: 0,
    notes: "",
    status: "DRAFT",
    correctionReason: "",
    shipmentSnapshot: shipment || null,
  };
}

function formatAmount(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function parseInvoiceDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (value?.seconds || value?._seconds) {
    const seconds = value.seconds || value._seconds;
    const date = new Date(seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const stringValue = String(value).trim();
  if (!stringValue) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    const [year, month, day] = stringValue.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const hasYear = /\b\d{4}\b/.test(stringValue);
  const date = new Date(
    hasYear ? stringValue : `${stringValue} ${new Date().getFullYear()}`,
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatInvoiceDate(value, fallback = "") {
  const date = parseInvoiceDate(value);
  if (!date) return value || fallback;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatInvoiceExportDate(value, fallback = EMPTY_INVOICE_VALUE) {
  const date = parseInvoiceDate(value);
  if (!date) return value || fallback;
  return date.toLocaleDateString();
}

function getInvoiceShipmentDisplayId(invoice = {}) {
  return (
    invoice.shipmentTrackingNumber ||
    invoice.shipmentId ||
    invoice.trackingNumber ||
    invoice.id ||
    EMPTY_INVOICE_VALUE
  );
}

function getInvoiceTripId(invoice = {}) {
  return (
    invoice.tripId ||
    invoice.truckTripId ||
    getShipmentTripIdsLabel(invoice.shipment) ||
    getShipmentTripIdsLabel(invoice.shipmentSnapshot) ||
    invoice.currentTripId ||
    invoice.shipment?.currentTripId ||
    invoice.shipmentSnapshot?.currentTripId ||
    ""
  );
}

function getInvoiceDate(invoice = {}) {
  return parseInvoiceDate(invoice.invoiceDate || invoice.createdAt);
}

function getInvoiceRouteLabel(invoice = {}) {
  return invoice.routeLabel || buildInvoiceRouteLabel(invoice);
}

export {
  EMPTY_INVOICE_VALUE,
  INVOICE_STATUSES,
  buildInitialForm,
  buildInvoiceRouteLabel,
  formatInvoiceContactAddress,
  resolveInvoiceContact,
  formatAmount,
  parseInvoiceDate,
  formatInvoiceDate,
  formatInvoiceExportDate,
  getInvoiceShipmentDisplayId,
  getInvoiceTripId,
  getInvoiceDate,
  getInvoiceRouteLabel,
};
