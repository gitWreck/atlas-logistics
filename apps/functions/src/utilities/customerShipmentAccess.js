"use strict";

const { normalizePhone, phoneVariants } = require("./phoneHelpers");

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

function customerOwnsShipment(shipment = {}, customer = {}) {
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
  const senderPhone = normalizePhone(shipment.sender?.phone);
  const recipientPhone = normalizePhone(shipment.recipient?.phone);

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

function getShipmentOwnerUserIds(shipment = {}) {
  return [
    shipment.sender?.uid,
    shipment.recipient?.uid,
    shipment.createdBy,
    shipment.customerId,
  ]
    .filter(Boolean)
    .map(String);
}

module.exports = {
  customerOwnsShipment,
  getCustomerPublicIds,
  getShipmentOwnerUserIds,
};
