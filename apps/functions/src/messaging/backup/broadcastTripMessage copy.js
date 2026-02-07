"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { assertAdminOrManager } = require("../../system/authGuards");
const {
  sendSmsViaProvider,
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../shared/sms-service");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.broadcastTripMessage = onCall(
  {
    region: "asia-southeast1",
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
    timeoutSeconds: 300, // Allow extra time for large bulk sends
  },
  async (request) => {
    // 1. Auth & Validation
    const actor = await assertAdminOrManager(request);
    const { tripId, message, type = "BROADCAST" } = request.data;

    if (!tripId || !message) {
      throw new HttpsError(
        "invalid-argument",
        "Trip ID and Message are required.",
      );
    }

    // 2. Fetch Trip & Shipments
    const tripRef = db.collection("truck_trips").doc(tripId);
    const tripSnap = await tripRef.get();
    if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");

    // Query all active shipments on this truck
    const shipmentsSnap = await db
      .collection("shipments")
      .where("currentTruckTripId", "==", tripId)
      .get();

    if (shipmentsSnap.empty) {
      return { success: false, message: "No shipments found on this trip." };
    }

    // 3. Extract Unique Recipients (Deduplicate by Phone)
    const recipients = new Map(); // Use Map to ensure unique phones

    shipmentsSnap.forEach((doc) => {
      const data = doc.data();
      const phone = data.recipient?.phone;
      const name = data.recipient?.name || "Customer";

      // Only add if we have a valid-looking phone
      if (phone && phone.length >= 10) {
        if (!recipients.has(phone)) {
          recipients.set(phone, { phone, name, shipmentCount: 1 });
        } else {
          // Update count just for logging
          const existing = recipients.get(phone);
          existing.shipmentCount++;
        }
      }
    });

    const uniqueList = Array.from(recipients.values());
    const totalRecipients = uniqueList.length;

    console.log(
      `Starting broadcast for Trip ${tripId} to ${totalRecipients} recipients.`,
    );

    // 4. Send Messages (Batch Process)
    // We use Promise.all to send in parallel, but you might want to chunk this for massive lists (e.g. >500)
    const results = await Promise.allSettled(
      uniqueList.map(async (recipient) => {
        try {
          // Optional: You could personalize the message here like "Hi ${recipient.name}..."
          await sendSmsViaProvider(recipient.phone, message);
          return { status: "fulfilled", phone: recipient.phone };
        } catch (err) {
          console.error(`Failed to send to ${recipient.phone}:`, err);
          return {
            status: "rejected",
            phone: recipient.phone,
            error: err.message,
          };
        }
      }),
    );

    // 5. Audit & Log
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failCount = totalRecipients - successCount;

    await db.collection("sms_logs").add({
      type: "TRIP_BROADCAST",
      tripId,
      message,
      requestedBy: actor.uid,
      totalTargets: totalRecipients,
      successCount,
      failCount,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      total: totalRecipients,
      sent: successCount,
      failed: failCount,
    };
  },
);
