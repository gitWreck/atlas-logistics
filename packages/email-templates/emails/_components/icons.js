const DEFAULT_ICON_BASE = "https://atlas-tracking.web.app/email";

function getIconUrls(iconBaseUrl = DEFAULT_ICON_BASE) {
  const base = String(iconBaseUrl || DEFAULT_ICON_BASE).replace(/\/$/, "");
  return {
    mobile: `${base}/mobile.png`,
    envelopeSm: `${base}/envelope-sm.png`,
    headset: `${base}/headset.png`,
    shield: `${base}/shield.png`,
    envelope: `${base}/envelope.png`,
  };
}

module.exports = { DEFAULT_ICON_BASE, getIconUrls };
