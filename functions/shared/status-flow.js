"use strict";

/**
 * CANONICAL STATUS FLOW (BACKEND)
 * Order MUST NEVER change
 */
const STATUS_FLOW = Object.freeze([
  "Received",
  "Loaded",
  "In Transit",
  "Arrived at Port",
  "Boarded RORO Vessel",
  "Out for Delivery",
  "Delivered"
]);

function isValidStatus(status) {
  return STATUS_FLOW.includes(status);
}

module.exports = {
  STATUS_FLOW,
  isValidStatus
};
