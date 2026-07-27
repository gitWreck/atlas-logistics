import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import qrcode from "qrcode-generator";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import StatusBadge from "../ui/StatusBadge";
import {
  assignShipmentToTrip,
  assignDriverToTrip,
  broadcastTripMessage,
  clearTruckDelay,
  createStaffConversation,
  dispatchTrip,
  generateTripManifest,
  getManagerMobileTrip,
  listManagerMobileShipments,
  manualAssignShipmentToTrip,
  releaseForDeliveryOperations,
  recoverFoundPackage,
  resolveManagerMobileTripScan,
  setTruckDelay,
  startReceiving,
  unlockTripManifest,
  unassignShipmentFromTrip,
  updateShipmentPackages,
  updateTripStatus,
} from "../utilities/FirebaseFunctions";
import useManagerRequest from "./useManagerRequest";
import ManagerQuickCreateModal from "./ManagerQuickCreateModal";
import ManagerTripScheduleModal from "./ManagerTripScheduleModal";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ManagerCard,
  ManagerHeader,
  SectionTitle,
  formatDate,
} from "./ManagerUI";

const TABS = [
  { key: "status", label: "Status", icon: "truck" },
  { key: "manifest", label: "Manifest", icon: "clipboard" },
  { key: "actions", label: "Actions", icon: "tool" },
];
const STEPS = ["CREATED", "LOADING", "LOADED", "IN_TRANSIT", "ARRIVED", "COMPLETED"];

