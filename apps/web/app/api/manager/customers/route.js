import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

function serializeTimestamp(value) {
  if (!value?.toDate) return value || null;
  return value.toDate().toISOString();
}

export async function GET() {
  try {
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const staffDoc = await adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();
    const staffData = staffDoc.data();
    const staffRole = staffData?.role?.toLowerCase();

    if (
      !staffData ||
      staffData.active !== true ||
      !["admin", "manager"].includes(staffRole)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snapshot = await adminDb
      .collection("users")
      .where("role", "==", "customer")
      .get();

    const users = snapshot.docs
      .map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          uid: doc.id,
          ...data,
          role: "customer",
          status:
            data.status || (data.active === false ? "suspended" : "active"),
          createdAt: serializeTimestamp(data.createdAt),
          lastAuthAt: serializeTimestamp(data.lastAuthAt),
          updatedAt: serializeTimestamp(data.updatedAt),
        };
      })
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Manager customers fetch error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
