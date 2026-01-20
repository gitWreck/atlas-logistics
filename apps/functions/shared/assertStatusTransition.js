"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { STATUS_FLOW, STATUS_ROLE_GUARD } = require("./statusFlow");

exports.assertStatusTransition = ({
  currentStatus,
  currentIndex,
  nextStatus,
  nextIndex,
  actorRole
}) => {
  // Terminal lock
  if (currentStatus === "Delivered") {
    throw new HttpsError(
      "failed-precondition",
      "Shipment already delivered"
    );
  }

  // Index sanity
  if (nextIndex !== currentIndex + 1) {
    throw new HttpsError(
      "failed-precondition",
      `Invalid status jump (${currentIndex} → ${nextIndex})`
    );
  }

  // Status name must match index
  if (STATUS_FLOW[nextIndex] !== nextStatus) {
    throw new HttpsError(
      "failed-precondition",
      "Status does not match canonical flow"
    );
  }

  // Role guard
  const allowedRoles = STATUS_ROLE_GUARD[nextStatus] || [];
  if (!allowedRoles.includes(actorRole)) {
    throw new HttpsError(
      "permission-denied",
      `Role ${actorRole} cannot set status ${nextStatus}`
    );
  }

  return true;
};