function manifestStatus(trip) {
  if (trip.manifestStatus) return String(trip.manifestStatus).toUpperCase();
  if (trip.reconciledAt) return "RECONCILED";
  if (trip.receivingStartedAt) return "RECEIVING_IN_PROGRESS";
  return trip.manifestLocked ? "LOCKED" : "OPEN";
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function printDate(value) {
  if (!value) return "—";
  const raw =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value?.seconds
        ? new Date(value.seconds * 1000)
        : new Date(value);
  if (Number.isNaN(raw.getTime())) return "—";
  return raw.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function loadedPackageQty(pkg) {
  const quantity = Math.max(Number(pkg?.quantity) || 1, 1);
  const packageStatus = String(pkg?.status || "").toUpperCase();
  const loadedQty = Number(pkg?.loadedQty);
  if (["LOADED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(packageStatus)) {
    return quantity;
  }
  if (packageStatus === "PARTIALLY_LOADED") {
    return Math.min(Number.isFinite(loadedQty) ? Math.max(loadedQty, 0) : 0, quantity);
  }
  return Number.isFinite(loadedQty) && loadedQty > 0
    ? Math.min(loadedQty, quantity)
    : 0;
}

function shipmentPackageSummary(shipment) {
  const descriptionCounts = {};
  let packageCount = 0;

  if (Array.isArray(shipment.packages) && shipment.packages.length) {
    shipment.packages.forEach((pkg) => {
      const count = loadedPackageQty(pkg);
      if (count <= 0) return;
      const description = String(pkg.description || "Standard Pkg").trim();
      descriptionCounts[description] = (descriptionCounts[description] || 0) + count;
      packageCount += count;
    });
  } else if (Array.isArray(shipment.contents) && shipment.contents.length) {
    shipment.contents.forEach((item) => {
      const count = Math.max(Number(item.count || item.quantity) || 1, 1);
      const description = String(item.desc || item.description || "Standard Pkg").trim();
      descriptionCounts[description] = (descriptionCounts[description] || 0) + count;
      packageCount += count;
    });
  } else if (Array.isArray(shipment.descriptionBreakdown)) {
    shipment.descriptionBreakdown.forEach((item) => {
      const count = Math.max(Number(item.count) || 0, 0);
      if (!count) return;
      const description = String(item.desc || item.description || "Standard Pkg").trim();
      descriptionCounts[description] = (descriptionCounts[description] || 0) + count;
      packageCount += count;
    });
  }

  if (!packageCount) {
    packageCount = Math.max(
      Number(
        shipment.loadedCount ??
          shipment.loadedQty ??
          shipment.totals?.loaded ??
          shipment.totalPackages ??
          shipment.packageCount ??
          0,
      ) || 0,
      0,
    );
    if (packageCount) descriptionCounts["Standard Pkg"] = packageCount;
  }

  return {
    packageCount,
    descriptionBreakdown: Object.entries(descriptionCounts).map(([desc, count]) => ({
      desc,
      count,
    })),
  };
}

function buildMobileManifestPayload(trip, shipments, fallbackTripId) {
  const origin =
    trip.origin ||
    trip.originName ||
    trip.originWarehouseName ||
    trip.originCode ||
    "Warehouse";
  const tripDestination =
    trip.destination ||
    trip.destinationName ||
    trip.destinationWarehouseName ||
    trip.destinationCode ||
    "Direct";
  const groups = new Map();
  let totalPackages = 0;

  shipments.forEach((shipment) => {
    const destination =
      shipment.destinationCity ||
      shipment.destinationName ||
      shipment.municipality ||
      shipment.recipientMunicipality ||
      shipment.recipient?.address?.city ||
      shipment.destinationCode ||
      tripDestination ||
      "UNKNOWN";
    const destinationCode =
      shipment.destinationCode || String(destination).toUpperCase();
    const routeCode =
      shipment.route ||
      `${shipment.originCode || trip.originCode || origin} → ${destinationCode}`;
    const summary = shipmentPackageSummary(shipment);
    totalPackages += summary.packageCount;
    if (!groups.has(destinationCode)) {
      groups.set(destinationCode, {
        destination,
        routeCode,
        items: [],
      });
    }
    groups.get(destinationCode).items.push({
      shipmentId:
        shipment.shipmentId ||
        shipment.trackingNumber ||
        shipment.trackingShipmentId ||
        shipment.id ||
        "—",
      packageCount: summary.packageCount,
      descriptionBreakdown: summary.descriptionBreakdown,
      note:
        shipment.isFragile ||
        shipment.packages?.some((pkg) => pkg.isFragile) ||
        shipment.contents?.some((item) => item.isFragile)
          ? "Fragile"
          : "",
    });
  });

  const tripDocumentId = trip.id || fallbackTripId || trip.tripId || "";
  const isLocked = trip.manifestLocked === true;
  return {
    tripId: tripDocumentId,
    tripNumber: trip.tripId || tripDocumentId || "T-PENDING",
    driverName: trip.driverName || trip.assignedDriverName || "Unassigned",
    truckPlate:
      trip.truckPlateNumber || trip.plateNumber || trip.vehiclePlate || "—",
    origin,
    route: trip.route || `${origin} → ${tripDestination}`,
    sealedAt:
      trip.manifestGeneratedAt ||
      trip.manifestLockedAt ||
      trip.lockedAt ||
      trip.updatedAt,
    version:
      trip.manifestVersion || (isLocked ? "v1.0-LOCKED" : "DRAFT-PREVIEW"),
    manifestHash: trip.manifestHash || "DRAFT-NO-HASH-GENERATED",
    verifyUrl: `https://atlastransport.ph/verify/${encodeURIComponent(
      tripDocumentId,
    )}`,
    stamps: isLocked ? ["LOCKED", "OFFICIAL RECORD"] : ["DRAFT", "UNVERIFIED"],
    totals: {
      shipments: shipments.length,
      packages: totalPackages,
      destinations: groups.size,
    },
    destinations: Array.from(groups.values()),
  };
}

function buildManifestPrintHtml(manifest) {
  const qr = qrcode(0, "M");
  qr.addData(manifest.verifyUrl);
  qr.make();
  const qrSvg = qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
  const destinationCards = manifest.destinations
    .map((group) => {
      const subtotal = group.items.reduce(
        (sum, item) => sum + Number(item.packageCount || 0),
        0,
      );
      const rows = group.items
        .map((item) => {
          const breakdown = item.descriptionBreakdown?.length
            ? item.descriptionBreakdown
                .map(
                  (line) =>
                    `<div><span class="muted">${htmlEscape(line.desc)}:</span> ${htmlEscape(
                      line.count,
                    )}</div>`,
                )
                .join("") +
              (item.descriptionBreakdown.length > 1
                ? `<div class="breakdown-total">Total: ${htmlEscape(
                    item.packageCount,
                  )}</div>`
                : "")
            : htmlEscape(item.packageCount);
          return `<tr>
            <td class="tracking">${htmlEscape(item.shipmentId)}
              ${item.note ? `<span class="note">${htmlEscape(item.note)}</span>` : ""}
            </td>
            <td class="packages">${breakdown}</td>
          </tr>`;
        })
        .join("");
      return `<section class="destination">
        <div class="destination-head">
          <div><strong>DESTINATION: ${htmlEscape(group.destination)}</strong>
          <small>Route: ${htmlEscape(group.routeCode || "—")}</small></div>
          <span>${group.items.length} Tracking #</span>
        </div>
        <table><thead><tr><th>Tracking Number</th><th class="right">Packages</th></tr></thead>
        <tbody>${rows}<tr class="subtotal"><td>Total Pieces</td><td>${subtotal}</td></tr></tbody></table>
      </section>`;
    })
    .join("");
  const stamps = manifest.stamps
    .map((stamp) => `<span class="stamp">${htmlEscape(stamp)}</span>`)
    .join("");

  return `<!doctype html>
  <html><head><meta charset="utf-8"><style>
    @page{size:Letter;margin:12mm}
    *{box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:0;font-size:11px;-webkit-print-color-adjust:exact}
    .header{display:grid;grid-template-columns:1.4fr .6fr;gap:28px;margin-bottom:24px}
    .brand{display:flex;gap:16px;align-items:flex-start}
    .logo{width:64px;height:64px;display:flex;align-items:center;justify-content:center;flex:0 0 64px}
    .logo img{display:block;width:64px;height:64px;object-fit:contain}
    h1{font-size:18px;line-height:1.12;margin:0;text-transform:uppercase;font-weight:900}
    .subtitle{font-size:9px;color:#64748b;line-height:1.35;margin:6px 0 8px;max-width:330px}
    .stamp{display:inline-block;border:1px solid #cbd5e1;background:#f1f5f9;border-radius:99px;padding:2px 7px;margin-right:4px;font-size:8px;font-weight:700;letter-spacing:.4px}
    .verify{display:grid;grid-template-columns:80px 1fr;gap:12px;align-items:center;border:1px dashed #cbd5e1;border-radius:12px;padding:12px;background:#f8fafc}
    .qr{width:80px;height:80px;background:#fff;border:1px solid #e2e8f0;border-radius:7px;padding:4px}.qr svg{width:100%;height:100%}
    .verify p{font-size:8px;color:#64748b;line-height:1.35;margin:0 0 5px;word-break:break-all}
    .hash{font-family:monospace;font-size:7px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:4px;word-break:break-all}
    .rule{border:0;border-top:2px solid #e2e8f0;margin:0 0 24px}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:18px 28px;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-bottom:24px}
    .label,.section-label{display:block;color:#94a3b8;font-size:8px;text-transform:uppercase;letter-spacing:.7px;font-weight:700;margin-bottom:3px}
    .value{font-weight:700;font-size:11px}
    .section-label{margin:0 0 6px}
    .totals{display:grid;grid-template-columns:repeat(3,1fr);border:2px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px}
    .total{text-align:center;background:#f8fafc;padding:14px;border-right:1px solid #e2e8f0}.total:last-child{border-right:0}
    .total strong{display:block;font-size:20px;margin-top:4px}
    .destination{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:12px;break-inside:avoid}
    .destination-head{display:flex;justify-content:space-between;align-items:center;background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:7px 11px;font-size:10px}
    .destination-head small{display:block;color:#64748b;margin-top:2px;font-size:8px}.destination-head>span{font-size:8px;font-weight:700;background:#fff;border:1px solid #e2e8f0;border-radius:5px;padding:4px 6px}
    table{width:100%;border-collapse:collapse}th,td{padding:7px 11px;border-bottom:1px solid #f1f5f9;text-align:left;font-size:9px}
    th{text-transform:uppercase;color:#94a3b8;font-size:8px}.right,.packages{text-align:right}.tracking{font-family:monospace;font-weight:600}
    .note{display:block;font-family:Arial;color:#94a3b8;font-size:7px;margin-top:2px}.muted{color:#64748b;font-weight:500}.breakdown-total{border-top:1px solid #e2e8f0;margin-top:2px;padding-top:2px}
    .subtotal td{background:#f8fafc;font-weight:700;text-align:right;text-transform:uppercase}.subtotal td:last-child{color:#0f172a}
    .signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:6px 0 20px;break-inside:avoid}
    .signature{height:82px;border:1px solid #cbd5e1;border-radius:8px;padding:10px;display:flex;flex-direction:column;justify-content:space-between}.signature i{border-top:1px solid #cbd5e1}
    .legal{background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:14px;font-size:7.5px;line-height:1.5;text-align:justify;break-inside:avoid}
    .legal h2{text-align:center;font-size:10px;text-transform:uppercase;margin:0 0 2px}.legal .legal-sub{text-align:center;color:#64748b;font-style:italic;margin:0 0 9px}
    .legal h3{font-size:8px;text-transform:uppercase;border-bottom:1px solid #cbd5e1;padding-bottom:3px;margin:9px 0 4px}.legal p{margin:0 0 5px}.audit{text-align:center;color:#64748b;font-style:italic;border-top:1px solid #cbd5e1;padding-top:7px;margin-top:8px}
  </style></head><body>
    <header class="header">
      <div class="brand"><div class="logo"><img src="https://atlastransport.ph/atlas-logo.png" alt="Atlas Logistics"></div><div>
        <h1>Atlas Official Sealed Bill<br>of Lading<br>&amp; Cargo Declaration</h1>
        <p class="subtitle">Atlas Logistics Platform — digitally sealed cargo ledger for port / RORO / checkpoint verification.</p>
        ${stamps}
      </div></div>
      <div class="verify"><div class="qr">${qrSvg}</div><div>
        <p>Scan to verify authenticity at port.<br><strong>${htmlEscape(manifest.verifyUrl)}</strong></p>
        <div class="hash">Hash: ${htmlEscape(manifest.manifestHash)}</div>
      </div></div>
    </header>
    <hr class="rule">
    <section class="meta">
      <div><span class="label">Trip ID</span><span class="value">${htmlEscape(manifest.tripId)}</span></div>
      <div><span class="label">Driver</span><span class="value">${htmlEscape(manifest.driverName)}</span></div>
      <div><span class="label">Truck Plate</span><span class="value">${htmlEscape(manifest.truckPlate)}</span></div>
      <div><span class="label">Origin</span><span class="value">${htmlEscape(manifest.origin)}</span></div>
      <div><span class="label">Route</span><span class="value">${htmlEscape(manifest.route)}</span></div>
      <div><span class="label">Sealed At</span><span class="value">${htmlEscape(printDate(manifest.sealedAt))}</span></div>
      <div><span class="label">Version</span><span class="value">${htmlEscape(manifest.version)}</span></div>
    </section>
    <span class="section-label">Trip Totals</span>
    <section class="totals">
      <div class="total"><span class="label">Total Shipments</span><strong>${manifest.totals.shipments}</strong></div>
      <div class="total"><span class="label">Total Packages</span><strong>${manifest.totals.packages}</strong></div>
      <div class="total"><span class="label">Destinations</span><strong>${manifest.totals.destinations}</strong></div>
    </section>
    <span class="section-label">Packages by Destination</span>
    ${destinationCards || '<p class="subtitle">No shipments are currently included in this manifest.</p>'}
    <span class="section-label">Signatures</span>
    <section class="signatures">
      <div class="signature"><span class="label">Driver Signature</span><i></i></div>
      <div class="signature"><span class="label">Warehouse / Dispatcher</span><i></i></div>
      <div class="signature"><span class="label">Port Officer</span><i></i></div>
    </section>
    <section class="legal">
      <h2>Atlas Official Sealed Bill of Lading &amp; Cargo Declaration</h2>
      <p class="legal-sub">(Shipping Manifest, Chain-of-Custody Record &amp; Sealed-Cargo Enforcement Instrument)</p>
      <p>This document constitutes the <strong>exclusive and final cargo ledger</strong> for the referenced trip and forms an integral and controlling part of the Contract of Carriage governing this shipment.</p>
      <p>This Shipping Manifest was digitally generated and sealed by the <strong>Atlas Logistics Platform</strong>. It represents the complete, final, and authoritative record of all cargo loaded onto this vehicle for the specified trip.</p>
      <h3>Sealed Cargo Protocol</h3>
      <p>Once sealed, package identities, quantities, and destinations are final and immutable. Any unauthorized modification, substitution, removal, opening, inspection, transfer, or unloading invalidates this manifest. Validation must be performed using the QR code or manifest hash.</p>
      <p><strong>Designated route: ${htmlEscape(manifest.route)}</strong></p>
      <h3>Unauthorized Access &amp; Legal Consequences</h3>
      <p>Unauthorized interference with sealed freight triggers Atlas audit and incident logging and may expose the responsible party to contractual, civil, and other liability. Atlas Logistics reserves all available legal remedies.</p>
      <h3>Legal &amp; Audit Authority</h3>
      <p>Atlas maintains a permanent cryptographic and operational audit trail. This manifest serves as the sealed bill of lading, cargo declaration, and chain-of-custody record for the referenced trip.</p>
      <div class="audit">Audit Notice: Verification must be performed using the QR code or manifest hash. If verification does not validate, notify Atlas Operations immediately.</div>
    </section>
  </body></html>`;
}

export default function ManagerTripDetailsScreen() {
  const { tripId, tab: initialTab } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [tab, setTab] = React.useState(
    ["status", "manifest", "actions"].includes(String(initialTab))
      ? String(initialTab)
      : "status",
  );
  const [driverModal, setDriverModal] = React.useState(false);
  const [scheduleVisible, setScheduleVisible] = React.useState(false);
  const [unlockMode, setUnlockMode] = React.useState(false);
  const [unlockReason, setUnlockReason] = React.useState("");
  const [foundModal, setFoundModal] = React.useState(false);
  const [foundLabel, setFoundLabel] = React.useState("");
  const [foundRemarks, setFoundRemarks] = React.useState("");
  const [operationModal, setOperationModal] = React.useState(null);
  const [scanLabel, setScanLabel] = React.useState("");
  const [scanMode, setScanMode] = React.useState("loading");
  const [scanOutcome, setScanOutcome] = React.useState("LOADED");
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [scanFeedback, setScanFeedback] = React.useState(null);
  const [manualShipmentRef, setManualShipmentRef] = React.useState("");
  const [manualReason, setManualReason] = React.useState("");
  const [forcedStatus, setForcedStatus] = React.useState("");
  const [delayReason, setDelayReason] = React.useState("");
  const [notifyCustomers, setNotifyCustomers] = React.useState(true);
  const [broadcastMessage, setBroadcastMessage] = React.useState("");
  const scanProcessingRef = React.useRef(false);
  const [manifestSearch, setManifestSearch] = React.useState("");
  const [shipmentMenu, setShipmentMenu] = React.useState(null);
  const [addShipmentVisible, setAddShipmentVisible] = React.useState(false);
  const [availableShipments, setAvailableShipments] = React.useState([]);
  const [availableSearch, setAvailableSearch] = React.useState("");
  const [loadingAvailable, setLoadingAvailable] = React.useState(false);
  const [invoiceShipment, setInvoiceShipment] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const id = tripId ? String(tripId) : "";
  const { data, loading, refreshing, error, reload } = useManagerRequest(
    getManagerMobileTrip,
    { tripId: id },
  );
  const invoiceInitialValues = React.useMemo(
    () =>
      invoiceShipment
        ? {
            shipmentId:
              invoiceShipment.id ||
              invoiceShipment.trackingNumber ||
              invoiceShipment.shipmentId ||
              "",
            billingName:
              invoiceShipment.customerName ||
              invoiceShipment.recipientName ||
              invoiceShipment.recipient?.name ||
              "",
            billingAddress:
              invoiceShipment.recipientAddress ||
              invoiceShipment.recipient?.address?.formatted ||
              "",
          }
        : undefined,
    [invoiceShipment],
  );

  if (loading) return <LoadingState label="Loading trip details…" />;
  if (error) return <ErrorState message={error.message} onRetry={() => reload()} />;

  const trip = data?.trip || {};
  const shipments = data?.shipments || [];
  const auditEntries = data?.auditEntries || [];
  const status = String(trip.status || "CREATED").toUpperCase();
  const currentIndex = STEPS.indexOf(status);
  const issue = trip.delayReason || trip.issue || trip.issueReport || trip.reportedIssue;
  const resolvedManifestStatus = manifestStatus(trip);
  const isHubTransfer =
    String(trip.tripType || "").toUpperCase() === "HUB_TRANSFER" ||
    Boolean(trip.originCode && trip.destinationCode);
  const canDispatch =
    isHubTransfer &&
    resolvedManifestStatus === "LOCKED" &&
    ((!trip.manifestReopenedAt &&
      (status === "LOADED" ||
        (status === "IN_TRANSIT" && !trip.dispatchedAt))) ||
      (trip.manifestReopenedAt &&
        ["ARRIVED", "LOADED", "LOADING"].includes(status) &&
        !trip.correctionDispatchedAt));
  const canReceive =
    isHubTransfer &&
    resolvedManifestStatus === "LOCKED" &&
    ((!trip.receivingStartedAt && status === "IN_TRANSIT") ||
      (trip.manifestReopenedAt &&
        ((status === "ARRIVED" && trip.correctionDispatchedAt) ||
          (status === "IN_TRANSIT" &&
            trip.dispatchedAt &&
            trip.receivingStartedAt))));
  const profileRole = String(profile?.role || "").toLowerCase();
  const loadedPieces = shipments.reduce(
    (total, shipment) =>
      total + Number(shipment.loadedCount || shipment.loadedQty || shipment.quantity || 0),
    0,
  );
  const totalPieces = shipments.reduce(
    (total, shipment) =>
      total + Number(shipment.totalPackages || shipment.packageCount || shipment.quantity || 1),
    0,
  );
  const manifestPercent = totalPieces
    ? Math.min(100, Math.round((loadedPieces / totalPieces) * 100))
    : 0;
  const manifestEditable = trip.manifestLocked !== true;
  const canUnlockManifestMobile =
    resolvedManifestStatus === "LOCKED" ||
    (profileRole === "admin" && resolvedManifestStatus === "RECONCILED");
  const canRemoveShipment =
    profileRole === "admin" || (profileRole === "manager" && manifestEditable);
  const manifestTerm = manifestSearch.trim().toLowerCase();
  const filteredShipments = shipments.filter((shipment) =>
    !manifestTerm
      ? true
      : [
          shipment.id,
          shipment.shipmentId,
          shipment.trackingNumber,
          shipment.trackingShipmentId,
          shipment.customerName,
          shipment.recipientName,
          shipment.recipient?.name,
          shipment.municipality,
          shipment.recipientMunicipality,
          shipment.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(manifestTerm),
  );
  const currentShipmentIds = new Set(
    shipments
      .flatMap((shipment) => [
        shipment.id,
        shipment.shipmentId,
        shipment.trackingNumber,
        shipment.trackingShipmentId,
      ])
      .filter(Boolean)
      .map(String),
  );
  const availableTerm = availableSearch.trim().toLowerCase();
  const filteredAvailableShipments = availableShipments.filter((shipment) => {
    const identifiers = [
      shipment.id,
      shipment.shipmentId,
      shipment.trackingNumber,
      shipment.trackingShipmentId,
    ]
      .filter(Boolean)
      .map(String);
    if (identifiers.some((value) => currentShipmentIds.has(value))) return false;
    if (!availableTerm) return true;
    return [
      ...identifiers,
      shipment.customerName,
      shipment.recipientName,
      shipment.recipient?.name,
      shipment.municipality,
      shipment.recipientMunicipality,
      shipment.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(availableTerm);
  });

  const runAction = async (callable, payload, failureTitle) => {
    try {
      setSaving(true);
      await callable(payload);
      await reload({ refresh: true });
      return true;
    } catch (nextError) {
      Alert.alert(failureTitle, nextError.message || "Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmAction = ({ title, message, confirm, callable, payload, danger = false }) => {
    if (saving) return;
    Alert.alert(title, message, [
      { text: "Back", style: "cancel" },
      {
        text: confirm,
        style: danger ? "destructive" : "default",
        onPress: () => runAction(callable, payload, `${title} failed`),
      },
    ]);
  };

  const assignDriver = async (driver) => {
    await runAction(
      assignDriverToTrip,
      {
        tripId: trip.id,
        driverId: driver.id,
        truckPlateNumber: trip.truckPlateNumber || null,
        truckId: trip.truckId || null,
      },
      "Driver not assigned",
    );
    setDriverModal(false);
  };
  const printManifest = async () => {
    try {
      setSaving(true);
      const manifest = buildMobileManifestPayload(trip, shipments, id);
      const manifestHtml = buildManifestPrintHtml(manifest);
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        typeof document !== "undefined"
      ) {
        await new Promise((resolve, reject) => {
          const printFrame = document.createElement("iframe");
          printFrame.setAttribute("title", "Atlas Manifest Print Document");
          printFrame.style.position = "fixed";
          printFrame.style.left = "-10000px";
          printFrame.style.top = "0";
          printFrame.style.width = "816px";
          printFrame.style.height = "1056px";
          printFrame.style.border = "0";
          printFrame.style.opacity = "0";

          const removeFrame = () => {
            window.setTimeout(() => printFrame.remove(), 500);
          };
          printFrame.onerror = () => {
            removeFrame();
            reject(new Error("The manifest print document could not be created."));
          };
          printFrame.onload = () => {
            window.setTimeout(() => {
              try {
                const frameWindow = printFrame.contentWindow;
                if (!frameWindow) {
                  throw new Error("The manifest print document is unavailable.");
                }
                frameWindow.focus();
                frameWindow.print();
                removeFrame();
                resolve();
              } catch (printError) {
                removeFrame();
                reject(printError);
              }
            }, 350);
          };
          document.body.appendChild(printFrame);
          printFrame.srcdoc = manifestHtml;
        });
      } else {
        await Print.printAsync({
          html: manifestHtml,
        });
      }
    } catch (error) {
      Alert.alert("Unable to print manifest", error.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const printManifestLegacy = async () => {
    try {
      setSaving(true);
      const rows = shipments
        .map(
          (shipment) => `
            <tr>
              <td>${htmlEscape(
                shipment.trackingNumber ||
                  shipment.trackingShipmentId ||
                  shipment.id,
              )}</td>
              <td>${htmlEscape(
                shipment.customerName || shipment.recipientName || "",
              )}</td>
              <td>${htmlEscape(
                shipment.municipality ||
                  shipment.recipientMunicipality ||
                  "",
              )}</td>
              <td>${htmlEscape(
                shipment.status || shipment.masterStatus || "",
              )}</td>
            </tr>`,
        )
        .join("");
      await Print.printAsync({
        html: `<!doctype html><html><head><meta charset="utf-8"><style>
          body{font-family:Arial,sans-serif;color:#0f172a;padding:24px}
          h1{font-size:22px;margin:0 0 6px}p{font-size:12px;color:#475569}
          table{width:100%;border-collapse:collapse;margin-top:22px}
          th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:10px}
          th{background:#f1f5f9;text-transform:uppercase}
        </style></head><body>
          <h1>Trip Manifest — ${htmlEscape(trip.tripId || trip.id)}</h1>
          <p>${htmlEscape(
            `${trip.origin || trip.originCode || "Divisoria"} → ${
              trip.destination || trip.destinationCode || "Odiongan"
            }`,
          )}</p>
          <p>Driver: ${htmlEscape(
            trip.driverName || "Unassigned",
          )} &nbsp; Truck: ${htmlEscape(
            trip.truckPlateNumber || trip.vehiclePlate || "Unassigned",
          )}</p>
          <table><thead><tr><th>Shipment</th><th>Customer</th><th>Municipality</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody></table>
        </body></html>`,
      });
    } catch (error) {
      Alert.alert("Unable to print manifest", error.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const exportManifest = async () => {
    try {
      setSaving(true);
      const header = ["Shipment", "Customer", "Municipality", "Status"];
      const rows = shipments.map((shipment) => [
        shipment.trackingNumber ||
          shipment.trackingShipmentId ||
          shipment.id,
        shipment.customerName || shipment.recipientName || "",
        shipment.municipality || shipment.recipientMunicipality || "",
        shipment.status || shipment.masterStatus || "",
      ]);
      const csv = [header, ...rows]
        .map((row) => row.map(csvValue).join(","))
        .join("\r\n");
      const safeId = String(trip.tripId || trip.id || "trip")
        .replace(/[^a-z0-9_-]/gi, "-");
      const uri = `${FileSystem.cacheDirectory}${safeId}-manifest.csv`;
      await FileSystem.writeAsStringAsync(uri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "text/csv",
          dialogTitle: `Export ${trip.tripId || trip.id} manifest`,
          UTI: "public.comma-separated-values-text",
        });
      } else {
        Alert.alert("Manifest exported", uri);
      }
    } catch (error) {
      Alert.alert("Unable to export manifest", error.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const shipmentIdentifier = (shipment = {}) =>
    shipment.id ||
    shipment.trackingNumber ||
    shipment.trackingShipmentId ||
    shipment.shipmentId;
  const shipmentTracking = (shipment = {}) =>
    shipment.trackingNumber ||
    shipment.trackingShipmentId ||
    shipment.shipmentId ||
    shipment.id;
  const labelHtml = (shipment) => `
    <section class="label">
      <div class="brand">ATLAS TRANSPORT</div>
      <div class="tracking">${htmlEscape(shipmentTracking(shipment))}</div>
      <div class="row"><strong>Customer</strong><span>${htmlEscape(
        shipment.customerName ||
          shipment.recipientName ||
          shipment.recipient?.name ||
          "Not assigned",
      )}</span></div>
      <div class="row"><strong>Destination</strong><span>${htmlEscape(
        shipment.municipality ||
          shipment.recipientMunicipality ||
          shipment.recipient?.address?.city ||
          "Not assigned",
      )}</span></div>
      <div class="row"><strong>Status</strong><span>${htmlEscape(
        shipment.status || shipment.masterStatus || "UNKNOWN",
      )}</span></div>
    </section>`;
  const printLabels = async (rows) => {
    if (!rows.length) {
      Alert.alert("No labels", "This manifest has no shipment labels to print.");
      return;
    }
    try {
      setSaving(true);
      await Print.printAsync({
        html: `<!doctype html><html><head><meta charset="utf-8"><style>
          @page{size:4in 6in;margin:.2in}
          body{font-family:Arial,sans-serif;color:#0f172a;margin:0}
          .label{box-sizing:border-box;min-height:5.5in;border:2px solid #0f172a;padding:22px;page-break-after:always}
          .label:last-child{page-break-after:auto}.brand{font-size:13px;font-weight:800;letter-spacing:1px}
          .tracking{font-size:25px;font-weight:900;margin:24px 0;word-break:break-all}
          .row{display:flex;justify-content:space-between;gap:14px;border-top:1px solid #cbd5e1;padding:12px 0;font-size:12px}
          .row span{text-align:right}
        </style></head><body>${rows.map(labelHtml).join("")}</body></html>`,
      });
    } catch (printError) {
      Alert.alert(
        "Unable to print labels",
        printError.message || "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  const openAddShipments = async () => {
    if (!manifestEditable) {
      Alert.alert(
        "Manifest locked",
        "Unlock the manifest before adding shipments.",
      );
      return;
    }
    setAddShipmentVisible(true);
    setAvailableSearch("");
    try {
      setLoadingAvailable(true);
      const response = await listManagerMobileShipments({});
      setAvailableShipments(response?.data?.shipments || []);
    } catch (listError) {
      Alert.alert(
        "Shipments unavailable",
        listError.message || "Please try again.",
      );
    } finally {
      setLoadingAvailable(false);
    }
  };
  const addShipment = async (shipment) => {
    const added = await runAction(
      assignShipmentToTrip,
      {
        trackingShipmentId: shipmentIdentifier(shipment),
        tripId: trip.id,
      },
      "Shipment not added",
    );
    if (added) {
      setAvailableShipments((current) =>
        current.filter(
          (item) => shipmentIdentifier(item) !== shipmentIdentifier(shipment),
        ),
      );
    }
  };
  const removeShipment = (shipment) => {
    setShipmentMenu(null);
    confirmAction({
      title: "Remove shipment",
      message: `Remove ${shipmentTracking(shipment)} from this manifest?`,
      confirm: "Remove",
      callable: unassignShipmentFromTrip,
      payload: {
        trackingShipmentId: shipmentIdentifier(shipment),
        tripId: trip.id,
      },
      danger: true,
    });
  };
  const viewPackages = (shipment) => {
    setShipmentMenu(null);
    router.push({
      pathname: "/(manager)/shipment-details",
      params: { shipmentId: shipmentIdentifier(shipment), tab: "items" },
    });
  };
  const isAdmin = ["admin", "administrator"].includes(profileRole);
  const closeOperationModal = () => {
    if (!saving) {
      setCameraOpen(false);
      setOperationModal(null);
    }
  };
  const completeOperation = async (callable, payload, failureTitle) => {
    const completed = await runAction(callable, payload, failureTitle);
    if (completed) setOperationModal(null);
    return completed;
  };
  const openScanCamera = async () => {
    setScanFeedback(null);
    if (cameraPermission?.granted) {
      setCameraOpen(true);
      return;
    }
    const permissionResult = await requestCameraPermission();
    if (permissionResult?.granted) {
      setCameraOpen(true);
      return;
    }
    Alert.alert(
      "Camera permission required",
      "Allow camera access to scan package labels, or use manual entry.",
    );
  };
  const processTripScan = async (rawCode) => {
    const code = String(rawCode || "").trim();
    if (!code || scanProcessingRef.current) return;
    scanProcessingRef.current = true;
    setSaving(true);
    setScanFeedback(null);
    try {
      let resolved = null;
      try {
        const resolveResult = await resolveManagerMobileTripScan({
          tripId: trip.id,
          scanCode: code,
        });
        resolved = resolveResult?.data || null;
      } catch (resolverError) {
        // Production clients can still scan while the optimized resolver rolls
        // out by using the already-scoped Manager shipment list.
        const listResult = await listManagerMobileShipments({});
        const normalizedCode = code.toUpperCase();
        const manifestIds = new Set(
          shipments
            .flatMap((shipment) => [
              shipment.id,
              shipment.shipmentId,
              shipment.trackingNumber,
              shipment.trackingShipmentId,
            ])
            .filter(Boolean)
            .map((value) => String(value)),
        );
        const shipment = (listResult?.data?.shipments || []).find((item) => {
          const identifiers = [
            item.id,
            item.shipmentId,
            item.trackingNumber,
            item.trackingShipmentId,
          ]
            .filter(Boolean)
            .map((value) => String(value));
          const onManifest = identifiers.some((value) =>
            manifestIds.has(value),
          );
          if (!onManifest) return false;
          return [
            ...identifiers,
            ...(item.packageBarcodes || []),
            ...(item.packages || []).flatMap((pkg) => [
              pkg.packageId,
              pkg.trackingNumber,
            ]),
          ]
            .filter(Boolean)
            .some(
              (value) =>
                String(value).trim().toUpperCase() === normalizedCode,
            );
        });
        if (!shipment) throw resolverError;
        const exactPackages = (shipment.packages || []).filter((pkg) =>
          [pkg.packageId, pkg.trackingNumber]
            .filter(Boolean)
            .some(
              (value) =>
                String(value).trim().toUpperCase() === normalizedCode,
            ),
        );
        const packageSource = exactPackages.length
          ? exactPackages
          : shipment.packages || [];
        resolved = {
          shipmentId: shipment.id,
          packageRows: packageSource
            .map((pkg) => ({
              packageId: pkg.packageId || pkg.trackingNumber,
              quantity: Math.max(Number(pkg.quantity) || 1, 1),
            }))
            .filter((pkg) => pkg.packageId),
        };
      }
      const packageRows = Array.isArray(resolved.packageRows)
        ? resolved.packageRows
        : [];
      if (!resolved.shipmentId || !packageRows.length) {
        throw new Error("No package rows were found for this label.");
      }
      const packageIds = packageRows.map((row) => row.packageId);
      const manualQty = Object.fromEntries(
        packageRows.map((row) => [row.packageId, Number(row.quantity) || 1]),
      );
      await updateShipmentPackages({
        shipmentId: resolved.shipmentId,
        tripId: trip.id,
        packageIds,
        newStatus: scanOutcome,
        manualQty,
        scanAction: scanMode === "loading" ? "LOAD" : "UNLOAD",
        remarks: `Manager mobile ${scanMode === "loading" ? "load" : "unload"} scan`,
      });
      setScanLabel("");
      setCameraOpen(false);
      setScanFeedback({
        success: true,
        message: `${code} marked ${scanOutcome.replace(/_/g, " ").toLowerCase()}.`,
      });
      await reload({ refresh: true });
    } catch (scanError) {
      setCameraOpen(false);
      setScanFeedback({
        success: false,
        message: scanError.message || "Package scan failed.",
      });
    } finally {
      setSaving(false);
      setTimeout(() => {
        scanProcessingRef.current = false;
      }, 700);
    }
  };
  const reconcileAndRelease = () => {
    const shipmentIds = shipments
      .map((shipment) => shipmentIdentifier(shipment))
      .filter(Boolean);
    if (!shipmentIds.length) {
      Alert.alert("Nothing to reconcile", "This trip has no shipments.");
      return;
    }
    Alert.alert(
      "Reconcile and release",
      "Release all hub-received shipments on this reconciled trip to delivery operations?",
      [
        { text: "Back", style: "cancel" },
        {
          text: "Release",
          onPress: async () => {
            const released = await runAction(
              releaseForDeliveryOperations,
              {
                tripId: trip.id,
                shipmentIds,
                remarks:
                  "Released from Manager mobile after unload reconciliation.",
              },
              "Shipments not released",
            );
            if (released) {
              setScanFeedback({
                success: true,
                message: "Reconciled shipments released to delivery operations.",
              });
            }
          },
        },
      ],
    );
  };
  const messageDriver = async () => {
    const driverId =
      trip.driverId || trip.driverUid || trip.assignedDriverId || null;
    if (!driverId) {
      Alert.alert("Driver unavailable", "Assign a Driver before opening a conversation.");
      return;
    }
    try {
      setSaving(true);
      const response = await createStaffConversation({ contactId: driverId });
      const conversationId = response?.data?.conversationId;
      if (!conversationId) throw new Error("Conversation was not created.");
      router.push({
        pathname: "/(manager)/chat/[conversationId]",
        params: { conversationId: String(conversationId) },
      });
    } catch (messageError) {
      Alert.alert(
        "Unable to message Driver",
        messageError.message || "This Driver is outside your authorized contacts.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ManagerHeader
        back
        title={trip.tripId || trip.id}
        titleNumberOfLines={1}
        titleStyle={styles.tripTitle}
        subtitleStyle={styles.tripSubtitle}
        titleAdjustsFontSizeToFit
        titleMinimumFontScale={0.7}
        subtitle="Active Trip Details"
        actions={[
          {
            key: "scan",
            label: "Scan",
            icon: "maximize",
            onPress: () => {
              const mustUnload =
                trip.manifestLocked === true || status === "IN_TRANSIT";
              setScanMode(mustUnload ? "delivering" : "loading");
              setScanOutcome(mustUnload ? "RECEIVED" : "LOADED");
              setScanFeedback(null);
              setCameraOpen(false);
              setOperationModal("scan");
            },
          },
          {
            key: "found",
            label: "Found",
            icon: "crosshair",
            tone: "green",
            onPress: () => setFoundModal(true),
          },
        ]}
        actionIcon="refresh-cw"
        onAction={() => reload({ refresh: true })}
      />
      <ScrollView
        style={styles.detailScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => reload({ refresh: true })}
            tintColor="#0f766e"
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
      <View style={[styles.summary, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.summaryLine}>
          <StatusBadge status={trip.status} />
          <StatusBadge status={resolvedManifestStatus} />
          <Text style={[styles.summaryRoute, { color: colors.textMuted }]} numberOfLines={1}>
            {trip.origin || trip.originCode || "Divisoria"} → {trip.destination || trip.destinationCode || "Odiongan"}
          </Text>
        </View>
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Feather name={item.icon} size={15} color={active ? "#059669" : colors.textMuted} />
              <Text style={[styles.tabLabel, { color: active ? "#059669" : colors.textMuted }]}>
                {item.label}
                {item.key === "manifest" ? ` (${shipments.length})` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.content}>
        {tab === "status" ? (
          <>
            <ManagerCard>
              <SectionTitle title="Vehicle & Driver" subtitle={trip.tripType || trip.routeType || "Hub transfer"} />
              <View style={styles.grid}>
                <InfoCard label="Driver" value={trip.driverName} icon="user" colors={colors} />
                <InfoCard label="Checker" value={trip.checkerName} icon="user-check" colors={colors} />
                <InfoCard label="Plate Number" value={trip.truckPlateNumber || trip.vehiclePlate} icon="truck" colors={colors} />
                <InfoCard label="Vehicle" value={trip.truckName || trip.vehicleName || trip.truckId} icon="box" colors={colors} />
                <InfoCard label="Origin" value={trip.origin || trip.originCode || "Divisoria"} icon="map-pin" colors={colors} />
                <InfoCard label="Destination" value={trip.destination || trip.destinationCode || "Odiongan"} icon="navigation" colors={colors} />
              </View>
            </ManagerCard>

            <ManagerCard>
              <SectionTitle title="Trip Statistics" />
              <View style={styles.statRow}>
                <Stat label="Shipments" value={shipments.length} colors={colors} />
                <Stat label="Loaded pieces" value={loadedPieces} colors={colors} />
                <Stat label="Total pieces" value={totalPieces} colors={colors} />
              </View>
              <Info label="Municipalities" value={(trip.municipalityCoverage || [trip.municipality]).filter(Boolean).join(", ")} colors={colors} />
              <Info label="Departure" value={formatDate(trip.departedAt || trip.startedAt || trip.departureAt)} colors={colors} />
              <Info label="Arrival" value={formatDate(trip.arrivedAt || trip.arrivalAt)} colors={colors} />
            </ManagerCard>

            <ManagerCard>
              <SectionTitle title="Trip Progress" />
              <View style={styles.steps}>
                {STEPS.map((step, index) => {
                  const complete = currentIndex >= index || status === "COMPLETED";
                  return (
                    <View key={step} style={styles.step}>
                      <View style={[styles.dot, { backgroundColor: complete ? "#0f766e" : colors.border }]} />
                      <Text style={[styles.stepText, { color: complete ? colors.text : colors.textMuted }]}>
                        {step.replace(/_/g, " ")}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ManagerCard>

            <ManagerCard>
              <SectionTitle
                title="Manifest Progress"
                subtitle={`${loadedPieces} of ${totalPieces} pieces loaded`}
              />
              <View
                style={[
                  styles.manifestState,
                  { backgroundColor: colors.cardMuted },
                ]}
              >
                <Feather
                  name={trip.manifestLocked ? "lock" : "unlock"}
                  size={16}
                  color="#0f766e"
                />
                <Text
                  style={[styles.manifestStateText, { color: colors.text }]}
                >
                  Manifest {resolvedManifestStatus.replace(/_/g, " ")}
                </Text>
                <Text
                  style={[styles.manifestPercent, { color: colors.textMuted }]}
                >
                  {manifestPercent}%
                </Text>
              </View>
              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    { width: `${manifestPercent}%` },
                  ]}
                />
              </View>
              <View style={styles.manifestControlGrid}>
                {resolvedManifestStatus === "OPEN" ? (
                  <CompactAction
                    icon="lock"
                    label="Lock Manifest"
                    colors={colors}
                    onPress={() =>
                      confirmAction({
                        title: "Lock manifest",
                        message:
                          "Lock this manifest? Shipment assignments become protected.",
                        confirm: "Lock",
                        callable: generateTripManifest,
                        payload: { tripId: trip.id },
                      })
                    }
                  />
                ) : (
                  <CompactAction
                    icon="unlock"
                    label="Unlock Manifest"
                    colors={colors}
                    disabled={!canUnlockManifestMobile}
                    onPress={() => setUnlockMode(true)}
                  />
                )}
                <CompactAction
                  icon="printer"
                  label="Print Manifest"
                  colors={colors}
                  onPress={printManifest}
                />
                <CompactAction
                  icon="download"
                  label="Export Excel"
                  colors={colors}
                  onPress={exportManifest}
                />
              </View>
              {unlockMode && canUnlockManifestMobile ? (
                <View
                  style={[
                    styles.unlockBox,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.cardMuted,
                    },
                  ]}
                >
                  <Text style={[styles.unlockLabel, { color: colors.text }]}>
                    Reason for unlocking
                  </Text>
                  <TextInput
                    value={unlockReason}
                    onChangeText={setUnlockReason}
                    multiline
                    placeholder="Explain why the manifest must be reopened"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.unlockInput,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  />
                  <View style={styles.unlockActions}>
                    <Pressable
                      onPress={() => {
                        setUnlockMode(false);
                        setUnlockReason("");
                      }}
                      style={[
                        styles.unlockButton,
                        { borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[styles.cancelText, { color: colors.textMuted }]}
                      >
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={!unlockReason.trim() || saving}
                      onPress={async () => {
                        const unlocked = await runAction(
                          unlockTripManifest,
                          {
                            tripId: trip.id,
                            reason: unlockReason.trim(),
                          },
                          "Unlock manifest failed",
                        );
                        if (unlocked) {
                          setUnlockMode(false);
                          setUnlockReason("");
                        }
                      }}
                      style={[
                        styles.unlockButton,
                        styles.unlockConfirm,
                        (!unlockReason.trim() || saving) && styles.disabled,
                      ]}
                    >
                      <Text style={styles.saveText}>Confirm Unlock</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </ManagerCard>

            {issue ? (
              <ManagerCard>
                <SectionTitle title="Reported Issue" subtitle="Requires operational review" />
                <Text style={[styles.issue, { color: colors.warning }]}>
                  {typeof issue === "string" ? issue : issue.description || issue.message || "Trip issue reported"}
                </Text>
              </ManagerCard>
            ) : null}
          </>
        ) : null}

        {tab === "manifest" ? (
          <>
            <ManagerCard>
              <SectionTitle
                title="Shipment Manifest"
                subtitle={`${filteredShipments.length} of ${shipments.length} authorized shipments`}
              />
              <View style={styles.manifestTopActions}>
                <Pressable
                  onPress={() => printLabels(shipments)}
                  style={[
                    styles.manifestTopButton,
                    { borderColor: colors.border },
                  ]}
                >
                  <Feather name="printer" size={15} color="#0f766e" />
                  <Text
                    style={[styles.manifestTopText, { color: colors.text }]}
                  >
                    Print All Labels
                  </Text>
                </Pressable>
                <Pressable
                  disabled={!manifestEditable}
                  onPress={openAddShipments}
                  style={[
                    styles.manifestTopButton,
                    styles.addShipmentButton,
                    !manifestEditable && styles.disabled,
                  ]}
                >
                  <Feather name="plus" size={16} color="#fff" />
                  <Text style={styles.addShipmentText}>Add Shipments</Text>
                </Pressable>
              </View>
              <View
                style={[
                  styles.manifestSearch,
                  {
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Feather name="search" size={16} color={colors.textMuted} />
                <TextInput
                  value={manifestSearch}
                  onChangeText={setManifestSearch}
                  placeholder="Search tracking, customer, destination, or status"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.manifestSearchInput, { color: colors.text }]}
                />
              </View>
            </ManagerCard>

            {filteredShipments.length ? (
              filteredShipments.map((shipment, index) => {
                const shipmentLoaded = Number(
                  shipment.loadedCount || shipment.loadedQty || 0,
                );
                const shipmentTotal = Number(
                  shipment.shipmentPieceTotal ||
                    shipment.totalPackages ||
                    shipment.packageCount ||
                    shipment.quantity ||
                    1,
                );
                return (
                  <ManagerCard
                    key={shipmentIdentifier(shipment) || index}
                    style={styles.manifestShipmentCard}
                  >
                    <View style={styles.manifestCardTop}>
                      <View style={styles.shipmentCopy}>
                        <Text
                          style={[styles.shipmentTitle, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {shipmentTracking(shipment)}
                        </Text>
                        <Text
                          style={[
                            styles.shipmentCustomer,
                            { color: colors.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {shipment.customerName ||
                            shipment.recipientName ||
                            shipment.recipient?.name ||
                            "Customer not assigned"}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityLabel={`Actions for ${shipmentTracking(
                          shipment,
                        )}`}
                        onPress={() => setShipmentMenu(shipment)}
                        style={[
                          styles.moreButton,
                          { backgroundColor: colors.cardMuted },
                        ]}
                      >
                        <Feather
                          name="more-vertical"
                          size={20}
                          color={colors.text}
                        />
                      </Pressable>
                    </View>
                    <View
                      style={[
                        styles.manifestDivider,
                        { backgroundColor: colors.border },
                      ]}
                    />
                    <View style={styles.manifestFields}>
                      <ManifestField
                        icon="map-pin"
                        label="Destination"
                        value={
                          shipment.municipality ||
                          shipment.recipientMunicipality ||
                          shipment.recipient?.address?.city
                        }
                        colors={colors}
                      />
                      <View style={styles.manifestField}>
                        <Text
                          style={[
                            styles.manifestFieldLabel,
                            { color: colors.textMuted },
                          ]}
                        >
                          SHIPMENT STATUS
                        </Text>
                        <StatusBadge
                          status={
                            shipment.status ||
                            shipment.masterStatus ||
                            "UNKNOWN"
                          }
                        />
                      </View>
                      <ManifestField
                        icon="package"
                        label="Trip Progress"
                        value={`${shipmentLoaded} / ${shipmentTotal} loaded`}
                        colors={colors}
                      />
                      <ManifestField
                        icon="hash"
                        label="#"
                        value={String(index + 1)}
                        colors={colors}
                      />
                    </View>
                  </ManagerCard>
                );
              })
            ) : (
              <ManagerCard>
                <EmptyState
                  icon="package"
                  title={
                    shipments.length
                      ? "No matching shipments"
                      : "No manifest shipments found"
                  }
                />
              </ManagerCard>
            )}
          </>
        ) : null}

        {tab === "actions" ? (
          <>
            <ManagerCard>
              <SectionTitle title="Assignments" subtitle="Uses authorized staff from your Manager scope" />
              {["CREATED", "LOADED"].includes(status) ? (
                <ActionButton
                  icon="calendar"
                  label="Edit Trip Schedule"
                  description="Update loading, departure, arrival, and customer notifications"
                  onPress={() => setScheduleVisible(true)}
                  colors={colors}
                />
              ) : null}
              <ActionButton
                icon="user-check"
                label="Assign or change Driver"
                description={trip.driverName || "No Driver assigned"}
                onPress={() => setDriverModal(true)}
                colors={colors}
              />
            </ManagerCard>

            <ManagerCard>
              <SectionTitle title="Manifest Actions" />
              <ActionButton
                icon="search"
                label="Found Package"
                description="Recover a missing or on-trip package using its package label"
                onPress={() => setFoundModal(true)}
                colors={colors}
              />
              <ActionButton
                icon="printer"
                label="Print Manifest"
                description="Open the native print dialog with this trip's authorized manifest"
                onPress={printManifest}
                colors={colors}
              />
              <ActionButton
                icon="download"
                label="Export Manifest"
                description="Create and share a CSV manifest from the current live trip data"
                onPress={exportManifest}
                colors={colors}
              />
              {canDispatch ? (
                <ActionButton
                  icon="truck"
                  label={trip.manifestReopenedAt ? "Dispatch Correction" : "Dispatch Trip"}
                  description="Apply the web dispatch workflow, shipment custody updates, and notifications"
                  onPress={() => confirmAction({
                    title: trip.manifestReopenedAt ? "Dispatch correction" : "Dispatch trip",
                    message: "Dispatch this trip and update all trip-scoped shipments?",
                    confirm: "Dispatch",
                    callable: dispatchTrip,
                    payload: { tripId: trip.id },
                  })}
                  colors={colors}
                />
              ) : null}
              {canReceive ? (
                <ActionButton
                  icon="download"
                  label={trip.receivingStartedAt ? "Resume Receiving" : "Start Receiving"}
                  description="Mark arrival and begin the destination receiving workflow"
                  onPress={() => confirmAction({
                    title: trip.receivingStartedAt ? "Resume receiving" : "Start receiving",
                    message: "Begin receiving this trip at its destination warehouse?",
                    confirm: "Continue",
                    callable: startReceiving,
                    payload: { tripId: trip.id },
                  })}
                  colors={colors}
                />
              ) : null}
              {resolvedManifestStatus === "OPEN" ? (
                <ActionButton
                  icon="lock"
                  label="Lock Manifest"
                  description="Seal the current shipment manifest using the web workflow"
                  onPress={() => confirmAction({
                    title: "Lock manifest",
                    message: "Lock this manifest? Shipment assignments become protected.",
                    confirm: "Lock",
                    callable: generateTripManifest,
                    payload: { tripId: trip.id },
                  })}
                  colors={colors}
                />
              ) : null}
              {resolvedManifestStatus === "LOCKED" ? (
                !unlockMode ? (
                  <ActionButton
                    icon="unlock"
                    label="Unlock Manifest"
                    description="Reopen the manifest for an authorized correction"
                    onPress={() => setUnlockMode(true)}
                    colors={colors}
                  />
                ) : (
                  <View
                    style={[
                      styles.unlockBox,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.cardMuted,
                      },
                    ]}
                  >
                    <Text style={[styles.unlockLabel, { color: colors.text }]}>
                      Reason for unlocking
                    </Text>
                    <TextInput
                      value={unlockReason}
                      onChangeText={setUnlockReason}
                      multiline
                      placeholder="Explain why the manifest must be reopened"
                      placeholderTextColor={colors.textMuted}
                      style={[
                        styles.unlockInput,
                        {
                          color: colors.text,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    />
                    <View style={styles.unlockActions}>
                      <Pressable
                        onPress={() => {
                          setUnlockMode(false);
                          setUnlockReason("");
                        }}
                        style={[styles.unlockButton, { borderColor: colors.border }]}
                      >
                        <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                          Cancel
                        </Text>
                      </Pressable>
                      <Pressable
                        disabled={!unlockReason.trim() || saving}
                        onPress={async () => {
                          const unlocked = await runAction(
                            unlockTripManifest,
                            { tripId: trip.id, reason: unlockReason.trim() },
                            "Unlock manifest failed",
                          );
                          if (unlocked) {
                            setUnlockMode(false);
                            setUnlockReason("");
                          }
                        }}
                        style={[
                          styles.unlockButton,
                          styles.unlockConfirm,
                          (!unlockReason.trim() || saving) && styles.disabled,
                        ]}
                      >
                        <Text style={styles.saveText}>Confirm Unlock</Text>
                      </Pressable>
                    </View>
                  </View>
                )
              ) : null}
              {!["OPEN", "LOCKED"].includes(resolvedManifestStatus) ? (
                <Text style={[styles.actionNotice, { color: colors.textMuted }]}>
                  This manifest is {resolvedManifestStatus.replace(/_/g, " ").toLowerCase()}. Existing web rules prevent Manager reopening where Admin approval is required.
                </Text>
              ) : null}
            </ManagerCard>

            <ManagerCard>
              <SectionTitle
                title="Operational Controls"
                subtitle="The same permission-checked actions used by the web Trip Board"
              />
              <ActionButton
                icon="user-plus"
                label="Manual Assignment"
                description={
                  isAdmin
                    ? "Add a missed shipment or package and record the correction reason"
                    : "Admin authorization is required for manifest corrections"
                }
                disabled={!isAdmin}
                onPress={() => setOperationModal("manual")}
                colors={colors}
              />
              <ActionButton
                icon="truck"
                label="Force Status"
                description="Override the trip status and optionally notify customers"
                onPress={() => setOperationModal("status")}
                colors={colors}
              />
              <ActionButton
                icon="pause-circle"
                label="Delay Controls"
                description="Set or clear a delay and control customer notifications"
                onPress={() => setOperationModal("delay")}
                colors={colors}
              />
              <ActionButton
                icon="send"
                label="Broadcast to Customers"
                description="Send an operational update to authorized customers on this trip"
                onPress={() => setOperationModal("broadcast")}
                colors={colors}
              />
              <ActionButton
                icon="message-circle"
                label="Message Driver"
                description={trip.driverName || "No Driver assigned"}
                disabled={!(
                  trip.driverId ||
                  trip.driverUid ||
                  trip.assignedDriverId
                )}
                onPress={messageDriver}
                colors={colors}
              />
            </ManagerCard>

            <ManagerCard>
              <SectionTitle
                title="Audit Log"
                subtitle={`${auditEntries.length} operational event${auditEntries.length === 1 ? "" : "s"}`}
              />
              {auditEntries.length ? auditEntries.map((entry, index) => (
                <View key={entry.id || index} style={styles.auditRow}>
                  <View style={styles.auditRail}>
                    <View style={styles.auditDot} />
                    {index < auditEntries.length - 1 ? (
                      <View style={[styles.auditLine, { backgroundColor: colors.border }]} />
                    ) : null}
                  </View>
                  <View style={styles.auditCopy}>
                    <Text style={[styles.auditTitle, { color: colors.text }]}>
                      {String(entry.action || entry.type || entry.eventType || "TRIP_UPDATE").replace(/_/g, " ")}
                    </Text>
                    <Text style={[styles.auditMeta, { color: colors.textMuted }]}>
                      {[entry.actorName || entry.user || entry.updatedBy, formatDate(entry.timestamp || entry.createdAt || entry.updatedAt)]
                        .filter(Boolean)
                        .join(" • ")}
                    </Text>
                    {entry.reason || entry.note ? (
                      <Text style={[styles.auditNote, { color: colors.textMuted }]}>
                        {entry.reason || entry.note}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )) : (
                <EmptyState icon="clipboard" title="No audit events recorded" />
              )}
            </ManagerCard>
          </>
        ) : null}
      </View>
      </ScrollView>

      {saving ? (
        <View style={styles.savingOverlay} pointerEvents="auto">
          <View style={[styles.savingCard, { backgroundColor: colors.surface }]}>
            <ActivityIndicator color="#0f766e" />
            <Text style={[styles.savingText, { color: colors.text }]}>Updating trip…</Text>
          </View>
        </View>
      ) : null}

      <Modal
        visible={driverModal}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && setDriverModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Assign Driver</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              Only active Drivers within your assigned warehouse and municipalities are listed.
            </Text>
            <ScrollView style={styles.driverList}>
              {(data?.authorizedDrivers || []).map((driver) => (
                <Pressable
                  key={driver.id}
                  disabled={saving}
                  onPress={() => assignDriver(driver)}
                  style={[styles.driverRow, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.driverCopy}>
                    <Text style={[styles.driverName, { color: colors.text }]}>
                      {driver.name || driver.fullName || driver.email}
                    </Text>
                    <Text style={[styles.driverMeta, { color: colors.textMuted }]}>
                      {[driver.warehouseName || driver.warehouseCode, (driver.assignedMunicipalities || []).join(", ")]
                        .filter(Boolean)
                        .join(" • ")}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
              {(data?.authorizedDrivers || []).length === 0 ? (
                <Text style={[styles.noDrivers, { color: colors.textMuted }]}>
                  No authorized active Drivers are available.
                </Text>
              ) : null}
            </ScrollView>
            <Pressable
              disabled={saving}
              onPress={() => setDriverModal(false)}
              style={[styles.cancelButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <ManagerTripScheduleModal
        visible={scheduleVisible}
        trip={trip}
        trips={[trip]}
        onClose={() => setScheduleVisible(false)}
        onSaved={() => reload({ refresh: true })}
      />
      <Modal
        visible={Boolean(operationModal)}
        transparent
        animationType="slide"
        onRequestClose={closeOperationModal}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              styles.operationSheet,
              { backgroundColor: colors.surface },
            ]}
          >
            <View style={styles.operationHeading}>
              <View style={styles.operationHeadingCopy}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {{
                    scan: "Scan Package",
                    manual: "Manual Assignment",
                    status: "Force Status",
                    delay: "Delay Controls",
                    broadcast: "Broadcast to Customers",
                  }[operationModal] || "Trip Action"}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                  {{
                    scan: "Scan or enter a package label for this trip.",
                    manual: "Admin correction for a missed shipment or package.",
                    status: "Apply the existing trip status and notification workflow.",
                    delay: "Record or clear a delay using the live trip workflow.",
                    broadcast: "Notify customers attached to this authorized manifest.",
                  }[operationModal]}
                </Text>
              </View>
              <Pressable
                disabled={saving}
                onPress={closeOperationModal}
                style={[styles.closeOperation, { backgroundColor: colors.cardMuted }]}
              >
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.operationScroll}
              contentContainerStyle={styles.operationContent}
              keyboardShouldPersistTaps="handled"
            >
              {operationModal === "scan" ? (
                <>
                  <View style={styles.choiceRow}>
                    {[
                      {
                        value: "loading",
                        label: "Load",
                        icon: "truck",
                        disabled:
                          status === "IN_TRANSIT" ||
                          trip.manifestLocked === true,
                      },
                      {
                        value: "delivering",
                        label: "Unload",
                        icon: "rotate-ccw",
                        disabled: false,
                      },
                    ].map((option) => (
                      <Pressable
                        key={option.value}
                        disabled={option.disabled}
                        onPress={() => {
                          setScanMode(option.value);
                          setScanOutcome(
                            option.value === "loading" ? "LOADED" : "RECEIVED",
                          );
                          setScanFeedback(null);
                        }}
                        style={[
                          styles.scanModeCard,
                          { borderColor: colors.border },
                          scanMode === option.value &&
                            (option.value === "loading"
                              ? styles.loadModeActive
                              : styles.unloadModeActive),
                          option.disabled && styles.disabled,
                        ]}
                      >
                        <View
                          style={[
                            styles.scanModeIcon,
                            {
                              backgroundColor:
                                option.value === "loading"
                                  ? "#eff6ff"
                                  : "#fff7ed",
                            },
                          ]}
                        >
                          <Feather
                            name={option.icon}
                            size={20}
                            color={
                              option.value === "loading"
                                ? "#2563eb"
                                : "#f59e0b"
                            }
                          />
                        </View>
                        <Text
                          style={[
                            styles.scanModeText,
                            { color: colors.text },
                          ]}
                        >
                          {option.label}
                        </Text>
                        {option.disabled ? (
                          <Text
                            style={[
                              styles.scanModeReason,
                              { color: colors.textMuted },
                            ]}
                          >
                            {trip.manifestLocked
                              ? "MANIFEST LOCKED"
                              : "IN TRANSIT"}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>

                  {scanMode === "delivering" ? (
                    <>
                      {canReceive ? (
                        <Pressable
                          disabled={saving}
                          onPress={async () => {
                            const started = await runAction(
                              startReceiving,
                              { tripId: trip.id },
                              "Receiving not started",
                            );
                            if (started) {
                              setScanFeedback({
                                success: true,
                                message:
                                  "Receiving started. You can now unload packages.",
                              });
                            }
                          }}
                          style={styles.receivingAction}
                        >
                          <Feather name="play-circle" size={19} color="#fff" />
                          <View style={styles.receivingActionCopy}>
                            <Text style={styles.receivingActionTitle}>
                              Start Receiving
                            </Text>
                            <Text style={styles.receivingActionText}>
                              Open the manifest for hub unload scans
                            </Text>
                          </View>
                          <Feather name="arrow-right" size={18} color="#fff" />
                        </Pressable>
                      ) : null}
                      <Pressable
                        disabled={saving}
                        onPress={reconcileAndRelease}
                        style={styles.reconcileAction}
                      >
                        <View style={styles.reconcileIcon}>
                          <Feather
                            name="clipboard"
                            size={20}
                            color="#fff"
                          />
                        </View>
                        <View style={styles.reconcileCopy}>
                          <View style={styles.reconcileTitleRow}>
                            <Text style={styles.reconcileTitle}>
                              Reconcile & release shipments
                            </Text>
                            <Text style={styles.reconcileBadge}>RECONCILE</Text>
                          </View>
                          <Text style={styles.reconcileText}>
                            Release hub-received shipments to delivery operations
                          </Text>
                        </View>
                        <Feather name="arrow-right" size={20} color="#059669" />
                      </Pressable>
                    </>
                  ) : null}

                  {cameraOpen ? (
                    <View style={styles.managerCamera}>
                      <CameraView
                        style={StyleSheet.absoluteFillObject}
                        facing="back"
                        onBarcodeScanned={
                          saving
                            ? undefined
                            : ({ data: scannedCode }) =>
                                processTripScan(scannedCode)
                        }
                        barcodeScannerSettings={{
                          barcodeTypes: [
                            "qr",
                            "code128",
                            "code39",
                            "pdf417",
                          ],
                        }}
                      />
                      <View style={styles.managerCameraOverlay}>
                        <View style={styles.managerScanFrame} />
                        <Pressable
                          onPress={() => setCameraOpen(false)}
                          style={styles.closeCameraButton}
                        >
                          <Feather name="x" size={17} color="#fff" />
                          <Text style={styles.closeCameraText}>Close camera</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={openScanCamera}
                      style={[
                        styles.openCamera,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.cardMuted,
                        },
                      ]}
                    >
                      <Feather name="camera" size={24} color={colors.text} />
                      <Text style={[styles.openCameraText, { color: colors.text }]}>
                        Open Phone Camera
                      </Text>
                    </Pressable>
                  )}

                  <View
                    style={[
                      styles.scanOutcomePanel,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.cardMuted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.scanOutcomeLabel,
                        { color: colors.textMuted },
                      ]}
                    >
                      SCAN WILL MARK AS
                    </Text>
                    <View style={styles.scanOutcomeRow}>
                      {(scanMode === "loading"
                        ? [
                            ["LOADED", "archive", "Loaded"],
                            ["MISSING", "alert-triangle", "Missing"],
                            ["DAMAGED", "tool", "Damaged"],
                          ]
                        : [
                            ["RECEIVED", "archive", "Received"],
                            ["MISSING", "alert-triangle", "Missing"],
                            ["DAMAGED", "tool", "Damaged"],
                          ]
                      ).map(([value, icon, label]) => {
                        const selected = scanOutcome === value;
                        return (
                          <Pressable
                            key={value}
                            onPress={() => setScanOutcome(value)}
                            style={[
                              styles.scanOutcomeButton,
                              { borderColor: colors.border },
                              selected && styles.scanOutcomeButtonActive,
                            ]}
                          >
                            <Feather
                              name={icon}
                              size={14}
                              color={selected ? "#059669" : colors.text}
                            />
                            <Text
                              style={[
                                styles.scanOutcomeText,
                                {
                                  color: selected ? "#059669" : colors.text,
                                },
                              ]}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View
                    style={[
                      styles.scanStats,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.cardMuted,
                      },
                    ]}
                  >
                    <View style={styles.scanStat}>
                      <Text
                        style={[
                          styles.scanStatLabel,
                          { color: colors.textMuted },
                        ]}
                      >
                        TRIP STATUS
                      </Text>
                      <StatusBadge status={trip.status} />
                    </View>
                    <View style={styles.scanStat}>
                      <Text
                        style={[
                          styles.scanStatLabel,
                          { color: colors.textMuted },
                        ]}
                      >
                        LOADED PACKAGES
                      </Text>
                      <Text style={[styles.scanStatValue, { color: colors.text }]}>
                        {loadedPieces}/{totalPieces}
                      </Text>
                    </View>
                    <View style={styles.scanStat}>
                      <Text
                        style={[
                          styles.scanStatLabel,
                          { color: colors.textMuted },
                        ]}
                      >
                        TOTAL SHIPMENTS
                      </Text>
                      <Text style={[styles.scanStatValue, { color: colors.text }]}>
                        {shipments.length}
                      </Text>
                    </View>
                  </View>

                  {scanFeedback ? (
                    <View
                      style={[
                        styles.scanFeedback,
                        scanFeedback.success
                          ? styles.scanFeedbackSuccess
                          : styles.scanFeedbackError,
                      ]}
                    >
                      <Feather
                        name={
                          scanFeedback.success
                            ? "check-circle"
                            : "alert-circle"
                        }
                        size={17}
                        color={scanFeedback.success ? "#047857" : "#dc2626"}
                      />
                      <Text
                        style={[
                          styles.scanFeedbackText,
                          {
                            color: scanFeedback.success
                              ? "#047857"
                              : "#dc2626",
                          },
                        ]}
                      >
                        {scanFeedback.message}
                      </Text>
                    </View>
                  ) : null}

                  <OperationInput
                    value={scanLabel}
                    onChangeText={setScanLabel}
                    placeholder="Package barcode or label"
                    colors={colors}
                    autoCapitalize="characters"
                  />
                  <PrimaryOperationButton
                    icon="maximize"
                    label={`Mark as ${scanOutcome.replace(/_/g, " ")}`}
                    disabled={!scanLabel.trim() || saving}
                    onPress={() => processTripScan(scanLabel)}
                  />
                </>
              ) : null}

              {operationModal === "manual" ? (
                <>
                  <OperationInput
                    value={manualShipmentRef}
                    onChangeText={setManualShipmentRef}
                    placeholder="Shipment ID or package label"
                    colors={colors}
                    autoCapitalize="characters"
                  />
                  <OperationInput
                    value={manualReason}
                    onChangeText={setManualReason}
                    placeholder="Reason for manual assignment"
                    colors={colors}
                    multiline
                  />
                  <PrimaryOperationButton
                    icon="user-plus"
                    label="Add to Manifest"
                    disabled={
                      !isAdmin ||
                      !manualShipmentRef.trim() ||
                      !manualReason.trim() ||
                      saving
                    }
                    onPress={async () => {
                      const completed = await completeOperation(
                        manualAssignShipmentToTrip,
                        {
                          tripId: trip.id,
                          shipmentRef: manualShipmentRef.trim(),
                          reason: manualReason.trim(),
                        },
                        "Manual assignment failed",
                      );
                      if (completed) {
                        setManualShipmentRef("");
                        setManualReason("");
                      }
                    }}
                  />
                </>
              ) : null}

              {operationModal === "status" ? (
                <>
                  <View style={styles.statusChoices}>
                    {[
                      "CREATED",
                      "LOADING",
                      "LOADED",
                      "IN_TRANSIT",
                      "ARRIVED",
                      "COMPLETED",
                      "CANCELLED",
                    ].map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => setForcedStatus(value)}
                        style={[
                          styles.statusChoice,
                          {
                            borderColor: colors.border,
                            backgroundColor: colors.cardMuted,
                          },
                          forcedStatus === value && styles.statusChoiceActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusChoiceText,
                            {
                              color:
                                forcedStatus === value ? "#fff" : colors.text,
                            },
                          ]}
                        >
                          {value.replace(/_/g, " ")}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <NotifyRow
                    value={notifyCustomers}
                    onChange={() => setNotifyCustomers((current) => !current)}
                    colors={colors}
                  />
                  <PrimaryOperationButton
                    icon="truck"
                    label="Set Trip Status"
                    disabled={!forcedStatus || saving}
                    onPress={() =>
                      completeOperation(
                        updateTripStatus,
                        {
                          tripId: trip.id,
                          status: forcedStatus,
                          notify: notifyCustomers,
                        },
                        "Status update failed",
                      )
                    }
                  />
                </>
              ) : null}

              {operationModal === "delay" ? (
                <>
                  <Text style={[styles.operationLabel, { color: colors.text }]}>
                    Delay reason
                  </Text>
                  <View style={styles.statusChoices}>
                    {["WEATHER", "MECHANICAL", "PORT_CONGESTION", "TRAFFIC"].map(
                      (value) => (
                        <Pressable
                          key={value}
                          onPress={() => setDelayReason(value)}
                          style={[
                            styles.statusChoice,
                            {
                              borderColor: colors.border,
                              backgroundColor: colors.cardMuted,
                            },
                            delayReason === value && styles.delayChoiceActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusChoiceText,
                              {
                                color:
                                  delayReason === value ? "#fff" : colors.text,
                              },
                            ]}
                          >
                            {value.replace(/_/g, " ")}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>
                  <OperationInput
                    value={delayReason}
                    onChangeText={setDelayReason}
                    placeholder="Or type a custom delay reason"
                    colors={colors}
                  />
                  <NotifyRow
                    value={notifyCustomers}
                    onChange={() => setNotifyCustomers((current) => !current)}
                    colors={colors}
                  />
                  <View style={styles.operationButtonRow}>
                    <SecondaryOperationButton
                      icon="play"
                      label="Clear Delay"
                      disabled={saving || !trip.delayReason}
                      colors={colors}
                      onPress={() =>
                        completeOperation(
                          clearTruckDelay,
                          { tripId: trip.id, notify: notifyCustomers },
                          "Unable to clear delay",
                        )
                      }
                    />
                    <PrimaryOperationButton
                      icon="pause"
                      label="Set Delay"
                      compact
                      disabled={!delayReason.trim() || saving}
                      onPress={() =>
                        completeOperation(
                          setTruckDelay,
                          {
                            tripId: trip.id,
                            reason: delayReason.trim(),
                            notify: notifyCustomers,
                          },
                          "Unable to set delay",
                        )
                      }
                    />
                  </View>
                </>
              ) : null}

              {operationModal === "broadcast" ? (
                <>
                  <OperationInput
                    value={broadcastMessage}
                    onChangeText={setBroadcastMessage}
                    placeholder="Write an operational update"
                    colors={colors}
                    multiline
                  />
                  <PrimaryOperationButton
                    icon="send"
                    label="Broadcast Message"
                    disabled={!broadcastMessage.trim() || saving}
                    onPress={async () => {
                      const completed = await completeOperation(
                        broadcastTripMessage,
                        {
                          tripId: trip.id,
                          message: broadcastMessage.trim(),
                        },
                        "Broadcast failed",
                      );
                      if (completed) setBroadcastMessage("");
                    }}
                  />
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={foundModal}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && setFoundModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Recover Found Package
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              Enter the scanned package label. Existing custody and manifest rules are applied.
            </Text>
            <TextInput
              value={foundLabel}
              onChangeText={setFoundLabel}
              autoCapitalize="characters"
              placeholder="Package label"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.foundInput,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.cardMuted,
                },
              ]}
            />
            <TextInput
              value={foundRemarks}
              onChangeText={setFoundRemarks}
              multiline
              placeholder="Remarks (optional)"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.foundInput,
                styles.foundRemarks,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.cardMuted,
                },
              ]}
            />
            <View style={styles.unlockActions}>
              <Pressable
                disabled={saving}
                onPress={() => setFoundModal(false)}
                style={[styles.unlockButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                disabled={saving || !foundLabel.trim()}
                onPress={async () => {
                  const recovered = await runAction(
                    recoverFoundPackage,
                    {
                      tripId: trip.id,
                      packageLabel: foundLabel.trim(),
                      remarks: foundRemarks.trim() || null,
                      sourceUI: "MANAGER_MOBILE_TRIP",
                    },
                    "Package not recovered",
                  );
                  if (recovered) {
                    setFoundModal(false);
                    setFoundLabel("");
                    setFoundRemarks("");
                  }
                }}
                style={[
                  styles.unlockButton,
                  styles.foundConfirm,
                  (saving || !foundLabel.trim()) && styles.disabled,
                ]}
              >
                <Text style={styles.saveText}>Recover Package</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(shipmentMenu)}
        transparent
        animationType="slide"
        onRequestClose={() => setShipmentMenu(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <Text
              style={[styles.modalTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {shipmentMenu ? shipmentTracking(shipmentMenu) : "Shipment"}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              Shipment manifest actions
            </Text>
            <SheetAction
              icon="printer"
              label="Print Label"
              colors={colors}
              onPress={() => {
                const selected = shipmentMenu;
                setShipmentMenu(null);
                printLabels(selected ? [selected] : []);
              }}
            />
            <SheetAction
              icon="package"
              label="View Package"
              colors={colors}
              onPress={() => shipmentMenu && viewPackages(shipmentMenu)}
            />
            <SheetAction
              icon="file-text"
              label={
                shipmentMenu?.hasInvoice || shipmentMenu?.invoiceId
                  ? "View Invoice"
                  : "Create Invoice"
              }
              colors={colors}
              onPress={() => {
                const selected = shipmentMenu;
                setShipmentMenu(null);
                if (selected?.hasInvoice || selected?.invoiceId) {
                  router.push("/(manager)/management/invoices");
                } else {
                  setInvoiceShipment(selected);
                }
              }}
            />
            <SheetAction
              icon="minus-circle"
              label="Remove Shipment"
              danger
              disabled={!canRemoveShipment}
              colors={colors}
              onPress={() => shipmentMenu && removeShipment(shipmentMenu)}
            />
            {!canRemoveShipment ? (
              <Text style={[styles.sheetNotice, { color: colors.textMuted }]}>
                Unlock the manifest before removing shipments. Admins retain
                the existing locked-manifest override.
              </Text>
            ) : null}
            <Pressable
              onPress={() => setShipmentMenu(null)}
              style={[styles.cancelButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={addShipmentVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && setAddShipmentVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              styles.addShipmentSheet,
              { backgroundColor: colors.surface },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Add Shipments
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              Only authorized shipments outside this manifest are shown.
            </Text>
            <View
              style={[
                styles.availableSearch,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.cardMuted,
                },
              ]}
            >
              <Feather name="search" size={16} color={colors.textMuted} />
              <TextInput
                value={availableSearch}
                onChangeText={setAvailableSearch}
                placeholder="Search tracking, customer, municipality, status"
                placeholderTextColor={colors.textMuted}
                style={[styles.manifestSearchInput, { color: colors.text }]}
              />
            </View>
            {loadingAvailable ? (
              <View style={styles.availableLoading}>
                <ActivityIndicator color="#0f766e" />
                <Text style={[styles.savingText, { color: colors.textMuted }]}>
                  Loading authorized shipments...
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.availableList}
                keyboardShouldPersistTaps="handled"
              >
                {filteredAvailableShipments.map((shipment, index) => (
                  <View
                    key={shipmentIdentifier(shipment) || index}
                    style={[
                      styles.availableRow,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={styles.shipmentCopy}>
                      <Text
                        style={[styles.shipmentTitle, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {shipmentTracking(shipment)}
                      </Text>
                      <Text
                        style={[
                          styles.shipmentMeta,
                          { color: colors.textMuted },
                        ]}
                        numberOfLines={2}
                      >
                        {[
                          shipment.customerName ||
                            shipment.recipientName ||
                            shipment.recipient?.name,
                          shipment.municipality ||
                            shipment.recipientMunicipality,
                          shipment.status,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </Text>
                    </View>
                    <Pressable
                      disabled={saving}
                      onPress={() => addShipment(shipment)}
                      style={[
                        styles.inlineAddButton,
                        saving && styles.disabled,
                      ]}
                    >
                      <Feather name="plus" size={15} color="#fff" />
                      <Text style={styles.inlineAddText}>Add</Text>
                    </Pressable>
                  </View>
                ))}
                {!filteredAvailableShipments.length ? (
                  <EmptyState
                    icon="package"
                    title="No available shipments found"
                  />
                ) : null}
              </ScrollView>
            )}
            <Pressable
              disabled={saving}
              onPress={() => setAddShipmentVisible(false)}
              style={[styles.cancelButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ManagerQuickCreateModal
        type="invoices"
        visible={Boolean(invoiceShipment)}
        initialValues={invoiceInitialValues}
        onClose={() => setInvoiceShipment(null)}
        onCreated={() => reload({ refresh: true })}
      />
    </View>
  );
}

function ManifestField({ icon, label, value, colors }) {
  return (
    <View style={styles.manifestField}>
      <View style={styles.manifestFieldHeading}>
        <Feather name={icon} size={13} color="#0f766e" />
        <Text
          style={[styles.manifestFieldLabel, { color: colors.textMuted }]}
        >
          {label.toUpperCase()}
        </Text>
      </View>
      <Text
        style={[styles.manifestFieldValue, { color: colors.text }]}
        numberOfLines={2}
      >
        {value || "Not assigned"}
      </Text>
    </View>
  );
}

function CompactAction({
  icon,
  label,
  colors,
  onPress,
  disabled = false,
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.compactAction,
        { borderColor: colors.border, backgroundColor: colors.cardMuted },
        disabled && styles.disabled,
      ]}
    >
      <Feather name={icon} size={16} color="#0f766e" />
      <Text
        style={[styles.compactActionText, { color: colors.text }]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SheetAction({
  icon,
  label,
  colors,
  onPress,
  danger = false,
  disabled = false,
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.sheetAction,
        {
          borderColor: danger ? "#fecaca" : colors.border,
          backgroundColor: colors.cardMuted,
        },
        disabled && styles.disabled,
      ]}
    >
      <Feather
        name={icon}
        size={18}
        color={danger ? "#dc2626" : "#0f766e"}
      />
      <Text
        style={[
          styles.sheetActionText,
          { color: danger ? "#dc2626" : colors.text },
        ]}
      >
        {label}
      </Text>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function InfoCard({ label, value, icon, colors }) {
  return (
    <View style={[styles.infoCard, { backgroundColor: colors.cardMuted, borderColor: colors.border }]}>
      <Feather name={icon} size={15} color="#0f766e" />
      <Text style={[styles.infoCardLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoCardValue, { color: colors.text }]} numberOfLines={2}>
        {value || "Not assigned"}
      </Text>
    </View>
  );
}

function Info({ label, value, colors }) {
  return (
    <View style={[styles.info, { borderTopColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value || "Not assigned"}</Text>
    </View>
  );
}

function Stat({ label, value, colors }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.cardMuted }]}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function OperationInput({
  value,
  onChangeText,
  placeholder,
  colors,
  multiline = false,
  autoCapitalize = "sentences",
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      multiline={multiline}
      autoCapitalize={autoCapitalize}
      style={[
        styles.operationInput,
        multiline && styles.operationInputMultiline,
        {
          color: colors.text,
          borderColor: colors.border,
          backgroundColor: colors.cardMuted,
        },
      ]}
    />
  );
}

function NotifyRow({ value, onChange, colors }) {
  return (
    <Pressable
      onPress={onChange}
      style={[
        styles.notifyRow,
        { borderColor: colors.border, backgroundColor: colors.cardMuted },
      ]}
    >
      <View style={styles.notifyCopy}>
        <Text style={[styles.notifyTitle, { color: colors.text }]}>
          Notify customers
        </Text>
        <Text style={[styles.notifyDescription, { color: colors.textMuted }]}>
          Send the related operational update
        </Text>
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackActive]}>
        <View style={[styles.switchThumb, value && styles.switchThumbActive]} />
      </View>
    </Pressable>
  );
}

function PrimaryOperationButton({
  icon,
  label,
  onPress,
  disabled = false,
  compact = false,
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.primaryOperationButton,
        compact && styles.compactOperationButton,
        disabled && styles.disabled,
      ]}
    >
      <Feather name={icon} size={16} color="#fff" />
      <Text style={styles.primaryOperationText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryOperationButton({
  icon,
  label,
  onPress,
  colors,
  disabled = false,
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.secondaryOperationButton,
        { borderColor: colors.border },
        disabled && styles.disabled,
      ]}
    >
      <Feather name={icon} size={16} color={colors.text} />
      <Text style={[styles.secondaryOperationText, { color: colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  icon,
  label,
  description,
  onPress,
  colors,
  danger = false,
  disabled = false,
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { borderColor: danger ? "#fecaca" : colors.border, opacity: pressed ? 0.7 : 1 },
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: danger ? "#fee2e2" : colors.cardMuted }]}>
        <Feather name={icon} size={18} color={danger ? "#dc2626" : "#0f766e"} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionLabel, { color: danger ? "#dc2626" : colors.text }]}>{label}</Text>
        <Text style={[styles.actionDescription, { color: colors.textMuted }]}>{description}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  detailScroll: { flex: 1 },
  scrollContent: { paddingBottom: 1 },
  tripTitle: { fontSize: 12, lineHeight: 15, letterSpacing: -0.55 },
  tripSubtitle: { fontSize: 9, lineHeight: 12, marginTop: 1 },
  summary: { minHeight: 44, paddingHorizontal: 15, paddingVertical: 7, borderBottomWidth: 1 },
  summaryLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryRoute: { flex: 1, minWidth: 0, fontSize: 11, fontWeight: "700" },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, minHeight: 52, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#10b981", backgroundColor: "rgba(16,185,129,0.08)" },
  tabLabel: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  content: { padding: 14, paddingBottom: 36, gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 12 },
  infoCard: { width: "48.5%", minHeight: 100, borderWidth: 1, borderRadius: 13, padding: 11 },
  infoCardLabel: { fontSize: 9, fontWeight: "900", textTransform: "uppercase", marginTop: 9 },
  infoCardValue: { fontSize: 13, lineHeight: 18, fontWeight: "800", marginTop: 4 },
  statRow: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 12 },
  stat: { flex: 1, minHeight: 70, borderRadius: 12, padding: 10, justifyContent: "center" },
  statValue: { fontSize: 19, fontWeight: "900" },
  statLabel: { fontSize: 9, lineHeight: 13, fontWeight: "800", marginTop: 3 },
  info: { paddingVertical: 11, borderTopWidth: 1 },
  infoLabel: { fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  infoValue: { fontSize: 13, lineHeight: 18, fontWeight: "700", marginTop: 3 },
  steps: { marginTop: 14, gap: 12 },
  step: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  stepText: { fontSize: 12, fontWeight: "800" },
  issue: { fontSize: 13, lineHeight: 19, fontWeight: "700", marginTop: 12 },
  manifestState: { minHeight: 44, borderRadius: 12, marginTop: 12, marginBottom: 4, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  manifestStateText: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  manifestPercent: { marginLeft: "auto", fontSize: 12, fontWeight: "900" },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: 10 },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: "#10b981" },
  manifestControlGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  compactAction: { width: "48.5%", minHeight: 54, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  compactActionText: { flexShrink: 1, fontSize: 10, lineHeight: 13, fontWeight: "900", textAlign: "center" },
  manifestTopActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  manifestTopButton: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  manifestTopText: { fontSize: 10, fontWeight: "900" },
  addShipmentButton: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  addShipmentText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  manifestSearch: { minHeight: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  manifestSearchInput: { flex: 1, minWidth: 0, fontSize: 12, paddingVertical: 8 },
  manifestShipmentCard: { padding: 14 },
  manifestCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  shipmentCustomer: { fontSize: 11, marginTop: 4 },
  moreButton: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  manifestDivider: { height: StyleSheet.hairlineWidth, marginVertical: 11 },
  manifestFields: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  manifestField: { width: "50%", minWidth: 0, paddingRight: 8 },
  manifestFieldHeading: { flexDirection: "row", alignItems: "center", gap: 5 },
  manifestFieldLabel: { fontSize: 8, fontWeight: "900" },
  manifestFieldValue: { fontSize: 11, lineHeight: 15, fontWeight: "700", marginTop: 4 },
  shipmentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13 },
  shipmentCopy: { flex: 1 },
  shipmentTitle: { fontSize: 13, fontWeight: "900" },
  shipmentMeta: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  actionButton: { minHeight: 70, borderWidth: 1, borderRadius: 13, padding: 10, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  actionIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionCopy: { flex: 1 },
  actionLabel: { fontSize: 13, fontWeight: "900" },
  actionDescription: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  actionNotice: { fontSize: 12, lineHeight: 18, marginTop: 12 },
  unlockBox: { borderWidth: 1, borderRadius: 13, padding: 12, marginTop: 10 },
  unlockLabel: { fontSize: 12, fontWeight: "900" },
  unlockInput: { minHeight: 82, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 9, marginTop: 8, fontSize: 12, textAlignVertical: "top" },
  unlockActions: { flexDirection: "row", gap: 8, marginTop: 9 },
  unlockButton: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  unlockConfirm: { backgroundColor: "#d97706", borderColor: "#d97706" },
  saveText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  auditRow: { flexDirection: "row", gap: 10, minHeight: 62, paddingTop: 12 },
  auditRail: { width: 14, alignItems: "center" },
  auditDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#4f46e5", marginTop: 3 },
  auditLine: { width: 2, flex: 1, marginTop: 4 },
  auditCopy: { flex: 1, paddingBottom: 12 },
  auditTitle: { fontSize: 12, fontWeight: "900", textTransform: "capitalize" },
  auditMeta: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  auditNote: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  savingOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.28)" },
  savingCard: { minWidth: 160, borderRadius: 16, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  savingText: { fontSize: 12, fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.55)" },
  modalSheet: { maxHeight: "78%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 },
  modalTitle: { fontSize: 20, fontWeight: "900" },
  modalSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  operationSheet: { maxHeight: "86%" },
  operationHeading: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  operationHeadingCopy: { flex: 1, minWidth: 0 },
  closeOperation: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  operationScroll: { marginTop: 12 },
  operationContent: { paddingBottom: 6 },
  choiceRow: { flexDirection: "row", gap: 8 },
  choiceChip: {
    flex: 1,
    minHeight: 43,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  choiceText: { fontSize: 11, fontWeight: "900" },
  scanModeCard: {
    flex: 1,
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 14,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  loadModeActive: { borderColor: "#60a5fa", backgroundColor: "#eff6ff" },
  unloadModeActive: { borderColor: "#f59e0b", backgroundColor: "#fff7ed" },
  scanModeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  scanModeText: { flexShrink: 1, fontSize: 15, fontWeight: "900" },
  scanModeReason: {
    position: "absolute",
    left: 62,
    bottom: 12,
    fontSize: 8,
    fontWeight: "900",
  },
  receivingAction: {
    minHeight: 72,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 12,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  receivingActionCopy: { flex: 1 },
  receivingActionTitle: { color: "#fff", fontSize: 13, fontWeight: "900" },
  receivingActionText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 9,
    lineHeight: 13,
    marginTop: 3,
  },
  reconcileAction: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: "#34d399",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    backgroundColor: "#ecfdf5",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reconcileIcon: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  reconcileCopy: { flex: 1, minWidth: 0 },
  reconcileTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  reconcileTitle: { color: "#047857", fontSize: 12, fontWeight: "900" },
  reconcileBadge: {
    color: "#047857",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 8,
    fontWeight: "900",
  },
  reconcileText: {
    color: "#475569",
    fontSize: 9,
    lineHeight: 13,
    marginTop: 4,
  },
  openCamera: {
    minHeight: 124,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  openCameraText: { fontSize: 14, fontWeight: "900" },
  managerCamera: {
    height: 270,
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 12,
    backgroundColor: "#000",
  },
  managerCameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  managerScanFrame: {
    width: 190,
    height: 150,
    borderWidth: 3,
    borderColor: "#34d399",
    borderRadius: 18,
  },
  closeCameraButton: {
    position: "absolute",
    bottom: 12,
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 13,
    backgroundColor: "rgba(15,23,42,0.88)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  closeCameraText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  scanOutcomePanel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 11,
    marginTop: 12,
  },
  scanOutcomeLabel: { fontSize: 9, fontWeight: "900", marginBottom: 9 },
  scanOutcomeRow: { flexDirection: "row", gap: 7 },
  scanOutcomeButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  scanOutcomeButtonActive: {
    borderColor: "#34d399",
    backgroundColor: "#ecfdf5",
  },
  scanOutcomeText: { fontSize: 9, fontWeight: "900" },
  scanStats: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 13,
  },
  scanStat: { width: "50%", minWidth: 0 },
  scanStatLabel: { fontSize: 8, fontWeight: "900", marginBottom: 5 },
  scanStatValue: { fontSize: 14, fontWeight: "900" },
  scanFeedback: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    padding: 11,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scanFeedbackSuccess: { borderColor: "#6ee7b7", backgroundColor: "#ecfdf5" },
  scanFeedbackError: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  scanFeedbackText: { flex: 1, fontSize: 10, lineHeight: 14, fontWeight: "800" },
  operationInput: {
    minHeight: 49,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 12,
    fontSize: 13,
  },
  operationInputMultiline: {
    minHeight: 100,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  operationLabel: { fontSize: 11, fontWeight: "900", marginBottom: 9 },
  statusChoices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChoice: {
    minHeight: 39,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  statusChoiceActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  delayChoiceActive: { backgroundColor: "#d97706", borderColor: "#d97706" },
  statusChoiceText: { fontSize: 9, fontWeight: "900" },
  notifyRow: {
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  notifyCopy: { flex: 1 },
  notifyTitle: { fontSize: 12, fontWeight: "900" },
  notifyDescription: { fontSize: 9, marginTop: 3 },
  switchTrack: {
    width: 44,
    height: 25,
    borderRadius: 13,
    padding: 3,
    backgroundColor: "#cbd5e1",
  },
  switchTrackActive: { backgroundColor: "#10b981" },
  switchThumb: { width: 19, height: 19, borderRadius: 10, backgroundColor: "#fff" },
  switchThumbActive: { alignSelf: "flex-end" },
  primaryOperationButton: {
    minHeight: 48,
    borderRadius: 13,
    marginTop: 13,
    paddingHorizontal: 14,
    backgroundColor: "#0f766e",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  compactOperationButton: { flex: 1, marginTop: 0 },
  primaryOperationText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  operationButtonRow: { flexDirection: "row", gap: 8, marginTop: 13 },
  secondaryOperationButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryOperationText: { fontSize: 11, fontWeight: "900" },
  sheetAction: { minHeight: 54, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, marginTop: 9, flexDirection: "row", alignItems: "center", gap: 10 },
  sheetActionText: { flex: 1, fontSize: 12, fontWeight: "900" },
  sheetNotice: { fontSize: 10, lineHeight: 15, marginTop: 9 },
  addShipmentSheet: { height: "82%" },
  availableSearch: { minHeight: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 11, marginTop: 13, flexDirection: "row", alignItems: "center", gap: 8 },
  availableLoading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  availableList: { flex: 1, marginTop: 9 },
  availableRow: { minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 9 },
  inlineAddButton: { minWidth: 62, minHeight: 36, borderRadius: 10, backgroundColor: "#0f766e", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  inlineAddText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  foundInput: { minHeight: 47, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, marginTop: 12, fontSize: 13 },
  foundRemarks: { minHeight: 82, paddingVertical: 10, textAlignVertical: "top" },
  foundConfirm: { backgroundColor: "#059669", borderColor: "#059669" },
  driverList: { maxHeight: 420, marginTop: 12 },
  driverRow: { minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 10 },
  driverCopy: { flex: 1 },
  driverName: { fontSize: 14, fontWeight: "800" },
  driverMeta: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  noDrivers: { paddingVertical: 28, textAlign: "center", fontSize: 13 },
  cancelButton: { minHeight: 48, borderWidth: 1, borderRadius: 13, alignItems: "center", justifyContent: "center", marginTop: 15 },
  cancelText: { fontWeight: "800" },
});
