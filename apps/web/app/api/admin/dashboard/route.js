import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    // 1. Fetch all users from Firestore (Source of Truth for roles/status)
    const usersSnapshot = await adminDb
      .collection("users")
      .orderBy("createdAt", "desc")
      .get();

    const users = usersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Ensure serialized dates for JSON
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      lastAuthAt: doc.data().lastAuthAt?.toDate().toISOString() || null,
    }));

    // 2. Calculate Stats dynamically based on the fetched users
    const total = users.length;
    const active = users.filter((u) => u.status === "active").length;
    const inactive = users.filter(
      (u) => u.status === "suspended" || u.active === false,
    ).length;

    // 3. Fetch Audit Logs (For the Analytics Grid)
    // We query the last 24h of logs
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const auditSnapshot = await adminDb
      .collection("audit_logs")
      .where("timestamp", ">", yesterday)
      .count()
      .get();

    const totalAuditSnapshot = await adminDb
      .collection("audit_logs")
      .count()
      .get();

    return NextResponse.json({
      users: users,
      stats: {
        total,
        active,
        inactive,
        actions24h: auditSnapshot.data().count, // Real count from DB
        actionsTotal: totalAuditSnapshot.data().count,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
