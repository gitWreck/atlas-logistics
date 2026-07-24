"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const {
  canAccessRecord,
  canAccessStaff,
  getManagerScope,
  requireManagerScope,
} = require("./managerAccess");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const REGION_OPTIONS = {
  region: "asia-southeast1",
  maxInstances: 30,
  memory: "512MiB",
  invoker: "public",
};
const STAFF_ROLES = new Set([
  "checker",
  "driver",
  "employee",
  "staff",
  "support",
  "manager",
]);
const COMPLETED_TRIP_STATUSES = new Set([
  "COMPLETED",
  "DELIVERED",
  "CANCELLED",
  "CANCELED",
  "ARCHIVED",
  "CLOSED",
]);

function serialize(value) {
  if (value == null) return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        serialize(entryValue),
      ]),
    );
  }
  return value;
}

function row(doc) {
  return serialize({ id: doc.id, ...doc.data() });
}

function statusOf(value = {}) {
  return String(value.status || "UNKNOWN").trim().toUpperCase();
}

function statusMatches(status, values) {
  return values.has(String(status || "").trim().toUpperCase());
}

function updatedMillis(value = {}) {
  const raw = value.updatedAt || value.lastActivityAt || value.createdAt;
  if (raw?.toMillis) return raw.toMillis();
  const parsed = new Date(raw || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function scopedDocs(snapshot, profile, predicate = () => true) {
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((value) => canAccessRecord(profile, value) && predicate(value))
    .sort((left, right) => updatedMillis(right) - updatedMillis(left));
}

async function getScopedShipment(profile, shipmentId) {
  const id = String(shipmentId || "").trim();
  if (!id) throw new HttpsError("invalid-argument", "shipmentId is required.");
  const snap = await db.collection("shipments").doc(id).get();
  if (!snap.exists) throw new HttpsError("not-found", "Shipment not found.");
  const shipment = { id: snap.id, ...snap.data() };
  if (!canAccessRecord(profile, shipment)) {
    throw new HttpsError(
      "permission-denied",
      "This shipment is outside your assigned warehouse or municipality.",
    );
  }
  return shipment;
}

async function getScopedTrip(profile, tripId) {
  const id = String(tripId || "").trim();
  if (!id) throw new HttpsError("invalid-argument", "tripId is required.");
  const snap = await db.collection("truck_trips").doc(id).get();
  if (!snap.exists) throw new HttpsError("not-found", "Trip not found.");
  const trip = { id: snap.id, ...snap.data() };
  if (!canAccessRecord(profile, trip)) {
    throw new HttpsError(
      "permission-denied",
      "This trip is outside your assigned warehouse or municipality.",
    );
  }
  return trip;
}

exports.getManagerMobileDashboard = onCall(REGION_OPTIONS, async (request) => {
  const { profile, scope } = await requireManagerScope(db, request);
  const [shipmentSnap, tripSnap, staffSnap] = await Promise.all([
    db.collection("shipments").get(),
    db.collection("truck_trips").get(),
    db.collection("users").get(),
  ]);

  const allScopedShipments = scopedDocs(shipmentSnap, profile);
  const pickups = allScopedShipments.filter(
    (shipment) => shipment.isPickupRequested === true,
  );
  const shipments = allScopedShipments.filter(
    (shipment) => shipment.isPickupRequested !== true,
  );
  const trips = scopedDocs(tripSnap, profile);
  const staff = staffSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter(
      (member) =>
        STAFF_ROLES.has(String(member.role || "").toLowerCase()) &&
        canAccessStaff(profile, member),
    );

  const counts = shipments.reduce(
    (result, shipment) => {
      const status = statusOf(shipment);
      result.total += 1;
      if (
        statusMatches(status, new Set([
          "AVAILABLE",
          "AVAILABLE_AT_WAREHOUSE",
          "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
          "RECEIVED",
          "RECEIVED_AT_DIVISORIA",
          "READY_FOR_LOADING",
        ]))
      ) result.available += 1;
      if (statusMatches(status, new Set(["LOADED", "PARTIALLY_LOADED"]))) {
        result.loaded += 1;
      }
      if (status === "OUT_FOR_DELIVERY") result.outForDelivery += 1;
      if (statusMatches(status, new Set(["DELIVERED", "COMPLETED"]))) {
        result.delivered += 1;
      }
      if (statusMatches(status, new Set(["FAILED", "FAILED_DELIVERY"]))) {
        result.failed += 1;
      }
      if (status.startsWith("RETURNED")) result.returned += 1;
      return result;
    },
    {
      total: 0,
      available: 0,
      loaded: 0,
      outForDelivery: 0,
      delivered: 0,
      failed: 0,
      returned: 0,
    },
  );

  const activeTrips = trips.filter(
    (trip) =>
      trip.archived !== true && !COMPLETED_TRIP_STATUSES.has(statusOf(trip)),
  );
  const checkers = staff.filter(
    (member) => String(member.role || "").toLowerCase() === "checker",
  );
  const drivers = staff.filter(
    (member) => String(member.role || "").toLowerCase() === "driver",
  );

  return serialize({
    scope: {
      warehouse: profile.warehouseName || profile.warehouseCode || scope.warehouses[0],
      warehouses: scope.warehouses,
      municipalities: scope.municipalities,
    },
    stats: {
      ...counts,
      pickups: pickups.length,
      activeTrips: activeTrips.length,
      assignedCheckers: checkers.length,
      assignedDrivers: drivers.length,
      activeCheckers: checkers.filter((member) => member.active !== false).length,
      activeDrivers: drivers.filter((member) => member.active !== false).length,
      deliveryProgress:
        counts.total > 0 ? Math.round((counts.delivered / counts.total) * 100) : 0,
    },
    recentActivity: shipments.slice(0, 8),
    attentionTrips: activeTrips
      .filter((trip) => trip.delayReason || trip.issue || trip.issueReport)
      .slice(0, 5),
  });
});

function customerIdsFromShipment(shipment = {}) {
  return [
    shipment.customerId,
    shipment.customerUid,
    shipment.userId,
    shipment.senderId,
    shipment.sender?.id,
    shipment.sender?.uid,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function reportSummary(shipments = [], trips = [], staff = []) {
  const shipmentStatuses = {};
  shipments.forEach((shipment) => {
    const status = statusOf(shipment);
    shipmentStatuses[status] = (shipmentStatuses[status] || 0) + 1;
  });
  const roles = {};
  staff.forEach((member) => {
    const role = String(member.role || "staff").toLowerCase();
    roles[role] = (roles[role] || 0) + 1;
  });
  return {
    shipmentStatuses,
    staffByRole: roles,
    totalShipments: shipments.length,
    totalTrips: trips.length,
    failedDeliveries:
      (shipmentStatuses.FAILED || 0) +
      (shipmentStatuses.FAILED_DELIVERY || 0),
    returns: Object.entries(shipmentStatuses)
      .filter(([status]) => status.startsWith("RETURN"))
      .reduce((sum, [, count]) => sum + count, 0),
    delivered:
      (shipmentStatuses.DELIVERED || 0) +
      (shipmentStatuses.COMPLETED || 0),
  };
}

exports.getManagerMobileModules = onCall(REGION_OPTIONS, async (request) => {
  const { profile, scope } = await requireManagerScope(db, request);
  const [
    shipmentSnap,
    tripSnap,
    staffSnap,
    truckSnap,
    customerSnap,
    invoiceSnap,
    settingsSnap,
  ] = await Promise.all([
    db.collection("shipments").get(),
    db.collection("truck_trips").get(),
    db.collection("users").get(),
    db.collection("trucks").get(),
    db.collection("users").where("role", "==", "customer").get(),
    db.collection("invoices").get(),
    db.collection("app_settings").doc("operational").get(),
  ]);

  const scopedShipments = scopedDocs(shipmentSnap, profile);
  const shipments = scopedShipments.filter(
    (shipment) => shipment.isPickupRequested !== true,
  );
  const pickups = scopedShipments.filter(
    (shipment) => shipment.isPickupRequested === true,
  );
  const trips = scopedDocs(tripSnap, profile);
  const staff = staffSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter(
      (member) =>
        STAFF_ROLES.has(String(member.role || "").toLowerCase()) &&
        canAccessStaff(profile, member),
    );
  const trucks = scopedDocs(truckSnap, profile);

  const authorizedCustomerIds = new Set(
    scopedShipments.flatMap(customerIdsFromShipment),
  );
  const customers = customerSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter(
      (customer) =>
        authorizedCustomerIds.has(customer.id) ||
        canAccessRecord(profile, customer),
    );
  const shipmentIds = new Set(
    scopedShipments.flatMap((shipment) => [
      shipment.id,
      shipment.shipmentId,
      shipment.trackingNumber,
    ]).filter(Boolean).map(String),
  );
  const invoices = invoiceSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((invoice) =>
      shipmentIds.has(String(invoice.shipmentId || "")),
    );

  return serialize({
    scope,
    trucks: trucks.slice(0, 500),
    customers: customers.slice(0, 500),
    invoices: invoices.slice(0, 500),
    pickups: pickups.slice(0, 500),
    staff,
    trips: trips.slice(0, 500),
    shipments: shipments.slice(0, 500),
    reports: reportSummary(shipments, trips, staff),
    settings: settingsSnap.exists ? settingsSnap.data() : {},
  });
});

exports.listManagerMobileShipments = onCall(REGION_OPTIONS, async (request) => {
  const { profile, scope } = await requireManagerScope(db, request);
  const snap = await db.collection("shipments").get();
  const limit = Math.min(Math.max(Number(request.data?.limit) || 250, 1), 500);
  return {
    scope: serialize(scope),
    shipments: serialize(
      scopedDocs(
        snap,
        profile,
        (shipment) => shipment.isPickupRequested !== true,
      ).slice(0, limit),
    ),
  };
});

exports.getManagerMobileShipment = onCall(REGION_OPTIONS, async (request) => {
  const { profile } = await requireManagerScope(db, request);
  const shipment = await getScopedShipment(profile, request.data?.shipmentId);
  const [eventsSnap, scansSnap] = await Promise.all([
    db
      .collection("shipment_events")
      .where("shipmentId", "==", shipment.id)
      .get(),
    db
      .collection("scan_audit_logs")
      .where("shipmentId", "==", shipment.id)
      .get(),
  ]);
  const timeline = [...eventsSnap.docs.map(row), ...scansSnap.docs.map(row)].sort(
    (left, right) => updatedMillis(right) - updatedMillis(left),
  );
  return { shipment: serialize(shipment), timeline };
});

exports.listManagerMobileOperations = onCall(REGION_OPTIONS, async (request) => {
  const { profile, scope } = await requireManagerScope(db, request);
  const [tripSnap, staffSnap] = await Promise.all([
    db.collection("truck_trips").get(),
    db.collection("users").get(),
  ]);
  const trips = scopedDocs(tripSnap, profile);
  const staff = staffSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter(
      (member) =>
        STAFF_ROLES.has(String(member.role || "").toLowerCase()) &&
        canAccessStaff(profile, member),
    )
    .sort((left, right) =>
      String(left.name || left.email || "").localeCompare(
        String(right.name || right.email || ""),
      ),
    );
  return {
    scope: serialize(scope),
    trips: serialize(trips.slice(0, 300)),
    staff: serialize(staff),
  };
});

exports.getManagerMobileTrip = onCall(REGION_OPTIONS, async (request) => {
  const { profile } = await requireManagerScope(db, request);
  const trip = await getScopedTrip(profile, request.data?.tripId);
  const [shipmentSnap, driverSnap, auditByDocSnap, auditByCodeSnap, manifestEventsSnap] = await Promise.all([
    db
      .collection("truck_trips")
      .doc(trip.id)
      .collection("trip_shipments")
      .get(),
    db
      .collection("users")
      .where("role", "==", "driver")
      .where("active", "==", true)
      .get(),
    db
      .collection("audit_logs")
      .where("targetId", "==", trip.id)
      .limit(100)
      .get()
      .catch(() => ({ docs: [] })),
    db
      .collection("audit_logs")
      .where("tripId", "==", trip.tripId || trip.id)
      .limit(100)
      .get()
      .catch(() => ({ docs: [] })),
    db
      .collection("truck_trips")
      .doc(trip.id)
      .collection("manifest_events")
      .limit(100)
      .get()
      .catch(() => ({ docs: [] })),
  ]);
  const authorizedDrivers = driverSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((driver) => canAccessStaff(profile, driver))
    .map((driver) => serialize(driver));
  const auditEntries = new Map();
  [...auditByDocSnap.docs, ...auditByCodeSnap.docs, ...manifestEventsSnap.docs]
    .map(row)
    .forEach((entry) => auditEntries.set(entry.id, entry));
  return {
    trip: serialize(trip),
    shipments: shipmentSnap.docs.map(row),
    authorizedDrivers,
    auditEntries: serialize(
      [...auditEntries.values()].sort(
        (left, right) => updatedMillis(right) - updatedMillis(left),
      ),
    ),
  };
});

exports.listManagerMobileNotifications = onCall(
  REGION_OPTIONS,
  async (request) => {
    const { uid } = await requireManagerScope(db, request);
    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return { notifications: snap.docs.map(row) };
  },
);

exports.listManagerMobileConversations = onCall(
  REGION_OPTIONS,
  async (request) => {
    const { uid, profile } = await requireManagerScope(db, request);
    const [snap, callerCalls, receiverCalls] = await Promise.all([
      db
        .collection("conversations")
        .orderBy("lastMessageAt", "desc")
        .limit(200)
        .get(),
      db.collection("calls").where("callerId", "==", uid).limit(60).get(),
      db.collection("calls").where("receiverId", "==", uid).limit(60).get(),
    ]);
    const shipmentCache = new Map();
    const authorized = [];

    for (const doc of snap.docs) {
      const conversation = { id: doc.id, ...doc.data() };
      const participants = conversation.participantIds || [];
      if (
        conversation.type === "direct_staff" &&
        participants.includes(uid)
      ) {
        authorized.push(conversation);
        continue;
      }
      if (
        conversation.assignedTo === uid ||
        conversation.assignedStaffId === uid ||
        participants.includes(uid)
      ) {
        authorized.push(conversation);
        continue;
      }

      const shipmentId = String(
        conversation.shipmentId || conversation.trackingNumber || "",
      ).trim();
      if (!shipmentId) continue;
      if (!shipmentCache.has(shipmentId)) {
        const shipmentSnap = await db.collection("shipments").doc(shipmentId).get();
        shipmentCache.set(
          shipmentId,
          shipmentSnap.exists
            ? { id: shipmentSnap.id, ...shipmentSnap.data() }
            : null,
        );
      }
      const shipment = shipmentCache.get(shipmentId);
      if (shipment && canAccessRecord(profile, shipment)) {
        authorized.push(conversation);
      }
    }

    const calls = new Map();
    [...callerCalls.docs, ...receiverCalls.docs].forEach((doc) => {
      const call = { id: doc.id, ...doc.data() };
      const incoming = call.receiverId === uid;
      calls.set(doc.id, {
        ...call,
        direction: incoming ? "incoming" : "outgoing",
        peerName: incoming
          ? call.callerName || call.callerDisplayName || null
          : call.receiverName || call.receiverDisplayName || null,
      });
    });

    return {
      conversations: serialize(authorized),
      recentCalls: serialize(
        [...calls.values()]
          .sort((left, right) => updatedMillis(right) - updatedMillis(left))
          .slice(0, 100),
      ),
    };
  },
);

async function matchingManagers(record) {
  const snap = await db
    .collection("users")
    .where("role", "==", "manager")
    .get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((manager) => canAccessRecord(manager, record));
}

async function writeManagerNotifications(managers, notification, eventId) {
  if (!managers.length) return;
  const batch = db.batch();
  managers.forEach((manager) => {
    const ref = db
      .collection("users")
      .doc(manager.id)
      .collection("notifications")
      .doc(`${eventId}_${manager.id}`);
    batch.set(
      ref,
      {
        ownerId: manager.id,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...notification,
      },
      { merge: true },
    );
  });
  await batch.commit();
}

exports.notifyManagersOnShipmentCreated = onDocumentCreated(
  { document: "shipments/{shipmentId}", region: "asia-southeast1" },
  async (event) => {
    const shipment = { id: event.params.shipmentId, ...event.data.data() };
    const managers = await matchingManagers(shipment);
    const pickup = shipment.isPickupRequested === true;
    await writeManagerNotifications(
      managers,
      {
        type: pickup ? "NEW_SHIPMENT_REQUEST" : "SHIPMENT_CREATED",
        title: pickup ? "New shipment request" : "New shipment",
        message: `${shipment.trackingNumber || shipment.shipmentId || shipment.id} was added to your operational scope.`,
        shipmentId: shipment.id,
        status: shipment.status || null,
      },
      event.id.replace(/[^a-zA-Z0-9_-]/g, "_"),
    );
  },
);

exports.notifyManagersOnShipmentUpdated = onDocumentUpdated(
  { document: "shipments/{shipmentId}", region: "asia-southeast1" },
  async (event) => {
    const before = event.data.before.data() || {};
    const after = { id: event.params.shipmentId, ...event.data.after.data() };
    if (before.status === after.status) return;
    const managers = await matchingManagers(after);
    const status = statusOf(after);
    const type = status.startsWith("RETURNED")
      ? "RETURNED_SHIPMENT"
      : ["FAILED", "FAILED_DELIVERY"].includes(status)
        ? "FAILED_DELIVERY"
        : "SHIPMENT_STATUS_CHANGED";
    await writeManagerNotifications(
      managers,
      {
        type,
        title: status.replace(/_/g, " "),
        message: `${after.trackingNumber || after.shipmentId || after.id} changed from ${before.status || "unrecorded"} to ${status}.`,
        shipmentId: after.id,
        status,
      },
      event.id.replace(/[^a-zA-Z0-9_-]/g, "_"),
    );
  },
);

exports.notifyManagersOnTripUpdated = onDocumentUpdated(
  { document: "truck_trips/{tripId}", region: "asia-southeast1" },
  async (event) => {
    const before = event.data.before.data() || {};
    const after = { id: event.params.tripId, ...event.data.after.data() };
    const statusChanged = before.status !== after.status;
    const delayChanged = before.delayReason !== after.delayReason;
    const assignmentChanged =
      before.driverId !== after.driverId ||
      before.checkerId !== after.checkerId ||
      before.truckId !== after.truckId ||
      before.truckPlateNumber !== after.truckPlateNumber;
    if (!statusChanged && !delayChanged && !assignmentChanged) return;

    const managers = await matchingManagers(after);
    const status = statusOf(after);
    let type = "ASSIGNMENT_UPDATED";
    let title = "Trip assignment updated";
    if (delayChanged && after.delayReason) {
      type = "TRIP_DELAY";
      title = "Trip delayed";
    } else if (statusChanged && ["IN_TRANSIT", "DISPATCHED"].includes(status)) {
      type = "TRIP_DEPARTURE";
      title = "Trip departed";
    } else if (statusChanged && status === "ARRIVED") {
      type = "TRIP_ARRIVAL";
      title = "Trip arrived";
    } else if (statusChanged) {
      type = "TRIP_STATUS_CHANGED";
      title = status.replace(/_/g, " ");
    }
    await writeManagerNotifications(
      managers,
      {
        type,
        title,
        message: `${after.tripId || after.id}: ${after.delayReason || status || "assignment updated"}.`,
        tripId: after.id,
        status,
      },
      event.id.replace(/[^a-zA-Z0-9_-]/g, "_"),
    );
  },
);

exports.notifyManagersOnStaffAssignmentUpdated = onDocumentUpdated(
  { document: "users/{userId}", region: "asia-southeast1" },
  async (event) => {
    const before = event.data.before.data() || {};
    const after = { id: event.params.userId, ...event.data.after.data() };
    if (!["checker", "driver", "employee", "staff"].includes(String(after.role || "").toLowerCase())) {
      return;
    }
    const beforeAssignment = JSON.stringify({
      warehouseCode: before.warehouseCode,
      assignedMunicipalities: before.assignedMunicipalities,
      assignedTripId: before.assignedTripId,
      assignedRoute: before.assignedRoute,
      vehiclePlate: before.vehiclePlate,
    });
    const afterAssignment = JSON.stringify({
      warehouseCode: after.warehouseCode,
      assignedMunicipalities: after.assignedMunicipalities,
      assignedTripId: after.assignedTripId,
      assignedRoute: after.assignedRoute,
      vehiclePlate: after.vehiclePlate,
    });
    if (beforeAssignment === afterAssignment) return;
    const managers = (await matchingManagers(after)).filter((manager) =>
      canAccessStaff(manager, after),
    );
    await writeManagerNotifications(
      managers,
      {
        type: "ASSIGNMENT_UPDATED",
        title: "Staff assignment updated",
        message: `${after.name || after.email || "Staff member"} has a new operational assignment.`,
        staffId: after.id,
      },
      event.id.replace(/[^a-zA-Z0-9_-]/g, "_"),
    );
  },
);
