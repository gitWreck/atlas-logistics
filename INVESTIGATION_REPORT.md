# Codebase Investigation Report
## Invoice & Schedule Implementation Analysis

**Date**: 2026-07-12  
**Scope**: Full project investigation (apps/mobile, apps/web, apps/functions, packages, Firestore)  
**Focus**: Existing Invoice and Schedule implementations

---

## EXECUTIVE SUMMARY

### Invoice System
- **Status**: ✅ **FULLY IMPLEMENTED** (Admin/Manager only)
- **Reusability for Customer**: ⚠️ **PARTIALLY REUSABLE** (customer read-only view exists)
- **Current Implementation**: Staff-only creation/management with customer-only read access
- **Firestore Collection**: `invoices` (top-level), `shipments/{shipmentId}/invoices` (sub-collection)
- **Cloud Functions**: 3 functions (createInvoice, editInvoice, updateInvoiceStatus)

### Schedule System  
- **Status**: ✅ **FULLY IMPLEMENTED** (Admin/Manager only)
- **Reusability for Customer**: ✅ **FULLY REUSABLE** (customer read-only view exists)
- **Current Implementation**: Trip schedule management in `truck_trips` collection
- **Firestore Collection**: `truck_trips` (with schedule fields)
- **Cloud Functions**: 1 function (updateTripSchedule)

---

## 1. INVOICE SYSTEM

### 1.1 Implementation Details

#### **File Structure**
```
apps/functions/src/invoices/
├── createInvoice.js         (Cloud Function - Callable)
├── editInvoice.js           (Cloud Function - Callable)
└── updateInvoiceStatus.js   (Cloud Function - Callable)

apps/functions/src/customers/
└── getCustomerOperations.js (includes getMyInvoices)

apps/web/app/(internal)/components/invoice/
├── InvoiceBoard.jsx         (Main admin/manager interface)
├── InvoiceCard.jsx          (Invoice card component)
├── InvoiceDetailsModal.jsx  (View invoice details)
├── InvoiceFormModal.jsx     (Create/edit invoice form)
├── InvoiceStatistics.jsx    (Invoice stats widget)
├── InvoiceTable.jsx         (Invoice data table)
├── useInvoiceWorkflow.js    (Hook for invoice operations)
├── invoiceHelpers.js        (Formatting & helpers)
└── ui/InvoiceStatusBadge.jsx

apps/web/app/api/invoices/
├── route.js                 (GET all invoices - staff only)
└── [invoiceId]/route.js     (GET single invoice)

apps/web/app/(internal)/components/customers/
└── CustomerDrawer.jsx       (Customer invoices tab)

apps/mobile/app/(customer)/
├── invoices.js              (Customer invoice list screen)
└── (components)
    └── CustomerOperationsList.js (Reusable invoice/schedule list)
```

#### **Firestore Collections**

**1. Top-level `invoices` collection**
```javascript
// Document: invoiceNumber (e.g., "INV-20260712-123456")
{
  invoiceNumber: "INV-20260712-123456",
  shipmentId: "TRACK123",
  shipmentTrackingNumber: "TRACK123",
  
  // Billing information
  billingName: "Company Name",
  billingAddress: "123 Street, City",
  
  // Shipment details (denormalized)
  senderName: "Sender Name",
  senderPhone: "+1234567890",
  recipientName: "Recipient Name",
  recipientPhone: "+0987654321",
  
  origin: "Manila",
  destination: "Cebu",
  routeLabel: "Manila → Cebu",
  
  // Amounts
  amount: 5000,
  totalPackages: 3,
  totalItems: 15,
  notes: "Optional notes",
  
  // Status workflow: DRAFT → ISSUED → PAID or CANCELLED
  status: "ISSUED",
  
  // Metadata
  shipmentStatus: "DELIVERED",
  tripId: "TRIP123",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: uid,
  updatedBy: uid
}
```

**2. Nested `shipments/{shipmentId}/invoices` sub-collection**
- Same structure as top-level
- Allows querying invoices per shipment

#### **Cloud Functions**

