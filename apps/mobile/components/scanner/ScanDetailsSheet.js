import React from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function ScanDetailsSheet({
  colors,
  height,
  panHandlers,
  scanned,
  latestScan,
  latestTypeLabel,
  primaryScanActions,
  issueScanActions,
  selectedScanAction,
  scanActionStatus,
  scanActionHeading,
  processing,
  tripStatusUpdating,
  summaryLoading,
  tripSummary,
  progressLabel,
  canMarkTripCompleted,
  canMarkTripOutForDelivery,
  onSelectScanAction,
  onManualEntry,
  onResetScanner,
  onMarkCompleted,
  onMarkOutForDelivery,
  onViewShipmentDetails,
}) {
  return (
    <Animated.ScrollView
      style={[
        styles.detailsPane,
        {
          height,
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
      ]}
      contentContainerStyle={styles.detailsContent}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[0]}
    >
      <View
        style={[styles.sheetHandleArea, { backgroundColor: colors.bg }]}
        {...panHandlers}
      >
        <View style={styles.sheetHandle} />
        <Text style={[styles.sheetHandleText, { color: colors.textMuted }]}>
          Details
        </Text>
      </View>

      <View style={styles.panelHeader}>
        <View>
          <Text style={[styles.panelEyebrow, { color: colors.textMuted }]}>
            Scanner
          </Text>
          <Text style={[styles.panelTitle, { color: colors.text }]}>
            Scan Details
          </Text>
        </View>
        <View
          style={[styles.latestBadge, { backgroundColor: colors.cardMuted }]}
        >
          <Text style={[styles.latestBadgeText, { color: colors.text }]}>
            {latestTypeLabel}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.scanDetailCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <DetailRow
          label="Code"
          value={latestScan.code || "No scan yet"}
          colors={colors}
        />
        <DetailRow
          label="Shipment"
          value={latestScan.shipmentId || "Not resolved"}
          colors={colors}
        />
        <DetailRow
          label="Customer"
          value={latestScan.customerName || "Pending scan"}
          colors={colors}
        />
        <DetailRow
          label="Package Status"
          value={latestScan.packageStatus || "Pending scan"}
          colors={colors}
        />
        <DetailRow
          label="Shipment Status"
          value={latestScan.shipmentStatus || "Pending scan"}
          colors={colors}
        />
      </View>

      {!!primaryScanActions.length && (
        <View
          style={[
            styles.offloadActionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View>
            <Text
              style={[styles.offloadActionLabel, { color: colors.textMuted }]}
            >
              {scanActionHeading}
            </Text>
            <Text style={[styles.offloadActionTitle, { color: colors.text }]}>
              {selectedScanAction?.label || primaryScanActions[0]?.label}
            </Text>
          </View>

          <View
            style={[
              styles.offloadToggleRow,
              primaryScanActions.length > 2 && styles.offloadToggleRowGrid,
            ]}
          >
            {primaryScanActions.map((action) => {
              const isActive = scanActionStatus === action.status;
              const useGridLayout = primaryScanActions.length > 2;

              return (
                <TouchableOpacity
                  key={action.status || action.label}
                  style={[
                    styles.offloadToggleButton,
                    useGridLayout && styles.offloadToggleButtonGrid,
                    isActive && {
                      backgroundColor: action.color,
                      borderColor: action.color,
                    },
                  ]}
                  onPress={() => onSelectScanAction(action.status)}
                  disabled={processing}
                  activeOpacity={0.82}
                >
                  <FontAwesome5
                    name={action.icon}
                    size={useGridLayout ? 16 : 13}
                    color={isActive ? "#ffffff" : action.color}
                  />
                  <Text
                    style={[
                      styles.offloadToggleText,
                      useGridLayout && styles.offloadToggleTextGrid,
                      isActive && styles.offloadToggleTextActive,
                    ]}
                    numberOfLines={2}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <View
        style={[
          styles.progressCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.progressHeader}>
          <View>
            <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
              Current Trip
            </Text>
            <Text style={[styles.progressTrip, { color: colors.text }]}>
              {tripSummary.tripId || latestScan.currentTripId || "No trip"}
            </Text>
            <Text style={[styles.progressStatus, { color: colors.textMuted }]}>
              {tripSummary.status || "Status unavailable"}
            </Text>
          </View>
          {summaryLoading ? (
            <ActivityIndicator color="#2563eb" />
          ) : (
            <Text style={styles.progressPercent}>{tripSummary.progress}%</Text>
          )}
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${tripSummary.progress}%` },
            ]}
          />
        </View>

        <View style={styles.statsRow}>
          <StatCell
            label="Shipments"
            value={tripSummary.shipmentCount}
            colors={colors}
          />
          <StatCell
            label="Packages"
            value={tripSummary.totalPackages}
            colors={colors}
          />
          <StatCell
            label={progressLabel}
            value={`${tripSummary.scannedPackages}/${tripSummary.totalPackages}`}
            colors={colors}
          />
        </View>
      </View>

      {canMarkTripCompleted && (
        <TouchableOpacity
          style={[
            styles.completeButton,
            (processing || tripStatusUpdating) && styles.disabledButton,
          ]}
          onPress={onMarkCompleted}
          disabled={processing || tripStatusUpdating}
          activeOpacity={0.82}
        >
          {tripStatusUpdating ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <FontAwesome5 name="flag-checkered" size={14} color="#ffffff" />
          )}
          <Text style={styles.releaseButtonText}>
            {tripStatusUpdating ? "Updating Trip..." : "Complete Trip"}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.manualButton]}
          onPress={onManualEntry}
          disabled={processing}
          activeOpacity={0.8}
        >
          <FontAwesome5 name="keyboard" size={14} color="#ffffff" />
          <Text style={styles.actionButtonText}>Manual Entry</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.secondaryButton,
            !scanned && !processing && styles.disabledButton,
          ]}
          onPress={onResetScanner}
          disabled={!scanned && !processing}
          activeOpacity={0.8}
        >
          <FontAwesome5 name="redo" size={14} color="#2563eb" />
          <Text style={styles.secondaryButtonText}>Scan Next</Text>
        </TouchableOpacity>
      </View>

      {canMarkTripOutForDelivery && (
        <TouchableOpacity
          style={[
            styles.releaseButton,
            (processing || tripStatusUpdating) && styles.disabledButton,
          ]}
          onPress={onMarkOutForDelivery}
          disabled={processing || tripStatusUpdating}
          activeOpacity={0.82}
        >
          {tripStatusUpdating ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <FontAwesome5 name="route" size={14} color="#ffffff" />
          )}
          <Text style={styles.releaseButtonText}>
            {tripStatusUpdating ? "Updating Trip..." : "Mark Out for Delivery"}
          </Text>
        </TouchableOpacity>
      )}

      {!!issueScanActions.length && (
        <View style={styles.issueActionsRow}>
          {issueScanActions.map((action) => {
            const isActive = scanActionStatus === action.status;

            return (
              <TouchableOpacity
                key={action.status}
                style={[
                  styles.issueButton,
                  { borderColor: action.color },
                  isActive && { backgroundColor: action.color },
                ]}
                onPress={() => onSelectScanAction(action.status)}
                disabled={processing}
                activeOpacity={0.82}
              >
                <FontAwesome5
                  name={action.icon}
                  size={13}
                  color={isActive ? "#ffffff" : action.color}
                />
                <Text
                  style={[
                    styles.issueButtonText,
                    { color: action.color },
                    isActive && styles.issueButtonTextActive,
                  ]}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!!latestScan.shipmentId && (
        <TouchableOpacity
          style={[
            styles.detailsButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onViewShipmentDetails}
          activeOpacity={0.8}
        >
          <Text style={[styles.detailsButtonText, { color: colors.text }]}>
            View Shipment Details
          </Text>
          <FontAwesome5 name="chevron-right" size={12} color={colors.text} />
        </TouchableOpacity>
      )}
    </Animated.ScrollView>
  );
}

const DetailRow = ({ label, value, colors }) => (
  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
      {label}
    </Text>
    <Text
      style={[styles.detailValue, { color: colors.text }]}
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
);

const StatCell = ({ label, value, colors }) => (
  <View
    style={[
      styles.statCell,
      { backgroundColor: colors.cardMuted, borderColor: colors.border },
    ]}
  >
    <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  detailsPane: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 12,
  },
  detailsContent: {
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },
  sheetHandleArea: {
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 6,
  },
  sheetHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#94a3b8",
  },
  sheetHandleText: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
  },
  panelTitle: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
  },
  latestBadge: {
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  latestBadgeText: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  scanDetailCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 10,
  },
  offloadActionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 12,
  },
  offloadActionLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  offloadActionTitle: {
    marginTop: 3,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },
  offloadToggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  offloadToggleRowGrid: {
    flexWrap: "wrap",
  },
  offloadToggleButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  offloadToggleButtonGrid: {
    flex: 0,
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 72,
    flexDirection: "column",
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 6,
  },
  offloadToggleText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
  offloadToggleTextGrid: {
    textAlign: "center",
    lineHeight: 16,
  },
  offloadToggleTextActive: {
    color: "#ffffff",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  detailLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "800",
  },
  progressCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  progressTrip: {
    marginTop: 2,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "900",
  },
  progressStatus: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  progressPercent: {
    color: "#2563eb",
    fontSize: 18,
    fontWeight: "900",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  statCell: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  statValue: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  issueActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  manualButton: {
    backgroundColor: "#2563eb",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  disabledButton: {
    opacity: 0.55,
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "800",
  },
  releaseButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#0f766e",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  releaseButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  completeButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#16a34a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  issueButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  issueButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },
  issueButtonTextActive: {
    color: "#ffffff",
  },
  detailsButton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  detailsButtonText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
  },
});
