import admin from "firebase-admin";

process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "atlas-tracking",
  });
}

const auth = admin.auth();
const db = admin.firestore();

const USERS_DATA = [
  {
    email: "admin@atlas.local",
    password: "Password123!",
    displayName: "Admin Operator",
    role: "admin",
    warehouseCode: "MNL",
    warehouseId: "WH-MNL",
    warehouseName: "Manila Main Hub",
  },
  {
    email: "manager@atlas.local",
    password: "Password123!",
    displayName: "Manager Marcus",
    role: "manager",
    warehouseCode: "MNL",
    warehouseId: "WH-MNL",
    warehouseName: "Manila Main Hub",
  },
  {
    email: "checker@atlas.local",
    password: "Password123!",
    displayName: "Checker Officer",
    role: "checker",
    warehouseCode: "MNL",
    warehouseId: "WH-MNL",
    warehouseName: "Manila Main Hub",
  },
  {
    email: "driver@atlas.local",
    password: "Password123!",
    displayName: "Driver Juan",
    role: "driver",
    warehouseCode: "MNL",
    warehouseId: "WH-MNL",
    warehouseName: "Manila Main Hub",
    licenseNumber: "N01-12-345678",
    truckPlate: "NCR-1234",
  },
  {
    email: "customer@atlas.local",
    password: "Password123!",
    displayName: "Customer Atlas",
    role: "customer",
    phoneNumber: "+639171234567",
    address: {
      street: "123 Ayala Avenue",
      barangay: "Bel-Air",
      city: "Makati",
      province: "Metro Manila",
      unit: "Suite 405",
    },
  },
  {
    email: "maria.santos@gmail.com",
    password: "Password123!",
    displayName: "Maria Santos",
    role: "customer",
    phoneNumber: "+639189876543",
    address: {
      street: "45 Osmeña Boulevard",
      barangay: "Capitol Site",
      city: "Cebu City",
      province: "Cebu",
      unit: "Unit 2B",
    },
  },
];

