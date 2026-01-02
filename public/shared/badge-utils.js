export function getStatusBadgeClass(status = "") {
  switch (status) {
    case "Received":
      return "received";

    case "Loaded":
    case "In Transit":
    case "Arrived at Port":
    case "Boarded RORO Vessel":
    case "Out for Delivery":
      return "in-transit";

    case "Delivered":
      return "delivered";

    default:
      return "received";
  }
}
