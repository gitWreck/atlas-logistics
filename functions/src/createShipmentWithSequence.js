"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const db = admin.firestore();

/* ======================================================
   HELPERS
====================================================== */
function requireAuth(req) {
  if (!req.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required");
  }
  return req.auth.uid;
}

function requireString(v, field) {
  if (typeof v !== "string" || !v.trim()) {
    throw new HttpsError("invalid-argument", `${field} is required`);
  }
  return v.trim();
}

function requirePosInt(v, field) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    throw new HttpsError("invalid-argument", `${field} must be a positive integer`);
  }
  return n;
}

async function assertAdminOrManager(tx, uid) {
  const userRef = db.collection("users").doc(uid);
  const snap = await tx.get(userRef);

  if (!snap.exists || snap.data().active !== true) {
    throw new HttpsError("permission-denied", "Inactive user");
  }

  const role = snap.data().role;
  if (role !== "admin" && role !== "manager") {
    throw new HttpsError("permission-denied", "Admin or Manager only");
  }

  return role;
}

/* ======================================================
   FUNCTION
====================================================== */
exports.createShipmentWithSequence = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    const uid = requireAuth(req);

    // Required payload
    const origin = requireString(req.data?.origin, "origin");
    const destination = requireString(req.data?.destination, "destination");
    const totalItems = requirePosInt(req.data?.totalItems, "totalItems");

    // Optional / UI fields
    const route = `${origin}-${destination}`;
    const remarks = req.data?.remarks || null;

    // Server date stamp
    const now = admin.firestore.Timestamp.now();
    const ymd = now.toDate().toISOString().slice(0, 10).replace(/-/g, "");

    const seqRef = db.collection("sequences").doc(`shipment-${ymd}`);
    const shipmentRef = db.collection("tracking_records").doc();

    return db.runTransaction(async (tx) => {
      const role = await assertAdminOrManager(tx, uid);

      /* ======================================================
         SEQUENCE (ATOMIC)
      ====================================================== */
      const seqSnap = await tx.get(seqRef);
      const nextSeq = (seqSnap.exists ? seqSnap.data().value : 0) + 1;

      tx.set(
        seqRef,
        {
          value: nextSeq,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      /* ======================================================
         BUILD TRACKING NUMBER
         Example: AT-20251223-DIVI-CAL-0001
      ====================================================== */
      const trackingNumber =
        `AT-${ymd}-${origin}-${destination}-${String(nextSeq).padStart(4, "0")}`;

      /* ======================================================
         CREATE SHIPMENT (SERVER-ONLY)
      ====================================================== */
      tx.set(shipmentRef, {
        trackingNumber,
        route,

        origin,
        destination,

        totalItems,
        loadedCount: 0,
        pendingCount: totalItems,

        status: "Created",
        statusIndex: 0,

        public: false,
        archived: false,

        currentTruckTripId: null,

        remarks,

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: uid,
        createdRole: role,

        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdatedBy: uid,
        lastUpdatedRole: role,
      });

      /* ======================================================
         STATUS EVENT (APPEND-ONLY)
      ====================================================== */
      tx.set(shipmentRef.collection("status_events").doc(), {
        type: "CREATED",
        message: "Shipment created",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: uid,
        createdRole: role,
      });

      /* ======================================================
         ADMIN AUDIT LOG
      ====================================================== */
      tx.set(db.collection("admin_logs").doc(), {
        action: "CREATE_SHIPMENT",
        trackingDocId: shipmentRef.id,
        trackingNumber,
        totalItems,
        route,
        actorId: uid,
        actorRole: role,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        trackingDocId: shipmentRef.id,
        trackingNumber,
        sequence: nextSeq,
      };
    });
  }
);

