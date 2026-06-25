import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOfflineSync } from "../../contexts/OfflineSyncContext";
import { useTheme } from "../../contexts/ThemeContext";

export default function OfflineStatusBar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const topInset =
    insets.top || (Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0);
  const {
    isOnline,
    pendingCount,
    pendingSummaries,
    syncing,
    syncNow,
    cacheSavedAt,
  } = useOfflineSync();

  const failedCount = pendingSummaries.filter(
    (item) => item.status === "failed" && item.lastError,
  ).length;

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
          paddingTop: topInset + 10,
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
                ? failedCount > 0
                  ? `${pendingCount} queued — ${failedCount} need attention`
                  : `${pendingCount} scan${pendingCount === 1 ? "" : "s"} pending sync`
                : "Offline mode — scans save locally"}
          </Text>
          {pendingSummaries.length > 0 ? (
            <View style={styles.queueList}>
              {pendingSummaries.map((item) => (
                <Text
                  key={item.id}
                  style={[styles.queueItem, { color: colors.textMuted }]}
                  numberOfLines={2}
                >
                  • {item.label}
                  {item.lastError ? ` — ${item.lastError}` : ""}
                </Text>
              ))}
            </View>
          ) : !isOnline ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {cacheLabel}. Scans queue locally even for new releases; sync verifies them.
            </Text>
          ) : null}
        </View>
      </View>

      {isOnline && pendingCount > 0 ? (
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => void syncNow()}
          disabled={syncing}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
    paddingBottom: 10,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    zIndex: 10,
    elevation: 4,
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
  queueList: {
    marginTop: 6,
    gap: 4,
  },
  queueItem: {
    fontSize: 11,
    lineHeight: 15,
  },
  retryBtn: {
    backgroundColor: "#b45309",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexShrink: 0,
    minHeight: 36,
    justifyContent: "center",
  },
  retryText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
