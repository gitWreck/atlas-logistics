export function getCustomerPhone(record) {
  return record?.customerPhoneNumber || null;
}

export function getDisplayStatus(record) {
  if (record.delayReason && !record.delayCleared) {
    return "Delayed";
  }
  return record.status;
}
