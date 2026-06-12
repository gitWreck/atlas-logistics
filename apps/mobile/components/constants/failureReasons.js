export const CHECKER_FAILURE_REASONS = [
  {
    code: "CUSTOMER_UNAVAILABLE",
    label: "Customer Unavailable",
  },
  {
    code: "REFUSED_SHIPMENT",
    label: "Refused Shipment",
  },
  {
    code: "INCORRECT_ADDRESS",
    label: "Incorrect Address",
  },
  {
    code: "UNABLE_TO_LOCATE_CUSTOMER",
    label: "Unable to Locate Customer",
  },
  {
    code: "CUSTOMER_REQUESTED_RESCHEDULE",
    label: "Customer Requested Reschedule",
  },
  {
    code: "BUSINESS_CLOSED",
    label: "Business Closed",
  },
  {
    code: "OTHER",
    label: "Other",
  },
];

export function getFailureReasonLabel(code = "") {
  const normalized = String(code || "").trim().toUpperCase();
  const match = CHECKER_FAILURE_REASONS.find(
    (row) => row.code === normalized,
  );
  return match?.label || normalized.replace(/_/g, " ") || "Other";
}
