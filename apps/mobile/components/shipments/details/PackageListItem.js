import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import StatusBadge from "../../ui/StatusBadge";

export default function PackageListItem({
  item,
  onMenuPress,
  onLongPress,
  selected,
  isSelectionMode,
  showMenu = true,
}) {
  const isLoaded = item.status === "LOADED";
  const isMissing = item.status === "MISSING";

  const handlePress = () => {
    if (isSelectionMode || selected) {
      onLongPress?.(item);
    } else {
      onMenuPress?.(item);
    }
  };

  const packageIcon =
    item.packagingType === "Box"
      ? "box"
      : item.packagingType === "Sack"
        ? "shopping-bag"
        : item.packagingType === "Bundle"
          ? "boxes"
          : "archive";

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isLoaded && styles.loadedCard,
        isMissing && styles.missingCard,
        selected && styles.selectedCard,
      ]}
      onLongPress={() => onLongPress?.(item)}
      onPress={handlePress}
      activeOpacity={0.85}
      delayLongPress={300}
    >
      <View style={styles.left}>
        <View
          style={[
            styles.iconWrap,
            selected && styles.selectedIconWrap,
            isLoaded && styles.loadedIconWrap,
            isMissing && styles.missingIconWrap,
          ]}
        >
          <FontAwesome5
            name={selected ? "check" : packageIcon}
            size={15}
            color={
              selected
                ? "#ffffff"
                : isLoaded
                  ? "#2563eb"
                  : isMissing
                    ? "#dc2626"
                    : "#475569"
            }
          />
        </View>

        <Text style={styles.sequenceText}>#{item.sequence || "—"}</Text>
      </View>

      <View style={styles.center}>
        <View style={styles.topRow}>
          <Text style={[styles.packageId, selected && styles.selectedText]}>
            {item.packageId || "No Package ID"}
          </Text>

          {/* {!selected && <StatusBadge status={item.status} />} */}
        </View>

        <Text style={styles.description} numberOfLines={1}>
          {item.description || "No description"}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <FontAwesome5 name="box-open" size={10} color="#64748b" />
            <Text style={styles.metaText}>
              {item.packagingType || "Package"}
            </Text>
          </View>

          <View style={styles.metaPill}>
            <FontAwesome5 name="hashtag" size={10} color="#64748b" />
            <Text style={styles.metaText}>{item.quantity || 0} pcs</Text>
          </View>
        </View>

        <View style={styles.badgesRow}>
          {item.isFragile && (
            <View style={[styles.tag, styles.fragileTag]}>
              <FontAwesome5 name="wine-glass-alt" size={9} color="#991b1b" />
              <Text style={[styles.tagText, styles.fragileTagText]}>
                Fragile
              </Text>
            </View>
          )}

          {item.isPerishable && (
            <View style={[styles.tag, styles.perishableTag]}>
              <FontAwesome5 name="snowflake" size={9} color="#065f46" />
              <Text style={[styles.tagText, styles.perishableTagText]}>
                Perishable
              </Text>
            </View>
          )}
        </View>

        <View style={styles.locationRow}>
          <FontAwesome5 name="map-marker-alt" size={11} color="#94a3b8" />
          <Text style={styles.locationText} numberOfLines={1}>
            From: {item.currentLocation || "No location"}
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        {showMenu && (
          <TouchableOpacity
            style={[styles.menuBtn, selected && styles.menuBtnSelected]}
            onPress={() => onMenuPress?.(item)}
          >
            <FontAwesome5
              name="ellipsis-v"
              size={14}
              color={selected ? "#2563eb" : "#94a3b8"}
            />
          </TouchableOpacity>
        )}

        {!selected && (
          <View style={styles.statusWrap}>
            <StatusBadge status={item.status} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    // marginHorizontal: 16,
    marginVertical: 7,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    // shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    // shadowOpacity: 0.05,
    // shadowRadius: 14,
    elevation: 2,
  },

  loadedCard: {
    borderColor: "#bfdbfe",
    backgroundColor: "#f8fbff",
  },

  missingCard: {
    borderColor: "#fecaca",
    backgroundColor: "#fffafa",
  },

  selectedCard: {
    borderColor: "#60a5fa",
    backgroundColor: "#eff6ff",
    shadowOpacity: 0.08,
  },

  left: {
    alignItems: "center",
    marginRight: 12,
    paddingTop: 2,
  },

  center: {
    flex: 1,
  },

  right: {
    marginLeft: 10,
    justifyContent: "space-between", // key change
    alignItems: "flex-end",
  },

  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  statusWrap: {
    marginTop: 8,
    alignItems: "flex-end",
  },

  right: {
    marginLeft: 10,
    justifyContent: "space-between", // key change
    alignItems: "flex-end",
  },

  loadedIconWrap: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },

  missingIconWrap: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },

  selectedIconWrap: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },

  sequenceText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94a3b8",
    marginTop: 6,
    letterSpacing: 0.4,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 4,
  },

  packageId: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    marginRight: 8,
  },

  selectedText: {
    color: "#1d4ed8",
  },

  description: {
    fontSize: 12.5,
    color: "#475569",
    marginBottom: 8,
    lineHeight: 18,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },

  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },

  metaText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },

  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },

  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },

  fragileTag: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },

  perishableTag: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },

  tagText: {
    fontSize: 10,
    fontWeight: "700",
  },

  fragileTagText: {
    color: "#991b1b",
  },

  perishableTagText: {
    color: "#065f46",
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },

  locationText: {
    flex: 1,
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
  },

  menuBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 2,
  },

  menuBtnSelected: {
    backgroundColor: "#dbeafe",
    borderColor: "#bfdbfe",
  },
});
