const COMPLETED_TRIP_STATUSES = new Set(["COMPLETED", "DELIVERED"]);

function buildInitialForm(trip = null) {
  return {
    tripId: trip?.tripId || trip?.id || "",
    tripType: trip?.tripType || "",
    truckId: trip?.truckId || "",
    truckPlateNumber: trip?.truckPlateNumber || "",
    route: trip?.route || "",
    origin: trip?.origin || "",
    destination: trip?.destination || "",
    status: trip?.status || "",

    plannedDeparture: trip?.plannedDeparture || "",
    estimatedArrival: trip?.estimatedArrival || "",

    plannedLoadingStart: trip?.plannedLoadingStart || "",
    plannedLoadingEnd: trip?.plannedLoadingEnd || "",

    actualLoadingStart: trip?.actualLoadingStart || "",
    actualLoadingEnd: trip?.actualLoadingEnd || "",
    actualDeparture: trip?.actualDeparture || "",
    actualArrival: trip?.actualArrival || "",
  };
}

function parseTripDate(value) {
  if (!value) return null;

  const date =
    typeof value.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function getDayLabel(dateValue) {
  const date = parseTripDate(dateValue);
  if (!date) return "-";

  return date.toLocaleDateString("en-PH", {
    weekday: "long",
  });
}

function formatScheduleDate(value) {
  const date = parseTripDate(value);
  if (!date) return "";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTripDisplayDate(value) {
  const date = parseTripDate(value);
  if (!date) return "-";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getTripStatus(trip) {
  return String(trip?.status || "").toUpperCase();
}

function isCompletedTrip(trip) {
  if (trip?.archived === true) return false;
  return COMPLETED_TRIP_STATUSES.has(getTripStatus(trip));
}

function isCancelledTrip(trip) {
  if (trip?.archived === true) return false;
  return getTripStatus(trip) === "CANCELLED";
}

function isArchivedTrip(trip) {
  return trip?.archived === true;
}

function getWarehouseOriginFilter(profile) {
  const warehouseCode = String(profile?.warehouseCode || "").toUpperCase();
  const warehouseName = String(profile?.warehouseName || "").toLowerCase();

  if (warehouseCode === "DIV" || warehouseName.includes("divisoria")) {
    return "DIV";
  }

  if (warehouseCode === "ODI" || warehouseName.includes("odiongan")) {
    return "ODI";
  }

  return "ALL";
}

function matchesOriginFilter(trip, originFilter) {
  if (originFilter === "ALL") return true;

  const originCode = String(trip?.originCode || "").toUpperCase();
  const origin = String(trip?.origin || trip?.originName || "").toLowerCase();
  const route = String(trip?.route || "").toLowerCase();

  if (originFilter === "DIV") {
    return (
      originCode === "DIV" ||
      origin.includes("divisoria") ||
      route.startsWith("divisoria")
    );
  }

  if (originFilter === "ODI") {
    return (
      originCode === "ODI" ||
      origin.includes("odiongan") ||
      route.startsWith("odiongan")
    );
  }

  return true;
}

function getPlannedLoadingStart(trip) {
  return trip?.plannedLoadingStart || null;
}

function getPlannedLoadingEnd(trip) {
  return trip?.plannedLoadingEnd || null;
}

export {
  buildInitialForm,
  getDayLabel,
  parseTripDate,
  formatScheduleDate,
  formatTripDisplayDate,
  getTripStatus,
  isCompletedTrip,
  isCancelledTrip,
  isArchivedTrip,
  getWarehouseOriginFilter,
  matchesOriginFilter,
  getPlannedLoadingStart,
  getPlannedLoadingEnd,
};
