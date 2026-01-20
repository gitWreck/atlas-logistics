import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase";

/**
 * ======================================================
 * Update shipment status + append immutable audit event
 * (ATOMIC, CANONICAL, AUDIT-SAFE)
 *
 * Responsibilities:
 * - Update shipment status + statusIndex
 * - Enforce forward-only by default
 * - Allow ADMIN regression with explicit override
 * - Append immutable status_events entry
 *
 * NON-Responsibilities:
 * ❌ Delay logic (truck-level only)
 * ❌ SMS sending
 * ❌ Analytics
 * ======================================================
 */
export async function updateShipmentStatus({
  trackingId,
  nextStatus,
  nextStatusIndex,
  user,

  // ✅ audit controls
  override = null,
  overrideNote = null,
}) {
  /* ===============================
     BASIC VALIDATION
  =============================== */
  if (!trackingId) throw new Error("Missing trackingId");
  if (!user || !user.uid || !user.role) {
    throw new Error("User not authenticated");
  }
  if (typeof nextStatus !== "string") {
    throw new Error("Invalid nextStatus");
  }
  if (typeof nextStatusIndex !== "number") {
    throw new Error("Invalid nextStatusIndex");
  }

  /* ===============================
     REFERENCES
  =============================== */
  const recordRef = doc(db, "tracking_records", trackingId);
  const eventsRef = collection(recordRef, "status_events");

  /* ===============================
     TRANSACTION (ATOMIC)
  =============================== */
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(recordRef);
    if (!snap.exists()) {
      throw new Error("Tracking record not found");
    }

    const data = snap.data();
    const currentIndex = data.statusIndex ?? 0;
    const currentStatus = data.status ?? null;

    const isForward = nextStatusIndex === currentIndex + 1;
    const isSame = nextStatusIndex === currentIndex;
    const isRegression = nextStatusIndex < currentIndex;

    /* ===============================
       STATUS TRANSITION RULES
    =============================== */

    // Forward progression — always allowed
    if (!isForward) {
      // Same index → ignore (no-op)
      if (isSame) {
        throw new Error("Status unchanged");
      }

      // Regression — admin only, explicit override required
      if (isRegression) {
        if (user.role !== "admin") {
          throw new Error("Status regression not allowed");
        }
        if (!override) {
          throw new Error("Admin override required for status regression");
        }
      }

      // Skip forward (e.g., +2) — NEVER allowed
      if (nextStatusIndex > currentIndex + 1) {
        throw new Error("Skipping status steps is not allowed");
      }
    }

    /* ===============================
       BUILD UPDATE PAYLOAD
    =============================== */
    const updatePayload = {
      status: nextStatus,
      statusIndex: nextStatusIndex,
      lastUpdatedAt: serverTimestamp(),
      lastUpdatedBy: user.uid,
      lastUpdatedRole: user.role,
    };

    /* ===============================
       UPDATE MAIN RECORD
    =============================== */
    tx.update(recordRef, updatePayload);

    /* ===============================
       APPEND IMMUTABLE AUDIT EVENT
    =============================== */
    tx.set(doc(eventsRef), {
      fromStatus: currentStatus,
      fromStatusIndex: currentIndex,
      status: nextStatus,
      statusIndex: nextStatusIndex,

      // Audit metadata
      override: override || null,
      overrideNote: overrideNote || null,

      by: user.uid,
      role: user.role,
      at: serverTimestamp(),
    });
  });
}
