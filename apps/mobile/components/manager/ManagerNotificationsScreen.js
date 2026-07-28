import React, { useMemo } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { listManagerMobileNotifications } from "../utilities/FirebaseFunctions";
import useManagerRequest from "./useManagerRequest";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ManagerHeader,
  formatDate,
} from "./ManagerUI";

function iconFor(type = "") {
  const value = String(type).toLowerCase();
  if (value.includes("message") || value.includes("call")) return "message-circle";
  if (value.includes("trip") || value.includes("delay") || value.includes("arrival")) return "truck";
  if (value.includes("fail") || value.includes("issue")) return "alert-triangle";
  if (value.includes("assign")) return "users";
  return "package";
}

export default function ManagerNotificationsScreen() {
  const { colors } = useTheme();
  const { view } = useLocalSearchParams();
  const { data, loading, refreshing, error, reload } = useManagerRequest(
    listManagerMobileNotifications,
  );
  const mode = String(view || "history").toLowerCase();
  const notifications = useMemo(() => {
    const rows = data?.notifications || [];
    if (mode === "history") return rows;
    return rows.filter((item) => {
      const searchable = [
        item.type,
        item.category,
        item.title,
        item.message,
        item.body,
        item.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const terms =
        mode === "customer"
          ? ["customer", "shipment", "pickup", "request"]
          : ["delay", "failed", "failure", "issue", "alert", "returned"];
      return terms.some((term) => searchable.includes(term));
    });
  }, [data?.notifications, mode]);
  const pageCopy =
    mode === "customer"
      ? {
          title: "Customer Notification History",
          subtitle: "Customer, shipment, and pickup updates",
        }
      : mode === "alerts"
        ? {
            title: "Recent Delays & Alerts",
            subtitle: "Operational delays, failures, returns, and issues",
          }
        : {
            title: "Customer Notification History",
            subtitle: "Operational alerts and assignment updates",
          };
  if (loading) return <LoadingState label="Loading Manager notifications…" />;
  if (error) return <ErrorState message={error.message} onRetry={() => reload()} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ManagerHeader
        back
        title={pageCopy.title}
        subtitle={pageCopy.subtitle}
      />
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => reload({ refresh: true })} tintColor="#0f766e" />
        }
        contentContainerStyle={notifications.length ? styles.list : styles.emptyList}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: item.read ? colors.surface : colors.cardMuted, borderColor: colors.border }]}>
            <View style={[styles.icon, { backgroundColor: colors.surface }]}>
              <Feather name={iconFor(item.type || item.category)} size={19} color="#0f766e" />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: colors.text }]}>{item.title || "Operational update"}</Text>
              <Text style={[styles.message, { color: colors.textMuted }]}>{item.message || item.body || item.description}</Text>
              <Text style={[styles.time, { color: colors.textMuted }]}>{formatDate(item.createdAt || item.updatedAt)}</Text>
            </View>
            {!item.read ? <View style={styles.unread} /> : null}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState icon="bell" title="No notifications" message="New shipment, trip, delivery, issue, message, call, and assignment alerts will appear here." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 14, paddingBottom: 28, gap: 10 },
  emptyList: { flexGrow: 1 },
  row: { borderWidth: 1, borderRadius: 17, padding: 13, flexDirection: "row", alignItems: "flex-start", gap: 11 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 },
  title: { fontSize: 14, fontWeight: "800" },
  message: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  time: { fontSize: 10, marginTop: 7 },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#0f766e", marginTop: 4 },
});