**A. `createInvoice` (Callable)**
- **File**: `apps/functions/src/invoices/createInvoice.js`
- **Role Requirements**: ANY authenticated user (no explicit role check - OPEN ACCESS)
- **Region**: asia-southeast1
- **Input Parameters**:
  ```javascript
  {
    shipmentId: string,        // REQUIRED
    invoiceDate: date,
    dueDate: date,
    billingName: string,       // REQUIRED
    billingAddress: string,
    amount: number,            // REQUIRED
    notes: string,
    status: "DRAFT" | "ISSUED" // Defaults to DRAFT
  }
  ```
- **Validation**:
  - ✅ Shipment must exist
  - ✅ No active invoice exists for shipment (prevents duplicates)
  - ❌ No role restriction
  - ❌ No permission check
- **Output**: Created invoice document
- **Side Effects**: 
  - Denormalizes shipment data into invoice
  - Logs action to `invoice_events` via `writeInvoiceActionLog()`
  - Creates SMS notification log if configured

**B. `editInvoice` (Callable)**
- **File**: `apps/functions/src/invoices/editInvoice.js`
- **Role Requirements**: ANY authenticated user (no explicit role check - OPEN ACCESS)
- **Input Parameters**:
  ```javascript
  {
    invoiceId: string,         // REQUIRED
    invoiceDate: date,
    dueDate: date,
    billingName: string,
    billingAddress: string,
    amount: number,
    notes: string,
    status: string
  }
  ```
- **Validation**:
  - ✅ Invoice exists
  - ❌ No role restriction
  - ❌ No permission check on invoice ownership
- **Output**: Updated invoice document
- **Side Effects**: Logs action via `writeInvoiceActionLog()`

**C. `updateInvoiceStatus` (Callable)**
- **File**: `apps/functions/src/invoices/updateInvoiceStatus.js`
- **Role Requirements**: ANY authenticated user (no explicit role check - OPEN ACCESS)
- **Input Parameters**:
  ```javascript
  {
    invoiceId: string,         // REQUIRED
    status: "ISSUED" | "PAID" | "CANCELLED" // REQUIRED
    notify: boolean,           // Send SMS notification
    scheduledTime: date       // Optional scheduled send
  }
  ```
- **Validation**:
  - ✅ Status in INVOICES_ALLOWED_STATUSES: ["DRAFT", "ISSUED", "PAID", "CANCELLED"]
  - ✅ Status transition valid via INVOICES_VALID_TRANSITIONS:
    - DRAFT → [ISSUED, CANCELLED]
    - ISSUED → [PAID, CANCELLED]
    - PAID → []
    - CANCELLED → []
  - ❌ No role restriction
  - ❌ No permission check
- **Output**: Updated invoice with status change
- **Side Effects**: 
  - Sends SMS notification if `notify: true`
  - Logs action via `writeInvoiceActionLog()`

**D. `getMyInvoices` (Callable)**
- **File**: `apps/functions/src/customers/getCustomerOperations.js`
- **Role Requirements**: ✅ **customer** role required (enforced via `requireRole()`)
- **Input Parameters**: None
- **Logic**:
  ```javascript
  // Query invoices by customer shipments:
  // 1. Invoices where shipmentSnapshot.sender.uid == userUid
  // 2. Invoices where shipmentSnapshot.recipient.uid == userUid
  // 3. Invoices where shipmentId in user's shipments
  ```
- **Output**: Array of invoices visible to customer
- **Customer Scope**: Customer sees invoices only for shipments where they are:
  - Sender (created shipment)
  - Recipient (delivery address)
  - Added to `visibilityUserIds` array on shipment

#### **API Routes**

**A. `GET /api/invoices/` (Next.js Route Handler)**
- **File**: `apps/web/app/api/invoices/route.js`
- **Auth**: Bearer token required
- **Role Check**: Enforced - staff only (admin, manager, driver, checker)
- **Query**: All invoices (limit 100), pre-fetches related shipments
- **Response**: Array of invoices with shipment snapshots

**B. `GET /api/invoices/[invoiceId]/` (Next.js Route Handler)**
- **File**: `apps/web/app/api/invoices/[invoiceId]/route.js`
- **Auth**: Bearer token required
- **Role Check**: Enforced - staff only
- **Response**: Single invoice document

