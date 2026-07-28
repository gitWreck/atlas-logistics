import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
import qrcode from "qrcode-generator";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import StatusBadge from "../ui/StatusBadge";
import {
  getManagerMobileShipment,
  deleteShipment,
  reconcileShipmentAtHub,
  receiveReturnedShipmentAtHub,
  releaseForDeliveryOperations,
  sendManualSMS,
  updateShipmentDetails,
  updateShipmentPackages,
  updateShipmentStatus,
} from "../utilities/FirebaseFunctions";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import useManagerRequest from "./useManagerRequest";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ManagerCard,
  ManagerHeader,
  SectionTitle,
  displayName,
  formatDate,
} from "./ManagerUI";

const TABS = [
  ["status", "Status", "truck"],
  ["items", "Items", "package"],
  ["actions", "Actions", "tool"],
];

const SHIPMENT_STATUSES = [
  "CREATED",
  "PENDING_PICKUP",
  "PICKED_UP",
  "RECEIVED",
  "RECEIVED_AT_DIVISORIA",
  "AVAILABLE",
  "ASSIGNED",
  "READY_FOR_LOADING",
  "LOADED",
  "IN_TRANSIT",
  "ARRIVED_AT_ODIONGAN",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELAYED",
  "FAILED_DELIVERY",
  "RETURNED_TO_WAREHOUSE",
  "CANCELLED",
];
const STATUS_FLOW = [
  "CREATED",
  "PENDING_PICKUP",
  "PICKED_UP",
  "RECEIVED_AT_DIVISORIA",
  "LOADED",
  "IN_TRANSIT",
  "ARRIVED_AT_ODIONGAN",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createQr(value) {
  const code = qrcode(0, "M");
  code.addData(String(value || ""));
  code.make();
  return code;
}

async function printHtmlDocument(html) {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    typeof document !== "undefined"
  ) {
    await new Promise((resolve, reject) => {
      const frame = document.createElement("iframe");
      frame.setAttribute("title", "Atlas Label Print Document");
      frame.style.position = "fixed";
      frame.style.left = "-10000px";
      frame.style.top = "0";
      frame.style.width = "816px";
      frame.style.height = "1056px";
      frame.style.border = "0";
      frame.onload = () => {
        window.setTimeout(() => {
          try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
            window.setTimeout(() => frame.remove(), 500);
            resolve();
          } catch (error) {
            frame.remove();
            reject(error);
          }
        }, 250);
      };
      frame.onerror = () => {
        frame.remove();
        reject(new Error("The label print document could not be created."));
      };
      document.body.appendChild(frame);
      frame.srcdoc = html;
    });
    return;
  }
  await Print.printAsync({ html });
}

