const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { assertAdminOrManager } = require("./../system/authGuards");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* =========================================================
   CONSTANTS (CANONICAL)
========================================================= */
const ALLOWED_ROLES = ["admin", "manager", "driver", "checker"];

/* =========================================================
   HELPERS
========================================================= */
function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function requireStaff(request) {
  const role = request.auth?.token?.role;
  if (!role || !ALLOWED_ROLES.includes(role)) {
    throw new HttpsError("permission-denied", "Staff only");
  }
  return role;
}

/* =========================================================
   APPEND STATUS EVENT (HASH-CHAINED, SERVER-ONLY)
========================================================= */
exports.appendStatusEvent = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    /* -----------------------------------------------------
       AUTH (REAL SECURITY)
    ----------------------------------------------------- */
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required");
    }

    // Use backend guard (admin/manager) OR staff role
    await assertAdminOrManager(request).catch(() => {
      requireStaff(request);
    });

    const uid = request.auth.uid;
    const role = request.auth.token?.role || "unknown";

    /* -----------------------------------------------------
       INPUT VALIDATION
    ----------------------------------------------------- */
    const { trackingId, status, statusIndex } = request.data || {};

    if (
      !trackingId ||
      typeof trackingId !== "string" ||
      !status ||
      typeof status !== "string" ||
      !Number.isInteger(statusIndex)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "trackingId, status, and integer statusIndex are required"
      );
    }

    const shipRef = db.collection("tracking_records").doc(trackingId);
    const eventsRef = shipRef.collection("status_events");

    /* -----------------------------------------------------
       TRANSACTION (ATOMIC + CONSISTENT)
    ----------------------------------------------------- */
    await db.runTransaction(async (tx) => {
      /* -----------------------------
         READ SHIPMENT
      ----------------------------- */
      const shipSnap = await tx.get(shipRef);
      if (!shipSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found");
      }

      const ship = shipSnap.data();
      const currentIndex = Number(ship.statusIndex ?? -1);

      // Enforce forward-only from canonical shipment
      if (statusIndex !== currentIndex + 1) {
        throw new HttpsError(
          "failed-precondition",
          "Status index must advance exactly by +1"
        );
      }

      /* -----------------------------
         READ LAST EVENT (CHAIN)
      ----------------------------- */
      const lastEventQuery = eventsRef.orderBy("statusIndex", "desc").limit(1);

      const lastSnap = await tx.get(lastEventQuery);

      let prevHash = "";
      let prevEventIndex = -1;

      if (!lastSnap.empty) {
        const last = lastSnap.docs[0].data();
        prevHash = last.hash || "";
        prevEventIndex = Number(last.statusIndex ?? -1);
      }

      // Double safety: events must also be sequential
      if (prevEventIndex !== -1 && statusIndex !== prevEventIndex + 1) {
        throw new HttpsError(
          "failed-precondition",
          "Event chain out of sequence"
        );
      }

      /* -----------------------------
         HASH (DETERMINISTIC)
      ----------------------------- */
      const hashPayload = [
        trackingId,
        status,
        statusIndex,
        uid,
        role,
        prevHash,
      ].join("|");

      const hash = sha256(hashPayload);

      /* -----------------------------
         WRITE EVENT (IMMUTABLE)
      ----------------------------- */
      const eventRef = eventsRef.doc();
      const now = admin.firestore.FieldValue.serverTimestamp();

      tx.set(eventRef, {
        status,
        statusIndex,
        at: now,
        by: uid,
        role,
        prevHash,
        hash,
      });

      /* -----------------------------
         UPDATE SHIPMENT (FAST READ UI)
      ----------------------------- */
      tx.update(shipRef, {
        status,
        statusIndex,
        lastUpdatedAt: now,
        lastUpdatedBy: uid,
        lastUpdatedRole: role,
      });
    });

    return { success: true };
  }
);