#### **Firestore Security Rules**

**Top-level `/invoices/{invoiceId}` collection**
```firestore
match /invoices/{invoiceId} {
  allow read: if isStaff();              // admin, manager, driver, checker
  allow create, update, delete: if false;
}
```

**Nested `/shipments/{shipmentId}/invoices/{invoiceId}` sub-collection**
```firestore
match /invoices/{invoiceId} {
  allow get: if isStaff() || customerOwnsShipment();
  allow list: if isStaff() || customerOwnsShipment() || isAdminOrManager();
  allow create, update, delete: if false;
}
```

#### **Web UI Components**

**1. InvoiceBoard.jsx** (Admin/Manager main interface)
- Fetches shipments and invoices via `/api/shipments` and `/api/invoices`
- Displays invoices in table with filters:
  - Status filter: ALL, DRAFT, ISSUED, PAID, CANCELLED
  - Search by invoice number, shipment ID, sender/recipient name, route
- Actions available:
  - Create invoice (from eligible shipments)
  - View invoice details
  - Edit invoice (form modal)
  - Issue invoice
  - Cancel invoice
  - Mark as paid

**2. InvoiceTable.jsx** (Paginated invoice listing)
- Columns: Invoice Number, Shipment ID, Sender/Recipient, Route, Status, Amount, Actions
- Pagination with limit selector (10, 25, 50, 100, ALL)
- Export functionality via ExportInvoiceList

**3. InvoiceFormModal.jsx** (Create/Edit invoice)
- Form fields:
  - Shipment selector (searchable dropdown)
  - Invoice date, Due date
  - Billing name, Billing address
  - Amount
  - Notes
  - Status (for creation)
- Validation: All REQUIRED fields must be filled
- Submit triggers createInvoice or editInvoice Cloud Function

**4. InvoiceDetailsModal.jsx** (View-only invoice details)
- Displays full invoice information
- Read-only fields
- Shows linked shipment details

**5. useInvoiceWorkflow.js** (Custom Hook)
- Manages invoice form state
- Handles create/edit/delete operations
- Refreshes data after actions
- Error handling and notifications

#### **Mobile Customer UI**

**1. apps/mobile/app/(customer)/invoices.js**
```javascript
// Simple wrapper that calls getMyInvoices
export default function CustomerInvoicesScreen() {
  const loadRecords = useCallback(async () => {
    const result = await getMyInvoices();
    return result.data?.invoices || [];
  }, []);

  return <CustomerOperationsList type="invoice" loadRecords={loadRecords} />;
}
```

**2. CustomerOperationsList.js** (Reusable component)
- Single list UI for both invoices and schedules
- Displays invoice cards with:
  - Invoice number
  - Status badge
  - Linked shipment tracking number
  - Due date (formatted)
- Features:
  - Loading state
  - Error state with retry
  - Empty state
  - No action buttons (read-only)

#### **Calling Functions in Web**

**File**: `apps/web/app/utility/FirebaseFunctions.js`
```javascript
export const createInvoice = httpsCallable(functions, "createInvoice");
export const editInvoice = httpsCallable(functions, "editInvoice");
export const updateInvoiceStatus = httpsCallable(functions, "updateInvoiceStatus");
export const getMyInvoices = httpsCallable(functions, "getMyInvoices");
```

**File**: `apps/mobile/components/utilities/FirebaseFunctions.js`
```javascript
export const getMyInvoices = httpsCallable(functions, "getMyInvoices");
```

#### **Logging**

**File**: `apps/functions/src/utilities/invoiceLogger.js`
- Logs all invoice actions to `invoice_events` collection
- Records: invoiceId, action, actor, timestamp, changes
- Used for audit trail

---

### 1.2 Invoice Status Classification

