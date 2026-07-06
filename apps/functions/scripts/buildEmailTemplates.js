"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const functionsDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(functionsDir, "../..");
const emailTemplatesDir = path.join(repoRoot, "packages", "email-templates");
const vendorDir = path.join(functionsDir, "vendor");
const vendorFile = path.join(vendorDir, "email-templates.js");
const builtFile = path.join(emailTemplatesDir, "dist", "index.js");

if (!fs.existsSync(emailTemplatesDir)) {
  console.error(
    `[buildEmailTemplates] Missing package at ${emailTemplatesDir}`,
  );
  process.exit(1);
}

console.log("[buildEmailTemplates] Building @atlas/email-templates...");
execSync("npm run build", {
  cwd: emailTemplatesDir,
  stdio: "inherit",
});

if (!fs.existsSync(builtFile)) {
  console.error(`[buildEmailTemplates] Build output not found: ${builtFile}`);
  process.exit(1);
}

fs.mkdirSync(vendorDir, { recursive: true });
fs.copyFileSync(builtFile, vendorFile);
console.log(`[buildEmailTemplates] Copied bundle to ${vendorFile}`);
