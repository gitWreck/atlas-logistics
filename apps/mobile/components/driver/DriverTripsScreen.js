import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { useRouter } from "expo-router";

import { useTheme } from "../../contexts/ThemeContext";
import useDriverOperations from "../../hooks/useDriverOperations";
import { formatTripDateTime, manilaDateKey, statusKey, statusLabel, toDate, tripDestination, tripNumber, tripOrigin, tripPlate } from "./driverData";

const TABS = [
  { key: "ALL", label: "All Trips", icon: "truck" },
  { key: "ONGOING", label: "Ongoing", icon: "truck" },
  { key: "COMPLETED", label: "Completed", icon: "check-square" },
  { key: "CANCELLED", label: "Cancelled", icon: "x-circle" },
];

function alpha(hex, opacity) {
  const clean = String(hex || "#000000").replace("#", "");
  const value = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean.padEnd(6, "0").slice(0, 6);
  const number = Number.parseInt(value, 16);
  const r = (number >> 16) & 255;
  const g = (number >> 8) & 255;
  const b = number & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

const tabLabel = (key) => TABS.find((tab) => tab.key === key)?.label || statusLabel(key);

const matches = (trip, filter) => {
  const status = statusKey(trip.status);
  if (filter === "ALL") return true;
  if (filter === "ONGOING") return ["CREATED", "READY", "LOADED", "ASSIGNED", "IN_TRANSIT", "ARRIVED", "DELAYED"].includes(status);
  if (filter === "COMPLETED") return ["COMPLETED", "ARRIVED"].includes(status);
  if (filter === "CANCELLED") return status.includes("CANCEL");
  return status === filter;
};

function matchesSearch(trip, query) {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return [
    tripNumber(trip),
    tripOrigin(trip),
    tripDestination(trip),
    statusLabel(trip.status),
    tripPlate(trip),
    trip.truckName,
    trip.truckType,
  ].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
}

function tripStatusTone(status, colors) {
  const key = statusKey(status);
  if (key.includes("CANCEL")) return { color: colors.danger, bg: colors.dangerSoft, iconBg: alpha(colors.danger, 0.18), label: "Cancelled" };
  if (key.includes("DELAY")) return { color: colors.warning, bg: colors.warningSoft, iconBg: alpha(colors.warning, 0.2), label: statusLabel(status) };
  if (["COMPLETED", "ARRIVED"].includes(key)) return { color: colors.success, bg: colors.successSoft, iconBg: alpha(colors.success, 0.16), label: "Completed" };
  if (["CREATED", "READY", "LOADED", "ASSIGNED"].includes(key)) return { color: colors.neutral, bg: colors.neutralSoft, iconBg: alpha(colors.neutral, 0.14), label: statusLabel(status) };
  return { color: colors.primary, bg: colors.primarySoft, iconBg: alpha(colors.primary, 0.18), label: statusLabel(status) };
}

function tripDate(trip) {
  return trip.plannedDeparture || trip.scheduledDeparture || trip.departureTime || trip.departureDate || trip.scheduledDate || trip.createdAt || trip.updatedAt;
}

function tripTime(value, fallback = "Time pending") {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(date);
}

function tripShortDate(value) {
  const date = toDate(value);
  if (!date) return "Date pending";
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }).format(date);
}

function tripEndLabel(trip) {
  const key = statusKey(trip.status);
  if (key.includes("CANCEL")) return "Cancelled On";
  if (["COMPLETED", "ARRIVED"].includes(key)) return "Completed On";
  return "Est. Arrival";
}

function tripEndDate(trip) {
  const key = statusKey(trip.status);
  if (key.includes("CANCEL")) return formatTripDateTime(trip.cancelledAt || trip.updatedAt);
  if (["COMPLETED", "ARRIVED"].includes(key)) return formatTripDateTime(trip.arrivedAt || trip.actualArrival || trip.completedAt || trip.updatedAt);
  return formatTripDateTime(trip.estimatedArrival || trip.arrivalEta || trip.eta);
}

