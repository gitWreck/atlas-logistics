"use strict";

/*************************************************
 * ATLAS — AUTO SMS (PACKAGE-LEVEL, TRIP-AWARE)
 * Node 20 — Firestore Trigger
 *
 * ✅ Triggered ONLY by transitionPackageStatus writes
 * ✅ Package-level accuracy
 * 🌦 Weather pause + auto-resume
 * 🚢 RORO delay handling
 * 🔁 Strong SMS suppression
 * 📊 Per-trip usage tracking
 * 🧾 Full audit trail
 *************************************************/

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

const { buildStatusSMS } = require("./buildStatusSMS");
const { calculateSmsCost } = require("./shared/sms-cost");
const { buildSmsSignature } = require("./shared/sms-suppression");
const { writeAuditEvent } = require("./shared/audit");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/* ======================================================
   HELPERS
====================================================== */
function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[^\d]/g, "");
  if (p.startsWith("09")) p = "63" + p.slice(1);
  if (p.startsWith("63") && p.length === 12) return p;
  return null;
}

/* ======================================================
   FIRESTORE TRIGGER
====================================================== */
exports.autoSmsOnPackageStatusChange = onDocumentUpdated(
  {
    region: "asia-southeast1",
    document:
      "truck_trips/{tripDocId}/trip_packages/{tripPackageId}",
  },
  async (event) => {
    const { tripDocId, tripPackageId } = event.params;

    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};

    /* -------------------------------------------
       1️⃣ Detect meaningful change
    ------------------------------------------- */
    const statusChanged = before.status !== after.status;
    const delayChanged =
      before.delayReason !== after.delayReason ||
      before.delayClearedAt !== after.delayClearedAt;

    if (!statusChanged && !delayChanged) return;

    /* -------------------------------------------
       2️⃣ Load trip
    ------------------------------------------- */
    const tripRef = db.collection("truck_trips").doc(tripDocId);
    const tripSnap = await tripRef.get();
    if (!tripSnap.exists) return;

    const trip = tripSnap.data();
    if (trip.autoSmsEnabled === false) return;

    /* -------------------------------------------
       3️⃣ Resolve delay state
    ------------------------------------------- */
    const status = after.status;
    const delayReason = after.delayReason || null;
    const delayCleared = !!after.delayClearedAt;

    const isWeatherDelay =
      delayReason && delayReason.toUpperCase().includes("WEATHER");

    const pauseDuringWeather =
      trip.pauseAutoSmsDuringWeather !== false;

    /* -------------------------------------------
       4️⃣ Resolve recipient
    ------------------------------------------- */
    const phone = normalizePhone(
      after.customerPhone ||
      after.phone ||
      after.mobile
    );
    if (!phone) return;

    /* -------------------------------------------
       5️⃣ Build SMS once
    ------------------------------------------- */
    const message = buildStatusSMS({
      trackingId: after.trackingId || trip.trackingId || tripDocId,
      status,
      delayReason,
      delayCleared,
    });

    const { credits } = calculateSmsCost(message);
    if (credits > 5) return;

    /* -------------------------------------------
       6️⃣ Suppression (PACKAGE-SCOPED)
    ------------------------------------------- */
    const stateRef = db.doc(
      `sms_state/${tripPackageId}__${phone}`
    );
    const stateSnap = await stateRef.get();

    if (isWeatherDelay && pauseDuringWeather) {
      if (stateSnap.exists && stateSnap.data()?.weatherPaused) {
        return;
      }
    }

    const signature = buildSmsSignature({
      tripPackageId,
      phone,
      status,
      delayReason,
      delayCleared,
      message,
    });

    if (
      stateSnap.exists &&
      stateSnap.data()?.lastSentSignature === signature
    ) {
      return;
    }

    /* -------------------------------------------
       7️⃣ Enqueue SMS
    ------------------------------------------- */
    await db.collection("sms_queue").add({
      tripDocId,
      tripPackageId,
      phone,
      message,
      status,
      delayReason,
      delayCleared,
      source: "auto",
      signature,
      createdAt: FieldValue.serverTimestamp(),
    });

    /* -------------------------------------------
       8️⃣ Update SMS state
    ------------------------------------------- */
    await stateRef.set(
      {
        lastSentSignature: signature,
        lastSentAt: FieldValue.serverTimestamp(),
        lastStatus: status,
        lastDelayReason: delayReason,
        lastDelayCleared: delayCleared,
        source: "auto",
        tripDocId,
        ...(isWeatherDelay && pauseDuringWeather
          ? {
              weatherPaused: true,
              weatherPausedAt: FieldValue.serverTimestamp(),
            }
          : {}),
        ...(delayCleared
          ? {
              weatherPaused: false,
              weatherClearedAt: FieldValue.serverTimestamp(),
            }
          : {}),
      },
      { merge: true }
    );

    /* -------------------------------------------
       9️⃣ Per-trip usage tracking
    ------------------------------------------- */
    await tripRef.set(
      {
        smsAutoCount: FieldValue.increment(1),
        smsTotalCredits: FieldValue.increment(credits),
        smsLastSentAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    /* -------------------------------------------
       🔍 Audit
    ------------------------------------------- */
    await writeAuditEvent(db, {
      actorUid: null,
      actorRole: "system",
      action: "AUTO_SMS_ENQUEUED",
      entityType: "trip_package",
      entityId: tripPackageId,
      meta: {
        tripDocId,
        status,
        delayReason,
        delayCleared,
        credits,
        weatherPaused:
          isWeatherDelay && pauseDuringWeather,
      },
    });
  }
);
