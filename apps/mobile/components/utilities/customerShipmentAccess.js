import { normalizePhoneNumber } from "./helpers";

function phoneVariants(value = "") {
  const normalized = normalizePhoneNumber(value).replace(/^\+/, "");
  const variants = new Set();

  if (normalized) variants.add(normalized);
  if (normalized.startsWith("63") && normalized.length === 12) {
    variants.add(`0${normalized.slice(2)}`);
  }

  return [...variants];
}

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function getCustomerPublicIds(customer = {}) {
  return [
    customer.publicId,
    customer.userCode,
    customer.customerCode,
    customer.userId,
  ]
    .filter(Boolean)
    .map(String);
}

export function customerOwnsShipment(shipment = {}, customer = {}) {
  if (!shipment || !customer?.uid) return false;

  const uid = String(customer.uid);
  const senderUid = shipment.sender?.uid ? String(shipment.sender.uid) : null;
  const recipientUid = shipment.recipient?.uid
    ? String(shipment.recipient.uid)
    : null;
  const createdBy = shipment.createdBy ? String(shipment.createdBy) : null;

  if (senderUid === uid || recipientUid === uid || createdBy === uid) {
    return true;
  }

  if (shipment.customerId && String(shipment.customerId) === uid) {
    return true;
  }

  const customerPhones = phoneVariants(
    customer.phoneNumber || customer.phone || "",
  );
  const senderPhone = normalizePhoneNumber(shipment.sender?.phone || "").replace(
    /^\+/,
    "",
  );
  const recipientPhone = normalizePhoneNumber(
    shipment.recipient?.phone || "",
  ).replace(/^\+/, "");

  if (
    customerPhones.length > 0 &&
    ((senderPhone && customerPhones.includes(senderPhone)) ||
      (recipientPhone && customerPhones.includes(recipientPhone)))
  ) {
    return true;
  }

  const customerEmail = normalizeEmail(customer.email);
  if (customerEmail) {
    const senderEmail = normalizeEmail(
      shipment.sender?.email || shipment.senderEmail,
    );
    const recipientEmail = normalizeEmail(
      shipment.recipient?.email || shipment.recipientEmail,
    );

    if (customerEmail === senderEmail || customerEmail === recipientEmail) {
      return true;
    }
  }

  const publicIds = getCustomerPublicIds(customer);
  const senderPublicId = shipment.sender?.userId
    ? String(shipment.sender.userId)
    : null;
  const recipientPublicId = shipment.recipient?.userId
    ? String(shipment.recipient.userId)
    : null;

  if (
    (senderPublicId && publicIds.includes(senderPublicId)) ||
    (recipientPublicId && publicIds.includes(recipientPublicId))
  ) {
    return true;
  }

  return false;
}

export function mapShipmentDoc(docSnap) {
  const data = docSnap.data();
  const updatedAt =
    data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || null;

  return {
    id: docSnap.id,
    ...data,
    trackingNumber: data.trackingNumber || data.shipmentId || docSnap.id,
    rawUpdatedAt: data.updatedAt || data.createdAt || null,
    updatedAt: updatedAt ? updatedAt.toLocaleDateString() : "Recently updated",
    sortTime: updatedAt ? updatedAt.getTime() : 0,
  };
}

export function sortShipments(items = []) {
  return [...items].sort((a, b) => b.sortTime - a.sortTime);
}