export default function DriverTripsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const data = useDriverOperations(manilaDateKey());
  const [filter, setFilter] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const trips = useMemo(() => [...data.trips]
    .filter((trip) => matches(trip, filter))
    .filter((trip) => matchesSearch(trip, searchText))
    .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0)), [data.trips, filter, searchText]);

  const openTrip = (trip) => router.push({ pathname: "/(driver)/trip-details", params: { tripId: trip.id } });

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.dashboardBg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <TripsHeader colors={colors} />
        <TripFilters filter={filter} setFilter={setFilter} colors={colors} />
        <TripSearchBar value={searchText} onChangeText={setSearchText} colors={colors} />
        {data.loading ? (
          <SkeletonTrips colors={colors} />
        ) : trips.length === 0 ? (
          <EmptyTripsState colors={colors} />
        ) : (
          <View style={styles.list}>
            {trips.map((trip) => <TripCard key={trip.id} trip={trip} colors={colors} onPress={() => openTrip(trip)} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TripsHeader({ colors }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={[styles.title, { color: colors.text }]}>Trips</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Track and manage your deliveries</Text>
      </View>
      <Pressable style={({ pressed }) => [styles.calendarButton, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }, pressed && styles.pressed]} accessibilityRole="button">
        <Feather name="calendar" size={23} color={colors.text} />
      </Pressable>
    </View>
  );
}

function TripFilters({ filter, setFilter, colors }) {
  return (
    <View style={[styles.segment, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder, shadowColor: colors.dashboardShadow }]}>
      {TABS.map((tab) => {
        const active = filter === tab.key;
        return (
          <Pressable key={tab.key} onPress={() => setFilter(tab.key)} style={({ pressed }) => [styles.segmentItem, pressed && styles.pressed]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
            <View style={[styles.segmentIconWrap, active && { backgroundColor: colors.primarySoft }]}>
              <Feather name={tab.icon} size={22} color={active ? colors.primary : colors.iconMuted} />
            </View>
            <Text style={[styles.segmentText, { color: active ? colors.primary : colors.textMuted }]} numberOfLines={1}>{tab.label}</Text>
            {active ? <View style={[styles.segmentIndicator, { backgroundColor: colors.primary }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function TripSearchBar({ value, onChangeText, colors }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.searchRow}>
      <View style={[styles.searchBox, { backgroundColor: colors.dashboardSurface, borderColor: focused ? colors.primary : colors.dashboardBorder, shadowColor: colors.dashboardShadow }]}>
        <Feather name="search" size={22} color={focused ? colors.primary : colors.iconMuted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search by Trip ID, location, or status"
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.text }]}
          returnKeyType="search"
        />
        {value ? <Pressable onPress={() => onChangeText("")} hitSlop={8}><Feather name="x-circle" size={18} color={colors.textMuted} /></Pressable> : null}
      </View>
      <Pressable style={({ pressed }) => [styles.filterButton, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder, shadowColor: colors.dashboardShadow }, pressed && styles.pressed]} accessibilityRole="button">
        <Feather name="filter" size={24} color={colors.text} />
      </Pressable>
    </View>
  );
}

function TripCard({ trip, colors, onPress }) {
  const tone = tripStatusTone(trip.status, colors);
  const departure = tripDate(trip);
  const arrival = trip.estimatedArrival || trip.arrivalEta || trip.eta;
  const cancelled = statusKey(trip.status).includes("CANCEL");

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tripCard, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder, shadowColor: colors.dashboardShadow }, pressed && styles.cardPressed]}>
      <View style={styles.cardHeader}>
        <View style={[styles.truckIcon, { backgroundColor: tone.iconBg, borderColor: alpha(tone.color, 0.32) }]}>
          <FontAwesome5 name="truck" size={20} color={tone.color} />
        </View>
        <View style={styles.tripHeading}>
          <Text style={[styles.tripId, { color: colors.text }]} numberOfLines={1}>{tripNumber(trip)}</Text>
          <Text style={[styles.tripDate, { color: colors.textMuted }]}>{tripShortDate(departure)} · {tripTime(departure, "--")}</Text>
        </View>
        <TripStatusBadge tone={tone} />
      </View>

      <View style={[styles.cardDivider, { backgroundColor: colors.dashboardBorder }]} />

      <View style={styles.cardBody}>
        <TripTimeline trip={trip} colors={colors} tone={tone} departure={departure} arrival={arrival} />
        <View style={styles.truckArtWrap}>
          <Image source={require("../../assets/driver-trip-semi-truck.png")} resizeMode="contain" style={[styles.truckArt, cancelled && styles.truckArtMuted]} />
          {cancelled ? (
            <View style={[styles.cancelMark, { borderColor: colors.danger }]}>
              <Feather name="slash" size={28} color={colors.danger} />
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.infoRow, { borderTopColor: colors.dashboardBorder }]}>
        <TripInfo label="Truck" value={trip.truckName || trip.truckType || "Assigned truck"} colors={colors} />
        <TripInfo label="Plate Number" value={tripPlate(trip)} colors={colors} />
        <TripInfo label={tripEndLabel(trip)} value={tripEndDate(trip)} colors={colors} />
        <View style={[styles.viewDetailsButton, { backgroundColor: colors.primarySoft, borderColor: alpha(colors.primary, 0.56) }]}>
          <Text style={[styles.viewDetailsText, { color: colors.primary }]}>View Details</Text>
          <Feather name="chevron-right" size={15} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

function TripStatusBadge({ tone }) {
  return (
    <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: alpha(tone.color, 0.36) }]}>
      <Text style={[styles.statusText, { color: tone.color }]}>{tone.label}</Text>
    </View>
  );
}

function TripTimeline({ trip, colors, tone, departure, arrival }) {
  const cancelled = statusKey(trip.status).includes("CANCEL");
  return (
    <View style={styles.timeline}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, { borderColor: tone.color, backgroundColor: colors.dashboardSurface }]} />
        <View style={[styles.timelineLine, { borderLeftColor: colors.iconMuted }]} />
        <View style={[styles.timelineDot, { borderColor: cancelled ? colors.iconMuted : colors.success, backgroundColor: colors.dashboardSurface }]} />
      </View>
      <View style={styles.timelineCopy}>
        <TimelineStop title={tripOrigin(trip)} label="Pickup" time={tripTime(departure, "Time pending")} color={tone.color} colors={colors} />
        <TimelineStop title={tripDestination(trip)} label="Destination" time={cancelled ? "--" : tripTime(arrival, "ETA pending")} color={cancelled ? colors.textMuted : colors.success} colors={colors} />
      </View>
    </View>
  );
}

