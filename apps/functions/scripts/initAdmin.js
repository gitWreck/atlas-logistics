"use strict";

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separator = trimmed.indexOf("=");
    if (separator === -1) return;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function bootstrapScriptEnv() {
  const repoRoot = path.resolve(__dirname, "../../..");
  loadEnvFile(path.join(repoRoot, ".env.local"));
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
  loadEnvFile(path.join(repoRoot, "apps/functions/.env.local"));
}

function readDefaultProjectId() {
  bootstrapScriptEnv();

  const fromEnv =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;

  if (fromEnv) return String(fromEnv).trim();

  const firebasercPath = path.resolve(__dirname, "../../../.firebaserc");
  if (!fs.existsSync(firebasercPath)) return null;

  try {
    const config = JSON.parse(fs.readFileSync(firebasercPath, "utf8"));
    return config?.projects?.default || null;
  } catch {
    return null;
  }
}

function resolveCredential() {
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (rawKey) {
    const serviceAccount = JSON.parse(rawKey);
    return admin.credential.cert(serviceAccount);
  }

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath && fs.existsSync(keyPath)) {
    return admin.credential.cert(
      JSON.parse(fs.readFileSync(keyPath, "utf8")),
    );
  }

  return admin.credential.applicationDefault();
}

function initAdminApp() {
  if (admin.apps.length) return admin.app();

  const projectId = readDefaultProjectId();
  if (!projectId) {
    throw new Error(
      [
        "Firebase project ID not found.",
        "Set FIREBASE_PROJECT_ID=atlas-tracking, or run from the repo root where .firebaserc exists.",
        "For auth, set FIREBASE_SERVICE_ACCOUNT_KEY (same as web) or GOOGLE_APPLICATION_CREDENTIALS.",
      ].join(" "),
    );
  }

  admin.initializeApp({
    projectId,
    credential: resolveCredential(),
  });

  return admin.app();
}

async function resolveTripDocRef(db, tripIdOrDocId) {
  const normalized = String(tripIdOrDocId || "").trim();
  if (!normalized) return null;

  const directRef = db.collection("truck_trips").doc(normalized);
  const directSnap = await directRef.get();
  if (directSnap.exists) return directRef;

  const querySnap = await db
    .collection("truck_trips")
    .where("tripId", "==", normalized)
    .limit(1)
    .get();

  if (!querySnap.empty) {
    return querySnap.docs[0].ref;
  }

  return null;
}

module.exports = {
  initAdminApp,
  readDefaultProjectId,
  resolveTripDocRef,
};