async function seed() {
  console.log("Seeding comprehensive dummy data into local Firebase Emulators...\n");

  const userMap = {};

  // 1. Seed Users (Auth + Firestore)
  for (const u of USERS_DATA) {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(u.email);
    } catch {
      userRecord = await auth.createUser({
        email: u.email,
        password: u.password,
        displayName: u.displayName,
      });
    }

    await auth.setCustomUserClaims(userRecord.uid, { role: u.role });

    const userProfile = {
      uid: userRecord.uid,
      email: u.email,
      name: u.displayName,
      displayName: u.displayName,
      role: u.role,
      status: "active",
      active: true,
      employmentStatus: "active",
      provider: "password",
      publicId: `${u.role.toUpperCase()}-${Date.now().toString().slice(-4)}`,
      phoneNumber: u.phoneNumber || "+639170000000",
      warehouseCode: u.warehouseCode || null,
      warehouseId: u.warehouseId || null,
      warehouseName: u.warehouseName || null,
      address: u.address || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("users").doc(userRecord.uid).set(userProfile, { merge: true });
    userMap[u.email] = { ...u, uid: userRecord.uid };
    console.log(`✓ User [${u.role.toUpperCase()}]: ${u.email}`);
  }

  // 2. Warehouses
  const warehouses = [
    { id: "WH-MNL", code: "MNL", name: "Manila Main Hub", city: "Manila", address: "North Harbor, Port Area, Manila", active: true },
    { id: "WH-CEB", code: "CEB", name: "Cebu Distribution Hub", city: "Cebu City", address: "North Reclamation Area, Cebu City", active: true },
    { id: "WH-DVO", code: "DVO", name: "Davao Regional Center", city: "Davao City", address: "Sasa Wharf, Davao City", active: true },
  ];

  for (const wh of warehouses) {
    await db.collection("warehouses").doc(wh.id).set(wh, { merge: true });
  }
  console.log(`✓ Warehouses seeded (${warehouses.length})`);

  // 3. Trucks
  const trucks = [
    {
      id: "TRK-001",
      plateNumber: "NCR-1234",
      model: "Isuzu Giga 10-Wheeler Wingvan",
      capacity: "15,000 kg",
      capacityKg: 15000,
      status: "available",
      currentOdometer: 42350,
      lastPmsOdometer: 40000,
      registrationExpiry: "2027-08-31",
      assignedWarehouse: "WH-MNL",
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: "TRK-002",
      plateNumber: "CEB-5678",
      model: "Hino 500 Heavy Truck",
      capacity: "12,000 kg",
      capacityKg: 12000,
      status: "in_use",
      currentOdometer: 68120,
      lastPmsOdometer: 65000,
      registrationExpiry: "2027-05-15",
      assignedWarehouse: "WH-CEB",
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: "TRK-003",
      plateNumber: "DVO-9012",
      model: "Fuso Fighter 6-Wheeler",
      capacity: "8,000 kg",
      capacityKg: 8000,
      status: "maintenance",
      currentOdometer: 99400,
      lastPmsOdometer: 95000,
      registrationExpiry: "2026-12-31",
      assignedWarehouse: "WH-DVO",
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  ];

  for (const t of trucks) {
    await db.collection("trucks").doc(t.id).set(t, { merge: true });
  }
  console.log(`✓ Trucks seeded (${trucks.length})`);

  // 4. Shipments
  const shipments = [
    {
      id: "SHIP-MNL-1001",
      shipmentId: "SHIP-MNL-1001",
      trackingNumber: "ATL-10001",
      status: "PENDING",
      originWarehouse: "WH-MNL",
      destinationWarehouse: "WH-CEB",
      origin: "Manila Main Hub",
      destination: "Cebu Distribution Hub",
      sender: {
        uid: userMap["customer@atlas.local"].uid,
        name: "Customer Atlas",
        phone: "+639171234567",
      },
      recipient: {
        uid: userMap["maria.santos@gmail.com"].uid,
        name: "Maria Santos",
        phone: "+639189876543",
        address: "45 Osmeña Blvd, Cebu City",
      },
      currentTripId: "TRIP-001",
      totalPackages: 3,
      totalPieces: 3,
      loadedPieces: 0,
      receivedPieces: 0,
      declaredValue: 25000,
      serviceType: "Door-to-Door",
      packages: [
        {
          id: "PKG-001",
          packageId: "PKG-001",
          trackingNumber: "ATL-10001-1",
          barcode: "ATL-10001-1",
          description: "Smartphones & Tablets (Box 1)",
          quantity: 1,
          pendingQuantity: 1,
          loadedQuantity: 0,
          receivedQuantity: 0,
          missingQuantity: 0,
          damagedQuantity: 0,
          status: "PENDING",
          weightKg: 4.5,
        },
        {
          id: "PKG-002",
          packageId: "PKG-002",
          trackingNumber: "ATL-10001-2",
          barcode: "ATL-10001-2",
          description: "Industrial Spares (Box 2)",
          quantity: 1,
          pendingQuantity: 1,
          loadedQuantity: 0,
          receivedQuantity: 0,
          missingQuantity: 0,
          damagedQuantity: 0,
          status: "PENDING",
          weightKg: 12.0,
        },
        {
          id: "PKG-003",
          packageId: "PKG-003",
          trackingNumber: "ATL-10001-3",
          barcode: "ATL-10001-3",
          description: "Confidential Contract Files (Box 3)",
          quantity: 1,
          pendingQuantity: 1,
          loadedQuantity: 0,
          receivedQuantity: 0,
          missingQuantity: 0,
          damagedQuantity: 0,
          status: "PENDING",
          weightKg: 1.2,
        },
      ],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: "SHIP-MNL-1002",
      shipmentId: "SHIP-MNL-1002",
      trackingNumber: "ATL-10002",
      status: "LOADED",
      originWarehouse: "WH-MNL",
      destinationWarehouse: "WH-DVO",
      origin: "Manila Main Hub",
      destination: "Davao Regional Center",
      sender: {
        uid: userMap["customer@atlas.local"].uid,
        name: "Customer Atlas",
        phone: "+639171234567",
      },
      recipient: {
        name: "Davao Agro Tech",
        phone: "+639191122334",
        address: "Lanang, Davao City",
      },
      currentTripId: "TRIP-002",
      totalPackages: 2,
      totalPieces: 2,
      loadedPieces: 2,
      receivedPieces: 0,
      declaredValue: 45000,
      serviceType: "Freight",
      packages: [
        {
          id: "PKG-004",
          packageId: "PKG-004",
          trackingNumber: "ATL-10002-1",
          barcode: "ATL-10002-1",
          description: "Irrigation Controller Units",
          quantity: 1,
          pendingQuantity: 0,
          loadedQuantity: 1,
          receivedQuantity: 0,
          status: "LOADED",
          weightKg: 18.0,
        },
        {
          id: "PKG-005",
          packageId: "PKG-005",
          trackingNumber: "ATL-10002-2",
          barcode: "ATL-10002-2",
          description: "Water Pumps Hardware",
          quantity: 1,
          pendingQuantity: 0,
          loadedQuantity: 1,
          receivedQuantity: 0,
          status: "LOADED",
          weightKg: 35.0,
        },
      ],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: "SHIP-MNL-1003",
      shipmentId: "SHIP-MNL-1003",
      trackingNumber: "ATL-10003",
      status: "ARRIVED",
      originWarehouse: "WH-MNL",
      destinationWarehouse: "WH-CEB",
      origin: "Manila Main Hub",
      destination: "Cebu Distribution Hub",
      sender: {
        name: "Manila Garments Co.",
        phone: "+639175556677",
      },
      recipient: {
        uid: userMap["maria.santos@gmail.com"].uid,
        name: "Maria Santos",
        phone: "+639189876543",
        address: "45 Osmeña Blvd, Cebu City",
      },
      currentTripId: "TRIP-004",
      totalPackages: 2,
      totalPieces: 2,
      loadedPieces: 2,
      receivedPieces: 0,
      declaredValue: 18000,
      serviceType: "Express Cargo",
      packages: [
        {
          id: "PKG-006",
          packageId: "PKG-006",
          trackingNumber: "ATL-10003-1",
          barcode: "ATL-10003-1",
          description: "Summer Apparel Batch 1",
          quantity: 1,
          pendingQuantity: 0,
          loadedQuantity: 1,
          receivedQuantity: 0,
          status: "LOADED",
          weightKg: 8.5,
        },
        {
          id: "PKG-007",
          packageId: "PKG-007",
          trackingNumber: "ATL-10003-2",
          barcode: "ATL-10003-2",
          description: "Summer Apparel Batch 2",
          quantity: 1,
          pendingQuantity: 0,
          loadedQuantity: 1,
          receivedQuantity: 0,
          status: "LOADED",
          weightKg: 9.0,
        },
      ],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  ];

  for (const s of shipments) {
    await db.collection("shipments").doc(s.id).set(s, { merge: true });
    // Also seed subcollection packages
    for (const pkg of s.packages) {
      await db.collection("shipments").doc(s.id).collection("packages").doc(pkg.id).set(pkg, { merge: true });
    }
  }
  console.log(`✓ Shipments seeded (${shipments.length}) with subcollection packages`);

  // 5. Truck Trips (truck_trips and trips collections)
  const trips = [
    {
      id: "TRIP-001",
      tripId: "TRIP-001",
      tripNumber: "TRIP-2026-001",
      status: "CREATED",
      manifestLocked: false,
      origin: "Manila Main Hub",
      destination: "Cebu Distribution Hub",
      originWarehouse: "WH-MNL",
      destinationWarehouse: "WH-CEB",
      driverId: userMap["driver@atlas.local"].uid,
      driverName: "Driver Juan",
      truckPlate: "NCR-1234",
      truckModel: "Isuzu Giga 10-Wheeler Wingvan",
      totalShipments: 1,
      loadedCount: 0,
      shipmentIds: ["SHIP-MNL-1001"],
      active: true,
      departureTime: "2026-10-26T08:00:00Z",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: "TRIP-002",
      tripId: "TRIP-002",
      tripNumber: "TRIP-2026-002",
      status: "LOADED",
      manifestLocked: true,
      origin: "Manila Main Hub",
      destination: "Davao Regional Center",
      originWarehouse: "WH-MNL",
      destinationWarehouse: "WH-DVO",
      driverId: userMap["driver@atlas.local"].uid,
      driverName: "Driver Juan",
      truckPlate: "CEB-5678",
      truckModel: "Hino 500 Heavy Truck",
      totalShipments: 1,
      loadedCount: 1,
      shipmentIds: ["SHIP-MNL-1002"],
      active: true,
      departureTime: "2026-10-26T14:00:00Z",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: "TRIP-003",
      tripId: "TRIP-003",
      tripNumber: "TRIP-2026-003",
      status: "IN_TRANSIT",
      manifestLocked: true,
      origin: "Cebu Distribution Hub",
      destination: "Davao Regional Center",
      originWarehouse: "WH-CEB",
      destinationWarehouse: "WH-DVO",
      driverId: userMap["driver@atlas.local"].uid,
      driverName: "Driver Juan",
      truckPlate: "DVO-9012",
      truckModel: "Fuso Fighter 6-Wheeler",
      totalShipments: 0,
      loadedCount: 0,
      active: true,
      departureTime: "2026-10-25T06:00:00Z",
      estimatedArrival: "2026-10-26T18:00:00Z",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: "TRIP-004",
      tripId: "TRIP-004",
      tripNumber: "TRIP-2026-004",
      status: "ARRIVED",
      manifestLocked: false,
      origin: "Manila Main Hub",
      destination: "Cebu Distribution Hub",
      originWarehouse: "WH-MNL",
      destinationWarehouse: "WH-CEB",
      driverId: userMap["driver@atlas.local"].uid,
      driverName: "Driver Juan",
      truckPlate: "NCR-1234",
      truckModel: "Isuzu Giga 10-Wheeler Wingvan",
      totalShipments: 1,
      loadedCount: 1,
      receivedCount: 0,
      shipmentIds: ["SHIP-MNL-1003"],
      active: true,
      arrivedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: "TRIP-005",
      tripId: "TRIP-005",
      tripNumber: "TRIP-2026-005",
      status: "COMPLETED",
      manifestLocked: true,
      origin: "Cebu Distribution Hub",
      destination: "Manila Main Hub",
      originWarehouse: "WH-CEB",
      destinationWarehouse: "WH-MNL",
      driverId: userMap["driver@atlas.local"].uid,
      driverName: "Driver Juan",
      truckPlate: "CEB-5678",
      totalShipments: 4,
      loadedCount: 4,
      receivedCount: 4,
      active: false,
      archived: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  ];

  for (const tr of trips) {
    // Both truck_trips and trips collections for compatibility
    await db.collection("truck_trips").doc(tr.id).set(tr, { merge: true });
    await db.collection("trips").doc(tr.id).set(tr, { merge: true });

    // Seed trip_shipments ledger row
    if (tr.shipmentIds && tr.shipmentIds.length > 0) {
      for (const shipId of tr.shipmentIds) {
        const s = shipments.find((item) => item.id === shipId);
        if (s) {
          const ledgerRow = {
            id: s.id,
            shipmentId: s.id,
            trackingShipmentId: s.id,
            trackingNumber: s.trackingNumber,
            status: s.status,
            totalPieces: s.totalPieces,
            loadedPieces: s.loadedPieces,
            receivedPieces: s.receivedPieces,
            packages: s.packages,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          await db.collection("truck_trips").doc(tr.id).collection("trip_shipments").doc(s.id).set(ledgerRow, { merge: true });
        }
      }
    }
  }
  console.log(`✓ Trips seeded in truck_trips and trips (${trips.length}) with trip_shipments subcollections`);

  // 6. Invoices
  const invoices = [
    {
      id: "INV-2026-001",
      invoiceNumber: "INV-2026-001",
      shipmentId: "SHIP-MNL-1001",
      trackingNumber: "ATL-10001",
      customerId: userMap["customer@atlas.local"].uid,
      customerName: "Customer Atlas",
      amount: 4750.00,
      subtotal: 4241.07,
      vat: 508.93,
      status: "PAID",
      paymentMethod: "Bank Transfer",
      paymentStatus: "CONFIRMED",
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: "INV-2026-002",
      invoiceNumber: "INV-2026-002",
      shipmentId: "SHIP-MNL-1002",
      trackingNumber: "ATL-10002",
      customerId: userMap["customer@atlas.local"].uid,
      customerName: "Customer Atlas",
      amount: 8900.00,
      subtotal: 7946.43,
      vat: 953.57,
      status: "PENDING",
      paymentMethod: "COD",
      paymentStatus: "UNPAID",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: "INV-2026-003",
      invoiceNumber: "INV-2026-003",
      shipmentId: "SHIP-MNL-1003",
      trackingNumber: "ATL-10003",
      customerId: userMap["maria.santos@gmail.com"].uid,
      customerName: "Maria Santos",
      amount: 2350.00,
      subtotal: 2098.21,
      vat: 251.79,
      status: "OVERDUE",
      paymentMethod: "GCash",
      paymentStatus: "UNPAID",
      dueDate: "2026-10-20",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  ];

  for (const inv of invoices) {
    await db.collection("invoices").doc(inv.id).set(inv, { merge: true });
  }
  console.log(`✓ Invoices seeded (${invoices.length})`);

  // 7. Admin Alerts & Operational Logs
  const alerts = [
    {
      id: "ALERT-001",
      type: "DELAY_REPORT",
      tripId: "TRIP-003",
      title: "TRIP-003 Delay Reported",
      message: "Driver Juan reported weather delay near Cebu strait crossing.",
      details: {
        driverName: "Driver Juan",
        driverId: userMap["driver@atlas.local"].uid,
        reason: "Weather / High Sea Swell",
        impactHours: 2,
      },
      severity: "WARNING",
      status: "UNREAD",
      category: "OPERATIONS",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: "ALERT-002",
      type: "TRIP_ARRIVAL",
      tripId: "TRIP-004",
      title: "TRIP-004 Arrived at Cebu Hub",
      message: "Trip arrived at Cebu Distribution Hub. Unload manifest ready for verification.",
      details: {
        warehouse: "WH-CEB",
        warehouseName: "Cebu Distribution Hub",
      },
      severity: "SUCCESS",
      status: "UNREAD",
      category: "CHECKER",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
      id: "ALERT-003",
      type: "CHAT_MESSAGE",
      title: "Customer Atlas Inquiry",
      message: "When is my shipment ATL-10001 departing Manila?",
      details: {
        customerName: "Customer Atlas",
        customerId: userMap["customer@atlas.local"].uid,
        shipmentId: "SHIP-MNL-1001",
      },
      severity: "INFO",
      status: "UNREAD",
      category: "SUPPORT",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  ];

  for (const alt of alerts) {
    await db.collection("admin_alerts").doc(alt.id).set(alt, { merge: true });
  }
  console.log(`✓ Admin Alerts seeded (${alerts.length})`);

  // 8. Support Conversations & Live Chat
  const convId = "CONV-DEMO-001";
  await db.collection("conversations").doc(convId).set({
    id: convId,
    conversationId: convId,
    customerId: userMap["customer@atlas.local"].uid,
    customerName: "Customer Atlas",
    customerEmail: "customer@atlas.local",
    type: "customer_support",
    status: "OPEN",
    lastMessageText: "Hello, when is my shipment ATL-10001 departing Manila?",
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection("conversations").doc(convId).collection("messages").doc("MSG-001").set({
    id: "MSG-001",
    senderId: userMap["customer@atlas.local"].uid,
    senderName: "Customer Atlas",
    senderRole: "customer",
    text: "Hello, when is my shipment ATL-10001 departing Manila?",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection("conversations").doc(convId).collection("messages").doc("MSG-002").set({
    id: "MSG-002",
    senderId: userMap["admin@atlas.local"].uid,
    senderName: "Admin Operator",
    senderRole: "admin",
    text: "Hi Customer Atlas! Your shipment is assigned to TRIP-001 departing tomorrow morning at 8:00 AM.",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // 9. Public Tracking
  await db.collection("tracking_public").doc("ATL-10001").set({
    id: "ATL-10001",
    trackingNumber: "ATL-10001",
    shipmentId: "SHIP-MNL-1001",
    status: "IN_TRANSIT",
    statusCode: "IN_TRANSIT",
    origin: "Manila Main Hub",
    originWarehouse: "WH-MNL",
    destination: "Cebu Distribution Hub",
    destinationWarehouse: "WH-CEB",
    sender: { name: "Customer Atlas", phone: "+639171234567" },
    recipient: { name: "Maria Santos", phone: "+639189876543", address: "45 Osmeña Blvd, Cebu City" },
    totalPieces: 3,
    totalPackages: 3,
    estimatedArrival: new Date(Date.now() + 86400000 * 2).toISOString(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    history: [
      {
        title: "Shipment Registered",
        status: "REGISTERED",
        statusCode: "REGISTERED",
        location: "Manila Main Hub",
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        note: "Package received and intake scan completed.",
      },
      {
        title: "Loaded into Container",
        status: "LOADED",
        statusCode: "LOADED",
        location: "Manila Main Hub",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        note: "Loaded into truck TRK-001 (Trip TRIP-001).",
      },
      {
        title: "In Transit to Cebu",
        status: "IN_TRANSIT",
        statusCode: "IN_TRANSIT",
        location: "En Route - Batangas Port",
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        note: "Vessel RoRo departure confirmed.",
      },
    ],
  }, { merge: true });
  console.log(`✓ Public Tracking seeded (ATL-10001)`);

  // 10. Manifest Amendments
  const amendmentData = {
    id: "AMEND-001",
    amendmentId: "AMEND-001",
    amendmentNumber: "AMD-2026-001",
    tripId: "TRIP-001",
    tripNumber: "TRIP-2026-001",
    status: "APPROVED",
    type: "PACKAGE_ADDITION",
    reason: "Late express package added before departure",
    description: "Added 1 express carton for Cebu Distribution Hub",
    origin: "Manila Main Hub",
    destination: "Cebu Distribution Hub",
    route: "MNL -> CEB",
    truckPlate: "NCR-1234",
    driverName: "Driver Juan",
    adminName: "Admin Operator",
    sealedAt: new Date().toISOString(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    meta: {
      sealedByName: "Admin Operator",
      sealedAtMs: Date.now(),
    },
    items: [
      {
        packageId: "PKG-001",
        trackingNumber: "ATL-10001-1",
        description: "Smartphones & Tablets (Box 1)",
        action: "ADDED",
        quantity: 1,
      },
    ],
    verifyUrl: "https://atlastransport.ph/verify/amendment/AMEND-001",
  };
  await db.collection("manifest_amendments").doc("AMEND-001").set(amendmentData, { merge: true });
  await db.collection("truck_trips").doc("TRIP-001").set({ latestAmendmentId: "AMEND-001" }, { merge: true });
  await db.collection("truck_trips").doc("TRIP-001").collection("manifest_amendments").doc("AMEND-001").set(amendmentData, { merge: true });
  console.log(`✓ Manifest Amendments seeded (AMEND-001)`);

  // 11. Delivery Manifests
  const deliveryManifestData = {
    id: "MNF-DELIVERY-001",
    manifestId: "MNF-DELIVERY-001",
    tripId: "TRIP-001",
    tripNumber: "TRIP-2026-001",
    type: "DELIVERY",
    status: "COMPLETED",
    version: "DELIVERY-v1.0",
    hash: "a3f5b9c1d8e2049f578b91a2c3d4e5f60718293a4b5c6d7e8f90123456789abc",
    sealedAt: new Date().toISOString(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    totals: {
      totalPackagesReceived: 3,
      totalDelivered: 3,
      totalFailedDelivery: 0,
      totalReturnedToWarehouse: 0,
      podCaptured: 3,
    },
    trip: {
      deliveryHub: "Cebu Distribution Hub",
      origin: "Manila Main Hub",
      destination: "Cebu Distribution Hub",
      route: "MNL -> CEB",
    },
    shipments: [
      {
        trackingShipmentId: "SHIP-MNL-1001",
        shipmentId: "SHIP-MNL-1001",
        trackingNumber: "ATL-10001",
        receiverName: "Maria Santos",
        destinationLabel: "Cebu City",
        route: "MNL -> CEB",
        contents: [
          {
            packageId: "PKG-001",
            description: "Smartphones & Tablets (Box 1)",
            quantity: 1,
            status: "DELIVERED",
          },
          {
            packageId: "PKG-002",
            description: "Industrial Spares (Box 2)",
            quantity: 1,
            status: "DELIVERED",
          },
          {
            packageId: "PKG-003",
            description: "Confidential Contract Files (Box 3)",
            quantity: 1,
            status: "DELIVERED",
          },
        ],
      },
    ],
  };
  await db.collection("manifests").doc("MNF-DELIVERY-001").set(deliveryManifestData, { merge: true });
  await db.collection("truck_trips").doc("TRIP-001").set({ deliveryManifestId: "MNF-DELIVERY-001" }, { merge: true });
  await db.collection("trips").doc("TRIP-001").set({ deliveryManifestId: "MNF-DELIVERY-001" }, { merge: true });
  console.log(`✓ Delivery Manifest seeded (MNF-DELIVERY-001)`);

  // 12. Operational App Settings
  await db.collection("app_settings").doc("operational").set({
    maintenanceMode: false,
    autoAssignDrivers: true,
    requirePhotoProofOfDelivery: true,
    enableQrScanning: true,
    manifestLockGraceMinutes: 30,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`✓ Operational Settings seeded`);

  console.log("\n=======================================================");
  console.log("   ALL DUMMY DATA SEEDED SUCCESSFULLY FOR EMULATOR     ");
  console.log("=======================================================");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
