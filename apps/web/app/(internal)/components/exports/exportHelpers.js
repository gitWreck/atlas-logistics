const EMPTY_EXPORT_VALUE = "-";

const FILTER_DEFAULTS = {
  tripId: "ALL",
  startDate: "",
  endDate: "",
  status: "ALL",
  minAmount: "",
  maxAmount: "",
};

function parseExportDate(value) {
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

  if (!/\b\d{4}\b/.test(stringValue)) {
    const assumedYearDate = new Date(
      `${stringValue} ${new Date().getFullYear()}`,
    );
    if (!Number.isNaN(assumedYearDate.getTime())) return assumedYearDate;
  }

  const date = new Date(stringValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatExportDate(value, fallback = EMPTY_EXPORT_VALUE) {
  const date = parseExportDate(value);
  if (!date) return value || fallback;
  return date.toLocaleDateString();
}

function getShipmentQuantity(shipment = {}) {
  return Number(
    shipment?.totals?.totalContentQty ??
      shipment?.totalContentQty ??
      shipment?.totalItems ??
      0,
  );
}

function getShipmentDescription(shipment = {}) {
  const packageRows = Array.isArray(shipment?.packages)
    ? shipment.packages
    : [];
  const itemRows = Array.isArray(shipment?.items) ? shipment.items : [];
  const rows = packageRows.length > 0 ? packageRows : itemRows;

  if (!rows.length) return EMPTY_EXPORT_VALUE;

  return rows
    .map((item) => {
      const qty = Number(item.quantity) || 1;
      const desc = item.description || (packageRows.length ? "Package" : "Item");
      return qty > 1 ? `${desc} (${qty})` : desc;
    })
    .join(", ");
}

function getDestination(shipment = {}) {
  return (
    shipment?.recipient?.address?.city ||
    shipment?.destination ||
    EMPTY_EXPORT_VALUE
  );
}

function getShipmentDisplayId(record = {}) {
  return (
    record.shipmentTrackingNumber ||
    record.shipmentId ||
    record.trackingNumber ||
    record.id ||
    EMPTY_EXPORT_VALUE
  );
}

function getTripFilterLabel(filters, tripQuery = "") {
  if (filters.tripId === "ALL" && tripQuery.trim()) {
    return `Matching "${tripQuery.trim()}"`;
  }

  return filters.tripId === "ALL" ? "All Trips" : filters.tripId;
}

function getDateRangeLabel(filters) {
  if (!filters.startDate && !filters.endDate) return "All Dates";
  return `${filters.startDate || "Start"} to ${filters.endDate || "End"}`;
}

function getAmountRangeLabel(filters) {
  if (!filters.minAmount && !filters.maxAmount) return "All Amounts";
  return `${filters.minAmount || "0"} to ${filters.maxAmount || "No limit"}`;
}

export {
  EMPTY_EXPORT_VALUE,
  FILTER_DEFAULTS,
  parseExportDate,
  formatExportDate,
  getShipmentQuantity,
  getShipmentDescription,
  getDestination,
  getShipmentDisplayId,
  getTripFilterLabel,
  getDateRangeLabel,
  getAmountRangeLabel,
};
