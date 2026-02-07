"use strict";

/**
 * ======================================================
 * generateTripManifest.js (Refactored)
 * ======================================================
 * ✅ Generates a trip-level manifest (Bill of Lading snapshot)
 * ✅ Allows partial shipments (Does NOT block if pending > 0)
 * ✅ Fetches ROOT shipment docs to capture specific package details
 * ✅ Writes:
 * - manifests/{manifestId}
 * - truck_trips/{tripDocId}.manifestLocked = true
 * - truck_trips/{tripDocId}/manifest_events/{eventId}
 * - admin_logs
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  requireRole,
  requireString,
  stableStringify,
  sha256Hex,
} = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.generateTripManifest = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. Role Guard
    await requireRole(db, req, ["admin", "manager"]);

    const tripDocId = requireString(req.data?.tripDocId, "tripDocId");
    const uid = req.auth.uid;

    // Get User Name for logs
    const userSnap = await db.collection("users").doc(uid).get();
    const user = userSnap.exists ? userSnap.data() : {};
    const generatedByName =
      String(user.name || user.fullName || user.displayName || "").trim() ||
      "Unknown User";

    const tripRef = db.collection("truck_trips").doc(tripDocId);
    const tripShipmentsRef = tripRef.collection("trip_shipments");

    return db.runTransaction(async (tx) => {
      // 2. Read Trip Data
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");

      const trip = tripSnap.data() || {};

      // Guard: Trip Status
      const tripClosed =
        trip.active === false ||
        String(trip.status || "").toUpperCase() === "COMPLETED" ||
        !!trip.completedAt;

      if (tripClosed) {
        throw new HttpsError("failed-precondition", "Trip already closed");
      }

      // Guard: Already Locked
      if (trip.manifestLocked === true && trip.manifestId) {
        return {
          ok: true,
          alreadyLocked: true,
          tripDocId,
          manifestId: trip.manifestId,
        };
      }

      // 3. Read Summary Sub-Collection (trip_shipments)
      const shipSnap = await tx.get(tripShipmentsRef);
      if (shipSnap.empty) {
        throw new HttpsError(
          "failed-precondition",
          "Trip has no shipments. Nothing to manifest.",
        );
      }

      // 4. Fetch ROOT Shipment Docs (Deep Fetch for Package Details)
      // We need this because trip_shipments usually doesn't have the 'packages' array
      const rootShipmentRefs = [];
      shipSnap.forEach((doc) => {
        rootShipmentRefs.push(db.collection("shipments").doc(doc.id));
      });

      // tx.getAll requires at least one ref, but shipSnap check handles that
      const rootShipments = await tx.getAll(...rootShipmentRefs);
      const rootMap = new Map(rootShipments.map((d) => [d.id, d.data()]));

      // 5. Build Ledger
      const items = [];
      const blockers = [];

      let totalShipments = 0;
      let totalItems = 0; // Total boxes/units across all shipments

      shipSnap.forEach((doc) => {
        const summary = doc.data() || {};
        const fullData = rootMap.get(doc.id) || {};
        const packages = fullData.packages || [];

        totalShipments += 1;

        const trackingDocId = doc.id;
        const trackingNumber =
          summary.trackingNumber || fullData.trackingNumber;

        // Counters
        const loadedCount = Number(summary.loadedCount || 0);
        // We use fullData.totals.totalItems if available, fallback to summary
        const shipmentTotalItems = Number(
          fullData.totals?.totalItems || summary.totalItems || 0,
        );

        // --- VALIDATION LOGIC ---
        // (Removed strict pending check to allow partial shipments)

        // Sanity Check: If loadedCount is 0, warn but allow?
        // Let's assume a manifest only cares about what IS loaded.
        if (loadedCount === 0) {
          // You might want to skip shipments that have 0 loaded items
          // return;
        }

        totalItems += loadedCount; // Manifest only counts what is ON the truck

        // Filter packages: Only include those marked as LOADED (or OUT_FOR_DELIVERY)
        // This ensures the manifest accurately reflects physical cargo.
        const manifestedPackages = packages.filter((p) =>
          ["LOADED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(p.status),
        );

        items.push({
          trackingDocId,
          trackingNumber,
          route: summary.route || fullData.destinationCode || null,
          senderName: fullData.sender?.name || null,
          receiverName: fullData.recipient?.name || null,

          // Stats for this shipment
          totalCount: shipmentTotalItems,
          loadedCount: loadedCount,

          // The actual list of items on the truck
          contents: manifestedPackages.map((p) => ({
            desc: p.description,
            weight: p.weight,
            type: p.packagingType,
            value: p.declaredValue,
            isFragile: p.isFragile,
          })),
        });
      });

      // Guard: Prevent empty manifest (0 loaded items)
      if (totalItems === 0) {
        throw new HttpsError(
          "failed-precondition",
          "Cannot lock manifest: No items are loaded on the truck.",
        );
      }

      if (blockers.length) {
        throw new HttpsError("failed-precondition", "Manifest Blocked", {
          reason: "VALIDATION_FAILED",
          blockers,
        });
      }

      // 6. Construct Payload
      const nowTs = admin.firestore.FieldValue.serverTimestamp();
      // We generate a discrete timestamp string for the hash input
      const generatedAtISO = new Date().toISOString();

      const manifestId = `MANIFEST-${tripDocId}-${Date.now()}`;

      const payload = {
        manifestId,
        tripDocId,
        status: "LOCKED",

        trip: {
          tripCode: trip.tripId || null,
          truckPlate: trip.truckPlateNumber || null,
          driverName: trip.driverName || null,
          origin: trip.origin || null,
          destination: trip.destination || null,
        },

        meta: {
          generatedAt: generatedAtISO,
          generatedBy: uid,
          generatedByName,
        },

        totals: {
          totalShipments, // Replaced totalPackages to avoid confusion
          totalItems, // Total boxes on board
        },

        shipments: items, // The detailed ledger
      };

      // Create Hash for Integrity Check
      const hash = sha256Hex(stableStringify(payload));

      // 7. Write Operations
      const manifestRef = db.collection("manifests").doc(manifestId);
      const manifestEventRef = tripRef.collection("manifest_events").doc();
      const adminLogRef = db.collection("audit_logs").doc(); // Using your audit_log collection

      // A. Write Manifest
      tx.set(manifestRef, {
        ...payload,
        hash,
        createdAt: nowTs,
        pdfUrl: null,
      });

      // B. Lock Trip
      tx.update(tripRef, {
        manifestLocked: true,
        manifestId,
        manifestHash: hash,
        manifestGeneratedAt: nowTs,
        manifestGeneratedBy: uid,
        updatedAt: nowTs,
      });

      // C. Trip Event Log
      tx.set(manifestEventRef, {
        type: "MANIFEST_LOCKED",
        manifestId,
        hash,
        createdAt: nowTs,
        createdBy: uid,
      });

      // D. Global Audit Log
      tx.set(adminLogRef, {
        action: "GENERATE_TRIP_MANIFEST",
        targetId: tripDocId,
        targetCollection: "truck_trips",
        at: nowTs,
        by: uid,
        note: `Manifest generated with ${totalShipments} shipments (${totalItems} items).`,
        details: {
          manifestId,
          hash,
          totalShipments,
          totalItems,
        },
      });

      return {
        ok: true,
        tripDocId,
        manifestId,
        generatedAt: generatedAtISO,
        hash,
      };
    });
  },
);
