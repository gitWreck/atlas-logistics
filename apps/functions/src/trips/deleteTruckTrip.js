"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

/**
 * Hard-delete is disabled for trips. Use cancelTruckTrip or archiveTruckTrip instead.
 */
exports.deleteTruckTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async () => {
    throw new HttpsError(
      "failed-precondition",
      "Trip hard-delete is disabled. Use Cancel Trip or Archive Trip to preserve the audit trail.",
      { code: "TRIP_HARD_DELETE_DISABLED" },
    );
  },
);
