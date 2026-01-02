"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

/* ======================================================
   HELPERS
====================================================== */

function requireAuth(req) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Login required");
  return req.auth.uid;
}

async function requireAdminOrManager(tx, uid) {
  const snap = await tx.get(db.collection("users").doc(uid));
  if (!snap.exists || snap.data().active !== true) {
    throw new HttpsError("permission-denied", "Inactive or missing user");
  }
  const role = String(snap.data().role || "").toLowerCase();
  if (!["admin", "manager"].includes(role)) {
    throw new HttpsError("permission-denied", "Admin or Manager only");
  }
  return { role, name: snap.data().name || "" };
}

/* ======================================================
   generateTripCertificate
====================================================== */
exports.generateTripCertificate = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    const uid = requireAuth(req);
    const tripDocId = String(req.data?.tripDocId || "").trim();
    if (!tripDocId) throw new HttpsError("invalid-argument", "tripDocId required");

    const tripRef = db.collection("truck_trips").doc(tripDocId);
    const pkgsRef = tripRef.collection("trip_packages");

    // 🔐 Load + verify everything in one transaction
    const result = await db.runTransaction(async (tx) => {
      const user = await requireAdminOrManager(tx, uid);

      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");

      const trip = tripSnap.data();
      if (trip.active !== false || !trip.completedAt) {
        throw new HttpsError("failed-precondition", "Trip not completed");
      }

      const pkgsSnap = await tx.get(pkgsRef);
      if (pkgsSnap.empty) {
        throw new HttpsError("failed-precondition", "No packages in trip");
      }

      const rows = [];
      let total = 0;
      let delivered = 0;

      pkgsSnap.forEach((doc) => {
        const p = doc.data();

        if (typeof p.pendingCount !== "number") {
          throw new HttpsError("failed-precondition", "Missing pendingCount", {
            packageId: doc.id,
          });
        }
        if (p.pendingCount > 0) {
          throw new HttpsError("failed-precondition", "Pending items exist", {
            packageId: doc.id,
            pendingCount: p.pendingCount,
          });
        }
        if (!p.deliveredAt) {
          throw new HttpsError("failed-precondition", "Package not delivered", {
            packageId: doc.id,
          });
        }

        const count = Number(p.packageCount || 0);
        const del = Number(p.deliveredCount || 0);

        total += count;
        delivered += del;

        rows.push({
          id: doc.id,
          tracking: p.trackingNumber || "",
          count,
          delivered: del,
        });
      });

      // 🔑 Hash of all packages
      const hash = crypto
        .createHash("sha256")
        .update(JSON.stringify(rows))
        .digest("hex");

      return { trip, rows, total, delivered, hash, user };
    });

    // ==================================================
    // 🧾 Build PDF
    // ==================================================
    const doc = new PDFDocument({ margin: 40 });
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {});

    doc.fontSize(18).text("ATLAS – Trip Closure Certificate", { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text(`Trip ID: ${tripDocId}`);
    doc.text(`Route: ${result.trip.route || ""}`);
    doc.text(`Driver: ${result.trip.driverName || ""}`);
    doc.text(`Completed At: ${result.trip.completedAt.toDate().toISOString()}`);
    doc.text(`Verified By: ${result.user.name}`);
    doc.moveDown();

    doc.text("Packages:");
    result.rows.forEach((r) => {
      doc.text(`• ${r.tracking}  |  ${r.delivered}/${r.count}`);
    });

    doc.moveDown();
    doc.text(`Total Delivered: ${result.delivered} / ${result.total}`);
    doc.moveDown();
    doc.text(`Black-Box Hash: ${result.hash}`, { width: 500 });

    doc.end();

    const pdfBuffer = Buffer.concat(buffers);

    // ==================================================
    // ☁️ Upload to Storage
    // ==================================================
    const file = bucket.file(`trip_certificates/${tripDocId}.pdf`);
    await file.save(pdfBuffer, { contentType: "application/pdf" });

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
    });

    return { success: true, url, hash: result.hash };
  }
);
