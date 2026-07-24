# Manager Mobile Feature Parity

## Result

Manager is a first-class mobile role. The existing login preserves the
`manager` role and routes it to a Manager-only Expo Router group. Customer,
Checker, Driver, Admin, and Administrator routing is unchanged.

All Manager operational datasets are returned by authenticated Cloud Functions.
Warehouse and municipality scope is applied on the server before records are
serialized. Direct shipment/trip reads and Manager mutations repeat the same
authorization checks.

## Navigation and pages

The bottom navigation contains exactly five tabs:

| Tab | Route |
| --- | --- |
| Home | `/(manager)/(tabs)` |
| Trips | `/(manager)/(tabs)/trips` |
| Shipments | `/(manager)/(tabs)/shipments` |
| Messages | `/(manager)/(tabs)/messages` |
| Profile | `/(manager)/(tabs)/profile` |

Additional Manager pages:

| Page | Route |
| --- | --- |
| Trip details | `/(manager)/trip-details` |
| Shipment details | `/(manager)/shipment-details` |
| Notifications | `/(manager)/notifications` |
| Messenger thread/calls | `/(manager)/chat/[conversationId]` |
| Trucks | `/(manager)/management/trucks` |
| Customers | `/(manager)/management/customers` |
| Invoices | `/(manager)/management/invoices` |
| Delivery Operations | `/(manager)/management/delivery-operations` |
| Pickup Requests | `/(manager)/management/pickup-requests` |
| Staff Management | `/(manager)/management/staff` |
| Municipality Assignments | `/(manager)/management/municipalities` |
| Reports | `/(manager)/management/reports` |
| Settings | `/(manager)/management/settings` |

## Feature-parity checklist

| Web feature | Mobile equivalent | Shared backend/API | Permission rule | Mobile-specific limitation |
| --- | --- | --- | --- | --- |
| Manager login/role redirect | Manager route group and five-tab shell | Firebase Auth, `users/{uid}` | Active Manager required by `AuthGuard` and callables | None |
| Dashboard | Greeting, Manager card, scope, 11 metrics, delivery progress, recent activity | `getManagerMobileDashboard` | Server warehouse/municipality filter | Desktop widgets become two-column cards |
| Trip board | Active/completed tabs, search, create Trip, route/assignment/issue cards | `listManagerMobileOperations`, `createTruckTrip` | Trips filtered server-side | Desktop calendar becomes mobile list |
| Trip details/actions | Progress timeline, Driver/Checker/truck, municipality, manifest, issues, Driver assignment, status progression | `getManagerMobileTrip`, `assignDriverToTrip`, `updateTripStatus` | Direct trip and Driver are re-authorized | PDF manifest/export remains web-only |
| Shipment board | Search; status, date, municipality, Checker and Driver filters; create Shipment | `listManagerMobileShipments`, `createShipment` | Server filters all returned shipments | Desktop table becomes cards |
| Shipment details/actions | Sender/receiver/customer, vehicle/staff, packages, scan history, timeline and Manager workflow actions | `getManagerMobileShipment`, `updateShipmentStatus` | Direct ID and mutation scope checks | Label/manifest printing remains web-only |
| Trucks | Search/status tabs, fleet cards, detail, status, capacity, current Trip, maintenance data, registration | `getManagerMobileModules`, `upsertTruck`, `updateTruckStatus` | Reads and mutations require assigned scope | Dense maintenance form is a bottom sheet |
| Customers | Search, contact details, add Customer, shipment history, pickup history | `getManagerMobileModules`, `createUserProfile` | Linked/scope-matching customers only; new city/warehouse restricted to Manager scope | None |
| Invoices | Search/status, create, details, shipment/customer/amount, issue/pay/cancel actions | `getManagerMobileModules`, `createInvoice`, `updateInvoiceStatus` | Invoice shipment must be in scope | Printing remains web-only |
| Delivery Operations | Authorized delivery pool, status/search, shipment details and workflow actions | Scoped shipments plus existing shipment callables | Shipment scope enforced server-side | Desktop multi-column board becomes cards |
| Pickup Requests | Pending/assigned/completed records, search/status and details/actions | Scoped pickup records, `updateShipmentStatus` | Pickup shipment scope enforced | None |
| Staff Management | Checker/Driver/warehouse staff list, status, warehouse, municipality, current assignment | `getManagerMobileModules` | `canAccessStaff` server check | Staff account creation remains Admin-only |
| Municipality Assignments | Authorized Checker list and multi-select assignment | `assignCheckerMunicipalities` | Checker and every municipality must match Manager scope | None |
| Reports | Shipment, delivery, failed, return, Trip, Driver and Checker summaries | Live aggregate from `getManagerMobileModules` | Aggregate is computed after scope filtering | Export remains web-only |
| Settings | Notification preference and operational reference values | `app_settings/operational` returned by scoped callable | Global configuration remains Admin-only | Manager view is intentionally read-only for Admin-owned values |
| Messages/calls | Conversations, authorized contacts, attachments, search, voice/video calls and recent calls | Existing conversation/call functions | Participant, assignment, or authorized shipment required | Mobile single-pane Messenger layout |
| Profile | Shared profile/photo/contact/scope/theme/password/logout UI | Existing shared profile/auth functions | Own account only | None |

