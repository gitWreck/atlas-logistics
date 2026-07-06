// A "Truth Model" simulation
export const MOCK_SHIPMENTS = [
  {
    id: "TRK-998877",
    status: "IN_TRANSIT",
    origin: "Manila Warehouse",
    destination: "Cebu Hub",
    itemsTotal: 50,
    itemsLoaded: 50,
    itemsReceived: 50,
    delayReason: "WEATHER", 
    delayCleared: false,
    updatedAt: "2024-02-20T08:30:00Z",
    history: [
      {
        status: "ORDER_PLACED",
        location: "Manila",
        timestamp: "2024-02-18T09:00:00Z",
      },
      {
        status: "WAREHOUSE_RECEIVED",
        location: "Manila",
        timestamp: "2024-02-19T14:00:00Z",
      },
      {
        status: "LOADED",
        location: "Manila Port",
        timestamp: "2024-02-20T06:00:00Z",
      },
    ],
  },
  {
    id: "TRK-112233",
    status: "DELIVERED",
    origin: "Davao",
    destination: "Tagum",
    itemsTotal: 12,
    itemsLoaded: 12,
    itemsReceived: 12,
    delayReason: null,
    updatedAt: "2024-02-21T10:00:00Z",
    history: [
      {
        status: "DELIVERED",
        location: "Tagum",
        timestamp: "2024-02-21T10:00:00Z",
      },
    ],
  },
];

export const MOCK_TRIPS = [
  {
    id: "TRIP-2024-001",
    driverName: "Juan Dela Cruz",
    truck: "ISUZU-GIGA-123",
    route: "MNL-CEB",
    status: "EN_ROUTE",
    totalLoaded: 500,
    manifestLocked: true,
  },
];

// Helper to simulate a DB fetch
export async function getMockShipment(id) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));
  return MOCK_SHIPMENTS.find((s) => s.id === id) || null;
}
