import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import StatusBadge from "../../ui/StatusBadge"; // Adjust path

export default function PackageListItem({
  item,
  onMenuPress,
  onLongPress,
  selected,
}) {
  const isDelivered = item.status === "DELIVERED";

  return (
    <TouchableOpacity
      style={[
        styles.listItem,
        isDelivered && styles.deliveredBorder,
        selected && styles.selectedBorder,
      ]}
      onLongPress={() => onLongPress(item)} // ✅ Hold to Select
      onPress={() => selected && onLongPress(item)} // Tap toggles if already in selection mode
      activeOpacity={0.7}
      delayLongPress={300} // Sensitivity for "Hold"
    >
      {/* Left: Icon */}
      <View
        style={[
          styles.iconCircle,
          isDelivered && styles.deliveredIconBg,
          selected && styles.selectedIconBg,
        ]}
      >
        <FontAwesome5
          name={selected ? "check" : "box-open"}
          size={16}
          color={selected ? "#ffffff" : isDelivered ? "#166534" : "#64748b"}
        />
      </View>

      {/* Center: Text Info */}
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemTitle, selected && styles.selectedText]}>
          {item.trackingNumber}
        </Text>
        <Text style={styles.itemSub}>
          {selected ? "Selected" : item.status}
        </Text>
      </View>

      {/* Right: Actions */}
      <View style={styles.rightActionRow}>
        {/* Status Badge (Hide if selected to reduce clutter) */}
        {!selected && <StatusBadge status={item.status} />}

        {/* ✅ Three Dot Menu Button */}
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => onMenuPress(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Easier to tap
        >
          <FontAwesome5 name="ellipsis-v" size={16} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12, // Reduced padding slightly to fit menu
    backgroundColor: "#ffffff",
    // marginHorizontal: 16,
    // marginBottom: 8,
    borderRadius: 12,
    gap: 12,
    borderWidth: 2, // Consistent border width
    borderColor: "#e2e8f0", // Default gray
  },
  deliveredBorder: {
    borderColor: "#bbf7d0", // Green border
  },
  selectedBorder: {
    // borderColor: "#3b82f6", // Blue border
    backgroundColor: "#eff6ff", // Light blue bg
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  deliveredIconBg: {
    backgroundColor: "#dcfce7",
  },
  selectedIconBg: {
    backgroundColor: "#3b82f6",
  },
  selectedText: {
    color: "#1e3a8a",
    fontWeight: "bold",
  },
  itemTitle: {
    fontWeight: "700",
    color: "#0f172a",
    fontSize: 14,
  },
  itemSub: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  rightActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuBtn: {
    padding: 8,
    paddingRight: 0, // Align right
  },
});
