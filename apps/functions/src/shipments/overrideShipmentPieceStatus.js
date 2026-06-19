"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole, updatedBy } = require("../utilities/helpers");
const {
  OverrideShipmentPieceStatusError,
  runOverrideShipmentPieceStatus,
} = require("./overrideShipmentPieceStatusCore");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

function toHttpsError(error) {
  if (error instanceof OverrideShipmentPieceStatusError) {
    throw new HttpsError(error.code, error.message);
  }
  throw error;
}

exports.overrideShipmentPieceStatus = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Auth required.");
    }

    try {
      const actor = await requireRole(db, req, ["admin", "manager"]);
      const { uid, role, name } = updatedBy(req);
      const {
        shipmentId,
        packageId,
        newStatus,
        remarks = null,
        sourceUI = "ADMIN_PIECE_OVERRIDE",
      } = req.data || {};

      return await runOverrideShipmentPieceStatus(db, {
        shipmentId,
        packageId,
        newStatus,
        remarks,
        sourceUI,
        actor: { uid, role, name },
      });
    } catch (error) {
      toHttpsError(error);
    }
  },
);
