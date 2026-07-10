const DEFAULT_ICON_BASE = "https://atlastransport.ph/email";

const EMBEDDED_ICON_URLS = {
  banner: "cid:atlas-email-banner",
  mobile: "cid:atlas-email-mobile",
  envelopeSm: "cid:atlas-email-envelope-sm",
  headset: "cid:atlas-email-headset",
  shield: "cid:atlas-email-shield",
  envelope: "cid:atlas-email-envelope",
  checkDelivered: "cid:atlas-email-check-delivered",
  truckOut: "cid:atlas-email-truck-out",
  packageTotal: "cid:atlas-email-package-total",
};

function getIconUrls(iconBaseUrl = DEFAULT_ICON_BASE, options = {}) {
  const embedded = options.embedded === true;
  if (embedded) {
    return { ...EMBEDDED_ICON_URLS };
  }

  const base = String(iconBaseUrl || DEFAULT_ICON_BASE).replace(/\/$/, "");
  return {
    banner: `${base}/atlas-banner.jpeg`,
    mobile: `${base}/mobile.png`,
    envelopeSm: `${base}/envelope-sm.png`,
    headset: `${base}/headset.png`,
    shield: `${base}/shield.png`,
    envelope: `${base}/envelope.png`,
    checkDelivered: `${base}/check-delivered.png`,
    truckOut: `${base}/truck-out.png`,
    packageTotal: `${base}/package-total.png`,
  };
}

module.exports = { DEFAULT_ICON_BASE, EMBEDDED_ICON_URLS, getIconUrls };
