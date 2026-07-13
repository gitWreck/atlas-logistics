export const BRANCHES = [
  {
    id: "odiongan",
    name: "Odiongan Branch",
    badge: "Main Branch",
    location: "Odiongan, Romblon",
    phone: "0906 840 3675",
    phoneUri: "09068403675",
    days: "Monday – Saturday",
    hours: "8:00 AM – 5:00 PM",
    coordinate: { latitude: 12.4106667, longitude: 121.9907778 },
    image: require("../../../assets/customer/branch-odiongan.png"),
  },
  {
    id: "divisoria",
    name: "Divisoria Branch",
    badge: null,
    location: "Divisoria, Manila",
    phone: "0953 226 5033",
    phoneUri: "09532265033",
    days: "Monday – Saturday",
    hours: "8:00 AM – 5:00 PM",
    coordinate: { latitude: 14.600025, longitude: 120.969801 },
    image: require("../../../assets/customer/branch-divisoria.png"),
  },
];

export const BOOKING_CONTACTS = [
  {
    id: "divisoria-warehouse",
    place: "Divisoria Warehouse",
    person: "Lean",
    phone: "0953 226 5033",
    phoneUri: "09532265033",
    icon: "home",
  },
  {
    id: "tablas-location",
    place: "Tablas Location",
    person: "Rose",
    phone: "0906 840 3675",
    phoneUri: "09068403675",
    icon: "map-pin",
  },
];

export const TRUCK_SCHEDULE = {
  departureTitle: "Departure",
  departurePlace: "Divisoria",
  departureDays: ["Tuesday", "Wednesday", "Thursday", "Saturday"],
  arrivalTitle: "Arrival in Tablas",
  arrivalDays: ["Thursday", "Friday", "Saturday", "Monday"],
};

export function getBranch(branchId) {
  return BRANCHES.find((branch) => branch.id === String(branchId || "")) || BRANCHES[0];
}