function labelHtml({ title, code, subtitle, details = [] }) {
  const qrSvg = createQr(code).createSvgTag({
    cellSize: 3,
    margin: 0,
    scalable: true,
  });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:4in 3in;margin:.18in}*{box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#0f172a;margin:0}
    .label{height:2.64in;border:2px solid #0f172a;border-radius:12px;padding:14px;display:grid;grid-template-columns:1fr 112px;gap:14px}
    .brand{font-size:11px;font-weight:900;letter-spacing:1.5px;color:#2563eb}.title{font-size:17px;font-weight:900;margin:10px 0 4px}
    .code{font-family:monospace;font-size:13px;font-weight:800;word-break:break-all}.subtitle{font-size:11px;color:#475569;margin:7px 0 12px}
    .detail{font-size:9px;color:#475569;margin-top:4px}.detail b{color:#0f172a}.qr{width:112px;height:112px;align-self:center}.qr svg{width:100%;height:100%}
  </style></head><body><section class="label"><div><div class="brand">ATLAS TRANSPORT</div>
    <div class="title">${escapeHtml(title)}</div><div class="code">${escapeHtml(code)}</div>
    <div class="subtitle">${escapeHtml(subtitle)}</div>
    ${details
      .map(
        ([label, value]) =>
          `<div class="detail"><b>${escapeHtml(label)}:</b> ${escapeHtml(value || "—")}</div>`,
      )
      .join("")}</div><div class="qr">${qrSvg}</div></section></body></html>`;
}

function packageLabelsHtml(shipmentCode, destination, packages) {
  const labels = packages
    .map((item, index) => {
      const packageCode =
        item.packageId || item.trackingNumber || item.id || `${shipmentCode}-${index + 1}`;
      const qrSvg = createQr(packageCode).createSvgTag({
        cellSize: 3,
        margin: 0,
        scalable: true,
      });
      return `<section class="label"><div><div class="brand">ATLAS TRANSPORT</div>
        <div class="title">Package Label</div><div class="code">${escapeHtml(packageCode)}</div>
        <div class="subtitle">${escapeHtml(item.description || "Package")}</div>
        <div class="detail"><b>Shipment:</b> ${escapeHtml(shipmentCode)}</div>
        <div class="detail"><b>Type:</b> ${escapeHtml(item.type || item.packageType || "Standard")}</div>
        <div class="detail"><b>Quantity:</b> ${escapeHtml(item.quantity || 1)}</div>
        <div class="detail"><b>Destination:</b> ${escapeHtml(destination || "—")}</div>
        </div><div class="qr">${qrSvg}</div></section>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:4in 3in;margin:.18in}*{box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#0f172a;margin:0}.label{height:2.64in;border:2px solid #0f172a;border-radius:12px;padding:14px;display:grid;grid-template-columns:1fr 112px;gap:14px;break-after:page;page-break-after:always}
    .label:last-child{break-after:auto;page-break-after:auto}.brand{font-size:11px;font-weight:900;letter-spacing:1.5px;color:#2563eb}.title{font-size:17px;font-weight:900;margin:10px 0 4px}
    .code{font-family:monospace;font-size:13px;font-weight:800;word-break:break-all}.subtitle{font-size:11px;color:#475569;margin:7px 0 12px}.detail{font-size:9px;color:#475569;margin-top:4px}.detail b{color:#0f172a}.qr{width:112px;height:112px;align-self:center}.qr svg{width:100%;height:100%}
  </style></head><body>${labels}</body></html>`;
}

export default function ManagerShipmentDetailsScreen() {
  const { shipmentId, tab } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  const { role } = useAuth();
  const canDelete = role === "admin";
  const [activeTab, setActiveTab] = React.useState(
    ["status", "items", "actions"].includes(String(tab || "")) ? String(tab) : "status",
  );
  const [saving, setSaving] = React.useState(false);
  const [reconcileOpen, setReconcileOpen] = React.useState(false);
  const [expectedQty, setExpectedQty] = React.useState("");
  const [receivedQty, setReceivedQty] = React.useState("");
  const [warehouseCode, setWarehouseCode] = React.useState("ODIONGAN_WAREHOUSE");
  const [operationRemarks, setOperationRemarks] = React.useState("");
  const [workflow, setWorkflow] = React.useState(null);
  const [selectedStatus, setSelectedStatus] = React.useState("");
  const [notifyCustomers, setNotifyCustomers] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const id = shipmentId ? String(shipmentId) : "";
  const { data, loading, refreshing, error, reload } = useManagerRequest(
    getManagerMobileShipment,
    { shipmentId: id },
  );

  if (loading) return <LoadingState label="Loading shipment order…" />;
  if (error) return <ErrorState message={error.message} onRetry={() => reload()} />;

  const shipment = data?.shipment || {};
  const timeline = data?.timeline || [];
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const status = String(shipment.status || "").toUpperCase();
  const expectedPieces =
    Number(shipment.reconcileExpectedQty) ||
    Number(shipment.totals?.totalContentQty) ||
    Number(shipment.totals?.totalItems) ||
    packages.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const route = [
    shipment.originCode || shipment.origin,
    shipment.destinationCode || shipment.destination,
  ].filter(Boolean).join(" → ");
  const municipality =
    shipment.municipality ||
    shipment.destinationMunicipality ||
    shipment.recipient?.address?.city ||
    shipment.recipient?.city ||
    shipment.destination ||
    "Not assigned";

  const openReconcile = () => {
    const value = String(expectedPieces || "");
    setExpectedQty(value);
    setReceivedQty(value);
    setReconcileOpen(true);
  };

  const reconcile = async () => {
    try {
      setSaving(true);
      await reconcileShipmentAtHub({
        shipmentId: shipment.id,
        expectedQty: Number(expectedQty),
        receivedQty: Number(receivedQty),
        warehouseCode: "ODIONGAN_WAREHOUSE",
        remarks: "Recorded from Manager mobile shipment order",
      });
      setReconcileOpen(false);
      await reload({ refresh: true });
    } catch (nextError) {
      Alert.alert("Reconciliation failed", nextError.message || "Please check the quantities.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = (nextStatus, notify = notifyCustomers) => {
    Alert.alert(
      "Update shipment status",
      `Move this shipment to ${nextStatus.replace(/_/g, " ")}? Existing custody and notification rules will apply.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: async () => {
            try {
              setSaving(true);
              await updateShipmentStatus({
                shipmentId: shipment.id,
                tripId: shipment.currentTripId || shipment.tripId || null,
                newStatus: nextStatus,
                notify,
                notifySms: notify,
                notifyEmail: notify,
                notifyPush: notify,
                sourceUI: "MANAGER_MOBILE",
              });
              setSelectedStatus("");
              setNotifyCustomers(false);
              await reload({ refresh: true });
            } catch (nextError) {
              Alert.alert("Status not updated", nextError.message || "Please try again.");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const runWorkflow = async () => {
    try {
      setSaving(true);
      if (workflow === "receive-return") {
        await receiveReturnedShipmentAtHub({
          shipmentIds: [shipment.id],
          warehouseCode: warehouseCode.trim() || null,
          remarks: operationRemarks.trim() || null,
        });
      } else if (workflow === "release") {
        await releaseForDeliveryOperations({
          tripId: shipment.currentTripId || shipment.tripId || null,
          shipmentIds: [shipment.id],
          warehouseCode: warehouseCode.trim() || null,
          remarks: operationRemarks.trim() || null,
        });
      }
      setWorkflow(null);
      setOperationRemarks("");
      await reload({ refresh: true });
    } catch (nextError) {
      Alert.alert("Action failed", nextError.message || "The shipment was not updated.");
    } finally {
      setSaving(false);
    }
  };

  const printShipment = async () => {
    try {
      setSaving(true);
      const html = `
        <html><body style="font-family:Arial;padding:28px;color:#0f172a">
          <h1 style="margin-bottom:4px">Shipment Order</h1>
          <h2>${escapeHtml(shipment.trackingNumber || shipment.shipmentId || shipment.id)}</h2>
          <p><b>Status:</b> ${escapeHtml(shipment.status)}</p>
          <p><b>Route:</b> ${escapeHtml(route)}</p>
          <p><b>Sender:</b> ${escapeHtml(displayName(shipment.sender))} · ${escapeHtml(shipment.sender?.phone || shipment.senderPhone)}</p>
          <p><b>Recipient:</b> ${escapeHtml(displayName(shipment.recipient))} · ${escapeHtml(shipment.recipient?.phone || shipment.recipientPhone)}</p>
          <p><b>Municipality:</b> ${escapeHtml(municipality)}</p>
          <p><b>Driver:</b> ${escapeHtml(shipment.driverName || shipment.assignedDriverName || "Unassigned")}</p>
          <p><b>Checker:</b> ${escapeHtml(shipment.checkerName || shipment.assignedCheckerName || "Unassigned")}</p>
          <p><b>Vehicle:</b> ${escapeHtml(shipment.truckPlateNumber || shipment.vehiclePlate || shipment.truckDetails?.truckPlate || "Unassigned")}</p>
          <h3>Items (${packages.length})</h3>
          <ul>${packages.map((item, index) => `<li>${escapeHtml(item.packageId || item.id || `Item ${index + 1}`)} — ${escapeHtml(item.description || "Package")} (${escapeHtml(item.status || shipment.status)})</li>`).join("")}</ul>
        </body></html>`;
      const file = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share shipment order",
        });
      } else {
        await Print.printAsync({ html });
      }
    } catch (nextError) {
      Alert.alert("Shipment document unavailable", nextError.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    const label = shipment.trackingNumber || shipment.shipmentId || shipment.id;
    Alert.alert(
      "Delete Shipment",
      `Permanently delete ${label}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);
              await deleteShipment({
                shipmentId: shipment.id,
                reason: "Deleted from Admin mobile shipment details",
              });
              router.replace("/(manager)/(tabs)/shipments");
            } catch (nextError) {
              Alert.alert("Shipment not deleted", nextError.message || "Please try again.");
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ManagerHeader
        back
        title={shipment.trackingNumber || shipment.shipmentId || shipment.id}
        titleNumberOfLines={1}
        titleStyle={styles.trackingTitle}
        subtitle="SHIPMENT ORDER"
        actionIcon="refresh-cw"
        onAction={() => reload({ refresh: true })}
      />
      <ScrollView
        style={styles.detailScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => reload({ refresh: true })}
            tintColor="#059669"
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
      <View style={[styles.summary, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.summaryStatus}>
          <StatusBadge status={shipment.status} />
        </View>
        {route ? (
          <View style={[styles.routeChip, { borderLeftColor: colors.border }]}>
            <Feather name="truck" size={14} color={colors.textMuted} />
            <Text style={[styles.route, { color: colors.text }]} numberOfLines={1}>
              {route}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {TABS.map(([value, label, icon]) => {
          const selected = activeTab === value;
          const count = value === "items" ? packages.length : null;
          return (
            <Pressable
              key={value}
              onPress={() => setActiveTab(value)}
              style={[styles.tab, selected && styles.tabSelected]}
            >
              <Feather name={icon} size={16} color={selected ? "#059669" : colors.textMuted} />
              <Text style={[styles.tabText, { color: selected ? "#059669" : colors.textMuted }]}>
                {label.toUpperCase()}{count !== null ? ` (${count})` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.content}>
        {activeTab === "status" ? (
          <StatusTab
            shipment={shipment}
            timeline={timeline}
            municipality={municipality}
            colors={colors}
            onReconcile={openReconcile}
            onWorkflow={setWorkflow}
          />
        ) : null}
        {activeTab === "items" ? (
          <ItemsTab
            shipment={shipment}
            packages={packages}
            colors={colors}
            onRefresh={() => reload({ refresh: true })}
          />
        ) : null}
        {activeTab === "actions" ? (
          <ActionsTab
            shipment={shipment}
            saving={saving}
            colors={colors}
            onStatus={changeStatus}
            selectedStatus={selectedStatus}
            onSelectStatus={setSelectedStatus}
            notifyCustomers={notifyCustomers}
            onNotifyCustomers={setNotifyCustomers}
          />
        ) : null}
      </View>
      </ScrollView>

      <Modal visible={reconcileOpen} transparent animationType="slide" onRequestClose={() => !saving && setReconcileOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Odiongan Reconcile</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              Record expected versus physically received pieces.
            </Text>
            <QuantityField label="Expected pieces" value={expectedQty} onChangeText={setExpectedQty} colors={colors} />
            <QuantityField label="Received pieces" value={receivedQty} onChangeText={setReceivedQty} colors={colors} />
            <View style={styles.modalActions}>
              <Pressable disabled={saving} onPress={() => setReconcileOpen(false)} style={[styles.modalButton, { borderColor: colors.border }]}>
                <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable disabled={saving} onPress={reconcile} style={[styles.modalButton, styles.reconcileButton, saving && styles.disabled]}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.reconcileText}>Reconcile</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <WorkflowModal
        visible={Boolean(workflow)}
        type={workflow}
        warehouseCode={warehouseCode}
        onWarehouseCode={setWarehouseCode}
        remarks={operationRemarks}
        onRemarks={setOperationRemarks}
        saving={saving}
        colors={colors}
        onClose={() => !saving && setWorkflow(null)}
        onSave={runWorkflow}
      />
      <EditShipmentModal
        visible={editOpen}
        shipment={shipment}
        colors={colors}
        saving={saving}
        onClose={() => !saving && setEditOpen(false)}
        onSave={async (payload) => {
          try {
            setSaving(true);
            await updateShipmentDetails(payload);
            setEditOpen(false);
            await reload({ refresh: true });
          } catch (nextError) {
            Alert.alert("Shipment not updated", nextError.message || "Please try again.");
          } finally {
            setSaving(false);
          }
        }}
      />
    </View>
  );
}

function StatusTab({ shipment, timeline, municipality, colors, onReconcile, onWorkflow }) {
  const status = String(shipment.status || "").toUpperCase();
  const hasReturn = status.includes("FAILED") || status.startsWith("RETURN");
  const awaitingReturnReceive =
    status === "FAILED_DELIVERY" ||
    status === "RETURNING_TO_WAREHOUSE" ||
    status === "RETURNED_TO_WAREHOUSE";
  const readyToRelease =
    Boolean(shipment.returnReceivedAt || shipment.reconciledAt) &&
    shipment.availableForDelivery !== true &&
    !["DELIVERED", "COMPLETED", "CANCELLED"].includes(status);
  const reconciled = Boolean(shipment.reconciledAt || shipment.reconcileResult);
  const inferredFlowIndex =
    status === "DELIVERED" || status === "COMPLETED"
      ? 8
      : status.includes("OUT_FOR_DELIVERY") ||
          status.includes("FAILED_DELIVERY") ||
          status.startsWith("RETURN")
        ? 7
        : status.includes("ARRIVED_AT_ODIONGAN") ||
            status === "READY_FOR_DELIVERY" ||
            status === "AVAILABLE_FOR_DELIVERY"
          ? 6
          : status === "IN_TRANSIT" || status === "DELAYED"
            ? 5
            : status === "LOADED" || status === "PARTIALLY_LOADED"
              ? 4
              : ["RECEIVED", "AVAILABLE", "ASSIGNED", "READY_FOR_LOADING"].includes(status)
                ? 3
                : status === "PICKED_UP"
                  ? 2
                  : status === "PENDING_PICKUP"
                    ? 1
                    : 0;
  const currentFlowIndex = Math.max(
    STATUS_FLOW.findIndex((value) => value === status),
    inferredFlowIndex,
  );
  return (
    <>
      <ManagerCard>
        <View style={styles.featureRow}>
          <Feather name="rotate-ccw" size={21} color="#7c3aed" />
          <View style={styles.flex}>
            <Text style={[styles.featureTitle, { color: colors.text }]}>Return loop</Text>
            <Text style={[styles.featureDescription, { color: colors.textMuted }]}>
              {hasReturn
                ? shipment.returnReason || shipment.failureReason || "This shipment has a failed-delivery or return event."
                : "No failed delivery or return on this shipment yet."}
            </Text>
          </View>
          {awaitingReturnReceive ? (
            <Pressable onPress={() => onWorkflow("receive-return")} style={[styles.smallAction, styles.returnAction]}>
              <Text style={styles.smallActionText}>Receive</Text>
            </Pressable>
          ) : readyToRelease ? (
            <Pressable onPress={() => onWorkflow("release")} style={[styles.smallAction, styles.releaseAction]}>
              <Text style={styles.smallActionText}>Release</Text>
            </Pressable>
          ) : null}
        </View>
      </ManagerCard>

      <ManagerCard>
        <View style={styles.featureRow}>
          <Feather name="check-square" size={20} color="#059669" />
          <View style={styles.flex}>
            <Text style={[styles.featureTitle, { color: colors.text }]}>Odiongan Reconcile</Text>
            <Text style={[styles.featureDescription, { color: colors.textMuted }]}>
              {reconciled
                ? shipment.reconcileResult || "Expected and received pieces were recorded."
                : "Not reconciled yet. Record expected versus received pieces at Odiongan."}
            </Text>
          </View>
          {!reconciled && !["DELIVERED", "COMPLETED", "CANCELLED"].includes(status) ? (
            <Pressable onPress={onReconcile} style={styles.smallAction}>
              <Text style={styles.smallActionText}>Reconcile</Text>
            </Pressable>
          ) : null}
        </View>
      </ManagerCard>

      <ManagerCard>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>DESTINATION MUNICIPALITY</Text>
        <Text style={[styles.municipality, { color: colors.text }]}>{municipality}</Text>
      </ManagerCard>

      <View style={styles.infoGrid}>
        <InfoCard label="Sender" value={displayName(shipment.sender)} colors={colors} />
        <InfoCard label="Recipient" value={displayName(shipment.recipient)} colors={colors} />
        <InfoCard label="Sender phone" value={shipment.sender?.phone || shipment.senderPhone} colors={colors} />
        <InfoCard label="Recipient phone" value={shipment.recipient?.phone || shipment.recipientPhone} colors={colors} />
        <InfoCard label="Origin" value={shipment.origin} colors={colors} />
        <InfoCard label="Destination" value={shipment.destination} colors={colors} />
        <InfoCard label="Driver" value={shipment.driverName || shipment.assignedDriverName || shipment.truckDetails?.driverName} colors={colors} />
        <InfoCard label="Checker" value={shipment.checkerName || shipment.assignedCheckerName} colors={colors} />
        <InfoCard label="Vehicle" value={shipment.truckPlateNumber || shipment.vehiclePlate || shipment.truckDetails?.truckPlate} colors={colors} />
        <InfoCard label="Trip" value={shipment.currentTripId || shipment.tripId} colors={colors} />
      </View>

      <ManagerCard>
        <SectionTitle
          title="Status Flow"
          subtitle={String(shipment.status || "Created").replace(/_/g, " ")}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.statusFlow}>
            {STATUS_FLOW.map((flowStatus, index) => {
              const complete = index <= currentFlowIndex;
              return (
                <View key={flowStatus} style={styles.statusFlowStep}>
                  <View
                    style={[
                      styles.statusFlowDot,
                      {
                        backgroundColor: complete ? "#059669" : colors.cardMuted,
                        borderColor: complete ? "#059669" : colors.border,
                      },
                    ]}
                  >
                    <Feather
                      name={complete ? "check" : "circle"}
                      size={12}
                      color={complete ? "#fff" : colors.textMuted}
                    />
                  </View>
                  <Text
                    style={[
                      styles.statusFlowLabel,
                      { color: complete ? colors.text : colors.textMuted },
                    ]}
                  >
                    {flowStatus.replace(/_/g, " ")}
                  </Text>
                  {index < STATUS_FLOW.length - 1 ? (
                    <View
                      style={[
                        styles.statusFlowConnector,
                        {
                          backgroundColor:
                            index < currentFlowIndex ? "#10b981" : colors.border,
                        },
                      ]}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ManagerCard>

      <ManagerCard>
        <SectionTitle
          title="Scanned Info / Custody Timeline"
          subtitle={`${timeline.length} custody event${timeline.length === 1 ? "" : "s"}`}
        />
        {timeline.length ? timeline.map((event, index) => (
          <View key={event.id || index} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={styles.timelineDot} />
              {index < timeline.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: colors.border }]} /> : null}
            </View>
            <View style={styles.timelineCopy}>
              <Text style={[styles.timelineTitle, { color: colors.text }]}>
                {String(
                  event.scanAction ||
                    event.action ||
                    event.status ||
                    event.eventType ||
                    "Custody update",
                ).replace(/_/g, " ")}
              </Text>
              <Text style={[styles.timelineMeta, { color: colors.textMuted }]}>
                {[event.actorName || event.scannedByName || event.createdByName, event.location, formatDate(event.timestamp || event.createdAt || event.updatedAt)]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
              {event.note || event.reason ? <Text style={[styles.timelineNote, { color: colors.textMuted }]}>{event.note || event.reason}</Text> : null}
            </View>
          </View>
        )) : <EmptyState icon="clock" title="No custody scans yet" />}
      </ManagerCard>
    </>
  );
}

function PackageQr({ value, size = 128 }) {
  const code = React.useMemo(() => createQr(value), [value]);
  const count = code.getModuleCount();
  const cell = size / count;
  return (
    <View style={[styles.qrCanvas, { width: size, height: size }]}>
      {Array.from({ length: count }, (_, row) => (
        <View key={row} style={styles.qrRow}>
          {Array.from({ length: count }, (__, column) => (
            <View
              key={column}
              style={{
                width: cell,
                height: cell,
                backgroundColor: code.isDark(row, column) ? "#000" : "#fff",
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function ItemsTab({ shipment, packages, colors, onRefresh }) {
  const [savingPackage, setSavingPackage] = React.useState(false);
  const [selectedPackage, setSelectedPackage] = React.useState(null);
  const [manualQty, setManualQty] = React.useState("1");
  const [visibleQr, setVisibleQr] = React.useState(null);
  const shipmentCode =
    shipment.trackingNumber || shipment.shipmentId || shipment.id || "SHIPMENT";
  const updatePackage = async (item, newStatus, quantity = null) => {
    const packageId = item.packageId || item.trackingNumber || item.id;
    if (newStatus === "LOADED" && !(shipment.currentTripId || shipment.tripId)) {
      Alert.alert("Trip required", "Assign this shipment to a trip before loading its pieces.");
      return;
    }
    try {
      setSavingPackage(true);
      await updateShipmentPackages({
        shipmentId: shipment.id,
        packageIds: [packageId],
        newStatus,
        manualQty: quantity == null
          ? Number(item.quantity || 1)
          : Math.max(1, Math.min(Number(item.quantity || 1), Number(quantity) || 1)),
        scanAction: newStatus === "LOADED" ? "LOAD" : "UNLOAD",
        tripId: shipment.currentTripId || shipment.tripId || null,
        sourceUI: "MANAGER_MOBILE_SHIPMENT_ITEMS",
      });
      setSelectedPackage(null);
      await onRefresh?.();
    } catch (error) {
      Alert.alert("Package not updated", error.message || "Please try again.");
    } finally {
      setSavingPackage(false);
    }
  };
  const openPackageActions = (item) => {
    setSelectedPackage(item);
    setManualQty(String(item.quantity || 1));
  };
  const printShipmentLabel = () =>
    printHtmlDocument(
      labelHtml({
        title: "Shipment Label",
        code: shipmentCode,
        subtitle: `${shipment.originCode || shipment.origin || "Origin"} → ${
          shipment.destinationCode || shipment.destination || "Destination"
        }`,
        details: [
          ["Recipient", displayName(shipment.recipient)],
          [
            "Municipality",
            shipment.municipality ||
              shipment.recipient?.address?.city ||
              shipment.recipient?.city,
          ],
          ["Pieces", shipment.totals?.totalItems || packages.length],
        ],
      }),
    ).catch((error) =>
      Alert.alert("Shipment label unavailable", error.message || "Please try again."),
    );
  const printPackageLabel = (item) => {
    const packageCode =
      item?.packageId || item?.trackingNumber || item?.id || shipmentCode;
    return printHtmlDocument(
      labelHtml({
        title: "Package Label",
        code: packageCode,
        subtitle: item?.description || "Package",
        details: [
          ["Shipment", shipmentCode],
          ["Type", item?.type || item?.packageType || "Standard"],
          ["Quantity", item?.quantity || 1],
          ["Destination", shipment.destination || shipment.destinationCode],
        ],
      }),
    ).catch((error) =>
      Alert.alert("Package label unavailable", error.message || "Please try again."),
    );
  };
  const printAllPackageLabels = () =>
    printHtmlDocument(
      packageLabelsHtml(
        shipmentCode,
        shipment.destination || shipment.destinationCode,
        packages,
      ),
    ).catch((error) =>
      Alert.alert("Package labels unavailable", error.message || "Please try again."),
    );
  return (
    <ManagerCard>
      <SectionTitle title="Shipment items" subtitle={`${packages.length || shipment.totals?.totalItems || 0} recorded`} />
      <View style={styles.labelActions}>
        <Pressable
          onPress={printShipmentLabel}
          style={[styles.labelButton, { backgroundColor: colors.cardMuted, borderColor: colors.border }]}
        >
          <Feather name="tag" size={16} color="#2563eb" />
          <Text style={[styles.labelButtonText, { color: colors.text }]}>Shipment Label</Text>
        </Pressable>
        <Pressable
          disabled={!packages.length}
          onPress={printAllPackageLabels}
          style={[styles.labelButton, { backgroundColor: colors.cardMuted, borderColor: colors.border }, !packages.length && styles.disabled]}
        >
          <Feather name="printer" size={16} color="#2563eb" />
          <Text style={[styles.labelButtonText, { color: colors.text }]}>Package Labels</Text>
        </Pressable>
      </View>
      {packages.length ? packages.map((item, index) => (
        <React.Fragment key={item.id || item.packageId || index}>
        <View style={[styles.packageRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}>
          <View style={styles.packageIcon}><Feather name="box" size={18} color="#4f46e5" /></View>
          <View style={styles.flex}>
            <Text style={[styles.packageTitle, { color: colors.text }]}>{item.packageId || item.id || `Item ${index + 1}`}</Text>
            <Text style={[styles.packageMeta, { color: colors.textMuted }]}>
              {[item.description, item.quantity ? `Qty ${item.quantity}` : null, item.weight ? `${item.weight} kg` : null].filter(Boolean).join(" • ") || "Package details"}
            </Text>
          </View>
          <View style={styles.packageControls}>
            <StatusBadge status={item.status || shipment.status} />
            <View style={styles.packageButtons}>
              <Pressable
                accessibilityLabel="Toggle package QR code"
                onPress={() => {
                  const packageCode = item.packageId || item.trackingNumber || item.id;
                  setVisibleQr(visibleQr === packageCode ? null : packageCode);
                }}
                style={[
                  styles.packageMore,
                  {
                    backgroundColor:
                      visibleQr === (item.packageId || item.trackingNumber || item.id)
                        ? "#dbeafe"
                        : colors.cardMuted,
                  },
                ]}
              >
                <Feather name="grid" size={17} color="#2563eb" />
              </Pressable>
              <Pressable
                disabled={savingPackage}
                onPress={() => openPackageActions(item)}
                style={[styles.packageMore, { backgroundColor: colors.cardMuted }]}
              >
                {savingPackage ? <ActivityIndicator size="small" color="#4f46e5" /> : <Feather name="more-vertical" size={18} color={colors.text} />}
              </Pressable>
            </View>
          </View>
        </View>
        {visibleQr === (item.packageId || item.trackingNumber || item.id) ? (
          <View style={[styles.qrPanel, { backgroundColor: colors.cardMuted, borderColor: colors.border }]}>
            <PackageQr value={item.packageId || item.trackingNumber || item.id} size={128} />
            <View style={styles.flex}>
              <Text style={[styles.qrTitle, { color: colors.text }]}>Package QR Code</Text>
              <Text style={[styles.qrCodeText, { color: colors.textMuted }]}>
                {item.packageId || item.trackingNumber || item.id}
              </Text>
              <Pressable onPress={() => printPackageLabel(item)} style={styles.qrPrintButton}>
                <Feather name="printer" size={14} color="#fff" />
                <Text style={styles.qrPrintText}>Package Label</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        </React.Fragment>
      )) : (
        <EmptyState icon="package" title="No item rows recorded" message="Shipment totals are still available on the order." />
      )}
      <Modal visible={Boolean(selectedPackage)} transparent animationType="slide" onRequestClose={() => !savingPackage && setSelectedPackage(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.managePackageSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.manageHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.flex}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Manage Package</Text>
                <Text style={[styles.modalSubtitle, styles.manageSubtitle, { color: colors.textMuted }]}>
                  Update loading or unload this package item.
                </Text>
              </View>
              <Pressable
                disabled={savingPackage}
                onPress={() => setSelectedPackage(null)}
                style={[styles.closeButton, { backgroundColor: colors.cardMuted }]}
              >
                <Feather name="x" size={23} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.manageBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.manageCard, { backgroundColor: colors.cardMuted, borderColor: colors.border }]}>
                <View style={styles.manageCardTop}>
                  <View style={styles.manageLabelRow}>
                    <Feather name="box" size={19} color="#2563eb" />
                    <Text style={[styles.manageLabel, { color: colors.textMuted }]}>PACKAGE DETAILS</Text>
                  </View>
                  <View style={styles.manageType}>
                    <Text style={[styles.manageLabel, { color: colors.textMuted }]}>TYPE</Text>
                    <Text style={[styles.manageTypeValue, { color: colors.textMuted }]}>
                      {selectedPackage?.type || selectedPackage?.packageType || "Bundle"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.managePackageCode}>
                  {selectedPackage?.packageId || selectedPackage?.trackingNumber || selectedPackage?.id}
                </Text>
                <Text style={[styles.manageDescription, { color: colors.text }]}>
                  {selectedPackage?.description || "Package"}
                </Text>
              </View>
              <View style={[styles.manageCard, { backgroundColor: colors.cardMuted, borderColor: colors.border }]}>
                <View style={styles.manageLabelRow}>
                  <Feather name="hexagon" size={19} color="#2563eb" />
                  <Text style={[styles.manageLabel, { color: colors.textMuted }]}>MANUAL QUANTITY</Text>
                </View>
                <Text style={[styles.manageHelp, { color: colors.textMuted }]}>
                  Set how many pieces to process for partial load. Max: {Number(selectedPackage?.quantity || 1)}
                </Text>
                <View style={styles.manualQuantityRow}>
                  <TextInput
                    value={manualQty}
                    onChangeText={setManualQty}
                    keyboardType="number-pad"
                    style={[styles.manualQuantityInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                  />
                  <Pressable
                    onPress={() => setManualQty(String(selectedPackage?.quantity || 1))}
                    style={[styles.maxButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  >
                    <Text style={[styles.maxButtonText, { color: colors.textMuted }]}>MAX</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.manageActionGrid}>
                <Pressable
                  disabled={savingPackage}
                  onPress={() => updatePackage(selectedPackage, "LOADED")}
                  style={[styles.manageAction, styles.loadAllAction, savingPackage && styles.disabled]}
                >
                  <Feather name="layers" size={18} color="#059669" />
                  <Text style={styles.loadAllText}>Load All</Text>
                </Pressable>
                <Pressable
                  disabled={savingPackage || Number(selectedPackage?.quantity || 1) <= 1}
                  onPress={() => updatePackage(selectedPackage, "LOADED", manualQty)}
                  style={[styles.manageAction, styles.partialAction, (savingPackage || Number(selectedPackage?.quantity || 1) <= 1) && styles.disabled]}
                >
                  <Feather name="box" size={18} color="#3b82f6" />
                  <Text style={styles.partialText}>Partial Load ({Math.max(1, Number(manualQty) || 1)})</Text>
                </Pressable>
              </View>
              <Pressable
                disabled={savingPackage}
                onPress={() => updatePackage(selectedPackage, "RECEIVED")}
                style={[styles.unloadAction, savingPackage && styles.disabled]}
              >
                <Feather name="rotate-ccw" size={19} color="#ef4444" />
                <Text style={styles.unloadText}>Unload Package</Text>
              </Pressable>
              <Pressable
                disabled={savingPackage}
                onPress={() => printPackageLabel(selectedPackage)}
                style={[styles.packageLabelAction, { borderColor: colors.border }]}
              >
                <Feather name="printer" size={18} color="#2563eb" />
                <Text style={[styles.packageLabelText, { color: colors.text }]}>Print Package Label</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ManagerCard>
  );
}

function ActionsTab({
  shipment,
  saving,
  colors,
  onStatus,
  selectedStatus,
  onSelectStatus,
  notifyCustomers,
  onNotifyCustomers,
}) {
  const [statusPickerOpen, setStatusPickerOpen] = React.useState(false);
  const [recipientMessage, setRecipientMessage] = React.useState("");
  const [smsSending, setSmsSending] = React.useState(false);
  const [smsSent, setSmsSent] = React.useState(false);
  const currentStatus = String(shipment.status || "").toUpperCase();
  const recipientName = displayName(shipment.recipient) || "Customer";
  const recipientPhone =
    shipment.recipient?.phone ||
    shipment.recipientPhone ||
    shipment.recipient?.secondaryPhone ||
    shipment.recipient?.altPhone ||
    "";
  const receiptImages = [
    ...(Array.isArray(shipment.proofOfReceipt) ? shipment.proofOfReceipt : []),
    ...(Array.isArray(shipment.receiptImages) ? shipment.receiptImages : []),
    ...(Array.isArray(shipment.receiptPhotos) ? shipment.receiptPhotos : []),
  ].filter(Boolean);
  const deliveryImages = [
    ...(Array.isArray(shipment.proofOfDelivery) ? shipment.proofOfDelivery : []),
    ...(Array.isArray(shipment.deliveryImages) ? shipment.deliveryImages : []),
    ...(Array.isArray(shipment.deliveryPhotos) ? shipment.deliveryPhotos : []),
  ].filter(Boolean);
  const shipmentRemarks = [
    shipment.remarks,
    shipment.deliveryRemarks,
    shipment.failureReason,
    shipment.returnReason,
  ].filter(Boolean);
  const sendRecipientMessage = async () => {
    const message = recipientMessage.trim();
    if (!recipientPhone || !message || smsSending) return;
    try {
      setSmsSending(true);
      setSmsSent(false);
      const result = await sendManualSMS({
        phoneNumber: recipientPhone,
        message,
        shipmentId: shipment.id,
        relatedTo: "SHIPMENT",
      });
      setRecipientMessage("");
      setSmsSent(true);
      Alert.alert(
        result?.data?.suppressed ? "Message already sent" : "Message sent",
        result?.data?.suppressed
          ? "An identical recent SMS was suppressed to prevent duplicates."
          : `The SMS was sent to ${recipientName}.`,
      );
    } catch (error) {
      Alert.alert("Message not sent", error.message || "Please try again.");
    } finally {
      setSmsSending(false);
    }
  };
  return (
    <>
      <ManagerCard>
        <SectionTitle
          title="Shipment Status Override"
          subtitle="Manually update the shipment status. Customer notifications are off unless you enable them below."
        />
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
          NEW SHIPMENT STATUS
        </Text>
        <Pressable
          disabled={saving}
          onPress={() => setStatusPickerOpen(true)}
          style={[
            styles.statusDropdown,
            { backgroundColor: colors.cardMuted, borderColor: colors.border },
            saving && styles.disabled,
          ]}
        >
          <View style={styles.flex}>
            <Text
              style={[
                styles.statusDropdownValue,
                { color: selectedStatus ? colors.text : colors.textMuted },
              ]}
            >
              {selectedStatus
                ? selectedStatus.replace(/_/g, " ")
                : "Select shipment status"}
            </Text>
            <Text style={[styles.statusDropdownCurrent, { color: colors.textMuted }]}>
              Current: {currentStatus.replace(/_/g, " ")}
            </Text>
          </View>
          <Feather name="chevron-down" size={20} color={colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => onNotifyCustomers(!notifyCustomers)}
          style={styles.silentUpdateRow}
        >
          <View
            style={[
              styles.silentCheckbox,
              {
                borderColor: notifyCustomers ? "#d97706" : colors.textMuted,
                backgroundColor: notifyCustomers ? "#d97706" : "transparent",
              },
            ]}
          >
            {notifyCustomers ? <Feather name="check" size={12} color="#fff" /> : null}
          </View>
          <Text
            style={[
              styles.silentUpdateText,
              { color: notifyCustomers ? "#d97706" : colors.textMuted },
            ]}
          >
            {notifyCustomers ? "NOTIFY CUSTOMERS" : "SILENT UPDATE"}
          </Text>
        </Pressable>
        {selectedStatus === "CANCELLED" ? (
          <View style={styles.warningBox}>
            <Feather name="alert-triangle" size={16} color="#dc2626" />
            <Text style={styles.warningText}>Cancelling stops shipment tracking and is recorded in the audit history.</Text>
          </View>
        ) : null}
        <Pressable
          disabled={!selectedStatus || saving}
          onPress={() => onStatus(selectedStatus)}
          style={[styles.fullAction, (!selectedStatus || saving) && styles.disabled]}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Feather name="refresh-cw" size={18} color="#fff" />}
          <Text style={styles.fullActionText}>Update Shipment Status</Text>
        </Pressable>
        <Modal
          visible={statusPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setStatusPickerOpen(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setStatusPickerOpen(false)}
          >
            <Pressable
              style={[styles.statusPickerSheet, { backgroundColor: colors.surface }]}
              onPress={() => {}}
            >
              <View style={styles.statusPickerHeader}>
                <View style={styles.flex}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    Select Shipment Status
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                    Current status: {currentStatus.replace(/_/g, " ")}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setStatusPickerOpen(false)}
                  style={[styles.closeButton, { backgroundColor: colors.cardMuted }]}
                >
                  <Feather name="x" size={21} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView
                style={styles.statusPickerScroll}
                contentContainerStyle={styles.statusPickerList}
              >
                {SHIPMENT_STATUSES.map((value) => {
                  const selected = selectedStatus === value;
                  const current = currentStatus === value;
                  return (
                    <Pressable
                      key={value}
                      disabled={current}
                      onPress={() => {
                        onSelectStatus(value);
                        setStatusPickerOpen(false);
                      }}
                      style={[
                        styles.statusPickerOption,
                        {
                          backgroundColor: selected
                            ? colors.primarySoft
                            : colors.cardMuted,
                          borderColor: selected ? "#2563eb" : colors.border,
                          opacity: current ? 0.55 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusPickerRadio,
                          {
                            borderColor: selected ? "#2563eb" : colors.textMuted,
                            backgroundColor: selected ? "#2563eb" : "transparent",
                          },
                        ]}
                      >
                        {selected ? <View style={styles.statusPickerRadioDot} /> : null}
                      </View>
                      <Text style={[styles.statusPickerOptionText, { color: colors.text }]}>
                        {value.replace(/_/g, " ")}
                      </Text>
                      {current ? (
                        <Text style={[styles.statusPickerCurrent, { color: colors.textMuted }]}>
                          CURRENT
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </ManagerCard>
      <ManagerCard>
        <SectionTitle
          title="Message Recipient"
          subtitle={`Send a direct SMS update to the recipient for ${
            shipment.trackingNumber || shipment.shipmentId || shipment.id
          }.`}
        />
        <View
          style={[
            styles.recipientAddress,
            { backgroundColor: colors.cardMuted, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.recipientAddressText, { color: colors.text }]}>
            To: <Text style={styles.recipientName}>{recipientName}</Text>
          </Text>
          <Text style={[styles.recipientPhone, { color: colors.textMuted }]}>
            {recipientPhone || "No Phone Number"}
          </Text>
        </View>
        <TextInput
          value={recipientMessage}
          onChangeText={(value) => {
            setRecipientMessage(value);
            setSmsSent(false);
          }}
          editable={!smsSending && Boolean(recipientPhone)}
          multiline
          textAlignVertical="top"
          placeholder={`Hi ${recipientName}, regarding your package...`}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.recipientMessageInput,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            !recipientPhone && styles.disabled,
          ]}
        />
        {smsSent ? (
          <View style={styles.smsSuccess}>
            <Feather name="check-circle" size={15} color="#059669" />
            <Text style={styles.smsSuccessText}>Message sent successfully.</Text>
          </View>
        ) : null}
        <Pressable
          disabled={
            saving ||
            smsSending ||
            !recipientPhone ||
            !recipientMessage.trim()
          }
          onPress={sendRecipientMessage}
          style={[
            styles.messageRecipientButton,
            (saving ||
              smsSending ||
              !recipientPhone ||
              !recipientMessage.trim()) &&
              styles.disabled,
          ]}
        >
          {smsSending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Feather name="send" size={18} color="#fff" />
          )}
          <Text style={styles.messageRecipientText}>
            {smsSending ? "Sending..." : "Send SMS"}
          </Text>
        </Pressable>
        <View style={[styles.smsNotice, { backgroundColor: colors.cardMuted }]}>
          <Feather name="alert-triangle" size={14} color={colors.textMuted} />
          <Text style={[styles.smsNoticeText, { color: colors.textMuted }]}>
            This sends a real SMS to the recipient linked to this shipment.
            Standard messaging rates may apply.
          </Text>
        </View>
      </ManagerCard>
      <ManagerCard>
        <SectionTitle
          title="Captured Proofs and Shipment Remarks"
          subtitle={`${receiptImages.length + deliveryImages.length} captured proof${
            receiptImages.length + deliveryImages.length === 1 ? "" : "s"
          }`}
        />
        {receiptImages.length ? (
          <CapturedProofStrip
            label="Receipt Proofs"
            images={receiptImages}
            colors={colors}
          />
        ) : null}
        {deliveryImages.length ? (
          <CapturedProofStrip
            label="Delivery Proofs"
            images={deliveryImages}
            colors={colors}
          />
        ) : null}
        {shipmentRemarks.length ? (
          shipmentRemarks.map((remark, index) => (
            <View
              key={`${remark}-${index}`}
              style={[
                styles.shipmentRemark,
                { backgroundColor: colors.cardMuted, borderColor: colors.border },
              ]}
            >
              <Feather name="message-square" size={15} color={colors.textMuted} />
              <Text style={[styles.shipmentRemarkText, { color: colors.text }]}>
                {String(remark)}
              </Text>
            </View>
          ))
        ) : (
          <EmptyState
            icon="image"
            title="No proofs or remarks"
            message="Captured delivery evidence and shipment remarks will appear here."
          />
        )}
      </ManagerCard>
    </>
  );
}

function CapturedProofStrip({ label, images, colors }) {
  return (
    <View style={styles.capturedProofGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
        {label.toUpperCase()}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.capturedProofRow}>
          {images.map((image, index) => {
            const url =
              typeof image === "string"
                ? image
                : image?.url || image?.uri || image?.downloadURL || "";
            if (!url) return null;
            return (
              <Pressable
                key={`${url}-${index}`}
                onPress={() => Linking.openURL(url)}
              >
                <Image source={{ uri: url }} style={styles.capturedProofImage} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function ActionButton({ icon, label, onPress, colors, disabled }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.actionRow, { borderTopColor: colors.border }, disabled && styles.disabled]}>
      <View style={[styles.actionIcon, { backgroundColor: colors.primarySoft }]}>
        <Feather name={icon} size={20} color="#2563eb" />
      </View>
      <Text style={[styles.actionTitle, styles.flex, { color: colors.text }]}>{label}</Text>
      <Feather name="chevron-right" size={19} color={colors.textMuted} />
    </Pressable>
  );
}

function WorkflowModal({
  visible,
  type,
  warehouseCode,
  onWarehouseCode,
  remarks,
  onRemarks,
  saving,
  colors,
  onClose,
  onSave,
}) {
  const receiving = type === "receive-return";
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {receiving ? "Receive Returned Shipment" : "Release to Delivery Operations"}
          </Text>
          <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
            {receiving
              ? "Confirm warehouse intake of returned pieces. The custody and return audit trail will be updated."
              : "Make eligible inventory visible to authorized checkers. Custody remains at Odiongan until the Load scan."}
          </Text>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>WAREHOUSE CODE</Text>
          <TextInput
            value={warehouseCode}
            onChangeText={onWarehouseCode}
            style={[styles.actionInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardMuted }]}
          />
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>REMARKS (OPTIONAL)</Text>
          <TextInput
            value={remarks}
            onChangeText={onRemarks}
            multiline
            placeholder={receiving ? "Received returned shipment at Odiongan" : "Released for checker Load scan"}
            placeholderTextColor={colors.textMuted}
            style={[styles.actionInput, styles.multilineInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardMuted }]}
          />
          <View style={styles.modalActions}>
            <Pressable disabled={saving} onPress={onClose} style={[styles.modalButton, { borderColor: colors.border }]}>
              <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable disabled={saving || !warehouseCode.trim()} onPress={onSave} style={[styles.modalButton, receiving ? styles.returnConfirm : styles.releaseConfirm, (saving || !warehouseCode.trim()) && styles.disabled]}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.reconcileText}>{receiving ? "Confirm Receive" : "Release Shipment"}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EditShipmentModal({ visible, shipment, colors, saving, onClose, onSave }) {
  const [form, setForm] = React.useState({});
  React.useEffect(() => {
    if (!visible) return;
    setForm({
      senderName: displayName(shipment.sender),
      senderPhone: shipment.sender?.phone || shipment.senderPhone || "",
      senderAddress: shipment.sender?.address?.street || shipment.sender?.address || "",
      recipientName: displayName(shipment.recipient),
      recipientPhone: shipment.recipient?.phone || shipment.recipientPhone || "",
      recipientSecondaryPhone: shipment.recipient?.secondaryPhone || shipment.recipient?.altPhone || "",
      recipientAddress: shipment.recipient?.address?.street || shipment.recipient?.address || "",
      municipality: shipment.municipality || shipment.recipient?.address?.city || shipment.recipient?.city || "",
      origin: shipment.origin || "",
      originCode: shipment.originCode || shipment.origin || "",
      destination: shipment.destination || "",
      destinationCode: shipment.destinationCode || shipment.destination || "",
      currentLocation: shipment.currentLocation || shipment.currentLocationState || "",
    });
  }, [visible, shipment]);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    if (!form.senderName?.trim() || !form.recipientName?.trim() || !form.origin?.trim() || !form.destination?.trim()) {
      Alert.alert("Missing information", "Sender, recipient, origin, and destination are required.");
      return;
    }
    onSave({
      shipmentId: shipment.id,
      sender: {
        ...(shipment.sender || {}),
        name: form.senderName.trim(),
        phone: form.senderPhone.trim(),
        address: {
          ...(typeof shipment.sender?.address === "object" ? shipment.sender.address : {}),
          street: form.senderAddress.trim(),
        },
      },
      recipient: {
        ...(shipment.recipient || {}),
        name: form.recipientName.trim(),
        phone: form.recipientPhone.trim(),
        secondaryPhone: form.recipientSecondaryPhone.trim() || null,
        address: {
          ...(typeof shipment.recipient?.address === "object" ? shipment.recipient.address : {}),
          street: form.recipientAddress.trim(),
          city: form.municipality.trim(),
          municipality: form.municipality.trim(),
        },
      },
      origin: form.origin.trim(),
      originCode: form.originCode.trim() || form.origin.trim(),
      destination: form.destination.trim(),
      destinationCode: form.destinationCode.trim() || form.destination.trim(),
      currentLocation: form.currentLocation.trim() || form.origin.trim(),
      proofOfReceipt: shipment.proofOfReceipt || [],
    });
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.editSheet, { backgroundColor: colors.surface }]}>
          <View style={styles.editHeader}>
            <View style={styles.flex}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Shipment Details</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>Structural edits follow manifest custody locks and Manager scope.</Text>
            </View>
            <Pressable onPress={onClose} disabled={saving} style={[styles.closeButton, { backgroundColor: colors.cardMuted }]}>
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.editForm} keyboardShouldPersistTaps="handled">
            <EditField label="Sender name *" value={form.senderName} onChangeText={(v) => set("senderName", v)} colors={colors} />
            <EditField label="Sender phone" value={form.senderPhone} onChangeText={(v) => set("senderPhone", v)} colors={colors} />
            <EditField label="Sender address" value={form.senderAddress} onChangeText={(v) => set("senderAddress", v)} colors={colors} />
            <EditField label="Recipient name *" value={form.recipientName} onChangeText={(v) => set("recipientName", v)} colors={colors} />
            <EditField label="Recipient phone" value={form.recipientPhone} onChangeText={(v) => set("recipientPhone", v)} colors={colors} />
            <EditField label="Secondary phone" value={form.recipientSecondaryPhone} onChangeText={(v) => set("recipientSecondaryPhone", v)} colors={colors} />
            <EditField label="Recipient address" value={form.recipientAddress} onChangeText={(v) => set("recipientAddress", v)} colors={colors} />
            <EditField label="Municipality" value={form.municipality} onChangeText={(v) => set("municipality", v)} colors={colors} />
            <EditField label="Origin *" value={form.origin} onChangeText={(v) => set("origin", v)} colors={colors} />
            <EditField label="Origin code" value={form.originCode} onChangeText={(v) => set("originCode", v)} colors={colors} />
            <EditField label="Destination *" value={form.destination} onChangeText={(v) => set("destination", v)} colors={colors} />
            <EditField label="Destination code" value={form.destinationCode} onChangeText={(v) => set("destinationCode", v)} colors={colors} />
            <EditField label="Current location" value={form.currentLocation} onChangeText={(v) => set("currentLocation", v)} colors={colors} />
          </ScrollView>
          <View style={[styles.editFooter, { borderTopColor: colors.border }]}>
            <Pressable disabled={saving} onPress={onClose} style={[styles.modalButton, { borderColor: colors.border }]}>
              <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={submit} style={[styles.modalButton, styles.reconcileButton, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.reconcileText}>Save Changes</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EditField({ label, value, onChangeText, colors }) {
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <TextInput
        value={String(value || "")}
        onChangeText={onChangeText}
        style={[styles.actionInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardMuted }]}
      />
    </View>
  );
}

function InfoCard({ label, value, colors }) {
  return (
    <ManagerCard style={styles.infoCard}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={3}>{String(value || "—")}</Text>
    </ManagerCard>
  );
}

function QuantityField({ label, value, onChangeText, colors }) {
  return (
    <View style={styles.quantityField}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        style={[styles.quantityInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardMuted }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  detailScroll: { flex: 1 },
  scrollContent: { paddingBottom: 1 },
  trackingTitle: { fontSize: 17, letterSpacing: -0.35 },
  summary: { minHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 15, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 10 },
  summaryStatus: { maxWidth: "56%", flexShrink: 1 },
  routeChip: { flex: 1, minWidth: 0, minHeight: 28, borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 10, flexDirection: "row", alignItems: "center", gap: 7 },
  route: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: "800" },
  tabs: { height: 54, flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabSelected: { borderBottomColor: "#10b981" },
  tabText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  content: { padding: 15, paddingBottom: 36, gap: 13 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  featureTitle: { fontSize: 15, fontWeight: "900" },
  featureDescription: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  smallAction: { minHeight: 38, borderRadius: 11, backgroundColor: "#059669", paddingHorizontal: 13, alignItems: "center", justifyContent: "center" },
  returnAction: { backgroundColor: "#7c3aed" },
  releaseAction: { backgroundColor: "#2563eb" },
  smallActionText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  fieldLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
  municipality: { fontSize: 16, fontWeight: "900", marginTop: 6 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  infoCard: { width: "48.5%", minHeight: 92 },
  infoValue: { fontSize: 14, lineHeight: 19, marginTop: 7 },
  packageRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  packageIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center" },
  packageTitle: { fontSize: 13, fontWeight: "900" },
  packageMeta: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  packageControls: { alignItems: "flex-end", gap: 7 },
  packageButtons: { flexDirection: "row", gap: 6 },
  packageMore: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  packageClose: { marginTop: 12, flex: 0 },
  labelActions: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 4 },
  labelButton: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  labelButtonText: { fontSize: 10, fontWeight: "900" },
  qrPanel: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 14 },
  qrCanvas: { backgroundColor: "#fff", padding: 0, overflow: "hidden" },
  qrRow: { flexDirection: "row" },
  qrTitle: { fontSize: 14, fontWeight: "900" },
  qrCodeText: { fontSize: 9, lineHeight: 14, marginTop: 4 },
  qrPrintButton: { alignSelf: "flex-start", minHeight: 34, borderRadius: 9, backgroundColor: "#2563eb", paddingHorizontal: 10, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  qrPrintText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  actionRow: { minHeight: 76, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 11 },
  actionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  deleteIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center" },
  deleteTitle: { color: "#dc2626", fontSize: 13, fontWeight: "900" },
  actionTitle: { fontSize: 13, fontWeight: "900", textTransform: "capitalize" },
  actionDescription: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  statusOptions: { flexDirection: "row", gap: 8, paddingVertical: 12 },
  statusOption: { minHeight: 38, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  statusOptionText: { fontSize: 9, fontWeight: "900" },
  statusDropdown: { minHeight: 58, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, marginTop: 7, marginBottom: 5, flexDirection: "row", alignItems: "center", gap: 10 },
  statusDropdownValue: { fontSize: 13, fontWeight: "900" },
  statusDropdownCurrent: { fontSize: 9, marginTop: 4 },
  statusPickerSheet: { maxHeight: "82%", borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden" },
  statusPickerHeader: { padding: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#cbd5e1", flexDirection: "row", alignItems: "flex-start", gap: 12 },
  statusPickerScroll: { minHeight: 0 },
  statusPickerList: { padding: 14, gap: 8, paddingBottom: 28 },
  statusPickerOption: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  statusPickerRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  statusPickerRadioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  statusPickerOptionText: { flex: 1, fontSize: 11, fontWeight: "900" },
  statusPickerCurrent: { fontSize: 8, fontWeight: "900" },
  actionInput: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 13, marginTop: 7, marginBottom: 12 },
  multilineInput: { minHeight: 82, paddingTop: 12, textAlignVertical: "top" },
  notifyRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  silentUpdateRow: { alignSelf: "flex-start", minHeight: 40, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 },
  silentCheckbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  silentUpdateText: { fontSize: 10, fontWeight: "900" },
  warningBox: { borderRadius: 11, backgroundColor: "#fef2f2", flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 11, marginBottom: 12 },
  warningText: { flex: 1, color: "#b91c1c", fontSize: 10, lineHeight: 15, fontWeight: "700" },
  fullAction: { minHeight: 50, borderRadius: 14, backgroundColor: "#059669", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  fullActionText: { color: "#fff", fontWeight: "900" },
  messageRecipientButton: { minHeight: 50, borderRadius: 14, backgroundColor: "#2563eb", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 12 },
  messageRecipientText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  recipientAddress: { minHeight: 50, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  recipientAddressText: { flex: 1, fontSize: 11 },
  recipientName: { fontWeight: "900" },
  recipientPhone: { fontFamily: "monospace", fontSize: 10 },
  recipientMessageInput: { minHeight: 112, borderWidth: 1, borderRadius: 11, padding: 12, fontSize: 13, lineHeight: 19, marginTop: 12 },
  smsSuccess: { minHeight: 38, borderRadius: 10, backgroundColor: "#d1fae5", paddingHorizontal: 11, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 7 },
  smsSuccessText: { color: "#047857", fontSize: 10, fontWeight: "800" },
  smsNotice: { borderRadius: 10, padding: 10, marginTop: 10, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  smsNoticeText: { flex: 1, fontSize: 9, lineHeight: 14 },
  capturedProofGroup: { marginTop: 14 },
  capturedProofRow: { flexDirection: "row", gap: 10, paddingTop: 8 },
  capturedProofImage: { width: 92, height: 92, borderRadius: 13, backgroundColor: "#e2e8f0" },
  shipmentRemark: { borderWidth: 1, borderRadius: 11, padding: 11, marginTop: 10, flexDirection: "row", alignItems: "flex-start", gap: 9 },
  shipmentRemarkText: { flex: 1, fontSize: 11, lineHeight: 17 },
  timelineRow: { flexDirection: "row", gap: 11, minHeight: 68, paddingTop: 12 },
  timelineRail: { width: 14, alignItems: "center" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#059669", marginTop: 3 },
  timelineLine: { width: 2, flex: 1, marginTop: 4 },
  timelineCopy: { flex: 1, paddingBottom: 12 },
  timelineTitle: { fontSize: 13, fontWeight: "800", textTransform: "capitalize" },
  timelineMeta: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  timelineNote: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  statusFlow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 14, paddingHorizontal: 2 },
  statusFlowStep: { width: 92, alignItems: "center", position: "relative" },
  statusFlowDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", zIndex: 2 },
  statusFlowLabel: { fontSize: 8, lineHeight: 11, textAlign: "center", fontWeight: "800", marginTop: 6, paddingHorizontal: 2 },
  statusFlowConnector: { position: "absolute", height: 2, width: 66, left: 59, top: 13 },
  proofGroup: { marginTop: 14 },
  proofRow: { flexDirection: "row", gap: 10, paddingTop: 8 },
  proofImage: { width: 86, height: 86, borderRadius: 13, backgroundColor: "#e2e8f0" },
  remarkBox: { borderWidth: 1, borderRadius: 11, padding: 11, marginTop: 10 },
  remarkText: { fontSize: 11, lineHeight: 17 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.55)" },
  modalSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 28 },
  managePackageSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", maxHeight: "92%" },
  manageHeader: { minHeight: 94, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  manageSubtitle: { marginBottom: 0 },
  manageBody: { padding: 20, gap: 14 },
  manageCard: { borderWidth: 1, borderRadius: 15, padding: 16 },
  manageCardTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  manageLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  manageLabel: { fontSize: 11, fontWeight: "900" },
  manageType: { alignItems: "flex-end" },
  manageTypeValue: { fontSize: 12, marginTop: 6 },
  managePackageCode: { color: "#f59e0b", fontFamily: "monospace", fontSize: 13, marginTop: 13 },
  manageDescription: { fontSize: 16, marginTop: 12 },
  manageHelp: { fontSize: 11, lineHeight: 17, marginTop: 20, marginBottom: 12 },
  manualQuantityRow: { flexDirection: "row", gap: 9 },
  manualQuantityInput: { flex: 1, minHeight: 50, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, fontSize: 16 },
  maxButton: { flex: 1.1, minHeight: 50, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  maxButtonText: { fontSize: 14, fontWeight: "800" },
  manageActionGrid: { flexDirection: "row", gap: 10 },
  manageAction: { flex: 1, minHeight: 58, borderRadius: 4, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  loadAllAction: { backgroundColor: "#d1fae5", borderColor: "#6ee7b7" },
  loadAllText: { color: "#059669", fontSize: 12, fontWeight: "900" },
  partialAction: { backgroundColor: "#dbeafe", borderColor: "#93c5fd" },
  partialText: { color: "#3b82f6", fontSize: 11, fontWeight: "900" },
  unloadAction: { minHeight: 58, borderRadius: 4, borderWidth: 1, borderColor: "#fca5a5", backgroundColor: "#fee2e2", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  unloadText: { color: "#ef4444", fontSize: 12, fontWeight: "900" },
  packageLabelAction: { minHeight: 48, borderRadius: 11, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  packageLabelText: { fontSize: 11, fontWeight: "900" },
  modalTitle: { fontSize: 20, fontWeight: "900" },
  modalSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 14 },
  quantityField: { marginBottom: 12 },
  quantityInput: { minHeight: 48, marginTop: 5, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 15 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 7 },
  modalButton: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  reconcileButton: { backgroundColor: "#059669", borderColor: "#059669" },
  returnConfirm: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  releaseConfirm: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  reconcileText: { color: "#fff", fontWeight: "900" },
  cancelText: { fontWeight: "800" },
  disabled: { opacity: 0.6 },
  editSheet: { flex: 1, marginTop: 45, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden" },
  editHeader: { padding: 18, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  closeButton: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  editForm: { paddingHorizontal: 18, paddingBottom: 20 },
  editFooter: { borderTopWidth: 1, padding: 14, flexDirection: "row", gap: 10 },
});