| Aspect | Status |
|--------|--------|
| **Fully Implemented** | ✅ Yes - Complete CRUD for staff |
| **Admin-Only** | ✅ Yes - Creation, editing, status changes |
| **Manager-Only** | ✅ Shared with managers (no exclusive features) |
| **Checker-Only** | ❌ No access |
| **Driver-Only** | ❌ No access |
| **Customer-Ready** | ⚠️ **PARTIALLY** - Read-only view only |
| **Reusable for Customer** | ⚠️ **PARTIALLY** - Need permission controls |
| **Reusable for Driver** | ❌ No - Requires separate authorization |

---

### 1.3 Security Issues & Concerns

#### 🔴 **CRITICAL ISSUES**

1. **No Role Restriction on Create/Edit/Delete Cloud Functions**
   - `createInvoice` accepts ANY authenticated user
   - `editInvoice` accepts ANY authenticated user
   - `updateInvoiceStatus` accepts ANY authenticated user
   - ❌ **Current**: No `requireRole()` check in these functions
   - **Impact**: Any logged-in customer/driver/checker can create invoices for ANY shipment
   - **Location**: 
     - `apps/functions/src/invoices/createInvoice.js` - lines 11-25
     - `apps/functions/src/invoices/editInvoice.js` - lines 12-30
     - `apps/functions/src/invoices/updateInvoiceStatus.js` - lines 32-53

2. **No Shipment Ownership Validation**
   - Invoice creation doesn't verify user owns/manages the shipment
   - Can create invoices for any shipment ID
   - **Impact**: Customer A can create invoice for Customer B's shipment

3. **No Permission Check on Invoice Editing**
   - Anyone can edit any existing invoice
   - **Impact**: Customer can modify invoice amount, due date, etc.

#### 🟡 **MODERATE ISSUES**

4. **Web API Role Check Not Reflected in Cloud Functions**
   - Web API (`/api/invoices/`) enforces staff-only access
   - But Cloud Functions don't enforce same restriction
   - ❌ **Mobile customer can bypass via direct Cloud Function call**
   - **Impact**: Security inconsistency between platforms

5. **Denormalized Data Not Validated**
   - Invoice stores snapshots of shipment data
   - No validation that snapshot matches current shipment
   - **Impact**: Stale or incorrect data in invoices

#### 🟢 **FIRESTORE RULES (Currently Correct)**

✅ Read access to top-level invoices restricted to staff only  
✅ Read access to nested invoices allow customers of shipment  
✅ No create/update/delete at Firestore level (all via Cloud Functions)

---

## 2. SCHEDULE SYSTEM

### 2.1 Implementation Details

#### **File Structure**
```
apps/functions/src/trips/
└── updateTripSchedule.js    (Cloud Function - Callable)

apps/functions/src/customers/
└── getCustomerOperations.js (includes getMySchedules)

apps/web/app/(internal)/components/trips/
├── TripBoard.jsx            (Main trip management interface)
├── TripSchedule/
│   ├── TripScheduleModal.jsx
│   ├── TripScheduleOverview.jsx
│   ├── TripScheduleTable.jsx
│   ├── TripScheduleSummaryCards.jsx
│   ├── TripScheduleConflictList.jsx
│   └── TripUpcomingDepartures.jsx
├── modals/
│   ├── TripScheduleDateField.jsx
│   ├── TripScheduleFields.jsx
│   └── TripScheduleInfoCard.jsx
└── (trip management components)

apps/web/app/utility/
└── tripScheduleHelpers.js   (Schedule calculation & conflict detection)

apps/mobile/app/(customer)/
├── schedules.js             (Customer schedule list screen)
└── (components)
    └── CustomerOperationsList.js (Reusable)
```

#### **Firestore Collection**

