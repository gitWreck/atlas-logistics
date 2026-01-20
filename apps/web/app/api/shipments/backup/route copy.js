import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/apps/web/lib/firebase-admin";
import { headers } from "next/headers";

export async function GET() {
  try {
    // 1. GET THE TOKEN
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];
    // console.log("token: ", token);

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized", token: token },
        { status: 401 },
      );
    }

    // 2. VERIFY THE USER
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // 3. CHECK ROLE (Optional but Recommended)
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();
    console.log("userdata:", userData);

    // If not staff, block them
    if (
      !userData ||
      !["admin", "manager", "driver", "checker"].includes(
        userData.role?.toLowerCase(),
      )
    ) {
      return NextResponse.json(
        { error: "Forbidden: Staff Access Only" },
        { status: 403 },
      );
    }

    // 4. NOW IT IS SAFE TO FETCH SHIPMENTS
    const snapshot = await adminDb
      .collection("shipments")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    // 3. Transform the Data
    const shipments = snapshot.docs.map((doc) => {
      const data = doc.data();

      // Safe math for progress
      const total = data.totals?.totalItems || 1;
      const delivered = data.totals?.delivered || 0;
      const percent = Math.round((delivered / total) * 100);

      // Handle Dates
      // Firestore returns a "Timestamp" object. We must convert to String/Null.
      const createdAt = data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : null;
      const updatedAt = data.updatedAt?.toDate
        ? data.updatedAt.toDate().toISOString()
        : null;
      // const delayStartedAt = data.delayStartedAt?.toDate
      //   ? data.delayStartedAt.toDate().toISOString()
      //   : null;

      // Determine "Last Update" logic
      let lastUpdateIso = updatedAt || delayStartedAt || createdAt;

      return {
        id: doc.id,
        ...data,
        // Override timestamps with strings (JSON safe)
        createdAt: createdAt,
        updatedAt: updatedAt,

        // Calculated Fields
        route:
          data.origin && data.destination
            ? `${data.origin.substring(0, 3)} → ${data.destination.substring(
                0,
                3,
              )}`
            : "—",
        progressPercent: percent,
        lastUpdateRaw: lastUpdateIso,
      };
    });

    return NextResponse.json({ shipments });
  } catch (error) {
    console.error("API Error fetching shipments:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipments", details: error.message },
      { status: 500 },
    );
  }
}
