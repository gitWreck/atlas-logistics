"use strict";

const { onCall } = require("firebase-functions/v2/https");
const { db, requireRole } = require("../../../_shared");

exports.getTruckSmsUsage = onCall(async (req) => {
  await requireRole(req, ["admin", "manager"]);

  const snap = await db
    .collection("sms_logs")
    .where("truckTripId", "==", req.data.truckTripId)
    .get();

  let auto = 0,
    manual = 0;
  snap.forEach((d) => (d.data().auto ? auto++ : manual++));

  return { auto, manual };
});
