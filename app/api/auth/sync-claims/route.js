import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin"; // Use your existing lib

export async function POST(request) {
  try {
    // 1. Get the user's ID token from the request header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];

    // 2. Verify who is calling (Security Check)
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // 3. Check Firestore: Is this user ACTUALLY an admin?
    // We do not trust the frontend. We check the database directly.
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();

    if (userData?.role === "admin") {
      // 4. THE CODE YOU WANTED TO ADD:
      await adminAuth.setCustomUserClaims(uid, { admin: true });
      return NextResponse.json({ message: "Admin claim set successfully" });
    } else {
      // If they aren't an admin in DB, remove the claim (security best practice)
      await adminAuth.setCustomUserClaims(uid, { admin: false });
      return NextResponse.json({ message: "User is not an admin" });
    }
  } catch (error) {
    console.error("Sync Claims Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
