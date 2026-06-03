"use strict";

const { phoneVariants } = require("./phoneHelpers");

function getPublicUserId(user = {}, fallback = null) {
  return (
    user?.userId ||
    user?.publicId ||
    user?.userCode ||
    user?.driverCode ||
    fallback ||
    null
  );
}

async function findCustomerByPhone(db, phone) {
  const variants = phoneVariants(phone);
  if (!variants.length) return null;

  const snap = await db
    .collection("users")
    .where("phoneNumber", "in", variants)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const userDoc = snap.docs[0];
  const data = userDoc.data() || {};
  if (data.role && data.role !== "customer") return null;

  return { uid: userDoc.id, ...data };
}

module.exports = {
  findCustomerByPhone,
  getPublicUserId,
};
