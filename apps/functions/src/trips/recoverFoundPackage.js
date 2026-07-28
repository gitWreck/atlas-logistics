"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole, updatedBy } = require("../utilities/helpers");
const {
  RecoverFoundPackageError,
  runRecoverFoundPackage,
} = require("./recoverFoundPackageCore");
const { canAccessRecord } = require("../manager/managerAccess");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

function toHttpsError(error) {
  if (error instanceof RecoverFoundPackageError) {
    throw new HttpsError(error.code, error.message);
  }
  throw error;
}

exports.recoverFoundPackage = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Auth required.");
    }

    try {
      const actor = await requireRole(db, req, ["admin", "manager"]);
      const { uid, role, name } = updatedBy(req);
      const {
        tripId,
        packageLabel,
        remarks = null,
        sourceUI = "TRIP_SCANNER",
      } = req.data || {};
      if (actor.role === "manager") {
        const tripSnap = await db
          .collection("truck_trips")
          .doc(String(tripId || "").trim())
          .get();
        if (
          !tripSnap.exists ||
          !canAccessRecord(actor.user, {
            id: tripSnap.id,
            ...tripSnap.data(),
          })
        ) {
          throw new HttpsError(
            "permission-denied",
            "This trip is outside your assigned warehouse or municipality.",
          );
        }
      }

      return await runRecoverFoundPackage(db, {
        tripId,
        packageLabel,
        remarks,
        sourceUI,
        actor: { uid, role, name },
      });
    } catch (error) {
      toHttpsError(error);
    }
  },
);
