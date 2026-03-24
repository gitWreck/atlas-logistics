import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import StatusBadge from "../ui/StatusBadge";

export default function TrackedShipmentList({ shipments, onShipmentPress }) {
  // Empty State
  if (!shipments || shipments.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>
          You haven’t added any shipments yet.
        </Text>
        {/* <Text style={styles.emptyTextMuted}>
          Use “Add tracking” to link a shipment to your dashboard.
        </Text> */}
      </View>
    );
  }

  // List State
  return (
    <ScrollView contentContainerStyle={styles.listContent}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>My Shipments</Text>
      </View>

      {shipments.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.shipmentCard}
          activeOpacity={0.85}
          onPress={() => onShipmentPress(item)}
        >
          {/* Top Row: Tracking & Badge */}
          <View style={styles.cardTopRow}>
            <View>
              <Text style={styles.trackingLabel}>Tracking number</Text>
              <Text style={styles.trackingValue}>
                {item.trackingNumber || item.id}
              </Text>
            </View>
            <StatusBadge status={item.status} />
          </View>

          {/* Bottom Row: Hint & Time */}
          <View style={styles.cardBottomRow}>
            <Text style={styles.trackingHint}>Tap to view live status...</Text>
            <Text style={styles.timeText}>{item.updatedAt || "Just now"}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 4,
  },
  emptyTextMuted: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 24,
  },
  shipmentCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  trackingLabel: {
    fontSize: 11,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  trackingValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },
  trackingHint: {
    fontSize: 12,
    color: "#64748b",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },
  timeText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
  },
});
