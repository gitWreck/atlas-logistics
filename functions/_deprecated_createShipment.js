/**
 * 🚫 DEPRECATED — DO NOT USE
 *
 * Replaced by:
 *   createShipmentWithSequence.js
 *
 * Reason:
 * - Collision-proof sequencing
 * - Trip-aware numbering
 * - Atomic Firestore transactions
 *
 * Kept only for reference.
 */


const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { assertAdminOrManager } = require("./authGuards");

function yyyymmddPH() {
  // Use Asia/Manila date (server safe)
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  // en-CA returns YYYY-MM-DD
  return fmt.format(new Date()).replace(/-/g, "");
}

function pad4(n) {
  return String(n).padStart(4, "0");
}

function normName(s = "") {
  return String(s).trim().toLowerCase();
}

function normPhone(s = "") {
  // keep digits only
  const digits = String(s).replace(/\D/g, "");
  // optional: normalize to PH 63xxxxxxxxxx
  if (digits.startsWith("0") && digits.length === 11) return "63" + digits.slice(1);
  if (digits.startsWith("63") && digits.length === 12) return digits;
  return digits;
}

exports.createShipment = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    await assertAdminOrManager(request);

    const uid = request.auth?.uid || "unknown";
    const role = request.auth?.token?.role || "unknown";

    const {
      originCode,      // "DIVI"
      destinationCode, // "ODI"
      customerName,
      customerPhone,
      originLabel,      // "Divisoria" (optional)
      destinationLabel, // "Odiongan" (optional)
      extra = {}        // optional extra fields
    } = request.data || {};

    if (!originCode || !destinationCode || !customerName || !customerPhone) {
      throw new HttpsError("invalid-argument", "Missing required fields");
    }

    const date = yyyymmddPH();
    const db = admin.firestore();

    // Counter doc: counters/daily_tracking/20251218
    const counterRef = db.collection("counters").doc("daily_tracking").collection("days").doc(date);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);

      let nextSeq = 1;
      if (!snap.exists) {
        tx.set(counterRef, {
          date,
          nextSeq: 2,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        const current = snap.data()?.nextSeq || 1;
        nextSeq = current;
        tx.update(counterRef, {
          nextSeq: current + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      const trackingId = `AT-${date}-${originCode}-${destinationCode}-${pad4(nextSeq)}`;
      const shipRef = db.collection("tracking_records").doc(trackingId);

      // Prevent accidental overwrite
      const exists = await tx.get(shipRef);
      if (exists.exists) {
        throw new HttpsError("already-exists", `Tracking already exists: ${trackingId}`);
      }

      tx.set(shipRef, {
        trackingNumber: trackingId,

        origin: originLabel || originCode,
        destination: destinationLabel || destinationCode,
        originCode,
        destinationCode,

        customerName,
        customerNameLower: normName(customerName),
        customerPhone: customerPhone,
        customerPhoneNorm: normPhone(customerPhone),

        status: "Received",
        statusIndex: 0,

        delayReason: null,
        delayCleared: true,
        delayStartedAt: null,
        delayClearedAt: null,

        archived: false,
        archivedAt: null,
        archivedBy: null,

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: uid,
        createdRole: role,

        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdatedBy: uid,
        lastUpdatedRole: role,

        ...extra
      });

      return { trackingId, seq: nextSeq, date };
    });

    return { success: true, ...result };
  }
);
