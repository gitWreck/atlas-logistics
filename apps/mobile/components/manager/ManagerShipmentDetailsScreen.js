import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const [statusRemarks, setStatusRemarks] = React.useState("");
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

  const changeStatus = (nextStatus, notify = notifyCustomers, remarks = statusRemarks) => {
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
                remarks: remarks.trim() || null,
                sourceUI: "MANAGER_MOBILE",
              });
              setSelectedStatus("");
              setStatusRemarks("");
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
            onReconcile={openReconcile}
            selectedStatus={selectedStatus}
            onSelectStatus={setSelectedStatus}
            statusRemarks={statusRemarks}
            onStatusRemarks={setStatusRemarks}
            notifyCustomers={notifyCustomers}
            onNotifyCustomers={setNotifyCustomers}
            onWorkflow={setWorkflow}
            onEdit={() => setEditOpen(true)}
            onPrint={printShipment}
            canDelete={canDelete}
            onDelete={confirmDelete}
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
        <SectionTitle title="Timeline and scan history" subtitle={`${timeline.length} events`} />
        {timeline.length ? timeline.map((event, index) => (
          <View key={event.id || index} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={styles.timelineDot} />
              {index < timeline.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: colors.border }]} /> : null}
            </View>
            <View style={styles.timelineCopy}>
              <Text style={[styles.timelineTitle, { color: colors.text }]}>
                {String(event.status || event.action || event.eventType || "Operational update").replace(/_/g, " ")}
              </Text>
              <Text style={[styles.timelineMeta, { color: colors.textMuted }]}>
                {[event.actorName || event.scannedByName || event.createdByName, event.location, formatDate(event.timestamp || event.createdAt || event.updatedAt)]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
              {event.note || event.reason ? <Text style={[styles.timelineNote, { color: colors.textMuted }]}>{event.note || event.reason}</Text> : null}
            </View>
          </View>
        )) : <EmptyState icon="clock" title="No audit events yet" />}
      </ManagerCard>
      {(receiptImages.length || deliveryImages.length || shipment.remarks || shipment.deliveryRemarks || shipment.failureReason) ? (
        <ManagerCard>
          <SectionTitle
            title="Proofs and remarks"
            subtitle={`${receiptImages.length + deliveryImages.length} captured image${receiptImages.length + deliveryImages.length === 1 ? "" : "s"}`}
          />
          {receiptImages.length ? <ProofStrip label="Receipt" images={receiptImages} colors={colors} /> : null}
          {deliveryImages.length ? <ProofStrip label="Delivery" images={deliveryImages} colors={colors} /> : null}
          {[shipment.remarks, shipment.deliveryRemarks, shipment.failureReason, shipment.returnReason]
            .filter(Boolean)
            .map((remark, index) => (
              <View key={`${remark}-${index}`} style={[styles.remarkBox, { backgroundColor: colors.cardMuted, borderColor: colors.border }]}>
                <Text style={[styles.remarkText, { color: colors.text }]}>{String(remark)}</Text>
              </View>
            ))}
        </ManagerCard>
      ) : null}
    </>
  );
}

