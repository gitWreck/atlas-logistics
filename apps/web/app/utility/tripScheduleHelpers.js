export function normalizeDateValue(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getTimeValue(value) {
  const date = normalizeDateValue(value);
  return date ? date.getTime() : Number.POSITIVE_INFINITY;
}

export function getTripDeparture(trip) {
  return (
    trip?.plannedDeparture ||
    trip?.departure ||
    trip?.departureAt ||
    trip?.scheduledDeparture ||
    null
  );
}

export function getTripEta(trip) {
  return (
    trip?.estimatedArrival ||
    trip?.eta ||
    trip?.estimatedArrivalAt ||
    trip?.arrivalEstimate ||
    null
  );
}

export function getTripLoadingStart(trip) {
  return trip?.plannedLoadingStart || trip?.loadingStart || null;
}

export function getTripLoadingEnd(trip) {
  return trip?.plannedLoadingEnd || trip?.loadingEnd || null;
}

export function getTripRoute(trip) {
  const origin =
    trip?.origin || trip?.originName || trip?.pickupLocation || "—";
  const destination =
    trip?.destination || trip?.destinationName || trip?.dropoffLocation || "—";

  return `${origin} → ${destination}`;
}

export function getTripShipmentCount(trip) {
  return (
    trip?.totalShipments ||
    trip?.shipmentCount ||
    trip?.totalItems ||
    trip?.totalLoaded ||
    0
  );
}

export function getTripDisplayId(trip) {
  return trip?.tripId || trip?.id || "—";
}

export function getTripTruckLabel(trip) {
  return trip?.truckPlateNumber || trip?.plateNumber || "Unassigned Truck";
}

export function isTripActiveForSchedule(trip) {
  if (!trip) return false;
  if (!trip.truckId) return false;
  if (trip.active === false) return false;

  const status = String(trip.status || "").toUpperCase();
  if (status === "COMPLETED" || status === "CANCELLED") return false;

  return true;
}

export function sortTripsByDeparture(trips = []) {
  return [...trips].sort(
    (a, b) =>
      getTimeValue(getTripDeparture(a)) - getTimeValue(getTripDeparture(b)),
  );
}

export function groupTripsByTruck(trips = []) {
  const grouped = new Map();

  for (const trip of trips) {
    if (!trip?.truckId) continue;

    if (!grouped.has(trip.truckId)) {
      grouped.set(trip.truckId, []);
    }

    grouped.get(trip.truckId).push(trip);
  }

  for (const [truckId, truckTrips] of grouped.entries()) {
    grouped.set(truckId, sortTripsByDeparture(truckTrips));
  }

  return grouped;
}

export function getScheduleConflicts(trips = []) {
  const activeTrips = trips.filter(isTripActiveForSchedule);
  const grouped = groupTripsByTruck(activeTrips);
  const conflicts = [];

  for (const [, truckTrips] of grouped.entries()) {
    for (let i = 0; i < truckTrips.length - 1; i++) {
      const currentTrip = truckTrips[i];
      const nextTrip = truckTrips[i + 1];

      const currentEta = getTimeValue(getTripEta(currentTrip));
      const nextDeparture = getTimeValue(getTripDeparture(nextTrip));

      if (
        currentEta !== Number.POSITIVE_INFINITY &&
        nextDeparture !== Number.POSITIVE_INFINITY &&
        nextDeparture < currentEta
      ) {
        conflicts.push({
          truckId: currentTrip.truckId,
          truckLabel:
            currentTrip.truckPlateNumber ||
            nextTrip.truckPlateNumber ||
            currentTrip.truckId,
          currentTrip,
          nextTrip,
        });
      }
    }
  }

  return conflicts;
}

export function getUpcomingTrips(trips = [], limit = 5) {
  return sortTripsByDeparture(trips.filter(isTripActiveForSchedule)).slice(
    0,
    limit,
  );
}

export function getScheduleSummary(trips = []) {
  const activeTrips = sortTripsByDeparture(
    trips.filter(isTripActiveForSchedule),
  );
  const grouped = groupTripsByTruck(activeTrips);
  const conflicts = getScheduleConflicts(activeTrips);

  return {
    activeTrips,
    truckGroups: grouped,
    totalScheduledTrips: activeTrips.length,
    trucksWithUpcomingTrips: grouped.size,
    nextDepartureTrip: activeTrips[0] || null,
    totalConflicts: conflicts.length,
    conflicts,
    upcomingTrips: activeTrips.slice(0, 5),
  };
}

export function validateTripScheduleFields(schedule = {}) {
  const errors = {};

  const plannedDeparture = normalizeDateValue(schedule.plannedDeparture);
  const estimatedArrival = normalizeDateValue(schedule.estimatedArrival);
  const plannedLoadingStart = normalizeDateValue(schedule.plannedLoadingStart);
  const plannedLoadingEnd = normalizeDateValue(schedule.plannedLoadingEnd);

  if (!plannedDeparture) {
    errors.plannedDeparture = "Planned departure is required.";
  }

  if (!estimatedArrival) {
    errors.estimatedArrival = "Estimated arrival is required.";
  }

  if (
    plannedDeparture &&
    estimatedArrival &&
    estimatedArrival <= plannedDeparture
  ) {
    errors.estimatedArrival =
      "Estimated arrival must be later than planned departure.";
  }

  if (
    plannedLoadingStart &&
    plannedLoadingEnd &&
    plannedLoadingEnd < plannedLoadingStart
  ) {
    errors.plannedLoadingEnd =
      "Planned loading end must be later than loading start.";
  }

  return errors;
}
