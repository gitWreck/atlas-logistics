import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { headers } from "next/headers";
import { adminDb } from "@/lib/firebase-admin";
import {
  DEFAULT_OPERATIONAL_SETTINGS,
  normalizeOperationalSettings,
} from "@/app/utility/settingsDefaults";

export const dynamic = "force-dynamic";

const SETTINGS_COLLECTION = "app_settings";
const SETTINGS_DOC = "operational";

async function assertAdmin() {
  const headersList = await headers();
  const token = headersList.get("authorization")?.split("Bearer ")[1];

  if (!token) {
    return { error: "Unauthorized", status: 401 };
  }

  const decodedToken = await getAuth().verifyIdToken(token);
  const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
  const role = userDoc.data()?.role?.toLowerCase();

  if (role !== "admin") {
    return { error: "Forbidden: Admin access only", status: 403 };
  }

  return { uid: decodedToken.uid };
}

async function getSettingsRef() {
  return adminDb.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC);
}

export async function GET() {
  try {
    const ref = await getSettingsRef();
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({
        settings: DEFAULT_OPERATIONAL_SETTINGS,
        source: "defaults",
      });
    }

    return NextResponse.json({
      settings: normalizeOperationalSettings(snap.data()),
      source: "firestore",
      updatedAt: snap.data().updatedAt?.toDate?.().toISOString?.() || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load app settings", details: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  try {
    const admin = await assertAdmin();

    if (admin.error) {
      return NextResponse.json(
        { error: admin.error },
        { status: admin.status },
      );
    }

    const body = await request.json();
    const settings = normalizeOperationalSettings(body.settings || body);
    const ref = await getSettingsRef();

    await ref.set(
      {
        ...settings,
        updatedAt: new Date(),
        updatedBy: admin.uid,
      },
      { merge: true },
    );

    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save app settings", details: error.message },
      { status: 500 },
    );
  }
}
