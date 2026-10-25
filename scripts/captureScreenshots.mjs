import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SCREENSHOTS_DIR = path.resolve(process.cwd(), "screenshots");

function getBrowserExecutablePath() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

  if (fs.existsSync(chromePath)) return chromePath;
  if (fs.existsSync(edgePath)) return edgePath;

  throw new Error("Neither Google Chrome nor Microsoft Edge could be found on this system.");
}

const PUBLIC_ROUTES = [
  { name: "01_home", path: "/", waitMs: 4000 },
  { name: "02_login", path: "/login", waitMs: 3000 },
  { name: "03_privacy_policy", path: "/privacy-policy", waitMs: 3000 },
  { name: "04_account_deletion", path: "/account-deletion", waitMs: 3000 },
  { name: "05_mobile_privacy_policy", path: "/mobile/privacy-policy", waitMs: 3000 },
  { name: "06_tracking_sample", path: "/track/ATL-10001", waitMs: 5000 },
  { name: "07_verify_sample", path: "/verify/TRIP-001", waitMs: 5000 },
];

const ADMIN_ROUTES = [
  { name: "08_admin_dashboard", path: "/admin/dashboard", waitMs: 7000 },
  { name: "12_print_manifest", path: "/components/print/manifest?tripId=TRIP-001", waitMs: 6000 },
  { name: "13_print_delivery_manifest", path: "/components/print/delivery-manifest?tripId=TRIP-001", waitMs: 6000 },
  { name: "14_print_invoice", path: "/components/print/invoice?id=INV-2026-001", waitMs: 6000 },
  { name: "15_print_labels", path: "/components/print/labels?id=SHIP-MNL-1001", waitMs: 6000 },
  { name: "16_print_manifest_amendment", path: "/components/print/manifest-amendment?tripId=TRIP-001", waitMs: 6000 },
];

const MANAGER_ROUTES = [
  { name: "09_manager_dashboard", path: "/manager/dashboard", waitMs: 7000 },
];

const CHECKER_ROUTES = [
  { name: "10_checker_dashboard", path: "/checker/dashboard", waitMs: 7000 },
];

const DRIVER_ROUTES = [
  { name: "11_driver_dashboard", path: "/driver/dashboard", waitMs: 4000 },
];

async function captureRouteList(page, routes) {
  for (const route of routes) {
    const url = `${BASE_URL}${route.path}`;
    const filePath = path.join(SCREENSHOTS_DIR, `${route.name}.png`);
    console.log(`Navigating to: ${url}`);
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 35000 });
      // Extended settle delay so client-side React hooks, charts, and Firestore subscriptions populate
      await new Promise((resolve) => setTimeout(resolve, route.waitMs || 5000));
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`✓ Saved ${route.name}.png`);
    } catch (err) {
      console.error(`✗ Failed capturing ${route.name}:`, err.message);
    }
  }
}

async function runAuthenticatedGroup(browser, email, password, routes) {
  // Use isolated incognito context so Firebase Auth state does not conflict between roles
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on("dialog", async (d) => {
    try {
      await d.dismiss();
    } catch {}
  });

  console.log(`\n--- Logging in as ${email} ---`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2", timeout: 35000 });
  await page.waitForSelector('input[type="email"], input[name="email"], input#email', { timeout: 15000 });

  const emailInput = await page.$('input[type="email"], input[name="email"], input#email');
  await emailInput.click({ clickCount: 3 });
  await emailInput.type(email, { delay: 25 });

  const passwordInput = await page.$('input[type="password"], input[name="password"], input#password');
  await passwordInput.click({ clickCount: 3 });
  await passwordInput.type(password, { delay: 25 });

  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
  } else {
    await page.keyboard.press("Enter");
  }

  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 4000));
  console.log(`✓ Authenticated as ${email}. Landed on: ${page.url()}`);

  await captureRouteList(page, routes);
  await context.close();
}

async function capture() {
  const executablePath = getBrowserExecutablePath();
  console.log(`Using browser executable: ${executablePath}`);

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1440,900",
    ],
  });

  console.log("\n=================================");
  console.log("   CAPTURING PUBLIC ROUTES       ");
  console.log("=================================");
  const publicContext = await browser.createBrowserContext();
  const publicPage = await publicContext.newPage();
  publicPage.on("dialog", async (d) => {
    try {
      await d.dismiss();
    } catch {}
  });
  await captureRouteList(publicPage, PUBLIC_ROUTES);
  await publicContext.close();

  console.log("\n=================================");
  console.log("   CAPTURING ADMIN & PRINT ROUTES ");
  console.log("=================================");
  await runAuthenticatedGroup(browser, "admin@atlas.local", "Password123!", ADMIN_ROUTES);

  console.log("\n=================================");
  console.log("   CAPTURING MANAGER ROUTES      ");
  console.log("=================================");
  await runAuthenticatedGroup(browser, "manager@atlas.local", "Password123!", MANAGER_ROUTES);

  console.log("\n=================================");
  console.log("   CAPTURING CHECKER ROUTES      ");
  console.log("=================================");
  await runAuthenticatedGroup(browser, "checker@atlas.local", "Password123!", CHECKER_ROUTES);

  console.log("\n=================================");
  console.log("   CAPTURING DRIVER ROUTES       ");
  console.log("=================================");
  await runAuthenticatedGroup(browser, "driver@atlas.local", "Password123!", DRIVER_ROUTES);

  await browser.close();
  console.log("\nAll screenshot tasks completed successfully!");
}

capture().catch((err) => {
  console.error("Fatal screenshot error:", err);
  process.exit(1);
});
