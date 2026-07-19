import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, onSnapshot } from "firebase/firestore";

import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { DriverCard, DriverPageHeader, EmptyDriverState } from "./DriverUI";
import { formatTripDateTime, statusKey, statusLabel, tripDestination, tripNumber, tripOrigin, tripPackageTotal, tripPlate } from "./driverData";

function first(row, keys, fallback = "Not assigned") { for (const key of keys) { const value = row?.[key]; if (value !== undefined && value !== null && value !== "") return String(value); } return fallback; }
function municipalityOf(row = {}) { return first(row, ["municipality", "destinationMunicipality", "destinationCity"], row.recipient?.address?.municipality || row.recipient?.address?.city || "Unspecified"); }

export default function DriverTripDetailsScreen() {
  const { tripId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [trip, setTrip] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!tripId) { setLoading(false); return undefined; }
    const unsubscribeTrip = onSnapshot(doc(db, "truck_trips", String(tripId)), (snapshot) => {
      if (!snapshot.exists()) { setTrip(null); setLoading(false); return; }
      const next = { id: snapshot.id, ...snapshot.data() };
      if (String(next.driverId || next.driverUid || "") !== String(user?.uid || "")) { Alert.alert("Access denied", "This trip is not assigned to your Driver account."); router.back(); return; }
      setTrip(next); setLoading(false);
    }, () => setLoading(false));
    const unsubscribeShipments = onSnapshot(collection(db, "truck_trips", String(tripId), "trip_shipments"), (snapshot) => setShipments(snapshot.docs.map((row) => ({ id: row.id, ...row.data() }))));
    return () => { unsubscribeTrip(); unsubscribeShipments(); };
  }, [router, tripId, user?.uid]);
  const municipalities = useMemo(() => shipments.reduce((map, row) => { const name = municipalityOf(row); map[name] = (map[name] || 0) + Math.max(Number(row.totalPackages || row.packageCount || 0), Array.isArray(row.packageBarcodes) ? row.packageBarcodes.length : 0, 1); return map; }, {}), [shipments]);
  if (loading) return <View style={[styles.center, { backgroundColor: colors.dashboardBg }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!trip) return <View style={[styles.screen, { backgroundColor: colors.dashboardBg }]}><DriverPageHeader title="Trip Details" onBack={() => router.back()} /><EmptyDriverState icon="alert-circle" title="Trip unavailable" message="This trip could not be loaded." /></View>;
  const status = statusKey(trip.status);
  return <View style={[styles.screen, { backgroundColor: colors.dashboardBg }]}>
    <DriverPageHeader title="Trip Details" onBack={() => router.back()} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <DriverCard style={styles.summary}><View style={styles.heading}><Text style={[styles.number, { color: colors.text }]} numberOfLines={1}>{tripNumber(trip)}</Text><View style={[styles.status, { backgroundColor: ["ARRIVED", "COMPLETED"].includes(status) ? colors.successSoft : colors.primarySoft }]}><Text style={[styles.statusText, { color: ["ARRIVED", "COMPLETED"].includes(status) ? colors.success : colors.primary }]}>{statusLabel(status)}</Text></View></View>
        <View style={styles.timeline}><View style={styles.timelineRail}><View style={[styles.dot, { backgroundColor: colors.primary }]} /><View style={[styles.line, { backgroundColor: colors.primary }]} /><View style={[styles.dot, { backgroundColor: colors.success }]} /></View><View style={styles.timelineCopy}><Place label="Departure Warehouse" value={tripOrigin(trip)} colors={colors} /><Place label="Destination Warehouse" value={tripDestination(trip)} colors={colors} /></View></View>
      </DriverCard>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Trip Information</Text>
      <DriverCard style={styles.infoCard}>{[
        ["truck", "Truck", first(trip, ["truckName", "truckType"], "Assigned truck")], ["credit-card", "Plate Number", tripPlate(trip)], ["user", "Driver", first(trip, ["driverName"], user?.name || user?.fullName || "Driver")], ["calendar", "Departure Date", formatTripDateTime(trip.plannedDeparture || trip.departureDate)], ["clock", "Estimated Arrival", formatTripDateTime(trip.estimatedArrival)], ["user-check", "Assigned Checker", first(trip, ["assignedCheckerName", "checkerName"])], ["briefcase", "Assigned Manager", first(trip, ["assignedManagerName", "managerName", "warehouseManagerName"])],
      ].map(([icon, label, value], index) => <View key={label} style={[styles.infoRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}><Feather name={icon} size={15} color={colors.primary} /><Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text><Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text></View>)}</DriverCard>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Shipment Summary</Text>
      <View style={styles.summaryRow}><DriverCard style={styles.metric}><Feather name="package" size={17} color={colors.primary} /><Text style={[styles.metricLabel, { color: colors.textMuted }]}>Total Shipments</Text><Text style={[styles.metricValue, { color: colors.text }]}>{shipments.length || Number(trip.totalShipments || 0)}</Text></DriverCard><DriverCard style={styles.metric}><Feather name="layers" size={17} color={colors.success} /><Text style={[styles.metricLabel, { color: colors.textMuted }]}>Total Packages</Text><Text style={[styles.metricValue, { color: colors.text }]}>{tripPackageTotal(shipments, trip)}</Text></DriverCard></View>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Municipality Summary</Text>
      <DriverCard style={styles.infoCard}>{Object.keys(municipalities).length ? Object.entries(municipalities).sort(([a], [b]) => a.localeCompare(b)).map(([name, total], index) => <View key={name} style={[styles.municipality, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}><View style={[styles.municipalityDot, { backgroundColor: [colors.primary, colors.success, colors.warning][index % 3] }]} /><Text style={[styles.municipalityName, { color: colors.text }]} numberOfLines={1}>{name}</Text><Text style={[styles.municipalityTotal, { color: colors.textMuted }]}>{total} packages</Text></View>) : <Text style={[styles.noMunicipality, { color: colors.textMuted }]}>Municipality totals will appear when the trip manifest is available.</Text>}</DriverCard>
    </ScrollView>
    {status === "IN_TRANSIT" ? <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}><TouchableOpacity style={[styles.primary, { backgroundColor: colors.primary }]} onPress={() => router.push({ pathname: "/(driver)/confirm-arrival", params: { tripId: trip.id } })}><Text style={styles.primaryText}>Confirm Arrival</Text></TouchableOpacity></View> : null}
  </View>;
}
function Place({ label, value, colors }) { return <View><Text style={[styles.place, { color: colors.text }]} numberOfLines={1}>{value}</Text><Text style={[styles.placeLabel, { color: colors.textMuted }]}>{label}</Text></View>; }
const styles = StyleSheet.create({ screen: { flex: 1 }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, content: { padding: 12, paddingBottom: 94 }, summary: { padding: 13, borderRadius: 13 }, heading: { flexDirection: "row", alignItems: "center", gap: 8 }, number: { flex: 1, fontSize: 12, fontWeight: "900" }, status: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4 }, statusText: { fontSize: 8, fontWeight: "900" }, timeline: { marginTop: 13, flexDirection: "row" }, timelineRail: { width: 20, height: 59, alignItems: "center" }, dot: { width: 7, height: 7, borderRadius: 4 }, line: { width: 1, flex: 1 }, timelineCopy: { flex: 1, height: 62, justifyContent: "space-between" }, place: { fontSize: 10, fontWeight: "800" }, placeLabel: { fontSize: 8, marginTop: 1 }, sectionTitle: { fontSize: 12, fontWeight: "900", marginTop: 15, marginBottom: 7 }, infoCard: { paddingHorizontal: 12, borderRadius: 12 }, infoRow: { minHeight: 39, flexDirection: "row", alignItems: "center", gap: 8 }, infoLabel: { width: 96, fontSize: 9 }, infoValue: { flex: 1, textAlign: "right", fontSize: 9, lineHeight: 12, fontWeight: "800" }, summaryRow: { flexDirection: "row", gap: 8 }, metric: { flex: 1, padding: 11, borderRadius: 11 }, metricLabel: { marginTop: 6, fontSize: 8 }, metricValue: { marginTop: 3, fontSize: 18, fontWeight: "900" }, municipality: { height: 38, flexDirection: "row", alignItems: "center" }, municipalityDot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 }, municipalityName: { flex: 1, fontSize: 9, fontWeight: "800" }, municipalityTotal: { fontSize: 8 }, noMunicipality: { textAlign: "center", paddingVertical: 18, fontSize: 9, lineHeight: 14 }, footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 12, borderTopWidth: 1 }, primary: { height: 43, borderRadius: 7, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#fff", fontSize: 11, fontWeight: "900" } });
