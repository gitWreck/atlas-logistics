import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function ShipmentListItem({ item, onPress, onMenuPress }) {
  return (
    <View style={styles.listItem}>
      {/* Main Click Area */}
      <TouchableOpacity
        style={styles.itemContent}
        onPress={() => onPress(item)}
      >
        <View style={styles.iconCircle}>
          <FontAwesome5 name="box" size={16} color="#64748b" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{item.id}</Text>
          <Text style={styles.itemSub}>
            {item.destination} {item.type}
          </Text>

          {/* Status Badge Text */}
          <View style={styles.statusRow}>
            <Text
              style={[
                styles.statusText,
                item.status === "DELIVERED" && { color: "#8E24AA" },
                item.status === "OUT_FOR_DELIVERY" && { color: "#FFB300" },
              ]}
            >
              {item.status.replace(/_/g, " ")}
            </Text>
            {/* Small progress indicator */}
            <Text style={styles.countText}>
              ({item.loadedCount}/{item.packageCount})
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* 3-Dot Menu */}
      <TouchableOpacity
        style={styles.menuBtn}
        onPress={() => onMenuPress(item)}
      >
        <FontAwesome5 name="ellipsis-v" size={20} color="#94a3b8" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  listItem: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginVertical: -12,
    marginBottom: 8,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  itemContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    // padding: 16,
    paddingBottom: 16,
    paddingTop: 16,
    paddingStart: 12,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e5f2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: { fontWeight: "700", color: "#0f172a" },
  itemSub: { color: "#475569", fontSize: 12 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  statusText: { fontSize: 10, fontWeight: "700", color: "#2563eb" },
  countText: { fontSize: 10, color: "#64748b" },
  menuBtn: {
    padding: 10,
    borderLeftWidth: 1,
    borderLeftColor: "#e5e7eb",
    height: "100%",
    justifyContent: "center",
  },
});
