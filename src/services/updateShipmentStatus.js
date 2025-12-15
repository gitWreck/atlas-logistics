import {
  doc,
  collection,
  runTransaction,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Update shipment status and append immutable status event (ATOMIC)
 *
 * Roles:
 * - Admin / Manager: full control
 * - Checker / Driver: status-only, forward-only
 *
 * Firestore rules ENFORCE this again on the backend.
 */
export async function updateShipmentStatus({
  trackingId,
  nextStatus,
  nextStatusIndex,
  user
}) {
  /* ===============================
     BASIC VALIDATION
  =============================== */
  if (!trackingId) {
    throw new Error("Missing trackingId");
  }

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

    /* ===============================
       EXTRA SAFETY (UI + RULES)
       Prevent skip / rollback
    =============================== */
    if (nextStatusIndex !== currentIndex + 1) {
      throw new Error("Invalid status progression");
    }

    /* ===============================
       1️⃣ UPDATE MAIN TRACKING RECORD
    =============================== */
    tx.update(recordRef, {
      status: nextStatus,
      statusIndex: nextStatusIndex,
      lastUpdated: serverTimestamp(),
      lastUpdatedBy: user.uid,
      lastUpdatedRole: user.role
    });

    /* ===============================
       2️⃣ APPEND IMMUTABLE STATUS EVENT
       (AUDIT LOG)
    =============================== */
    tx.set(doc(eventsRef), {
      status: nextStatus,
      statusIndex: nextStatusIndex,
      by: user.uid,
      role: user.role,
      at: serverTimestamp()
    });
  });
}