**`truck_trips` collection** (Schedule fields only)
```javascript
// Document: {tripId}
{
  tripId: "TRIP-20260712-001",
  
  // Schedule fields (populated by updateTripSchedule)
  plannedDeparture: Timestamp,      // Planned truck departure time
  estimatedArrival: Timestamp,      // Estimated arrival at destination
  plannedLoadingStart: Timestamp,   // When loading should start
  
  // Execution fields (updated by trip operations)
  dispatchedAt: Timestamp,          // When trip was dispatched
  arrivedAt: Timestamp,             // When truck arrived
  
  // Trip details
  tripNumber: "T001",
  truckId: "TRUCK-001",
  driverId: "driver-uid-123",
  origin: "Manila",
  destination: "Cebu",
  route: "Manila → Cebu",
  
  status: "CREATED" | "ASSIGNED" | "LOADING" | "LOADED" | 
          "IN_TRANSIT" | "ARRIVED" | "OUT_FOR_DELIVERY" | 
          "COMPLETED" | "CANCELLED",
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### **Cloud Function**

**`updateTripSchedule` (Callable)**
- **File**: `apps/functions/src/trips/updateTripSchedule.js`
- **Role Requirements**: ✅ **Admin/Manager only** (enforced via `assertAdminOrManager()`)
- **Region**: asia-southeast1
- **Input Parameters**:
  ```javascript
  {
    tripId: string,                    // REQUIRED
    plannedDeparture: ISO8601 date,   // Optional
    estimatedArrival: ISO8601 date,   // Optional
    plannedLoadingStart: ISO8601 date,// Optional
    notify: boolean                    // Send SMS notification
  }
  ```
- **Validation**:
  - ✅ tripId required
  - ✅ All dates must be valid ISO8601 format
  - ✅ estimatedArrival must be later than plannedDeparture (if both provided)
  - ✅ Only admin/manager role allowed
  - ✅ Trip must not be completed
- **Output**: Updated trip document with schedule fields
- **Side Effects**:
  - Optional SMS broadcast to participants if `notify: true`
  - Logs action via `writeTripActionLog()`

#### **Mobile Customer Function**

**`getMySchedules` (Callable)**
- **File**: `apps/functions/src/customers/getCustomerOperations.js`
- **Role Requirements**: ✅ **customer** role required
- **Logic**:
  ```javascript
  // Get all customer shipments
  const shipments = await getCustomerShipments(req);
  
  // Extract unique trip IDs from shipments:
  // - currentTripId
  // - currentTruckTripId
  // - tripId
  
  // Fetch all truck_trips documents
  const schedules = await Promise.all(
    tripIds.map(tripId => 
      db.collection("truck_trips").doc(tripId).get()
    )
  );
  
  return { schedules: [...schedules] };
  ```
- **Output**: Array of trip schedules for customer's shipments
- **Customer Scope**: 
  - Sees trips only for their shipments
  - Cannot see other customers' trips
  - Cannot see trips without shipments

#### **Web UI Components**

**1. TripScheduleOverview.jsx** (Main schedule dashboard)
- Summary cards with:
  - Active trips count
  - Upcoming departures
  - On-time delivery rate
  - Average schedule variance
- Conflict list (trips overlapping on same truck/driver)
- Full schedule table

**2. TripScheduleTable.jsx** (Sortable schedule grid)
- Columns: Trip ID, Route, Truck, Driver, Departure, ETA, Loading Start, Status
- Sorting by any column
- Clickable rows to open schedule modal
- Filter by status

**3. TripScheduleModal.jsx** (Create/Edit schedule)
- Form fields:
  - Trip selector (from unscheduled trips)
  - Planned departure date/time
  - Estimated arrival date/time
  - Planned loading start date/time
- Validation:
  - All dates must be valid
  - Arrival must be after departure
- Conflict detection:
  - Shows existing schedules that conflict
  - Warning if driver/truck double-booked
- Submit triggers `updateTripSchedule` Cloud Function

**4. TripScheduleConflictList.jsx** (Conflict detection)
- Shows trips with:
  - Same truck/driver overlapping schedule
  - Same route at same time
  - Loading conflicts
- Color-coded severity

**5. TripUpcomingDepartures.jsx** (Next 7 days view)**
- Calendar grid of upcoming trip departures
- Grouped by day
- Click to view/edit trip

#### **Helper Functions**

**File**: `apps/web/app/utility/tripScheduleHelpers.js`
- `getTripDeparture()` - Extract departure time
- `getTripEta()` - Extract ETA
- `getPlannedLoadingStart()` - Extract loading start time
- `getTripStatus()` - Current trip status
- `isTripActiveForSchedule()` - Check if trip is in schedulable state
- `getScheduleConflicts()` - Find overlapping trips
- `getScheduleSummary()` - Generate schedule statistics

#### **Mobile Customer UI**

**1. apps/mobile/app/(customer)/schedules.js**
```javascript
// Simple wrapper that calls getMySchedules
export default function CustomerSchedulesScreen() {
  const loadRecords = useCallback(async () => {
    const result = await getMySchedules();
    return result.data?.schedules || [];
  }, []);

  return <CustomerOperationsList type="schedule" loadRecords={loadRecords} />;
}
```

**2. CustomerOperationsList.js (Reusable component)**
- Displays schedule cards with:
  - Trip ID
  - Route (origin → destination)
  - Status
  - Planned departure (formatted date/time)
- Features:
  - Loading state
  - Error state with retry
  - Empty state
  - No action buttons (read-only)

#### **Firestore Security Rules**

**`/truck_trips/{tripId}` collection**
```firestore
match /truck_trips/{tripId} {
  allow read: if isAdminOrManager() 
              || hasRole('checker') 
              || (hasRole('driver') && isAssignedDriver());
  allow create, update, delete: if false;
}

