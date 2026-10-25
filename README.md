# Atlas Trucking Platform

Comprehensive, multi-role logistics and freight management platform developed for **Atlas Transport Corporation** (Philippines). The platform handles multi-hub inter-island transport operations (e.g. Manila, Cebu, Davao, Odiongan), real-time cargo tracking, cryptographic chain-of-custody verification, warehouse barcode scanning, driver dispatch, and automated billing.

---

## 📅 Project Timeline & Repository Dates

| Event | Date & Time | Commit Hash | Details |
|---|---|---|---|
| **Project Creation / Initial Commit** | **December 15, 2025, 10:17:44 AM GMT+8** | [`a6b9803`](https://github.com/AtlasTransport/atlas-trucking-platform/commit/a6b9803d6d9880b63f561338dac3e35639558342) | *"Initial Atlas Tracking system (roles, rules, UI, functions)"* by JayVictoriano (`atlastransportopc@gmail.com`) |
| **GitHub Repository Initial Push** | **January 3, 2026, 01:14:33 AM GMT+8** | [`1c3f07c`](https://github.com/AtlasTransport/atlas-trucking-platform/commit/1c3f07cfc9f217aa4125803d294c18c69df75e11) | Initial GitHub repository setup by `jatlas0815` |
| **Latest Recorded Push / Commit** | **September 26, 2026, 01:09:02 PM GMT+8** | [`41ec93f`](https://github.com/AtlasTransport/atlas-trucking-platform/commit/41ec93fd88db6dc86bd8f223137a8b6e1862b42e) | *"Fix checker delivery confirmation flow"* on branch `main` |
| **Total Git Commits** | **1,222 commits** | — | Active multi-stage monorepo evolution |

---

## 🏗️ Architecture & Monorepo Structure

This project is organized as an **npm / Turborepo** monorepo:

```
atlas-trucking-platform/
├── apps/
│   ├── web/                     # Next.js 16 Web Application (Admin, Manager, Checker consoles, Public Tracking)
│   ├── mobile/                  # React Native / Expo 53 Mobile Application (Driver & Checker field app)
│   └── functions/               # Firebase Cloud Functions (Cryptographic sealing, audit logging, notifications)
├── packages/
│   ├── shared/                  # Common TypeScript interfaces, validation schemas, pricing & trip utilities
│   └── email-templates/         # Automated customer notification email layouts
├── screenshots/                 # Automated full-page UI captures of all platform routes
├── scripts/
│   ├── captureScreenshots.mjs   # Puppeteer automation script capturing all routes
│   └── seedLocalEmulator.mjs    # Comprehensive local Firestore emulator seed script
├── firebase.json                # Firebase emulator and hosting configuration
└── firestore.rules              # Strict security rules for multi-tenant and role-based data access
```

---

## 🚀 Key Modules & Capabilities

### 1. Operations Management (Web Console)
- **Admin Dashboard**: System health indicators, fleet metrics, active warehouse status, exception alerts, and operational configuration toggles.
- **Manager Console**: Trip scheduling, truck assignment, bulk shipment intake, automated load balancing, customer management, and support inbox.
- **Checker Console**: Intake verification, package scanning, load verification against shipping manifests, discrepancy logging, and delivery handoffs.
- **Driver Portal**: Dispatch route review, cargo inspection checkpoints, and electronic proof-of-delivery (e-POD) logging.

### 2. Public Tracking & Cryptographic Verification
- **Real-Time Tracking (`/track/[trackingNumber]`)**: Public milestone visualizer showing origin hub, sea transit, destination warehouse, and door-to-door delivery progress.
- **Cryptographic Seal Verification (`/verify/[tripId]`)**: Tamper-evident ledger verification validating SHA-256 digital seals against cloud ledger records for each dispatched wingvan.

### 3. Print & Document Generation
- **Official Shipping Manifest (`/components/print/manifest`)**: Standard logistics sheet featuring QR security seals, cargo custody signatures, and piece-level manifests.
- **Delivery Manifest (`/components/print/delivery-manifest`)**: Delivery reconciliation report tracking received vs. delivered pieces with POD percentage audit.
- **Itemized Tax Invoice (`/components/print/invoice`)**: Commercial transport invoices with itemized cargo breakdown, VAT computations, and payment status.
- **Barcode & QR Shipping Labels (`/components/print/labels`)**: Printable thermal shipping labels for packages and master cartons.
- **Manifest Amendments (`/components/print/manifest-amendment`)**: Formal change records for late package additions or emergency cargo removals after seal locking.

### 4. Mobile Field App (`apps/mobile`)
- Native Android and iOS app powered by **Expo SDK 53** and **React Native 0.79**.
- Integrated hardware camera barcode/QR scanner (`expo-camera`) for high-speed warehouse intake.
- Offline resilience via local cache and NetInfo synchronization.
- Photo proof of delivery capture and upload to cloud storage.

---

## 🛠️ Technology Stack

| Domain | Technology |
|---|---|
| **Monorepo Manager** | [Turborepo](https://turbo.build/) + npm Workspaces |
| **Web Framework** | [Next.js 16 (App Router & Turbopack)](https://nextjs.org/) |
| **Frontend Libraries** | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [FontAwesome](https://fontawesome.com/) |
| **Mobile Framework** | [React Native 0.79](https://reactnative.dev/) with [Expo SDK 53](https://expo.dev/) |
| **Backend & Cloud** | [Firebase](https://firebase.google.com/) (Firestore NoSQL, Cloud Storage, Cloud Functions v2) |
| **Authentication** | Firebase Authentication (Role Claims: `admin`, `manager`, `checker`, `driver`, `customer`) |
| **Real-Time Communication** | Tencent RTC (TRTC SDK) & Firestore Realtime Listeners |
| **Automated Testing & Capture** | Puppeteer Core (Chrome & Edge automation) |

---

## 💻 Local Development Setup

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **Java Development Kit (JDK)**: `v21` or `v25` (required by Firebase Local Emulator Suite)
- **Firebase CLI**: `npm install -g firebase-tools`

### 2. Installation
```bash
npm install
```

### 3. Running Firebase Local Emulators
Start local Auth (`9099`), Firestore (`8080`), and Emulator UI (`4000`):
```bash
# Windows PowerShell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"; $env:PATH = "C:\Program Files\Java\jdk-25\bin;$env:PATH"
npx firebase emulators:start --only auth,firestore
```

### 4. Seeding Comprehensive Dummy Data
Populates warehouses (`WH-MNL`, `WH-CEB`, `WH-DVO`), trucks, test users, trips, shipments, invoices, and tracking records:
```bash
node scripts/seedLocalEmulator.mjs
```

### 5. Running the Web Application
```bash
npm --workspace=apps/web run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

**Local Test Accounts (Password: `Password123!`):**
- **Admin**: `admin@atlas.local`
- **Manager**: `manager@atlas.local`
- **Checker**: `checker@atlas.local`
- **Driver**: `driver@atlas.local`
- **Customer**: `customer@atlas.local`

### 6. Running the Mobile Application
```bash
npx --workspace=apps/mobile expo start
```
Press `a` to run on a connected Android emulator or scan the QR code via Expo Go.

### 7. Generating Route Screenshots
To capture automated full-page screenshots of all public, authenticated, and print routes:
```bash
node scripts/captureScreenshots.mjs
```
Screenshots are saved sequentially into the [`screenshots/`](./screenshots/) directory.

---

## 📜 License & Copyright
Proprietary software developed for **Atlas Transport Corporation**. All rights reserved.
