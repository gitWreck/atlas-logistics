import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { formatFirestoreDate } from "@/app/utility/utilities";

export const dynamic = "force-dynamic";

function normalizePhone(value = "") {
  const digits = String(value || "").replace(/[^\d]/g, "");

  if (digits.length === 11 && digits.startsWith("0")) {
    return `63${digits.slice(1)}`;
  }

  if (digits.length === 10 && digits.startsWith("9")) {
    return `63${digits}`;
  }

  return digits;
}

function phoneVariants(value = "") {
  const normalized = normalizePhone(value);
  const variants = new Set();

  if (normalized) variants.add(normalized);

  if (normalized.startsWith("63") && normalized.length === 12) {
    variants.add(`0${normalized.slice(2)}`);
  }

  return [...variants].slice(0, 10);
}

function chunk(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function serializeInvoice(doc) {
  const data = doc.data();

  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt ? formatFirestoreDate(data.createdAt) : null,
    updatedAt: data.updatedAt ? formatFirestoreDate(data.updatedAt) : null,
    invoiceDate: data.invoiceDate ? formatFirestoreDate(data.invoiceDate) : null,
    dueDate: data.dueDate ? formatFirestoreDate(data.dueDate) : null,
    amount: Number(data.amount || 0),
    status: data.status || "DRAFT",
  };
}

async function verifyStaffAccess() {
  const headersList = await headers();
  const token = headersList.get("authorization")?.split("Bearer ")[1];

  if (!token) {
    return { error: "Unauthorized", status: 401 };
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  const staffDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
  const staffData = staffDoc.data();
  const staffRole = staffData?.role?.toLowerCase();

  if (
    !staffData ||
    staffData.active === false ||
    !["admin", "manager", "checker"].includes(staffRole)
  ) {
    return { error: "Forbidden", status: 403 };
  }

  return { uid: decodedToken.uid };
}

async function getCustomerShipmentIds(customerId, customer, phones) {
  const queries = [
    adminDb
      .collection("shipments")
      .where("visibilityUserIds", "array-contains", customerId)
      .limit(100)
      .get(),
    adminDb
      .collection("shipments")
      .where("sender.uid", "==", customerId)
      .limit(100)
      .get(),
    adminDb
      .collection("shipments")
      .where("recipient.uid", "==", customerId)
      .limit(100)
      .get(),
  ];
  const publicIds = [
    customer.publicId,
    customer.userCode,
    customer.customerCode,
    customer.driverCode,
  ].filter(Boolean);

  publicIds.forEach((publicId) => {
    queries.push(
      adminDb
        .collection("shipments")
        .where("sender.userId", "==", publicId)
        .limit(100)
        .get(),
      adminDb
        .collection("shipments")
        .where("recipient.userId", "==", publicId)
        .limit(100)
        .get(),
    );
  });

  if (phones.length > 0) {
    queries.push(
      adminDb
        .collection("shipments")
        .where("sender.phone", "in", phones)
        .limit(100)
        .get(),
      adminDb
        .collection("shipments")
        .where("recipient.phone", "in", phones)
        .limit(100)
        .get(),
    );
  }

  const snapshots = await Promise.all(queries);
  const ids = new Set();

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((doc) => ids.add(doc.id));
  });

  return [...ids];
}

export async function GET(_request, { params }) {
  try {
    const authResult = await verifyStaffAccess();

    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }

    const { id } = await params;
    const customerId = decodeURIComponent(id || "");

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID required" },
        { status: 400 },
      );
    }

    const customerSnap = await adminDb.collection("users").doc(customerId).get();

    if (!customerSnap.exists) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    const customer = customerSnap.data() || {};
    const phones = phoneVariants(customer.phoneNumber);
    const shipmentIds = await getCustomerShipmentIds(customerId, customer, phones);
    const queries = [
      adminDb
        .collection("invoices")
        .where("shipmentSnapshot.sender.uid", "==", customerId)
        .limit(100)
        .get(),
      adminDb
        .collection("invoices")
        .where("shipmentSnapshot.recipient.uid", "==", customerId)
        .limit(100)
        .get(),
    ];

    if (phones.length > 0) {
      queries.push(
        adminDb
          .collection("invoices")
          .where("senderPhone", "in", phones)
          .limit(100)
          .get(),
        adminDb
          .collection("invoices")
          .where("recipientPhone", "in", phones)
          .limit(100)
          .get(),
      );
    }

    chunk(shipmentIds, 10).forEach((ids) => {
      queries.push(
        adminDb
          .collection("invoices")
          .where("shipmentId", "in", ids)
          .limit(100)
          .get(),
      );
    });

    const snapshots = await Promise.all(queries);
    const invoiceMap = new Map();

    snapshots.forEach((snapshot) => {
      snapshot.docs.forEach((doc) => {
        invoiceMap.set(doc.id, serializeInvoice(doc));
      });
    });

    const invoices = [...invoiceMap.values()].sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Customer invoices fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer invoices", details: error.message },
      { status: 500 },
    );
  }
}