function TimelineStop({ title, label, time, color, colors }) {
  return (
    <View>
      <Text style={[styles.place, { color: colors.text }]} numberOfLines={1}>{title}</Text>
      <Text style={[styles.placeType, { color }]}>{label}</Text>
      <Text style={[styles.placeTime, { color: colors.textMuted }]}>{time}</Text>
    </View>
  );
}

function TripInfo({ label, value, colors }) {
  return (
    <View style={styles.infoColumn}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function EmptyTripsState({ colors }) {
  return (
    <View style={[styles.emptyCard, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <FontAwesome5 name="truck-loading" size={30} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No trips found</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Your assigned trips will appear here.</Text>
      <View style={[styles.refreshButton, { backgroundColor: colors.primarySoft, borderColor: alpha(colors.primary, 0.2) }]}>
        <Feather name="refresh-cw" size={16} color={colors.primary} />
        <Text style={[styles.refreshText, { color: colors.primary }]}>Refresh</Text>
      </View>
    </View>
  );
}

function SkeletonTrips({ colors }) {
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={styles.list}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={[styles.skeletonCard, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}>
          <Animated.View style={[styles.skeletonCircle, { backgroundColor: colors.dashboardSurfaceMuted, opacity: pulse }]} />
          <View style={styles.skeletonCopy}>
            <Animated.View style={[styles.skeletonLineWide, { backgroundColor: colors.dashboardSurfaceMuted, opacity: pulse }]} />
            <Animated.View style={[styles.skeletonLine, { backgroundColor: colors.dashboardSurfaceMuted, opacity: pulse }]} />
            <Animated.View style={[styles.skeletonBlock, { backgroundColor: colors.dashboardSurfaceMuted, opacity: pulse }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 20 },
  header: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, lineHeight: 27, fontWeight: "800" },
  subtitle: { marginTop: 2, fontSize: 10, lineHeight: 14, fontWeight: "500" },
  calendarButton: { width: 34, height: 34, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  segment: { marginTop: 12, minHeight: 48, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", overflow: "hidden", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 2 },
  segmentItem: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  segmentIconWrap: { width: 22, height: 18, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  segmentText: { marginTop: 3, fontSize: 8, lineHeight: 10, fontWeight: "600" },
  segmentIndicator: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, borderRadius: 2 },
  searchRow: { marginTop: 10, flexDirection: "row", gap: 7 },
  searchBox: { flex: 1, minHeight: 31, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 7, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 1 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 10, lineHeight: 13, fontWeight: "500", paddingVertical: 0 },
  filterButton: { width: 38, height: 31, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 1 },
  list: { marginTop: 10, gap: 9 },
  tripCard: { borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, padding: 11, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 3 },
  cardPressed: { transform: [{ scale: 0.985 }] },
  pressed: { opacity: 0.78 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  truckIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  tripHeading: { flex: 1, minWidth: 0 },
  tripId: { fontSize: 12, lineHeight: 15, fontWeight: "600" },
  tripDate: { marginTop: 1, fontSize: 8, lineHeight: 11, fontWeight: "500" },
  statusBadge: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 7, paddingVertical: 5 },
  statusText: { fontSize: 8, lineHeight: 10, fontWeight: "500" },
  cardDivider: { height: StyleSheet.hairlineWidth, marginTop: 8 },
  cardBody: { minHeight: 86, marginTop: 8, flexDirection: "row", alignItems: "center" },
  timeline: { flex: 1, minWidth: 0, flexDirection: "row" },
  timelineRail: { width: 18, height: 67, alignItems: "center" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  timelineLine: { flex: 1, borderLeftWidth: 1.5, borderStyle: "dashed", marginVertical: 3 },
  timelineCopy: { flex: 1, minWidth: 0, height: 76, justifyContent: "space-between", paddingLeft: 7 },
  place: { fontSize: 11, lineHeight: 14, fontWeight: "700" },
  placeType: { marginTop: 1, fontSize: 8, lineHeight: 10, fontWeight: "600" },
  placeTime: { marginTop: 1, fontSize: 8, lineHeight: 10, fontWeight: "500" },
  truckArtWrap: { width: 122, height: 88, alignItems: "center", justifyContent: "center" },
  truckArt: { width: 126, height: 90 },
  truckArtMuted: { opacity: 0.34 },
  cancelMark: { position: "absolute", right: 5, bottom: 13, width: 29, height: 29, borderRadius: 15, borderWidth: 3, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-18deg" }] },
  infoRow: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 6 },
  infoColumn: { flex: 1, minWidth: 0 },
  infoLabel: { fontSize: 8, lineHeight: 10, fontWeight: "500" },
  infoValue: { marginTop: 2, fontSize: 9, lineHeight: 11, fontWeight: "600" },
  viewDetailsButton: { minHeight: 22, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 1 },
  viewDetailsText: { fontSize: 8, lineHeight: 10, fontWeight: "600" },
  emptyCard: { marginTop: 28, minHeight: 260, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyIcon: { width: 74, height: 74, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 18, fontSize: 22, lineHeight: 28, fontWeight: "700" },
  emptySubtitle: { marginTop: 8, fontSize: 15, lineHeight: 21, fontWeight: "500", textAlign: "center" },
  refreshButton: { marginTop: 18, minHeight: 48, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 8 },
  refreshText: { fontSize: 14, lineHeight: 18, fontWeight: "700" },
  skeletonCard: { height: 210, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 20, flexDirection: "row", gap: 14 },
  skeletonCircle: { width: 54, height: 54, borderRadius: 27 },
  skeletonCopy: { flex: 1, gap: 12 },
  skeletonLineWide: { height: 22, borderRadius: 11, width: "78%" },
  skeletonLine: { height: 16, borderRadius: 8, width: "48%" },
  skeletonBlock: { marginTop: 12, height: 100, borderRadius: 18, width: "100%" },
});
