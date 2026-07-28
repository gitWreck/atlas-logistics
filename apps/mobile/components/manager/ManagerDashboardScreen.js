import React from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import StatusBadge from "../ui/StatusBadge";
import { getManagerMobileDashboard } from "../utilities/FirebaseFunctions";
import useManagerRequest from "./useManagerRequest";
import ManagerQuickAccess from "./ManagerQuickAccess";
import {
  ErrorState,
  LoadingState,
  ManagerCard,
  ManagerHeader,
  MetricCard,
  SectionTitle,
  formatDate,
} from "./ManagerUI";

const STAT_CARDS = [
  ["total", "Total Shipments", "package", "blue"],
  ["pickups", "Pickups", "inbox", "amber"],
  ["available", "Available", "archive", "teal"],
  ["loaded", "Loaded", "truck", "blue"],
  ["outForDelivery", "Out for Delivery", "navigation", "amber"],
  ["delivered", "Delivered", "check-circle", "green"],
  ["failed", "Failed", "alert-triangle", "red"],
  ["returned", "Returned", "corner-up-left", "amber"],
  ["activeTrips", "Active Trips", "map", "teal"],
  ["activeDrivers", "Active Drivers", "users", "green"],
  ["activeCheckers", "Active Checkers", "user-check", "blue"],
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function ManagerDashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { data, loading, refreshing, error, reload } = useManagerRequest(
    getManagerMobileDashboard,
  );

  if (loading) return <LoadingState label="Loading Manager dashboard…" />;
  if (error) return <ErrorState message={error.message} onRetry={() => reload()} />;

  const stats = data?.stats || {};
  const scope = data?.scope || {};
  const recent = data?.recentActivity || [];
  const managerName =
    profile?.name || profile?.fullName || profile?.displayName || "Manager";

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ManagerHeader
        title="Dashboard"
        subtitle={[scope.warehouse, (scope.municipalities || []).join(", ")]
          .filter(Boolean)
          .join(" • ")}
        actionIcon="bell"
        onAction={() => router.push("/(manager)/notifications")}
      />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => reload({ refresh: true })}
            tintColor="#4f46e5"
          />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ManagerCard style={styles.profileCard}>
          <View style={[styles.profileAvatar, { backgroundColor: colors.primarySoft }]}>
            <Feather name="user" size={24} color="#4f46e5" />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>{greeting()},</Text>
            <Text style={[styles.profileName, { color: colors.text }]}>{managerName}</Text>
            <Text style={styles.roleBadge}>MANAGER</Text>
          </View>
        </ManagerCard>

        <ManagerCard style={styles.scopeCard}>
          <View style={[styles.scopeIcon, { backgroundColor: colors.cardMuted }]}>
            <Feather name="map-pin" size={21} color="#4f46e5" />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.scopeLabel, { color: colors.textMuted }]}>ASSIGNED SCOPE</Text>
            <Text style={[styles.scopeTitle, { color: colors.text }]}>
              {scope.warehouse || "Warehouse assignment required"}
            </Text>
            <Text style={[styles.scopeMunicipalities, { color: colors.textMuted }]}>
              {(scope.municipalities || []).length
                ? scope.municipalities.join(", ")
                : "Warehouse-wide operations"}
            </Text>
          </View>
        </ManagerCard>

        <SectionTitle title="Live status" subtitle="Same authorized operational data as web" />
        <View style={styles.metrics}>
          {STAT_CARDS.map(([field, label, icon, tone]) => (
            <MetricCard key={field} label={label} value={stats[field] || 0} icon={icon} tone={tone} />
          ))}
        </View>

        <ManagerCard>
          <SectionTitle title="Delivery progress" subtitle="Delivered shipments" />
          <View style={[styles.progressTrack, { backgroundColor: colors.cardMuted }]}>
            <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, stats.deliveryProgress || 0))}%` }]} />
          </View>
          <Text style={[styles.progressValue, { color: colors.text }]}>{stats.deliveryProgress || 0}%</Text>
        </ManagerCard>

        <ManagerQuickAccess inset={false} />

        <ManagerCard>
          <SectionTitle
            title="Recent operational activity"
            action="View all"
            onAction={() => router.push("/(manager)/(tabs)/shipments")}
          />
          {recent.length ? recent.map((shipment, index) => (
            <Pressable
              key={shipment.id}
              onPress={() => router.push({ pathname: "/(manager)/shipment-details", params: { shipmentId: shipment.id } })}
              style={[styles.activityRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}
            >
              <View style={styles.flex}>
                <Text style={[styles.activityTitle, { color: colors.text }]} numberOfLines={1}>
                  {shipment.trackingNumber || shipment.shipmentId || shipment.id}
                </Text>
                <Text style={[styles.activityMeta, { color: colors.textMuted }]} numberOfLines={1}>
                  {shipment.recipient?.name || shipment.customerName || shipment.municipality || "Shipment"}
                  {" • "}
                  {formatDate(shipment.updatedAt)}
                </Text>
              </View>
              <StatusBadge status={shipment.status} />
            </Pressable>
          )) : (
            <Text style={[styles.empty, { color: colors.textMuted }]}>No recent activity in your assigned scope.</Text>
          )}
        </ManagerCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 34, gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 13 },
  profileAvatar: { width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  greeting: { fontSize: 12, fontWeight: "600" },
  profileName: { fontSize: 18, fontWeight: "900", marginTop: 2 },
  roleBadge: { alignSelf: "flex-start", color: "#4f46e5", fontSize: 9, fontWeight: "900", marginTop: 4, letterSpacing: 1 },
  scopeCard: { flexDirection: "row", alignItems: "center", gap: 13 },
  scopeIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  scopeLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  scopeTitle: { fontSize: 16, fontWeight: "800", marginTop: 3 },
  scopeMunicipalities: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  progressTrack: { height: 10, borderRadius: 999, overflow: "hidden", marginTop: 15 },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: "#4f46e5" },
  progressValue: { fontSize: 21, fontWeight: "900", marginTop: 8 },
  activityRow: { minHeight: 70, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  activityTitle: { fontSize: 14, fontWeight: "800" },
  activityMeta: { fontSize: 11, marginTop: 4 },
  empty: { paddingVertical: 24, textAlign: "center", fontSize: 13 },
});
