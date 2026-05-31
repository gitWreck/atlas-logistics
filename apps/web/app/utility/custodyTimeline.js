export const EVENT_TITLES = {
  RECEIVED_AT_DIVISORIA: "Received at Divisoria",
  LOADED_TO_TRIP: "Loaded to trip",
  IN_TRANSIT: "In transit",
  ARRIVED_ODIONGAN: "Received at Odiongan",
  RELEASED_TO_CHECKER: "Released by warehouse manager",
  ASSIGNED_TO_CHECKER: "Assigned to checker",
  LOADED_TO_DELIVERY_VEHICLE: "Loaded to delivery vehicle",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED_DELIVERY: "Failed delivery",
  RETURNED_TO_WAREHOUSE: "Returned to warehouse",
  RECEIVED_RETURNED_SHIPMENT: "Received returned shipment",
  PARTIAL_LOAD: "Partial load",
  UNLOADED: "Unloaded",
};

export function formatEventType(eventType, fallbackStatus) {
  const key = String(eventType || fallbackStatus || "")
    .trim()
    .toUpperCase();
  if (EVENT_TITLES[key]) return EVENT_TITLES[key];
  return key
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatTimelineTimestamp(value) {
  if (!value) return { time: "—", date: "—" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { time: "—", date: "—" };
  return {
    time: date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    date: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  };
}
