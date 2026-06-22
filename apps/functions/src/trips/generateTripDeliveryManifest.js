"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers");
const { sealTripDeliveryManifest } = require("./tripDeliveryManifest");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.generateTripDeliveryManifest = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const { uid, role, user } = await requireRole(db, req, ["admin", "manager"]);
    const tripDocId = String(req.data?.tripId || req.data?.tripDocId || "").trim();

    if (!tripDocId) {
      throw new HttpsError("invalid-argument", "tripId is required");
    }

    const actorName =
      user?.fullName || user?.name || user?.displayName || req.auth.token?.name || null;

    const result = await sealTripDeliveryManifest({
      db,
      tripDocId,
      actorId: uid,
      actorName,
      actorRole: role,
    });

    if (!result.ok) {
      throw new HttpsError(
        "failed-precondition",
        result.reason || "Unable to seal delivery manifest",
      );
    }

    return result;
  },
);
