import { NextResponse } from "next/server";
// We import from your lib folder.
// If your '@' alias isn't set up for root, use the relative path: "../../../lib/firebase-admin"
import { adminAuth } from "@/lib/firebase-admin";

export async function GET() {
  try {
    // 1. List users directly from Firebase Auth (Bypassing Cloud Functions)
    const listUsersResult = await adminAuth.listUsers(1000);

    // 2. Clean up the data (send only what the frontend needs)
    const users = listUsersResult.users.map((user) => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      disabled: user.disabled,
      creationTime: user.metadata.creationTime,
      lastSignInTime: user.metadata.lastSignInTime,
    }));

    // 3. Return JSON response
    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500 }
    );
  }
}
