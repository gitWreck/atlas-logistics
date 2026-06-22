"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  stableStringify,
  sha256Hex,
} = require("../utilities/helpers");
const { buildAmendmentPayload } = require("./manifestAmendment");

const cors = require("cors")({ origin: true });

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.verifyManifestAmendment = onRequest(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        const amendmentId =
          req.body?.amendmentId || req.query?.amendmentId || null;

        if (!amendmentId) {
          res.status(400).json({
            ok: false,
            error: "Amendment ID required",
          });
          return;
        }

        const amendmentRef = db.collection("manifest_amendments").doc(amendmentId);
        const amendmentSnap = await amendmentRef.get();

        if (!amendmentSnap.exists) {
          res.status(404).json({ ok: false, error: "Amendment not found" });
          return;
        }

        const data = amendmentSnap.data() || {};
        const payloadToHash = buildAmendmentPayload({
          amendmentId: data.amendmentId,
          version: data.version,
          versionSequence: data.versionSequence,
          trip: {
            tripId: data.originalTripId,
            manifestId: data.originalManifestId,
            manifestHash: data.originalManifestHash,
            manifestVersion: data.baseVersion,
          },
          tripDocId: data.tripDocId,
          reason: data.reason,
          entries: data.entries || [],
          actorId: data.meta?.sealedBy || null,
          actorName: data.meta?.sealedByName || null,
        });

        const recomputedHash = sha256Hex(stableStringify(payloadToHash));
        const storedHash = data.hash;
        const isIntegrityValid = recomputedHash === storedHash;

        res.json({
          ok: true,
          status: isIntegrityValid ? "VALID" : "TAMPERED",
          amendmentId,
          version: data.version || null,
          originalTripId: data.originalTripId || null,
          originalManifestId: data.originalManifestId || null,
          originalManifestHash: data.originalManifestHash || null,
          baseVersion: data.baseVersion || null,
          storedHash,
          recomputedHash,
          entryCount: Array.isArray(data.entries) ? data.entries.length : 0,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: err.message });
      }
    });
  },
);
