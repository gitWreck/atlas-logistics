"use strict";

/*************************************************
 * ATLAS — Set Truck Auto-SMS Settings (Option B)
 * Node 20 – Firebase Functions v2
 *
 * ✅ Admin / Manager only
 * ✅ Strong validation
 * ✅ Weather-pause compatible with autoSms.js
 * ✅ Audited + timestamped
 *************************************************/

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { db, requireRole, now } = require("./../../_shared");

if (!admin.apps.length) admin.initializeApp();

/* ======================================================
   HELPERS
====================================================== */
function requireBool(v, field) {
  if (typeof v !== "boolean") {
    throw new HttpsError("invalid-argument", `${field} must be boolean`);
  }
  return v;
}

/* ======================================================
   FUNCTION
====================================================== */
exports.setTruckAutoSmsSettings = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    await requireRole(req, ["admin", "manager"]);

    const uid = req.auth.uid;
    const role = req.auth.token?.role || "unknown";

    const truckTripId =
      typeof req.data?.truckTripId === "string"
        ? req.data.truckTripId.trim()
        : null;

    if (!truckTripId) {
      throw new HttpsError("invalid-argument", "truckTripId is required");
    }

    const autoSmsEnabled =
      req.data?.autoSmsEnabled !== undefined
        ? requireBool(req.data.autoSmsEnabled, "autoSmsEnabled")
        : undefined;

    const pauseAutoSmsDuringWeather =
      req.data?.pauseAutoSmsDuringWeather !== undefined
        ? requireBool(
            req.data.pauseAutoSmsDuringWeather,
            "pauseAutoSmsDuringWeather"
          )
        : undefined;

    if (
      autoSmsEnabled === undefined &&
      pauseAutoSmsDuringWeather === undefined
    ) {
      throw new HttpsError("invalid-argument", "Nothing to update");
    }

    const tripRef = db.collection("truck_trips").doc(truckTripId);
    const tripSnap = await tripRef.get();

    if (!tripSnap.exists) {
      throw new HttpsError("not-found", "Truck trip not found");
    }

    const update = {
      lastUpdatedAt: now(),
      lastUpdatedBy: uid,
      lastUpdatedRole: role,
    };

    if (autoSmsEnabled !== undefined) {
      update.autoSmsEnabled = autoSmsEnabled;
    }

    if (pauseAutoSmsDuringWeather !== undefined) {
      update.pauseAutoSmsDuringWeather = pauseAutoSmsDuringWeather;
    }

    await tripRef.update(update);

    /* ==================================================
       AUDIT LOG
    ================================================== */
    await db.collection("admin_logs").add({
      action: "SET_TRUCK_AUTO_SMS_SETTINGS",
      truckTripId,
      actorId: uid,
      actorRole: role,
      changes: {
        ...(autoSmsEnabled !== undefined && {
          autoSmsEnabled,
        }),
        ...(pauseAutoSmsDuringWeather !== undefined && {
          pauseAutoSmsDuringWeather,
        }),
      },
      createdAt: now(),
    });

    return {
      success: true,
      truckTripId,
      autoSmsEnabled:
        autoSmsEnabled !== undefined
          ? autoSmsEnabled
          : tripSnap.data().autoSmsEnabled ?? null,
      pauseAutoSmsDuringWeather:
        pauseAutoSmsDuringWeather !== undefined
          ? pauseAutoSmsDuringWeather
          : tripSnap.data().pauseAutoSmsDuringWeather ?? null,
    };
  }
);
