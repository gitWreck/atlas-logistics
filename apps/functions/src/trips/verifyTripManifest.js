"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
// Import the SAME helpers used in generation to ensure Hash matches
const { stableStringify, sha256Hex } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.verifyTripManifest = onRequest(async (req, res) => {
  // Allow CORS if being called from client-side JS
  res.set("Access-Control-Allow-Origin", "*");

  try {
    const manifestId = String(
      req.query.manifestId || req.body?.manifestId || "",
    ).trim();

    if (!manifestId) {
      res.status(400).json({ ok: false, error: "Manifest ID is required" });
      return;
    }

    // 1. Load the Manifest Snapshot
    const mRef = db.collection("manifests").doc(manifestId);
    const mSnap = await mRef.get();

    if (!mSnap.exists) {
      res.status(404).json({ ok: false, error: "Manifest not found" });
      return;
    }

    const data = mSnap.data();

    // 2. Reconstruct the Payload exactly as it was in 'generateTripManifest'
    // We must manually pick the fields that were hashed.
    // If we hash the whole doc, it fails because the doc has 'hash' and 'createdAt' which weren't in the input.

    const payloadToHash = {
      manifestId: data.manifestId,
      tripDocId: data.tripDocId,
      // Status is NOT part of the hash usually, but if you included it in generation, include it here.
      // Based on previous code, we hashed the 'payload' object BEFORE adding 'hash' or 'createdAt'.

      // We need to match the structure from generateTripManifest Step 6:
      status: "LOCKED", // This was hardcoded in the payload in generation script

      trip: {
        tripCode: data.trip?.tripCode || null,
        truckPlate: data.trip?.truckPlate || null,
        driverName: data.trip?.driverName || null,
        // driverUid: data.trip?.driverUid || null, // Ensure this exists in data or handle undefined
        origin: data.trip?.origin || null,
        destination: data.trip?.destination || null,
        // route: data.trip?.route || null,
      },

      meta: {
        generatedAtMs: data.meta.generatedAtMs,
        generatedBy: data.meta.generatedBy,
        generatedByName: data.meta.generatedByName,
      },

      totals: {
        totalShipments: data.totals.totalShipments,
        totalItems: data.totals.totalItems,
      },

      // shipments: data.shipments, // This is the detailed array
      shipments: data.shipments.map((s) => ({
        trackingDocId: s.trackingDocId,
        trackingNumber: s.trackingNumber,
        route: s.route ?? null,
        senderName: s.senderName ?? null,
        receiverName: s.receiverName ?? null,
        totalCount: s.totalCount,
        loadedCount: s.loadedCount,
        contents: (s.contents || []).map((c) => ({
          desc: c.desc,
          weight: c.weight,
          type: c.type,
          value: c.value,
          isFragile: c.isFragile,
        })),
      })),
    };

    // 3. Recompute Hash
    const recomputedHash = sha256Hex(stableStringify(payloadToHash));
    const storedHash = data.hash; // The hash stored in the doc

    const isIntegrityValid = recomputedHash === storedHash;

    // 4. (Optional) Drift Detection
    // Check if the LIVE trip data still matches the SNAPSHOT
    let drift = { hasDrift: false, details: [] };

    if (data.tripDocId) {
      const tripRef = db.collection("truck_trips").doc(data.tripDocId);
      const tripShipRef = tripRef.collection("trip_shipments");
      const currentSnaps = await tripShipRef.get();

      const currentIds = new Set(currentSnaps.docs.map((d) => d.id));
      const manifestIds = new Set(data.shipments.map((s) => s.trackingDocId));

      // Check for Removed Items
      manifestIds.forEach((id) => {
        if (!currentIds.has(id))
          drift.details.push(
            `Shipment ${id} was removed from trip after manifest.`,
          );
      });

      // Check for Added Items
      currentIds.forEach((id) => {
        if (!manifestIds.has(id))
          drift.details.push(
            `Shipment ${id} was added to trip after manifest.`,
          );
      });

      if (drift.details.length > 0) drift.hasDrift = true;
    }

    res.json({
      ok: true,
      status: isIntegrityValid ? "VALID" : "TAMPERED",
      manifestId,
      storedHash,
      recomputedHash, // Useful for debugging why it failed
      timestamp: new Date().toISOString(),
      drift,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});
