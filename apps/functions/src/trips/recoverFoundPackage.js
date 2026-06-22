"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole, updatedBy } = require("../utilities/helpers");
const {
  RecoverFoundPackageError,
  runRecoverFoundPackage,
} = require("./recoverFoundPackageCore");

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
