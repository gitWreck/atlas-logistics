import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import StatusBadge from "../../ui/StatusBadge";

export default function PackageListItem({
  item,
  onMenuPress,
  onLongPress,
  selected,
  isSelectionMode, // ✅ NEW PROP: Pass 'selectedIds.size > 0' from parent
}) {
  const isLoaded = item.status === "LOADED";
  const isMissing = item.status === "MISSING";

  const handlePress = () => {
    // ✅ FIX: If we are in selection mode (any item is selected),
    // tapping should toggle selection, NOT open the menu.
    if (isSelectionMode || selected) {
      onLongPress(item);
    } else {
      onMenuPress(item);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.listItem,
        isLoaded && styles.loadedBorder,
        isMissing && styles.missingBorder,
        selected && styles.selectedBorder,
      ]}
      onLongPress={() => onLongPress(item)}
      onPress={handlePress} // ✅ Use the new handler
      activeOpacity={0.7}
      delayLongPress={300}
    >
      {/* Left Container: Status/Selection Indicator + Sequence */}
      <View style={styles.leftContainer}>
        <View
          style={[
            styles.iconCircle,
            selected && styles.selectedIconBg,
            isLoaded && styles.loadedIconBg,
            isMissing && styles.missingIconBg,
          ]}
        >
          <FontAwesome5
            name={
              selected
                ? "check"
                : item.packagingType === "Box"
                  ? "box"
                  : "archive"
            }
            size={14}
            color={
              selected
                ? "#fff"
                : isLoaded
                  ? "#2563eb"
                  : isMissing
                    ? "#dc2626"
                    : "#64748b"
            }
          />
        </View>
        <Text style={styles.sequenceText}>#{item.sequence}</Text>
      </View>

      {/* Center Container: Main Info */}
      <View style={styles.centerContainer}>
        <View style={styles.titleRow}>
          <Text style={[styles.itemTitle, selected && styles.selectedText]}>
            {item.trackingNumber}
          </Text>
          {item.isFragile && (
            <View style={styles.fragileBadge}>
              <FontAwesome5 name="wine-glass-alt" size={8} color="#991b1b" />
              <Text style={styles.fragileText}>FRAGILE</Text>
            </View>
          )}
        </View>

        <Text style={styles.itemDescription} numberOfLines={1}>
          {item.description} • {item.packagingType}
        </Text>

        <View style={styles.locationRow}>
          <FontAwesome5 name="map-marker-alt" size={10} color="#94a3b8" />
          <Text style={styles.locationText}>{item.currentLocation}</Text>
        </View>
      </View>

      {/* Right Container: Badge & Action */}
      <View style={styles.rightContainer}>
        {!selected && <StatusBadge status={item.status} />}

        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => onMenuPress(item)}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <FontAwesome5
            name="ellipsis-v"
            size={14}
            color={selected ? "#3b82f6" : "#94a3b8"}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1.5,
    borderColor: "#f1f5f9",
    // Elevation for Android
    elevation: 2,
    // Shadow for iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  leftContainer: {
    alignItems: "center",
    marginRight: 12,
  },
  centerContainer: {
    flex: 1,
  },
  rightContainer: {
    alignItems: "flex-end",
    gap: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  sequenceText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94a3b8",
    marginTop: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },
  itemTitle: {
    fontWeight: "700",
    color: "#1e293b",
    fontSize: 13,
  },
  fragileBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  fragileText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#991b1b",
  },
  itemDescription: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "500",
  },
  menuBtn: {
    padding: 6,
  },
  // Conditional Styles
  loadedBorder: { borderColor: "#dbeafe" },
  missingBorder: { borderColor: "#fee2e2" },
  selectedBorder: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
  loadedIconBg: { backgroundColor: "#eff6ff" },
  missingIconBg: { backgroundColor: "#fef2f2" },
  selectedIconBg: { backgroundColor: "#3b82f6" },
  selectedText: { color: "#1d4ed8" },
});
