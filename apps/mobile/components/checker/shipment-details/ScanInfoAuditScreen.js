import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../../contexts/ThemeContext";
import { useShipmentCustodyTimeline } from "../../../hooks/useShipmentCustodyTimeline";
import { db } from "../../../firebase";
import StatusBadge from "../../ui/StatusBadge";
import {
  buildMilestoneChecklist,
  buildScanInfoSections,
  formatEventDetail,
  resolveScannedPieceContext,
} from "./scanInfoHelpers";

const MODAL_MAX_HEIGHT = Dimensions.get("window").height * 0.9;

function SectionCard({ title, icon, children, colors }) {
  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: colors.cardMuted, borderColor: colors.border },
      ]}
    >
      <View style={styles.sectionHeader}>
        <FontAwesome5 name={icon} size={12} color="#6366f1" />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function InfoField({ label, value, colors, highlight }) {
  if (value == null || value === "") return null;
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.fieldValue,
          { color: colors.text },
          highlight && styles.fieldHighlight,
        ]}
        numberOfLines={3}
      >
        {value}
      </Text>
    </View>
  );
}

function ViewScopeToggle({ viewScope, onChange, colors, hasPiece }) {
  if (!hasPiece) return null;

  return (
    <View
      style={[
        styles.toggleRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.toggleBtn,
          viewScope === "piece" && styles.toggleBtnActive,
        ]}
        onPress={() => onChange("piece")}
      >
        <Text
          style={[
            styles.toggleText,
            { color: colors.textMuted },
            viewScope === "piece" && styles.toggleTextActive,
          ]}
        >
          This piece
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.toggleBtn,
          viewScope === "shipment" && styles.toggleBtnActive,
        ]}
        onPress={() => onChange("shipment")}
      >
        <Text
          style={[
            styles.toggleText,
            { color: colors.textMuted },
            viewScope === "shipment" && styles.toggleTextActive,
          ]}
        >
          Whole shipment
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function MilestoneChecklist({ milestones, onSelectEvent, colors }) {
  return (
    <View style={styles.milestoneList}>
      {milestones.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={styles.milestoneRow}
          onPress={() => item.event && onSelectEvent(item.event)}
          disabled={!item.event}
          activeOpacity={item.event ? 0.7 : 1}
        >
          <Text style={styles.milestoneIcon}>
            {item.completed ? "✅" : "□"}
          </Text>
          <View style={styles.milestoneTextWrap}>
            <Text style={[styles.milestoneLabel, { color: colors.text }]}>
              {item.label}
            </Text>
            {!!item.timestamp && (
              <Text style={[styles.milestoneTime, { color: colors.textMuted }]}>
                {new Date(item.timestamp).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            )}
          </View>
          {!!item.event && (
            <FontAwesome5
              name="chevron-right"
              size={10}
              color={colors.textMuted}
            />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function EventDetailModal({ event, visible, onClose, colors }) {
  const rows = formatEventDetail(event || {});

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.detailOverlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.detailSheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.detailTitle, { color: colors.text }]}>
            {event?.title || "Event detail"}
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {rows.map((row) => (
              <InfoField
                key={row.label}
                label={row.label}
                value={row.value}
                colors={colors}
              />
            ))}
            {!rows.length && (
              <Text style={{ color: colors.textMuted }}>
                No additional details for this event.
              </Text>
            )}
          </ScrollView>
          <TouchableOpacity style={styles.detailCloseBtn} onPress={onClose}>
            <Text style={styles.detailCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function ScanInfoAuditScreen({
  visible,
  data,
  onClose,
  onDetails,
  showManagerAudit = false,
}) {
  const { colors, resolvedScheme } = useTheme();
  const isDark = resolvedScheme === "dark";
  const shipmentId = data?.id || data?.shipmentId || null;
  const scannedCode = data?.scannedPackageId || data?.scannedCode || "";
  const [liveShipment, setLiveShipment] = useState(null);

  useEffect(() => {
    if (!visible || !shipmentId) {
      setLiveShipment(null);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "shipments", String(shipmentId)));
        if (cancelled || !snap.exists()) return;
        setLiveShipment({ id: snap.id, ...snap.data() });
      } catch (error) {
        console.warn("Scan Info shipment refresh failed:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, shipmentId]);

  const shipmentData = useMemo(() => {
    const base = liveShipment || data || {};
    return {
      ...base,
      id: shipmentId || base.id,
      scannedPackageId: scannedCode || base.scannedPackageId,
      scannedCode: scannedCode || base.scannedCode,
    };
  }, [liveShipment, data, shipmentId, scannedCode]);

  const pieceContext = useMemo(
    () => resolveScannedPieceContext(shipmentData, scannedCode),
    [shipmentData, scannedCode],
  );

  const [viewScope, setViewScope] = useState(pieceContext.defaultViewScope);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    if (visible) {
      setViewScope(pieceContext.defaultViewScope);
      setSelectedEvent(null);
    }
  }, [visible, pieceContext.defaultViewScope, scannedCode]);

  const activePieceId = viewScope === "piece" ? pieceContext.pieceId : null;

  const { events, loading, error } = useShipmentCustodyTimeline(
    shipmentId,
    visible && !!shipmentId,
    activePieceId,
  );

  const sections = useMemo(
    () =>
      buildScanInfoSections({
        shipmentData,
        events,
        pieceId: activePieceId,
        viewScope,
      }),
    [shipmentData, events, activePieceId, viewScope],
  );

  const milestones = useMemo(() => buildMilestoneChecklist(events), [events]);

  if (!data) return null;

  return (
    <>
      <Modal
        animationType="fade"
        transparent
        visible={visible}
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View
            style={[
              styles.content,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                height: MODAL_MAX_HEIGHT,
                maxHeight: MODAL_MAX_HEIGHT,
              },
            ]}
          >
            <View
              style={[styles.readOnlyBanner, { borderColor: colors.border }]}
            >
              <FontAwesome5 name="eye" size={12} color="#6366f1" />
              <Text style={[styles.readOnlyText, { color: colors.textMuted }]}>
                Read-only audit — no status changes from Scan Info
              </Text>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
            >
              <View style={styles.header}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: isDark ? "#0f172a" : "#eff6ff" },
                  ]}
                >
                  <FontAwesome5 name="search" size={18} color="#3b82f6" />
                </View>
                <View style={styles.headerTextWrap}>
                  <Text style={[styles.title, { color: colors.text }]}>
                    Scan Info
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                    Chain-of-custody lookup
                  </Text>
                </View>
              </View>

              <ViewScopeToggle
                viewScope={viewScope}
                onChange={setViewScope}
                colors={colors}
                hasPiece={!!pieceContext.pieceId}
              />

              <SectionCard title="Shipment Summary" icon="box" colors={colors}>
                <InfoField
                  label="Tracking #"
                  value={sections.summary.trackingNumber}
                  colors={colors}
                  highlight
                />
                <InfoField
                  label="Master Tracking"
                  value={sections.summary.masterTracking}
                  colors={colors}
                />
                {!!sections.summary.pieceLabel && (
                  <InfoField
                    label="Piece"
                    value={sections.summary.pieceLabel}
                    colors={colors}
                  />
                )}
                <InfoField
                  label="Customer"
                  value={sections.summary.customer}
                  colors={colors}
                />
                <InfoField
                  label="Destination"
                  value={sections.summary.destination}
                  colors={colors}
                />
                <View style={styles.statusRow}>
                  <Text
                    style={[styles.fieldLabel, { color: colors.textMuted }]}
                  >
                    Current Status
                  </Text>
                  <StatusBadge status={sections.summary.currentStatus} />
                </View>
                {sections.summary.statusBreakdown && (
                  <View style={styles.breakdownWrap}>
                    <Text
                      style={[
                        styles.breakdownTitle,
                        { color: colors.textMuted },
                      ]}
                    >
                      Piece summary
                    </Text>
                    {Object.entries(sections.summary.statusBreakdown).map(
                      ([status, count]) => (
                        <Text
                          key={status}
                          style={[styles.breakdownLine, { color: colors.text }]}
                        >
                          {status.replace(/_/g, " ")}: {count}
                        </Text>
                      ),
                    )}
                  </View>
                )}
              </SectionCard>

              <SectionCard
                title="Main Transport Information"
                icon="truck"
                colors={colors}
              >
                <InfoField
                  label="Trip ID"
                  value={sections.mainTransport.tripId}
                  colors={colors}
                />
                <InfoField
                  label="Main Truck"
                  value={sections.mainTransport.truck}
                  colors={colors}
                />
                <InfoField
                  label="Plate"
                  value={sections.mainTransport.plate}
                  colors={colors}
                />
                <InfoField
                  label="Driver"
                  value={sections.mainTransport.driver}
                  colors={colors}
                />
                <InfoField
                  label="Loaded"
                  value={sections.mainTransport.loadedAt}
                  colors={colors}
                />
              </SectionCard>

              <SectionCard
                title="Odiongan Warehouse Information"
                icon="warehouse"
                colors={colors}
              >
                <InfoField
                  label="Received By"
                  value={sections.odiongan.receivedBy}
                  colors={colors}
                />
                <InfoField
                  label="Received"
                  value={sections.odiongan.receivedAt}
                  colors={colors}
                />
                <InfoField
                  label="Returned By Checker"
                  value={sections.odiongan.returnedBy}
                  colors={colors}
                />
                <InfoField
                  label="Returned At"
                  value={sections.odiongan.returnedAt}
                  colors={colors}
                />
                <InfoField
                  label="Return Received By"
                  value={sections.odiongan.returnReceivedBy}
                  colors={colors}
                />
                <InfoField
                  label="Return Received At"
                  value={sections.odiongan.returnReceivedAt}
                  colors={colors}
                />
                <InfoField
                  label="Reconciled By"
                  value={sections.odiongan.reconciledBy}
                  colors={colors}
                />
                <InfoField
                  label="Reconciled"
                  value={sections.odiongan.reconciledAt}
                  colors={colors}
                />
                {sections.odiongan.reconcileResult ? (
                  <View
                    style={[
                      styles.varianceBanner,
                      {
                        backgroundColor: sections.odiongan.hasVariance
                          ? isDark
                            ? "rgba(245, 158, 11, 0.15)"
                            : "#fffbeb"
                          : isDark
                            ? "rgba(16, 185, 129, 0.12)"
                            : "#ecfdf5",
                        borderColor: sections.odiongan.hasVariance
                          ? "#f59e0b"
                          : "#10b981",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.varianceText,
                        {
                          color: sections.odiongan.hasVariance
                            ? "#d97706"
                            : "#059669",
                        },
                      ]}
                    >
                      Result: {sections.odiongan.reconcileResult}
                      {sections.odiongan.hasVariance
                        ? " (variance — review required)"
                        : ""}
                    </Text>
                  </View>
                ) : (
                  <InfoField label="Result" value={null} colors={colors} />
                )}
              </SectionCard>

              <SectionCard
                title="Delivery Information"
                icon="shipping-fast"
                colors={colors}
              >
                <InfoField
                  label="Released To"
                  value={sections.delivery.releasedTo}
                  colors={colors}
                />
                <InfoField
                  label="Delivery Vehicle"
                  value={sections.delivery.deliveryVehicle}
                  colors={colors}
                />
                <InfoField
                  label="Plate"
                  value={sections.delivery.plate}
                  colors={colors}
                />
                <InfoField
                  label="Driver"
                  value={sections.delivery.driver}
                  colors={colors}
                />
                <InfoField
                  label="Loaded For Delivery"
                  value={sections.delivery.loadedForDelivery}
                  colors={colors}
                />
                <InfoField
                  label="Out For Delivery"
                  value={sections.delivery.outForDelivery}
                  colors={colors}
                />
              </SectionCard>

              <SectionCard
                title="Delivery Status"
                icon="map-marker-alt"
                colors={colors}
              >
                <View style={styles.statusRow}>
                  <Text
                    style={[styles.fieldLabel, { color: colors.textMuted }]}
                  >
                    Current Status
                  </Text>
                  <StatusBadge status={sections.deliveryStatus.currentStatus} />
                </View>
                <InfoField
                  label="Attempts"
                  value={
                    sections.deliveryStatus.attempts > 0
                      ? String(sections.deliveryStatus.attempts)
                      : "0"
                  }
                  colors={colors}
                />
                <InfoField
                  label="Fail Reason"
                  value={sections.odiongan.failureReason}
                  colors={colors}
                />
                <InfoField
                  label="Last Scan"
                  value={sections.deliveryStatus.lastScan}
                  colors={colors}
                />
                <InfoField
                  label="GPS"
                  value={sections.deliveryStatus.gps}
                  colors={colors}
                />
              </SectionCard>

              <SectionCard
                title="Event Timeline"
                icon="history"
                colors={colors}
              >
                {loading ? (
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator color="#6366f1" />
                    <Text style={{ color: colors.textMuted, marginTop: 8 }}>
                      Loading timeline…
                    </Text>
                  </View>
                ) : error ? (
                  <Text style={{ color: "#ef4444" }}>
                    Could not load custody timeline.
                  </Text>
                ) : (
                  <MilestoneChecklist
                    milestones={milestones}
                    onSelectEvent={setSelectedEvent}
                    colors={colors}
                  />
                )}
              </SectionCard>

              {showManagerAudit && (
                <SectionCard
                  title="Manager Audit"
                  icon="shield-alt"
                  colors={colors}
                >
                  <InfoField
                    label="Shipment ID"
                    value={sections.audit.shipmentId}
                    colors={colors}
                  />
                  <InfoField
                    label="Piece ID"
                    value={sections.audit.pieceId}
                    colors={colors}
                  />
                  <InfoField
                    label="Trip ID"
                    value={sections.audit.tripId}
                    colors={colors}
                  />
                  <InfoField
                    label="Checker ID"
                    value={sections.audit.checkerId}
                    colors={colors}
                  />
                  <InfoField
                    label="Event Count"
                    value={String(sections.audit.eventCount)}
                    colors={colors}
                  />
                  <InfoField
                    label="Hash Chain Status"
                    value={sections.audit.hashChainStatus}
                    colors={colors}
                  />
                </SectionCard>
              )}
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text
                  style={[styles.closeBtnText, { color: colors.textMuted }]}
                >
                  Scan Next
                </Text>
              </TouchableOpacity>
              {onDetails ? (
                <TouchableOpacity style={styles.detailBtn} onPress={onDetails}>
                  <Text style={styles.detailBtnText}>View Full Details</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <EventDetailModal
        event={selectedEvent}
        visible={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        colors={colors}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 12,
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  content: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    elevation: 5,
  },
  readOnlyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  readOnlyText: { fontSize: 12, fontWeight: "600", flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerTextWrap: { flex: 1 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { marginTop: 2, fontSize: 12, fontWeight: "500" },
  toggleRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  toggleBtnActive: { backgroundColor: "#6366f1" },
  toggleText: { fontSize: 12, fontWeight: "700" },
  toggleTextActive: { color: "#fff" },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "800" },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 2,
  },
  fieldLabel: { fontSize: 12, fontWeight: "600", width: 120 },
  fieldValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "right",
  },
  fieldHighlight: { fontWeight: "800" },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  breakdownWrap: { marginTop: 8, gap: 4 },
  breakdownTitle: { fontSize: 11, fontWeight: "700" },
  breakdownLine: { fontSize: 12, fontWeight: "600" },
  milestoneList: { gap: 6 },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  milestoneIcon: { fontSize: 14, width: 22 },
  milestoneTextWrap: { flex: 1, gap: 2 },
  milestoneLabel: { fontSize: 13, fontWeight: "700" },
  milestoneTime: { fontSize: 11, fontWeight: "500" },
  varianceBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  varianceText: {
    fontSize: 12,
    fontWeight: "700",
  },
  loadingWrap: { alignItems: "center", paddingVertical: 16 },
  footer: {
    flexShrink: 0,
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
  },
  detailBtn: {
    backgroundColor: "#0f172a",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  detailBtnText: { color: "#fff", fontWeight: "700" },
  closeBtn: { padding: 8, alignItems: "center" },
  closeBtnText: { fontWeight: "600" },
  detailOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  detailSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
    maxHeight: "70%",
    gap: 12,
  },
  detailTitle: { fontSize: 17, fontWeight: "800" },
  detailCloseBtn: {
    backgroundColor: "#6366f1",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  detailCloseText: { color: "#fff", fontWeight: "700" },
});