match /trip_shipments/{shipmentId} {
  allow read: if isStaff();
  allow create, update, delete: if false;
}

match /trip_packages/{packageId} {
  allow read: if isStaff();
  allow create, update, delete: if false;
}
```

**Notes**:
- ❌ **Customer cannot read `truck_trips` directly** via Firestore
- ✅ Customer can read via `getMySchedules` Cloud Function
- ✅ No create/update/delete allowed (all via Cloud Functions)

---

### 2.2 Schedule Status Classification

| Aspect | Status |
|--------|--------|
| **Fully Implemented** | ✅ Yes - Full CRUD for staff |
| **Admin-Only** | ✅ Yes - Creation, editing |
| **Manager-Only** | ✅ Shared with managers (no exclusive features) |
| **Checker-Only** | ❌ Cannot create/edit; read-only via Firestore |
| **Driver-Only** | ❌ Cannot create/edit; read-only via Firestore |
| **Customer-Ready** | ✅ **FULLY** - Read-only view via Cloud Function |
| **Reusable for Customer** | ✅ **FULLY** - Already customer-safe |
| **Reusable for Driver** | ⚠️ **PARTIALLY** - Need Firestore permission grant |

---

### 2.3 Security Analysis

#### 🟢 **SECURE**

1. ✅ **Cloud Function Role Check**
   - `updateTripSchedule` requires admin/manager role
   - Enforced via `assertAdminOrManager(db, tx, req.auth.uid)`
   - **Location**: Line 149

2. ✅ **Firestore Security Rules**
   - Read-only for checker/driver/customer
   - No create/update/delete via Firestore
   - All mutations via Cloud Functions only

3. ✅ **Mobile Access Restricted**
   - `getMySchedules` requires customer role
   - Returns only trips linked to customer's shipments
   - No access to other customers' trips

4. ✅ **Trip Validation**
   - Cannot schedule completed trips
   - Date validation enforced
   - Logical ordering validated

#### 🟡 **CONSIDERATIONS**

1. **Driver/Checker Access**
   - Can read trips via Firestore but cannot update schedule
   - Acceptable for mobile drivers (read-only workflows)
   - Good separation of concerns

---

## 3. COMPARATIVE SUMMARY

### Invoice vs Schedule Implementation

| Feature | Invoice | Schedule |
|---------|---------|----------|
| **Admin Create** | ✅ | ✅ |
| **Admin Edit** | ✅ | ✅ |
| **Customer View** | ✅ | ✅ |
| **Customer Create** | ❌ (open bug) | ❌ |
| **Customer Edit** | ❌ (open bug) | ❌ |
| **Role Enforcement** | ❌ CF (✅ API) | ✅ CF |
| **Firestore Rules** | ✅ | ✅ |
| **Mobile Support** | ✅ | ✅ |
| **Web Support** | ✅ | ✅ |
| **API Support** | ✅ | ❌ |
| **Conflict Detection** | ❌ | ✅ |

---

## 4. REUSABILITY ANALYSIS

### 4.1 For Customer Role

#### **Invoice** - ⚠️ **PARTIALLY REUSABLE**
```
Current State:
- Read: ✅ getMyInvoices (customer role enforced)
- View: ✅ Mobile customer screen exists
- Web: ❌ No customer web portal

