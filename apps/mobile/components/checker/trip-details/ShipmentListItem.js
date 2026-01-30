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
          <Text style={styles.itemSub}>{item.destination}</Text>

          {/* Status Badge Text */}
          <View style={styles.statusRow}>
            <Text
              style={[
                styles.statusText,
                item.status === "DELIVERED" && { color: "#10b981" },
                item.status === "OUT_FOR_DELIVERY" && { color: "#8b5cf6" },
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
    backgroundColor: "#1e293b",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  itemContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: { fontWeight: "700", color: "#f8fafc" },
  itemSub: { color: "#94a3b8", fontSize: 12 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  statusText: { fontSize: 10, fontWeight: "700", color: "#60a5fa" },
  countText: { fontSize: 10, color: "#64748b" },
  menuBtn: {
    padding: 16,
    borderLeftWidth: 1,
    borderLeftColor: "#334155",
    height: "100%",
    justifyContent: "center",
  },
});
