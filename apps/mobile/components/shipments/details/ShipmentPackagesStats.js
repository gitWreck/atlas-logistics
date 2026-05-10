import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../../contexts/ThemeContext";

export default function ShipmentPackagesStats({ shipment }) {
  const { colors, resolvedScheme } = useTheme();
  const isDark = resolvedScheme === "dark";
  const totals = shipment?.totals || {};
  const loaded = totals.loaded || 0;
  const missing = totals.missing || 0;
  const totalItems = totals.totalContentQty || totals.totalItems || 0;

  const processed = loaded + missing;
  const percent = totalItems > 0 ? (processed / totalItems) * 100 : 0;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
            Package Overview
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Shipment Progress
          </Text>
        </View>

        <View
          style={[
            styles.percentBadge,
            { backgroundColor: isDark ? "#1e3a8a" : "#eff6ff" },
          ]}
        >
          <Text style={styles.percentBadgeText}>{Math.round(percent)}%</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: isDark ? "#172554" : "#eff6ff" },
          ]}
        >
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: isDark ? "#1e3a8a" : "#dbeafe",
              },
            ]}
          >
            <FontAwesome5 name="check-circle" size={14} color="#2563eb" />
          </View>
          <Text style={[styles.statValue, { color: "#2563eb" }]}>{loaded}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            Loaded
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: isDark ? "#450a0a" : "#fef2f2" },
          ]}
        >
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: isDark ? "#7f1d1d" : "#fee2e2",
              },
            ]}
          >
            <FontAwesome5 name="exclamation-circle" size={14} color="#dc2626" />
          </View>
          <Text style={[styles.statValue, { color: "#dc2626" }]}>
            {missing}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            Missing
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.cardMuted }]}>
          <View
            style={[styles.iconWrap, { backgroundColor: colors.border }]}
          >
            <FontAwesome5 name="boxes" size={14} color={colors.text} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {totalItems}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            Total
          </Text>
        </View>
      </View>

      <View style={[styles.progressCard, { backgroundColor: colors.cardMuted }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressTitle, { color: colors.text }]}>
            Processed Items
          </Text>
          <Text style={[styles.progressMeta, { color: colors.textMuted }]}>
            {processed} / {totalItems}
          </Text>
        </View>

        <View style={[styles.barBg, { backgroundColor: colors.border }]}>
          <View style={[styles.barFill, { width: `${percent}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#94a3b8",
    marginBottom: 4,
  },

  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },

  percentBadge: {
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  percentBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563eb",
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
  },

  loadedCard: {
    backgroundColor: "#eff6ff",
  },

  missingCard: {
    backgroundColor: "#fef2f2",
  },

  totalCard: {
    backgroundColor: "#f8fafc",
  },

  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  loadedIconWrap: {
    backgroundColor: "#dbeafe",
  },

  missingIconWrap: {
    backgroundColor: "#fee2e2",
  },

  totalIconWrap: {
    backgroundColor: "#e2e8f0",
  },

  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
  },

  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  progressCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 12,
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  progressTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },

  progressMeta: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },

  barBg: {
    height: 10,
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },

  barFill: {
    height: "100%",
    backgroundColor: "#2563eb",
    borderRadius: 999,
  },
});