## Backend and security changes

New/expanded Manager callable:

- `getManagerMobileModules`
- `getManagerMobileDashboard` now returns Pickups, active Drivers, and active
  Checkers in addition to existing shipment and Trip statistics.

Server-side behavior:

- `getManagerMobileModules` returns only scoped trucks, customers, invoices,
  pickup requests, staff, trips, shipments, reports, and operational settings.
- `upsertTruck` and `updateTruckStatus` now load the actor profile, require
  Admin/Manager, and recheck Manager scope.
- `createInvoice` and `updateInvoiceStatus` verify the linked shipment is in the
  Manager's scope.
- Manager-created Customer warehouse and municipality values are forced into
  the Manager's authorized scope.
- Existing direct shipment, Trip, Driver, Checker, message, call, and
  notification security remains in force.

No database migration or new Firestore index is required.

## Shared components reused

- `AuthProvider`, `AuthGuard`, Firebase Auth persistence and logout/call cleanup.
- `ThemeProvider` and the existing light/dark design tokens.
- Shared `ProfileViewer`, password update, theme selector, and logout.
- Shared `StatusBadge`.
- Existing Messenger thread, attachment, incoming-call, voice/video, heartbeat,
  and synchronized call-end components.
- Expo Router, Safe Area Context, shared Firebase client and icon sets.
- Existing Manager request hook, cards, loading, error, and empty states.

## Created in this completion

- `apps/mobile/app/(manager)/(tabs)/trips.js`
- `apps/mobile/app/(manager)/management/[module].js`
- `apps/mobile/components/manager/ManagerModuleScreen.js`
- `apps/mobile/components/manager/ManagerQuickCreateModal.js`

The earlier `operations.js` tab route was removed so the bottom navigation has
only the required five tabs.

## Modified in this completion

- `apps/mobile/app/(manager)/_layout.js`
- `apps/mobile/app/(manager)/(tabs)/_layout.js`
- `apps/mobile/components/manager/ManagerDashboardScreen.js`
- `apps/mobile/components/manager/ManagerOperationsScreen.js`
- `apps/mobile/components/manager/ManagerShipmentsScreen.js`
- `apps/mobile/components/manager/ManagerShipmentDetailsScreen.js`
- `apps/mobile/components/manager/ManagerUI.js`
- `apps/mobile/components/utilities/FirebaseFunctions.js`
- `apps/functions/index.js`
- `apps/functions/src/manager/managerMobile.js`
- `apps/functions/src/trucks/handleTruck.js`
- `apps/functions/src/invoices/createInvoice.js`
- `apps/functions/src/invoices/updateInvoiceStatus.js`
- `apps/functions/src/users/createUserProfile.js`

The full Manager implementation also reuses the previously created Manager
screens, details, messaging, notifications, create Shipment/Trip modals,
Manager access helper, Firestore rules, and shared profile/auth changes.

## Validation

- Functions module/lint load: passed.
- Expo web production export: passed.
- Expo Android/Hermes production export: passed.
- Expo iOS/Hermes production export: passed.
- Deployed callable CORS preflight from `http://localhost:8082`: `204`, allowed.
- Eleven functions deployed successfully to `atlas-tracking`; zero errors:
  `getManagerMobileDashboard`, `getManagerMobileModules`,
  `createUserProfile`, `upsertTruck`, `updateTruckStatus`, `createInvoice`,
  `updateInvoiceStatus`, `updateShipmentStatus`, `updateTripStatus`,
  `assignDriverToTrip`, and `assignCheckerMunicipalities`.
- `firestore.rules` compiled and was released successfully to
  `cloud.firestore`.
- Web Manager source/layout was not changed by this completion.

Signed Play Store/App Store binaries were not produced because that requires
the project's EAS signing credentials. The Android and iOS production
JavaScript/Hermes bundles both compile successfully.
