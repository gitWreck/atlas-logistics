const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const crypto = require("crypto");

function generateTrackingId() {
  const now = new Date();

  // 1. Format Date: YYMMDD (e.g., "240112" for Jan 12, 2024)
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, "");

  // 2. Format Time: HHmm (e.g., "1530" for 3:30 PM)
  // We use getHours() and getMinutes() and pad them with leading zeros
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const timeStr = `${hours}${minutes}`;

  // 3. Random Suffix: 3-4 chars to prevent collision in the same minute
  // We use the safe alphabet (no I, O, 0, 1) from before
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomBytes = crypto.randomBytes(3); // 3 random bytes
  let randomSuffix = "";

  for (let i = 0; i < 3; i++) {
    randomSuffix += chars[randomBytes[i] % chars.length];
  }

  // RESULT: TRK-240112-1530-X9Z
  return `TRK-${dateStr}-${timeStr}-${randomSuffix}`;
}

exports.createPackage = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (request) => {
    // 1. Auth Check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const { sender, recipient, items } = request.data;
    const createdBy = request.auth.uid;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new HttpsError("invalid-argument", "No items in order.");
    }

    const db = admin.firestore();
    const orderId = db.collection("orders").doc().id;
    const orderRef = db.collection("orders").doc(orderId);

    try {
      await db.runTransaction(async (t) => {
        // A. Create Parent Order
        t.set(orderRef, {
          orderId,
          sender,
          recipient,
          totalPackages: items.length,
          status: "CREATED",
          createdAt: FieldValue.serverTimestamp(),
          createdBy: createdBy,
          paymentStatus: "PENDING",
        });

        // B. Loop through items
        items.forEach((item, index) => {
          const trackingNum = generateTrackingId();

          // 1. Reference the Package Document
          const pkgRef = db.collection("packages").doc(trackingNum);

          // 2. Reference the NEW History Subcollection Document
          const historyRef = pkgRef.collection("history").doc();

          // 3. Set Package Data (Main Doc)
          t.set(pkgRef, {
            packageId: trackingNum,
            orderId: orderId,
            sequence: `${index + 1} of ${items.length}`,
            weight: item.weight,
            description: item.description,
            status: "CREATED", // The "Latest" status
            currentLocation: "Warehouse A",
            senderName: sender.name,
            recipientName: recipient.name,
            createdAt: FieldValue.serverTimestamp(),
            // NOTE: "history" array is removed from here
          });

          // 4. Set History Data (Subcollection Doc)
          t.set(historyRef, {
            status: "CREATED",
            description: "Item received at counter",
            location: "Warehouse A",
            timestamp: FieldValue.serverTimestamp(), // Safe to use here now
            actorId: createdBy,
          });
        });
      });

      return { success: true, orderId };
    } catch (error) {
      console.error("Order Creation Failed:", error);
      throw new HttpsError(
        "internal",
        error.message || "Failed to create order"
      );
    }
  }
);