function ProofStrip({ label, images, colors }) {
  return (
    <View style={styles.proofGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.proofRow}>
          {images.map((url, index) => (
            <Pressable key={`${url}-${index}`} onPress={() => Linking.openURL(url)}>
              <Image source={{ uri: url }} style={styles.proofImage} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function ItemsTab({ shipment, packages, colors, onRefresh }) {
  const [savingPackage, setSavingPackage] = React.useState(false);
  const [selectedPackage, setSelectedPackage] = React.useState(null);
  const [manualQty, setManualQty] = React.useState("1");
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
  return (
    <ManagerCard>
      <SectionTitle title="Shipment items" subtitle={`${packages.length || shipment.totals?.totalItems || 0} recorded`} />
      {packages.length ? packages.map((item, index) => (
        <View key={item.id || item.packageId || index} style={[styles.packageRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}>
          <View style={styles.packageIcon}><Feather name="box" size={18} color="#4f46e5" /></View>
          <View style={styles.flex}>
            <Text style={[styles.packageTitle, { color: colors.text }]}>{item.packageId || item.id || `Item ${index + 1}`}</Text>
            <Text style={[styles.packageMeta, { color: colors.textMuted }]}>
              {[item.description, item.quantity ? `Qty ${item.quantity}` : null, item.weight ? `${item.weight} kg` : null].filter(Boolean).join(" • ") || "Package details"}
            </Text>
          </View>
          <View style={styles.packageControls}>
            <StatusBadge status={item.status || shipment.status} />
            <Pressable
              disabled={savingPackage}
              onPress={() => openPackageActions(item)}
              style={[styles.packageMore, { backgroundColor: colors.cardMuted }]}
            >
              {savingPackage ? <ActivityIndicator size="small" color="#4f46e5" /> : <Feather name="more-vertical" size={18} color={colors.text} />}
            </Pressable>
          </View>
        </View>
      )) : (
        <EmptyState icon="package" title="No item rows recorded" message="Shipment totals are still available on the order." />
      )}
      <Modal visible={Boolean(selectedPackage)} transparent animationType="slide" onRequestClose={() => !savingPackage && setSelectedPackage(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Manage Package</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              {selectedPackage?.packageId || selectedPackage?.trackingNumber || selectedPackage?.id}
            </Text>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
              PARTIAL LOAD QUANTITY · MAX {Number(selectedPackage?.quantity || 1)}
            </Text>
            <TextInput
              value={manualQty}
              onChangeText={setManualQty}
              keyboardType="number-pad"
              style={[styles.actionInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardMuted }]}
            />
            <ActionButton icon="layers" label="Load All" onPress={() => updatePackage(selectedPackage, "LOADED")} colors={colors} disabled={savingPackage} />
            <ActionButton icon="box" label={`Partial Load (${Math.max(1, Number(manualQty) || 1)})`} onPress={() => updatePackage(selectedPackage, "LOADED", manualQty)} colors={colors} disabled={savingPackage || Number(selectedPackage?.quantity || 1) <= 1} />
            <ActionButton icon="rotate-ccw" label="Unload Package" onPress={() => updatePackage(selectedPackage, "RECEIVED")} colors={colors} disabled={savingPackage} />
            <ActionButton icon="help-circle" label="Mark Missing" onPress={() => updatePackage(selectedPackage, "MISSING")} colors={colors} disabled={savingPackage} />
            <ActionButton icon="alert-triangle" label="Mark Damaged" onPress={() => updatePackage(selectedPackage, "DAMAGED")} colors={colors} disabled={savingPackage} />
            <Pressable disabled={savingPackage} onPress={() => setSelectedPackage(null)} style={[styles.modalButton, styles.packageClose, { borderColor: colors.border }]}>
              {savingPackage ? <ActivityIndicator color="#4f46e5" /> : <Text style={[styles.cancelText, { color: colors.text }]}>Close</Text>}
            </Pressable>
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
  onReconcile,
  selectedStatus,
  onSelectStatus,
  statusRemarks,
  onStatusRemarks,
  notifyCustomers,
  onNotifyCustomers,
  onWorkflow,
  onEdit,
  onPrint,
  canDelete,
  onDelete,
}) {
  const currentStatus = String(shipment.status || "").toUpperCase();
  const canReceiveReturn = ["FAILED_DELIVERY", "RETURNING_TO_WAREHOUSE", "RETURNED_TO_WAREHOUSE"].includes(currentStatus);
  const canRelease =
    Boolean(shipment.returnReceivedAt || shipment.reconciledAt) &&
    shipment.availableForDelivery !== true &&
    !["DELIVERED", "COMPLETED", "CANCELLED"].includes(currentStatus);
  return (
    <>
      <ManagerCard>
        <SectionTitle title="Shipment Status Override" subtitle="The full Manager status workflow from the web console" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.statusOptions}>
            {SHIPMENT_STATUSES.map((value) => {
              const selected = selectedStatus === value;
              const current = currentStatus === value;
              return (
                <Pressable
                  key={value}
                  disabled={current || saving}
                  onPress={() => onSelectStatus(value)}
                  style={[
                    styles.statusOption,
                    {
                      backgroundColor: selected ? "#2563eb" : colors.cardMuted,
                      borderColor: selected ? "#2563eb" : colors.border,
                      opacity: current ? 0.45 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.statusOptionText, { color: selected ? "#fff" : colors.text }]}>
                    {value.replace(/_/g, " ")}{current ? " (CURRENT)" : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <TextInput
          value={statusRemarks}
          onChangeText={onStatusRemarks}
          placeholder="Remarks (optional)"
          placeholderTextColor={colors.textMuted}
          style={[styles.actionInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardMuted }]}
        />
        <View style={styles.notifyRow}>
          <View style={styles.flex}>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Notify customer</Text>
            <Text style={[styles.actionDescription, { color: colors.textMuted }]}>
              Send the same SMS, email, and push lifecycle notifications as web.
            </Text>
          </View>
          <Switch value={notifyCustomers} onValueChange={onNotifyCustomers} trackColor={{ false: "#94a3b8", true: "#60a5fa" }} thumbColor={notifyCustomers ? "#2563eb" : "#f8fafc"} />
        </View>
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
      </ManagerCard>
      <ManagerCard>
        <SectionTitle title="Warehouse operations" subtitle="Return loop, hub reconcile, and checker-pool release" />
        <ActionButton icon="check-square" label={shipment.reconciledAt ? "Update Odiongan reconcile" : "Reconcile at Odiongan"} onPress={onReconcile} colors={colors} disabled={saving || ["DELIVERED", "COMPLETED", "CANCELLED"].includes(currentStatus)} />
        <ActionButton icon="corner-down-left" label="Receive returned shipment" onPress={() => onWorkflow("receive-return")} colors={colors} disabled={saving || !canReceiveReturn} />
        <ActionButton icon="send" label="Release to delivery operations" onPress={() => onWorkflow("release")} colors={colors} disabled={saving || !canRelease} />
      </ManagerCard>
      <ManagerCard>
        <SectionTitle title="Order tools" subtitle="Authorized shipment document and structural actions" />
        <ActionButton icon="edit-3" label="Edit shipment details" onPress={onEdit} colors={colors} disabled={saving} />
        <ActionButton icon="printer" label="Print or share shipment order" onPress={onPrint} colors={colors} disabled={saving} />
        {canDelete ? (
          <Pressable disabled={saving} onPress={onDelete} style={[styles.actionRow, { borderTopColor: colors.border }, saving && styles.disabled]}>
            <View style={styles.deleteIcon}>
              <Feather name="trash-2" size={20} color="#dc2626" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.deleteTitle}>Delete Shipment</Text>
              <Text style={[styles.actionDescription, { color: colors.textMuted }]}>Admin-only permanent deletion with audit logging.</Text>
            </View>
            <Feather name="chevron-right" size={19} color="#dc2626" />
          </Pressable>
        ) : null}
      </ManagerCard>
      <ManagerCard>
        <SectionTitle title="Customer communications" subtitle="Contact the sender or recipient from the shipment workspace" />
        {shipment.sender?.phone || shipment.senderPhone ? (
          <>
            <ActionButton icon="message-circle" label="Message sender" onPress={() => Linking.openURL(`sms:${shipment.sender?.phone || shipment.senderPhone}`)} colors={colors} disabled={saving} />
            <ActionButton icon="phone" label="Call sender" onPress={() => Linking.openURL(`tel:${shipment.sender?.phone || shipment.senderPhone}`)} colors={colors} disabled={saving} />
          </>
        ) : null}
        {shipment.recipient?.phone || shipment.recipientPhone ? (
          <>
            <ActionButton icon="message-circle" label="Message recipient" onPress={() => Linking.openURL(`sms:${shipment.recipient?.phone || shipment.recipientPhone}`)} colors={colors} disabled={saving} />
            <ActionButton icon="phone" label="Call recipient" onPress={() => Linking.openURL(`tel:${shipment.recipient?.phone || shipment.recipientPhone}`)} colors={colors} disabled={saving} />
          </>
        ) : null}
      </ManagerCard>
    </>
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
  packageMore: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  packageClose: { marginTop: 12, flex: 0 },
  actionRow: { minHeight: 76, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 11 },
  actionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  deleteIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center" },
  deleteTitle: { color: "#dc2626", fontSize: 13, fontWeight: "900" },
  actionTitle: { fontSize: 13, fontWeight: "900", textTransform: "capitalize" },
  actionDescription: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  statusOptions: { flexDirection: "row", gap: 8, paddingVertical: 12 },
  statusOption: { minHeight: 38, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  statusOptionText: { fontSize: 9, fontWeight: "900" },
  actionInput: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 13, marginTop: 7, marginBottom: 12 },
  multilineInput: { minHeight: 82, paddingTop: 12, textAlignVertical: "top" },
  notifyRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  warningBox: { borderRadius: 11, backgroundColor: "#fef2f2", flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 11, marginBottom: 12 },
  warningText: { flex: 1, color: "#b91c1c", fontSize: 10, lineHeight: 15, fontWeight: "700" },
  fullAction: { minHeight: 50, borderRadius: 14, backgroundColor: "#059669", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  fullActionText: { color: "#fff", fontWeight: "900" },
  timelineRow: { flexDirection: "row", gap: 11, minHeight: 68, paddingTop: 12 },
  timelineRail: { width: 14, alignItems: "center" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#059669", marginTop: 3 },
  timelineLine: { width: 2, flex: 1, marginTop: 4 },
  timelineCopy: { flex: 1, paddingBottom: 12 },
  timelineTitle: { fontSize: 13, fontWeight: "800", textTransform: "capitalize" },
  timelineMeta: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  timelineNote: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  proofGroup: { marginTop: 14 },
  proofRow: { flexDirection: "row", gap: 10, paddingTop: 8 },
  proofImage: { width: 86, height: 86, borderRadius: 13, backgroundColor: "#e2e8f0" },
  remarkBox: { borderWidth: 1, borderRadius: 11, padding: 11, marginTop: 10 },
  remarkText: { fontSize: 11, lineHeight: 17 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.55)" },
  modalSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 28 },
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