Changes Required:
1. Add role check to createInvoice Cloud Function
   - Reject if user is not invoice creator/shipment owner
   
2. Add role check to editInvoice Cloud Function
   - Allow only admin/manager OR invoice creator
   
3. Add role check to updateInvoiceStatus Cloud Function
   - Allow only admin/manager to change status
   - Optionally allow customer to see status changes only
   
4. Create customer invoice details screen (mobile)
   - Show invoice PDF download option (if implemented)
   - Show payment history
   
5. Create customer invoice portal (web)
   - Dashboard with all invoices
   - Filter by status, date range
   - Print/export options
```

#### **Schedule** - ✅ **FULLY REUSABLE**
```
Current State:
- Read: ✅ getMySchedules (customer role enforced)
- View: ✅ Mobile customer screen exists
- Edit: ✅ Correctly restricted to admin/manager only
- Web: ❌ No customer web portal (optional)

Changes Required:
1. (Optional) Create customer schedule portal (web)
   - Show upcoming deliveries with schedule
   - Calendar view of delivery dates
   - Notifications when schedule changes
   
2. (Optional) Add schedule notification SMS
   - When trip scheduled
   - When schedule updated
   - When estimated arrival approaching

No code changes required for security.
```

### 4.2 For Driver Role

#### **Invoice** - ❌ **NOT REUSABLE**
- Drivers should not see/manage invoices
- Billing is customer concern
- No driver-specific invoice features

#### **Schedule** - ⚠️ **PARTIALLY REUSABLE**
```
Current State:
- Read: ✅ Can read via Firestore if assigned
- Edit: ❌ Cannot edit schedules

Potential Features:
1. Trip itinerary view (read-only)
   - Show planned vs actual times
   - Show remaining stops
   
2. Real-time tracking display
   - Current location vs planned route
   
3. ETA update notifications
   - Alert when running behind schedule
   
Note: Driver app (mobile) currently uses trip-based workflow,
not schedule-focused. Different UX pattern than schedule board.
```

---

## 5. FIRESTORE COLLECTIONS SUMMARY

### Collections Used

| Collection | Purpose | Read Rules | Write Rules |
|------------|---------|-----------|------------|
| `invoices` | Top-level invoice storage | Staff only | Cloud Functions only |
| `shipments/{id}/invoices` | Nested invoices per shipment | Staff + Shipment owner | Cloud Functions only |
| `truck_trips` | Trip schedule storage | Admin/Manager + Assigned roles | Cloud Functions only |
| `invoice_events` | Invoice action audit log | Admin/Manager only | Cloud Functions only |
| `shipments` | Core shipment data | Staff + Customer (own shipments) | Cloud Functions only |
| `customers` | User profile data | Own profile + staff | Cloud Functions only |

---

## 6. EXISTING INTEGRATION PATTERNS

### How Invoice Interacts with Shipments
```
Shipment created
    ↓
Invoice created (links shipmentId)
    ↓
Invoice denormalizes current shipment snapshot
    ↓
Invoice becomes independent document
    ↓
Shipment changes don't affect invoice snapshot
    ↓
Invoice tracks status independently from shipment
```

### How Schedule Interacts with Trips/Shipments
```
Trip created (status: CREATED)
    ↓
Schedule assigned (plannedDeparture, estimatedArrival)
    ↓
Shipments assigned to trip
    ↓
Trip dispatched (status: IN_TRANSIT)
    ↓
Schedule times used for customer notifications
    ↓
