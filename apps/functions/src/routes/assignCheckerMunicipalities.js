"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireDeliveryRouteAssignmentAccess } = require("../utilities/helpers");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");
const {
  DELIVERY_MUNICIPALITIES,
  normalizeMunicipalityList,
} = require("../../shared/deliveryMunicipalities");
const {
  canAccessStaff,
  municipalityLabels,
  overlaps,
} = require("../manager/managerAccess");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.assignCheckerMunicipalities = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const actor = await requireDeliveryRouteAssignmentAccess(db, req);
    const { checkerId, municipalities = [] } = req.data || {};

    const normalizedCheckerId = String(checkerId || "").trim();
    if (!normalizedCheckerId) {
      throw new HttpsError("invalid-argument", "checkerId is required.");
    }

    const normalizedMunicipalities = normalizeMunicipalityList(municipalities);
    if (!Array.isArray(municipalities) || normalizedMunicipalities.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        `Provide at least one municipality. Valid values: ${DELIVERY_MUNICIPALITIES.join(", ")}`,
      );
    }

    const checkerRef = db.collection("users").doc(normalizedCheckerId);
    const checkerSnap = await checkerRef.get();
    if (!checkerSnap.exists || checkerSnap.data()?.active !== true) {
      throw new HttpsError("not-found", "Checker not found or inactive.");
    }

    const checkerData = checkerSnap.data() || {};
    if (String(checkerData.role || "").toLowerCase() !== "checker") {
      throw new HttpsError(
        "failed-precondition",
        "Municipality assignment is only supported for checker accounts.",
      );
    }
    if (
      actor.role === "manager" &&
      (!canAccessStaff(actor.user, checkerData) ||
        (municipalityLabels(actor.user).length > 0 &&
          !normalizedMunicipalities.every((municipality) =>
            overlaps(municipalityLabels(actor.user), [municipality]),
          )))
    ) {
      throw new HttpsError(
        "permission-denied",
        "This Checker or municipality is outside your assigned scope.",
      );
    }

    const checkerName =
      checkerData.fullName ||
      checkerData.name ||
      checkerData.displayName ||
      "Checker";

    await checkerRef.set(
      {
        assignedMunicipalities: normalizedMunicipalities,
        checkerChatAccessKey: FieldValue.delete(),
        municipalitiesAssignedAt: FieldValue.serverTimestamp(),
        municipalitiesAssignedBy: actor.name || actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await writeCustodyAuditLog({
      db,
      action: "ASSIGN_CHECKER_MUNICIPALITIES",
      targetCollection: "users",
      targetId: normalizedCheckerId,
      actorId: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      newValue: {
        checkerName,
        assignedMunicipalities: normalizedMunicipalities,
      },
    });

    return {
      success: true,
      checkerId: normalizedCheckerId,
      checkerName,
      assignedMunicipalities: normalizedMunicipalities,
    };
  },
);
