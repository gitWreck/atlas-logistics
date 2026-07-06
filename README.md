# Atlas Trucking Platform

The Atlas Trucking Platform is a comprehensive, monorepo-based logistics and fleet management system built to coordinate managers, drivers, checkers, and customers. It enables real-time tracking, barcode/QR scanning, mobile trip operations, offline-first data updates, invoicing, and messaging.

## System Architecture

The project is structured as a Turborepo monorepo:
* **`apps/web`**: Next.js (version 16) web application. Functions as the primary backoffice management console for back-office staff, managers, and admins.
* **`apps/mobile`**: Expo React Native mobile application for drivers and checkers to scan shipments, track locations, and handle delivery operations.
* **`apps/functions`**: Firebase Cloud Functions (v2) backend API, containing operational triggers, SMS notification handlers, chat endpoints, and PDF manifest generation.
* **`packages/shared` & `packages/src`**: Intended for shared domain logic (Firebase config, status helpers), but currently unused and non-functional due to path routing bugs.

---

## Features & Capabilities

### 1. Management Console (Web Application)
* **Dashboard Analytics**: Displays operational statistics, trip statuses, driver/checker activity, and shipment progress.
* **Linehaul Trip Management**:
  * Create, schedule, and assign trips to trucks and drivers.
  * Manifest locking/unlocking flow to control trip state and loading status.
  * PDF generation for linehaul manifests and manifest amendments.
* **Checker & Delivery Management**:
  * Allocate delivery routes and assign specific municipalities to checkers.
  * Monitor active checkers and reconcile trip handoffs.
* **Customer & User Accounts**:
  * Registration and profile management for customers, admins, managers, checkers, and drivers.
  * Custom claims assignment to enforce role-based access control.
* **Invoicing & Billing**:
  * Generate and manage invoices.
  * Track payment status and associate billing with specific shipments.

### 2. Field Operations (Mobile Application)
* **Driver Workflows**:
  * View assigned linehaul trips.
  * Report delays (traffic, breakdown, weather) during transit.
* **Checker Workflows (Barcode & QR Scanning)**:
  * Camera-based scanning (via `expo-camera`) and manual entry for packages.
  * Load/unload verification to align pieces with trip manifests.
  * Capture and upload proof-of-delivery photos (via `expo-image-picker`) to Firebase Storage.
  * Batch delivery and failed delivery logging with status resolution.
* **Offline Synchronization**:
  * Custom syncing context (`OfflineSyncContext`) to queue local operations and sync when the network reconnects.

### 3. Customer Portals & Tracking
* **Public Shipment Tracking**: Public pages (`/track/[id]` and `/verify/[id]`) allow anonymous visitors to view the real-time custody events of a shipment.
* **Customer Dashboard**: Mobile and web interface for customers to view active shipments and request package pickups.
* **Real-time Chat**: Live support conversation system between customers and support staff.
* **Automated Notifications**: System triggers SMS notifications (via Semaphore) and push updates on critical status transitions (e.g., shipment received, out for delivery, delivered).

---

## Project Limitations & Discovered Issues

During project analysis, the following structural and logic limitations were identified:

### 1. Broken `@atlas/shared` Workspace Package
* **Inaccessible Code**: `packages/shared/index.js` attempts to export from `./src/functions` and `./src/updateShipmentStatus`. However, the `src` folder is situated as a sibling (`packages/src`) instead of inside the `shared` package folder.
* **Missing Firebase References**: Files within `packages/src` try to import from non-existent `./firebase` and `../firebase` modules, preventing compilation.
* **Result**: The package `@atlas/shared` is completely broken and cannot be imported. Currently, both the web and mobile apps work around this by maintaining duplicate Firebase callables and logic directly.

### 2. High Churn on Firestore Listeners (Performance Bug)
* **Inefficient Hooks**: In `apps/mobile/hooks/useCheckerLastMileSync.js`, the active document subscription `useEffect` listens to changes in `watchedDocIds`.
* **The Churn**: The cleanup function tears down and wipes all active document listeners (`docUnsubsRef.current = {}`) every time `watchedDocIds` changes. This triggers high read/connection overhead in Firestore by rebuilding all unchanged listeners.

### 3. Hardcoded Credentials and Secrets
* **Exposed Google Maps Key**: `apps/mobile/app.json` has a hardcoded Google Maps API key committed under `android.config.googleMaps.apiKey`.
* **Tracked Environment Variables**: The environment configuration file `apps/mobile/.env` is tracked and committed to Git, containing Firebase keys and identifiers.

### 4. Code Redundancies
* **Duplicate Cloud Functions Exports**: In `apps/functions/index.js`, the `reportCheckerTrip` handler is imported and exported twice (at line 76 and lines 204–205).
