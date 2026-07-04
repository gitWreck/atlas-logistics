import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import StatusBadge from "../../ui/StatusBadge";
import { useTheme } from "../../../contexts/ThemeContext";
import { formatDisplayValue } from "../../utilities/helpers";

export default function PackageListItem({
  item,
  onMenuPress,
  onLongPress,
  selected,
  isSelectionMode,
  showMenu = true,
}) {
  const { colors, resolvedScheme } = useTheme();
  const isDark = resolvedScheme === "dark";
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
        { backgroundColor: colors.surface, borderColor: colors.border },
        isLoaded && {
          backgroundColor: isDark ? "#172554" : "#f8fbff",
          borderColor: isDark ? "#1d4ed8" : "#bfdbfe",
        },
        isMissing && {
          backgroundColor: isDark ? "#450a0a" : "#fffafa",
          borderColor: isDark ? "#991b1b" : "#fecaca",
        },
        selected && {
          backgroundColor: isDark ? "#1e3a8a" : "#eff6ff",
          borderColor: "#60a5fa",
        },
      ]}
      onLongPress={() => onLongPress?.(item)}
      onPress={handlePress}
      activeOpacity={0.85}
      delayLongPress={300}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconColumn}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: colors.cardMuted, borderColor: colors.border },
              selected && styles.selectedIconWrap,
              isLoaded && {
                backgroundColor: isDark ? "#1e3a8a" : "#eff6ff",
                borderColor: isDark ? "#3b82f6" : "#bfdbfe",
              },
              isMissing && {
                backgroundColor: isDark ? "#7f1d1d" : "#fef2f2",
                borderColor: isDark ? "#dc2626" : "#fecaca",
              },
            ]}
          >
            <FontAwesome5
              name={selected ? "check" : packageIcon}
              size={16}
              color={
                selected
                  ? "#ffffff"
                  : isLoaded
                    ? "#2563eb"
                    : isMissing
                      ? "#dc2626"
                      : colors.textMuted
              }
            />
          </View>
          <Text style={[styles.sequenceText, { color: colors.textMuted }]}>
            #{item.sequence || "—"}
          </Text>
        </View>

        <View style={styles.headerContent}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.packageId,
                { color: colors.text },
                selected && styles.selectedText,
              ]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {item.packageId || "No Package ID"}
            </Text>

            {showMenu && (
              <TouchableOpacity
                style={[
                  styles.menuBtn,
                  {
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                  },
                  selected && styles.menuBtnSelected,
                ]}
                onPress={() => onMenuPress?.(item)}
              >
                <FontAwesome5
                  name="ellipsis-v"
                  size={14}
                  color={selected ? "#2563eb" : colors.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>

          {!selected && (
            <View style={styles.statusRow}>
              <StatusBadge status={item.status} />
            </View>
          )}
        </View>
      </View>

      <View style={styles.body}>
        <Text
          style={[styles.description, { color: colors.textMuted }]}
          numberOfLines={2}
        >
          {item.description || "No description"}
        </Text>

        <View style={styles.metaRow}>
          <View
            style={[
              styles.metaPill,
              { backgroundColor: colors.cardMuted, borderColor: colors.border },
            ]}
          >
            <FontAwesome5 name="box-open" size={10} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {item.packagingType || "Package"}
            </Text>
          </View>

          <View
            style={[
              styles.metaPill,
              { backgroundColor: colors.cardMuted, borderColor: colors.border },
            ]}
          >
            <FontAwesome5 name="hashtag" size={10} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {item.quantity || 0} pcs
            </Text>
          </View>
        </View>

        {(item.isFragile || item.isPerishable) && (
          <View style={styles.badgesRow}>
            {item.isFragile && (
              <View
                style={[
                  styles.tag,
                  styles.fragileTag,
                  isDark && {
                    backgroundColor: colors.dangerSoft,
                    borderColor: colors.danger,
                  },
                ]}
              >
                <FontAwesome5 name="wine-glass-alt" size={9} color="#991b1b" />
                <Text
                  style={[
                    styles.tagText,
                    styles.fragileTagText,
                    isDark && { color: colors.danger },
                  ]}
                >
                  Fragile
                </Text>
              </View>
            )}

            {item.isPerishable && (
              <View
                style={[
                  styles.tag,
                  styles.perishableTag,
                  isDark && {
                    backgroundColor: colors.successSoft,
                    borderColor: colors.success,
                  },
                ]}
              >
                <FontAwesome5 name="snowflake" size={9} color="#065f46" />
                <Text
                  style={[
                    styles.tagText,
                    styles.perishableTagText,
                    isDark && { color: colors.success },
                  ]}
                >
                  Perishable
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.locationRow}>
          <FontAwesome5
            name="map-marker-alt"
            size={12}
            color={colors.textMuted}
            style={styles.locationIcon}
          />
          <Text
            style={[styles.locationText, { color: colors.textMuted }]}
            numberOfLines={2}
          >
            From: {formatDisplayValue(item.currentLocation) || "No location"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 14,
    elevation: 2,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },

  iconColumn: {
    alignItems: "center",
    width: 48,
  },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  selectedIconWrap: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },

  sequenceText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94a3b8",
    marginTop: 8,
    letterSpacing: 0.4,
  },

  headerContent: {
    flex: 1,
    gap: 10,
    minWidth: 0,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  packageId: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 20,
  },

  selectedText: {
    color: "#1d4ed8",
  },

  statusRow: {
    alignSelf: "flex-start",
  },

  body: {
    gap: 12,
  },

  description: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 19,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    gap: 8,
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
    alignItems: "flex-start",
    gap: 8,
  },

  locationIcon: {
    marginTop: 2,
  },

  locationText: {
    flex: 1,
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
    lineHeight: 17,
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
    flexShrink: 0,
  },

  menuBtnSelected: {
    backgroundColor: "#dbeafe",
    borderColor: "#bfdbfe",
  },
});
