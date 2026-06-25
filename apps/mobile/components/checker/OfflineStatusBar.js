import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useOfflineSync } from "../../contexts/OfflineSyncContext";
import { useTheme } from "../../contexts/ThemeContext";

export default function OfflineStatusBar() {
  const { colors } = useTheme();
  const {
    isOnline,
    pendingCount,
    syncing,
    syncNow,
    cacheSavedAt,
  } = useOfflineSync();

  if (isOnline && pendingCount === 0 && !syncing) {
    return null;
  }

  const cacheLabel = cacheSavedAt
    ? `Cached ${new Date(cacheSavedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "No cached route data";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isOnline ? "#fef3c7" : "#fee2e2",
          borderBottomColor: isOnline ? "#fcd34d" : "#fca5a5",
        },
      ]}
    >
      <View style={styles.row}>
        <FontAwesome5
          name={isOnline ? "cloud-upload-alt" : "wifi"}
          size={14}
          color={isOnline ? "#b45309" : "#b91c1c"}
          style={styles.icon}
        />
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: isOnline ? "#92400e" : "#991b1b" }]}>
            {syncing
              ? "Syncing offline scans..."
              : isOnline
                ? `${pendingCount} scan${pendingCount === 1 ? "" : "s"} pending sync`
                : "Offline mode — scans save locally"}
          </Text>
          {!isOnline ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {cacheLabel}. Reconnect to sync.
            </Text>
          ) : null}
        </View>
      </View>

      {isOnline && pendingCount > 0 ? (
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => void syncNow()}
          disabled={syncing}
        >
          <Text style={styles.retryText}>{syncing ? "Syncing..." : "Sync now"}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 10,
  },
  icon: {
    marginTop: 2,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  retryBtn: {
    backgroundColor: "#b45309",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
