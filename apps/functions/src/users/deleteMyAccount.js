"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

async function deleteSubcollectionInBatches(userRef, subcollectionId) {
  const col = userRef.collection(subcollectionId);
  for (;;) {
    const snap = await col.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < 400) break;
  }
}

async function removeUidFromShipmentVisibility(uid) {
  const snap = await db
    .collection("shipments")
    .where("visibilityUserIds", "array-contains", uid)
    .get();

  let batch = db.batch();
  let count = 0;
  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      visibilityUserIds: FieldValue.arrayRemove(uid),
      updatedAt: FieldValue.serverTimestamp(),
    });
    count += 1;
    if (count >= 450) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
}

exports.deleteMyAccount = onCall(
  { region: "asia-southeast1", maxInstances: 5 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const uid = request.auth.uid;
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "Account not found.");
    }

    const role = userSnap.data()?.role;
    if (role !== "customer") {
      throw new HttpsError(
        "permission-denied",
        "In-app account deletion is only available for customer accounts. Contact support for other roles.",
      );
    }

    await deleteSubcollectionInBatches(userRef, "pushTokens");
    await deleteSubcollectionInBatches(userRef, "notifications");
    // Canonical path (addTrackedShipment); legacy camelCase for older clients
    await deleteSubcollectionInBatches(userRef, "tracked_shipments");
    await deleteSubcollectionInBatches(userRef, "trackedShipments");

    await removeUidFromShipmentVisibility(uid);

    await userRef.delete();

    await db.collection("admin_logs").add({
      action: "CUSTOMER_DELETED_OWN_ACCOUNT",
      targetUid: uid,
      actorId: uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    try {
      await auth.deleteUser(uid);
    } catch (err) {
      console.error("deleteMyAccount: auth.deleteUser failed", err);
      throw new HttpsError(
        "internal",
        "Your profile was removed but sign-in could not be finalized. Contact support if you can still log in.",
      );
    }

    return { success: true };
  },
);
