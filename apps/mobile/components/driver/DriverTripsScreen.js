import React, { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";

import { useTheme } from "../../contexts/ThemeContext";
import useDriverOperations from "../../hooks/useDriverOperations";
import { DriverCard, EmptyDriverState } from "./DriverUI";
import { formatTripDateTime, manilaDateKey, statusKey, statusLabel, tripDestination, tripNumber, tripOrigin, tripPlate } from "./driverData";

const TABS = ["ALL", "ASSIGNED", "IN_TRANSIT", "ARRIVED", "COMPLETED"];
const tabLabel = (key) => key === "ALL" ? "All" : key === "IN_TRANSIT" ? "In Transit" : statusLabel(key);
const matches = (trip, filter) => {
  const status = statusKey(trip.status);
  if (filter === "ALL") return true;
  if (filter === "ASSIGNED") return ["CREATED", "READY", "LOADED", "ASSIGNED"].includes(status);
  return status === filter;
};

function StatusBadge({ status, colors }) {
  const key = statusKey(status);
  const danger = key === "DELAYED";
  const success = ["ARRIVED", "COMPLETED"].includes(key);
  const backgroundColor = danger ? colors.dangerSoft : success ? colors.successSoft : colors.primarySoft;
  const color = danger ? colors.danger : success ? colors.success : colors.primary;
  return <View style={[styles.badge, { backgroundColor }]}><Text style={[styles.badgeText, { color }]}>{statusLabel(status)}</Text></View>;
}

export default function DriverTripsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const data = useDriverOperations(manilaDateKey());
  const [filter, setFilter] = useState("ALL");
  const trips = useMemo(() => [...data.trips].filter((trip) => matches(trip, filter)).sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0)), [data.trips, filter]);
  return <View style={[styles.screen, { backgroundColor: colors.dashboardBg }]}>
    <View style={[styles.header, { backgroundColor: colors.primary }]}><Text style={styles.headerTitle}>Trips</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
      {TABS.map((tab) => <TouchableOpacity key={tab} style={[styles.tab, filter === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} onPress={() => setFilter(tab)}><Text style={[styles.tabText, { color: filter === tab ? colors.primary : colors.textMuted }]}>{tabLabel(tab)}</Text></TouchableOpacity>)}
    </ScrollView>
    {data.loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : trips.length === 0 ? <View style={styles.center}><EmptyDriverState icon="truck" title={`No ${tabLabel(filter).toLowerCase()} trips`} message="Only warehouse-transfer trips assigned to your account appear here." /></View> : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
      {trips.map((trip) => <DriverCard key={trip.id} style={styles.card}>
        <View style={styles.cardTop}><Text style={[styles.number, { color: colors.text }]} numberOfLines={1}>{tripNumber(trip)}</Text><StatusBadge status={trip.status} colors={colors} /></View>
        <View style={styles.route}><View style={styles.rail}><View style={[styles.dot, { backgroundColor: colors.primary }]} /><View style={[styles.line, { backgroundColor: colors.border }]} /><View style={[styles.dot, { backgroundColor: colors.success }]} /></View><View style={styles.routeCopy}><View><Text style={[styles.place, { color: colors.text }]} numberOfLines={1}>{tripOrigin(trip)}</Text><Text style={[styles.placeType, { color: colors.textMuted }]}>Departure</Text></View><View><Text style={[styles.place, { color: colors.text }]} numberOfLines={1}>{tripDestination(trip)}</Text><Text style={[styles.placeType, { color: colors.textMuted }]}>Destination</Text></View></View></View>
        <View style={[styles.details, { borderTopColor: colors.border }]}><Detail label="Truck" value={trip.truckName || trip.truckType || "Assigned truck"} colors={colors} /><Detail label="Plate No." value={tripPlate(trip)} colors={colors} /><Detail label="Departure" value={formatTripDateTime(trip.plannedDeparture || trip.departureDate)} colors={colors} /><Detail label="Est. Arrival" value={formatTripDateTime(trip.estimatedArrival)} colors={colors} /></View>
        <TouchableOpacity style={[styles.viewButton, { backgroundColor: colors.primary }]} onPress={() => router.push({ pathname: "/(driver)/trip-details", params: { tripId: trip.id } })}><Text style={styles.viewText}>View Details</Text></TouchableOpacity>
      </DriverCard>)}
    </ScrollView>}
  </View>;
}
function Detail({ label, value, colors }) { return <View style={styles.detail}><Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text><Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>{value}</Text></View>; }
const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { height: 54, alignItems: "center", justifyContent: "center" }, headerTitle: { color: "#fff", fontSize: 16, fontWeight: "800" }, tabsScroll: { flexGrow: 0 }, tabs: { minWidth: "100%", height: 48, paddingHorizontal: 8, alignItems: "stretch" }, tab: { minWidth: 68, flex: 1, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" }, tabText: { fontSize: 10, fontWeight: "800" }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, list: { padding: 12, gap: 10, paddingBottom: 24 }, card: { borderRadius: 13, padding: 13 }, cardTop: { flexDirection: "row", alignItems: "center", gap: 8 }, number: { flex: 1, fontSize: 12, fontWeight: "900" }, badge: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4 }, badgeText: { fontSize: 8, fontWeight: "900" }, route: { marginTop: 12, flexDirection: "row" }, rail: { width: 19, height: 59, alignItems: "center" }, dot: { width: 7, height: 7, borderRadius: 4 }, line: { width: 1, flex: 1 }, routeCopy: { flex: 1, height: 62, justifyContent: "space-between" }, place: { fontSize: 10, fontWeight: "800" }, placeType: { marginTop: 1, fontSize: 8 }, details: { marginTop: 12, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", flexWrap: "wrap", rowGap: 9 }, detail: { width: "50%", paddingRight: 8 }, detailLabel: { fontSize: 8, fontWeight: "700" }, detailValue: { marginTop: 2, fontSize: 9, lineHeight: 12, fontWeight: "800" }, viewButton: { marginTop: 12, height: 36, borderRadius: 7, alignItems: "center", justifyContent: "center" }, viewText: { color: "#fff", fontSize: 10, fontWeight: "900" },
});
