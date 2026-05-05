import React from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

function formatCreatedAt(value) {
  const date = value?.toDate?.() || null;
  if (!date) return "Recently";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function CustomerNotificationsList({
  notifications = [],
  loading = false,
  onPressNotification,
}) {
  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#042C83" />
      </View>
    );
  }

  return (
    <FlatList
      data={notifications}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <FontAwesome5 name="bell-slash" size={22} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>
            Shipment updates and delivery alerts will appear here.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const unread = item.read !== true;

        return (
          <TouchableOpacity
            style={[styles.card, unread && styles.unreadCard]}
            activeOpacity={0.85}
            onPress={() => onPressNotification?.(item)}
          >
            <View style={[styles.iconWrap, unread && styles.iconWrapUnread]}>
              <FontAwesome5
                name={unread ? "bell" : "check"}
                size={14}
                color={unread ? "#2563eb" : "#64748b"}
              />
            </View>

            <View style={styles.content}>
              <View style={styles.topRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title || "Notification"}
                </Text>
                {unread && <View style={styles.unreadDot} />}
              </View>

              <Text style={styles.body} numberOfLines={2}>
                {item.body || "You have a new update."}
              </Text>

              <Text style={styles.time}>{formatCreatedAt(item.createdAt)}</Text>
            </View>

            <FontAwesome5 name="chevron-right" size={12} color="#cbd5e1" />
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  unreadCard: {
    borderColor: "#bfdbfe",
    backgroundColor: "#f8fbff",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  iconWrapUnread: {
    backgroundColor: "#eff6ff",
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563eb",
  },
  body: {
    color: "#475569",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
  },
  time: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 8,
  },
});
