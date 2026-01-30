import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import StatusBadge from "../../ui/StatusBadge"; // Adjust path

export default function PackageListItem({ item, onPress }) {
  const isDelivered = item.status === "DELIVERED";

  return (
    <TouchableOpacity
      style={[
        styles.listItem,
        isDelivered && { borderColor: "#bbf7d0" }, // Green border if done
      ]}
      onPress={() => onPress(item)}
    >
      {/* Icon */}
      <View
        style={[
          styles.iconCircle,
          isDelivered && { backgroundColor: "#dcfce7" },
        ]}
      >
        <FontAwesome5
          name={isDelivered ? "check" : "box-open"}
          size={16}
          color={isDelivered ? "#166534" : "#64748b"}
        />
      </View>

      {/* Text Info */}
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{item.trackingNumber}</Text>
        <Text style={styles.itemSub}>Tap to update</Text>
      </View>

      {/* Status Badge */}
      <StatusBadge status={item.status} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#1e293b",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#334155",
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
  itemSub: { color: "#94a3b8", fontSize: 10 },
});
