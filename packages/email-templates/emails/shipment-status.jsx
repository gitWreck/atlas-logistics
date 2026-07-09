import React from "react";
import { ShipmentStatusEmail } from "./_components/ShipmentStatusEmail.jsx";

const previewPackages = Array.from({ length: 12 }, (_, index) => ({
  index: index + 1,
  description:
    index % 2 === 0 ? "hardware supplies" : "sackoline / lenoleum / tarp",
  packagingType: index % 3 === 0 ? "Sack" : "Box",
  quantity: 1,
  trackingNumber: `AT-20260628-PKG-${String(index + 1).padStart(3, "0")}`,
  statusLabel: index < 10 ? "Delivered" : "Out for Delivery",
  statusCode: index < 10 ? "DELIVERED" : "OUT_FOR_DELIVERY",
  lastUpdated: "Jun 28, 6:45 AM",
}));

export default ShipmentStatusEmail;

ShipmentStatusEmail.PreviewProps = {
  customerName: "Maria",
  statusLabel: "Partially Delivered",
  statusCode: "PARTIALLY_DELIVERED",
  shipmentId: "AT-20260628-SHP-792867",
  routeLabel: "Divisoria, Manila → Odiongan, Romblon",
  originLabel: "Divisoria Warehouse",
  destinationLabel: "Odiongan Warehouse",
  lastUpdated: "Jun 28, 2026, 7:11 AM GMT+8",
  summaryHeadline: "17 of 18 packages delivered",
  summarySubtext: "Your remaining package is out for delivery.",
  deliveredCount: 17,
  outForDeliveryCount: 1,
  totalPackages: 18,
  trackingUrl: "https://atlastransport.ph/track/AT-20260628-SHP-792867",
  packages: previewPackages,
};
