import { NextResponse } from "next/server";
import adminDb from "firebase-admin";

// Ensure Admin SDK is initialized
if (!adminDb.apps.length) {
  adminDb.initializeApp();
}

export async function GET(request) {
  try {
    // 1. Get 'shipmentId' from the URL query params
    const { searchParams } = new URL(request.url);
    const shipmentId = searchParams.get("shipmentId");

    if (!shipmentId) {
      return NextResponse.json(
        { error: "Missing shipmentId parameter" },
        { status: 400 }
      );
    }

    // 2. Query Firestore (Server-Side)
    const snapshot = await adminDb
      .firestore()
      .collection("shipments")
      .doc(shipmentId)
      .collection("packages")
      // .where("shipmentId", "==", shipmentId)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ packages: [] });
    }

    // 3. Map and Sort Data
    const pkgList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort manually to match your original logic (avoids composite index requirements)
    pkgList.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    // 4. Return JSON
    return NextResponse.json({ packages: pkgList });
  } catch (error) {
    console.error("API Error fetching packages:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
