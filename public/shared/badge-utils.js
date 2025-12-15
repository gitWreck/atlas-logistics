export function getStatusBadgeClass(status = "") {
  const s = status.toLowerCase();

  if (s.includes("received")) return "received";
  if (s.includes("loaded") || s.includes("transit")) return "in-transit";
  if (s.includes("delayed") || s.includes("weather")) return "delayed";
  if (s.includes("delivered")) return "delivered";

  return "received";
}
