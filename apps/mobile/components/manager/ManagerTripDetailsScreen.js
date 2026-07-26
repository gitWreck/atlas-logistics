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
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import StatusBadge from "../ui/StatusBadge";
import {
  archiveTruckTrip,
  assignDriverToTrip,
  cancelTruckTrip,
  dispatchTrip,
  generateTripManifest,
  getManagerMobileTrip,
  recoverFoundPackage,
  startReceiving,
  unlockTripManifest,
  updateTripStatus,
} from "../utilities/FirebaseFunctions";
import useManagerRequest from "./useManagerRequest";
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
const CLOSED = new Set(["COMPLETED", "DELIVERED", "CANCELLED", "CANCELED", "ARCHIVED"]);

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

export default function ManagerTripDetailsScreen() {
  const { tripId, tab: initialTab } = useLocalSearchParams();
  const { colors } = useTheme();
  const { profile } = useAuth();
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
  const [saving, setSaving] = React.useState(false);
  const id = tripId ? String(tripId) : "";
  const { data, loading, refreshing, error, reload } = useManagerRequest(
    getManagerMobileTrip,
    { tripId: id },
  );

  if (loading) return <LoadingState label="Loading trip details…" />;
  if (error) return <ErrorState message={error.message} onRetry={() => reload()} />;

  const trip = data?.trip || {};
  const shipments = data?.shipments || [];
  const auditEntries = data?.auditEntries || [];
  const status = String(trip.status || "CREATED").toUpperCase();
  const currentIndex = STEPS.indexOf(status);
  const issue = trip.delayReason || trip.issue || trip.issueReport || trip.reportedIssue;
  const nextStatus = {
    CREATED: "LOADING",
    LOADING: "LOADED",
    LOADED: "IN_TRANSIT",
    IN_TRANSIT: "ARRIVED",
    ARRIVED: "COMPLETED",
  }[status];
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
  const privilegedLifecycle =
    profileRole === "admin" ||
    (profileRole === "manager" &&
      String(profile?.email || "").toLowerCase() === "roselyn@gmail.com");
  const canCancel = privilegedLifecycle && !CLOSED.has(status);
  const canArchive =
    privilegedLifecycle &&
    (CLOSED.has(status) || trip.active === false) &&
    trip.archived !== true;
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

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ManagerHeader
        back
        title={trip.tripId || trip.id}
        titleNumberOfLines={1}
        titleStyle={styles.tripTitle}
        subtitle="Active Trip Details"
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
                subtitle={`${shipments.length} authorized shipment${shipments.length === 1 ? "" : "s"}`}
              />
              <View style={[styles.manifestState, { backgroundColor: colors.cardMuted }]}>
                <Feather name={trip.manifestLocked ? "lock" : "unlock"} size={16} color="#0f766e" />
                <Text style={[styles.manifestStateText, { color: colors.text }]}>
                  Manifest {resolvedManifestStatus.replace(/_/g, " ")}
                </Text>
              </View>
              {shipments.length ? shipments.map((shipment, index) => (
                <View
                  key={shipment.id || index}
                  style={[styles.shipmentRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}
                >
                  <View style={styles.shipmentCopy}>
                    <Text style={[styles.shipmentTitle, { color: colors.text }]}>
                      {shipment.trackingNumber || shipment.trackingShipmentId || shipment.id}
                    </Text>
                    <Text style={[styles.shipmentMeta, { color: colors.textMuted }]}>
                      {[shipment.municipality || shipment.recipientMunicipality, shipment.customerName || shipment.recipientName]
                        .filter(Boolean)
                        .join(" • ") || "Shipment details unavailable"}
                    </Text>
                  </View>
                  <StatusBadge status={shipment.status || shipment.masterStatus || "LOADED"} />
                </View>
              )) : (
                <EmptyState icon="package" title="No manifest shipments found" />
              )}
            </ManagerCard>
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
              <SectionTitle title="Trip Lifecycle" />
              {nextStatus ? (
                <ActionButton
                  icon="arrow-right-circle"
                  label={`Advance to ${nextStatus.replace(/_/g, " ")}`}
                  description="Apply existing trip lifecycle validation and notifications"
                  onPress={() => confirmAction({
                    title: "Update trip status",
                    message: `Move this trip to ${nextStatus.replace(/_/g, " ")}?`,
                    confirm: "Continue",
                    callable: updateTripStatus,
                    payload: { tripId: trip.id, status: nextStatus },
                  })}
                  colors={colors}
                />
              ) : null}
              {canCancel ? (
                <ActionButton
                  icon="slash"
                  label="Cancel Trip"
                  description="Detach shipments according to the existing web workflow"
                  danger
                  onPress={() => confirmAction({
                    title: "Cancel trip",
                    message: "Cancel this trip? This action is recorded in the audit log.",
                    confirm: "Cancel trip",
                    callable: cancelTruckTrip,
                    payload: { tripId: trip.id, reason: "Manager mobile cancellation" },
                    danger: true,
                  })}
                  colors={colors}
                />
              ) : null}
              {canArchive ? (
                <ActionButton
                  icon="archive"
                  label="Archive Trip"
                  description="Hide from active operations while preserving history"
                  danger
                  onPress={() => confirmAction({
                    title: "Archive trip",
                    message: "Archive this closed trip?",
                    confirm: "Archive",
                    callable: archiveTruckTrip,
                    payload: { tripId: trip.id, reason: "Manager mobile archive" },
                    danger: true,
                  })}
                  colors={colors}
                />
              ) : null}
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
    </View>
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

function ActionButton({ icon, label, description, onPress, colors, danger = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { borderColor: danger ? "#fecaca" : colors.border, opacity: pressed ? 0.7 : 1 },
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
  tripTitle: { fontSize: 17, letterSpacing: -0.45 },
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
