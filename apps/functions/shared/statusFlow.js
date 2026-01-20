"use strict";

/**
 * Canonical shipment status flow
 * index MUST be sequential
 */
exports.STATUS_FLOW = [
  "Created",              // 0
  "Received",             // 1
  "Loaded",               // 2
  "In Transit",           // 3
  "Arrived at Port",      // 4
  "Out for Delivery",     // 5
  "Delivered"             // 6 (terminal)
];

/**
 * Roles allowed to advance each step
 */
exports.STATUS_ROLE_GUARD = {
  Created: ["admin", "manager"],
  Received: ["admin", "manager"],
  Loaded: ["admin", "manager"],
  "In Transit": ["admin", "manager", "driver"],
  "Arrived at Port": ["admin", "manager", "driver"],
  "Out for Delivery": ["admin", "manager", "driver"],
  Delivered: ["admin", "manager", "checker"]
};
