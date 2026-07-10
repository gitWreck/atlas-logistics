"use strict";

const fs = require("fs");
const path = require("path");

const ASSET_DIR = path.join(__dirname, "../../assets/email");

const EMAIL_ASSET_FILES = Object.freeze([
  { file: "atlas-logo.jpeg", cid: "atlas-email-logo" },
  { file: "mobile.png", cid: "atlas-email-mobile" },
  { file: "envelope-sm.png", cid: "atlas-email-envelope-sm" },
  { file: "headset.png", cid: "atlas-email-headset" },
  { file: "shield.png", cid: "atlas-email-shield" },
  { file: "envelope.png", cid: "atlas-email-envelope" },
  { file: "check-delivered.png", cid: "atlas-email-check-delivered" },
  { file: "truck-out.png", cid: "atlas-email-truck-out" },
  { file: "package-total.png", cid: "atlas-email-package-total" },
]);

function getEmailAssetAttachments() {
  return EMAIL_ASSET_FILES.map(({ file, cid }) => {
    const filePath = path.join(ASSET_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`[emailAssetAttachments] Missing asset: ${filePath}`);
      return null;
    }

    return {
      filename: file,
      path: filePath,
      cid,
    };
  }).filter(Boolean);
}

module.exports = {
  EMAIL_ASSET_FILES,
  getEmailAssetAttachments,
};