Shipment delivery status linked to trip status
```

---

## 7. CRITICAL GAPS TO ADDRESS

### 🔴 **MUST FIX**

1. **Invoice Cloud Functions Missing Role Check**
   - Files: 
     - `apps/functions/src/invoices/createInvoice.js`
     - `apps/functions/src/invoices/editInvoice.js`
     - `apps/functions/src/invoices/updateInvoiceStatus.js`
   - Action: Add `requireRole(db, req, ["admin", "manager"])` at start
   - Impact: Critical security vulnerability

2. **No Shipment Ownership Validation**
   - Files: All invoice Cloud Functions
   - Action: Verify user created shipment OR is admin/manager
   - Impact: Data isolation breach

### 🟡 **SHOULD ADD**

3. **Customer Invoice Details Screen (Mobile)**
   - Currently: Customers can only see list
   - Add: Tap to view full invoice details
   - Expected feature: PDF download

4. **Customer Invoice Web Portal**
   - Currently: Web has no customer access
   - Add: Customer dashboard with invoices
   - Expected features: Print, export, payment history

5. **Schedule Change Notifications**
   - Currently: No SMS when schedule changes
   - Add: Notification when trip schedule updated
   - Benefit: Customer awareness

---

## 8. FILE LOCATIONS REFERENCE

### Invoice Files
- Cloud Functions: `apps/functions/src/invoices/`
- API Routes: `apps/web/app/api/invoices/`
- Web Components: `apps/web/app/(internal)/components/invoice/`
- Mobile Screen: `apps/mobile/app/(customer)/invoices.js`
- Helpers: `apps/web/app/utility/FirebaseFunctions.js`
- Logging: `apps/functions/src/utilities/invoiceLogger.js`

### Schedule Files
- Cloud Functions: `apps/functions/src/trips/updateTripSchedule.js`
- Web Components: `apps/web/app/(internal)/components/trips/`
- Mobile Screen: `apps/mobile/app/(customer)/schedules.js`
- Helpers: `apps/web/app/utility/tripScheduleHelpers.js`
- Firestore: `firestore.rules` (search `truck_trips`)

### Shared Customer Access
- Cloud Functions: `apps/functions/src/customers/getCustomerOperations.js`
- Mobile Component: `apps/mobile/components/customer/CustomerOperationsList.js`
- Mobile Dashboard: `apps/mobile/components/customer/CustomerHomeDashboard.js`
- Firebase Callable: `apps/mobile/components/utilities/FirebaseFunctions.js`

---

## 9. RECOMMENDATIONS

### For Invoice System
```
Priority 1 (Security): Fix Cloud Function role checks
Priority 2 (Feature): Add customer invoice details screen
Priority 3 (Feature): Add customer web portal
Priority 4 (Polish): PDF invoice generation & download
```

### For Schedule System
```
Priority 1 (Feature): Add customer web portal (optional)
Priority 2 (Feature): Add schedule change notifications
Priority 3 (Polish): Calendar visualization improvements
No security fixes needed (already secure)
```

---

## APPENDIX: Quick Reference

### Invoice Status Workflow
```
DRAFT → ISSUED → PAID
  ↓
  CANCELLED
```

### Trip Status Workflow (includes schedule)
```
CREATED → ASSIGNED → LOADING → LOADED → IN_TRANSIT → ARRIVED → OUT_FOR_DELIVERY → COMPLETED
  ↓                                                                                    ↑
  └──────────────────────────────── CANCELLED ──────────────────────────────────────┘
```

### Customer Access Paths
```
Invoice:
  Mobile: CustomerOperationsList (getMyInvoices) → Read-only list
  Web:    None (gap)
  
Schedule:
  Mobile: CustomerOperationsList (getMySchedules) → Read-only list
  Web:    None (gap)
```

### Role Hierarchy
```
Admin > Manager > [Checker, Driver] > Customer
  ↓
  Full access: Create, Read, Update, Delete invoices
  Full access: Create, Read, Update, Delete schedules
  
Manager:
  Same as Admin (shared access model)
  
Checker/Driver:
  Read only: Schedules via Firestore
  Read only: Invoices (none currently)
  No create/update/delete
  
Customer:
  Read only: Own invoices via getMyInvoices
  Read only: Own schedules via getMySchedules
  Via Cloud Function access, not direct Firestore
  No create/update/delete
```

---

**End of Report**

*For questions or clarifications, refer to file paths and line numbers provided throughout.*
