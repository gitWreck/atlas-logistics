import React from "react";
import { render } from "@react-email/render";
import { ShipmentStatusEmail } from "../emails/_components/ShipmentStatusEmail.jsx";

function buildPlainText(props = {}) {
  const lines = [
    `Hi ${props.customerName || "Customer"},`,
    "",
    `Here's the latest update on your shipment.`,
    "",
    `Status: ${props.statusLabel || "Update"}`,
    `Shipment: ${props.shipmentId || ""}`,
  ];

  if (props.routeLabel) lines.push(`Route: ${props.routeLabel}`);
  if (props.originLabel) lines.push(`Origin: ${props.originLabel}`);
  if (props.destinationLabel) {
    lines.push(`Destination: ${props.destinationLabel}`);
  }
  if (props.lastUpdated) lines.push(`Last updated: ${props.lastUpdated}`);
  if (props.summaryHeadline) {
    lines.push("", props.summaryHeadline);
  }
  if (props.summarySubtext) lines.push(props.summarySubtext);

  if (!props.isMultiShipment && props.totalPackages > 0) {
    lines.push(
      "",
      `Delivered: ${props.deliveredCount || 0}`,
      `Out for delivery: ${props.outForDeliveryCount || 0}`,
      `Total packages: ${props.totalPackages || 0}`,
    );
  }

  if (Array.isArray(props.packages) && props.packages.length) {
    const perPage = 5;
    lines.push("", "Packages:");
    props.packages.slice(0, perPage).forEach((pkg) => {
      lines.push(
        `- ${pkg.description || "Package"} (${pkg.trackingNumber}) — ${pkg.statusLabel}`,
      );
    });
    if (props.packages.length > perPage) {
      lines.push(
        "",
        `View all ${props.packages.length} packages: ${props.trackingUrl || "https://atlastransport.ph/track"}`,
      );
    }
  }

  if (props.isMultiShipment && props.shipmentIds?.length) {
    lines.push("", `Tracking numbers: ${props.shipmentIds.join(", ")}`);
  }

  lines.push(
    "",
    `Track online: ${props.trackingUrl || "https://atlastransport.ph/track"}`,
    "",
    `Need help? ${props.supportEmail || "support@atlastransport.ph"}`,
    "",
    "Thank you for choosing Atlas Transportation.",
  );

  return lines.filter(Boolean).join("\n");
}

async function renderShipmentStatusEmail(props = {}) {
  const html = await render(React.createElement(ShipmentStatusEmail, props));
  const text = buildPlainText(props);
  const subject = props.subject
    ? props.subject
    : `Atlas Transportation: ${props.statusLabel || "Shipment update"}${props.shipmentId ? ` — ${props.shipmentId}` : ""}`;

  return { subject, html, text };
}

module.exports = {
  ShipmentStatusEmail,
  buildPlainText,
  renderShipmentStatusEmail,
};
