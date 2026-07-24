import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import StatusBadge from "../ui/StatusBadge";
import {
  getManagerMobileShipment,
  reconcileShipmentAtHub,
  updateShipmentStatus,
} from "../utilities/FirebaseFunctions";
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

const STATUS_ACTIONS = {
  CREATED: ["AVAILABLE"],
  PENDING_PICKUP: ["PICKED_UP"],
  PICKED_UP: ["RECEIVED_AT_DIVISORIA"],
  AVAILABLE: ["LOADED"],
  READY_FOR_LOADING: ["LOADED"],
  LOADED: ["IN_TRANSIT"],
  IN_TRANSIT: ["ARRIVED_AT_ODIONGAN"],
  ARRIVED: ["OUT_FOR_DELIVERY"],
  ARRIVED_AT_ODIONGAN: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED_DELIVERY"],
  FAILED_DELIVERY: ["RETURNED_TO_WAREHOUSE"],
};

export default function ManagerShipmentDetailsScreen() {
  const { shipmentId, tab } = useLocalSearchParams();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = React.useState(
    ["status", "items", "actions"].includes(String(tab || "")) ? String(tab) : "status",
  );
  const [saving, setSaving] = React.useState(false);
  const [reconcileOpen, setReconcileOpen] = React.useState(false);
  const [expectedQty, setExpectedQty] = React.useState("");
  const [receivedQty, setReceivedQty] = React.useState("");
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
  const actions = STATUS_ACTIONS[status] || [];
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

  const changeStatus = (nextStatus) => {
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
                notify: true,
                sourceUI: "MANAGER_MOBILE",
              });
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

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ManagerHeader
        back
        title={shipment.trackingNumber || shipment.shipmentId || shipment.id}
        subtitle={["SHIPMENT ORDER", route].filter(Boolean).join(" • ")}
        actionIcon="refresh-cw"
        onAction={() => reload({ refresh: true })}
      />
      <View style={[styles.summary, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <StatusBadge status={shipment.status} />
        {route ? <Text style={[styles.route, { color: colors.textMuted }]}>{route}</Text> : null}
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

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => reload({ refresh: true })}
            tintColor="#059669"
          />
        }
        contentContainerStyle={styles.content}
      >
        {activeTab === "status" ? (
          <StatusTab
            shipment={shipment}
            timeline={timeline}
            municipality={municipality}
            colors={colors}
            onReconcile={openReconcile}
          />
        ) : null}
        {activeTab === "items" ? (
          <ItemsTab shipment={shipment} packages={packages} colors={colors} />
        ) : null}
        {activeTab === "actions" ? (
          <ActionsTab
            shipment={shipment}
            actions={actions}
            saving={saving}
            colors={colors}
            onStatus={changeStatus}
            onReconcile={openReconcile}
          />
        ) : null}
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
    </View>
  );
}

function StatusTab({ shipment, timeline, municipality, colors, onReconcile }) {
  const status = String(shipment.status || "").toUpperCase();
  const hasReturn = status.includes("FAILED") || status.startsWith("RETURN");
  const reconciled = Boolean(shipment.reconciledAt || shipment.reconcileResult);
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
    </>
  );
}

function ItemsTab({ shipment, packages, colors }) {
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
          <StatusBadge status={item.status || shipment.status} />
        </View>
      )) : (
        <EmptyState icon="package" title="No item rows recorded" message="Shipment totals are still available on the order." />
      )}
    </ManagerCard>
  );
}

function ActionsTab({ shipment, actions, saving, colors, onStatus, onReconcile }) {
  return (
    <>
      <ManagerCard>
        <SectionTitle title="Shipment actions" subtitle="Same Manager workflow rules as the web console" />
        {actions.length ? actions.map((nextStatus) => (
          <Pressable key={nextStatus} disabled={saving} onPress={() => onStatus(nextStatus)} style={[styles.actionRow, { borderTopColor: colors.border }]}>
            <View style={[styles.actionIcon, { backgroundColor: colors.primarySoft }]}>
              <Feather name="arrow-right-circle" size={20} color="#4f46e5" />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>Move to {nextStatus.replace(/_/g, " ")}</Text>
              <Text style={[styles.actionDescription, { color: colors.textMuted }]}>Custody, timeline, notification, and permission checks apply.</Text>
            </View>
            {saving ? <ActivityIndicator color="#4f46e5" /> : <Feather name="chevron-right" size={19} color={colors.textMuted} />}
          </Pressable>
        )) : (
          <EmptyState icon="check-circle" title="No status action available" message={`The ${shipment.status || "current"} state has no direct Manager transition.`} />
        )}
      </ManagerCard>
      {!shipment.reconciledAt &&
      !shipment.reconcileResult &&
      !["DELIVERED", "COMPLETED", "CANCELLED"].includes(String(shipment.status || "").toUpperCase()) ? (
        <Pressable onPress={onReconcile} style={styles.fullAction}>
          <Feather name="check-square" size={18} color="#fff" />
          <Text style={styles.fullActionText}>Reconcile at Odiongan</Text>
        </Pressable>
      ) : null}
    </>
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
  summary: { minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 10 },
  route: { fontSize: 12, fontWeight: "700" },
  tabs: { height: 54, flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabSelected: { borderBottomColor: "#10b981" },
  tabText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  content: { padding: 15, paddingBottom: 36, gap: 13 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  featureTitle: { fontSize: 15, fontWeight: "900" },
  featureDescription: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  smallAction: { minHeight: 38, borderRadius: 11, backgroundColor: "#059669", paddingHorizontal: 13, alignItems: "center", justifyContent: "center" },
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
  actionRow: { minHeight: 76, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 11 },
  actionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 13, fontWeight: "900", textTransform: "capitalize" },
  actionDescription: { fontSize: 10, lineHeight: 15, marginTop: 3 },
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
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.55)" },
  modalSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 28 },
  modalTitle: { fontSize: 20, fontWeight: "900" },
  modalSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 14 },
  quantityField: { marginBottom: 12 },
  quantityInput: { minHeight: 48, marginTop: 5, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 15 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 7 },
  modalButton: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  reconcileButton: { backgroundColor: "#059669", borderColor: "#059669" },
  reconcileText: { color: "#fff", fontWeight: "900" },
  cancelText: { fontWeight: "800" },
  disabled: { opacity: 0.6 },
});
