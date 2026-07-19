import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { confirmDriverArrival } from "../utilities/FirebaseFunctions";
import { DriverCard, DriverPageHeader } from "./DriverUI";
import { tripDestination, tripNumber } from "./driverData";

export default function DriverConfirmArrivalScreen() {
  const { tripId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => !tripId ? undefined : onSnapshot(doc(db, "truck_trips", String(tripId)), (snapshot) => { const next = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null; setTrip(String(next?.driverId || next?.driverUid || "") === String(user?.uid || "") ? next : null); setLoading(false); }, () => setLoading(false)), [tripId, user?.uid]);
  const confirm = () => Alert.alert("Confirm Arrival", `Confirm that you have arrived at ${tripDestination(trip)}?`, [{ text: "Cancel", style: "cancel" }, { text: "Confirm", onPress: async () => {
    setSubmitting(true);
    try { await confirmDriverArrival({ tripId: trip.id }); Alert.alert("Arrival confirmed", "The assigned Checker and Manager have been notified. Shipment statuses were not changed.", [{ text: "OK", onPress: () => router.replace({ pathname: "/(driver)/trip-details", params: { tripId: trip.id } }) }]); }
    catch (error) { Alert.alert("Unable to confirm arrival", error?.message || "Please try again."); }
    finally { setSubmitting(false); }
  } }]);
  return <View style={[styles.screen, { backgroundColor: colors.dashboardBg }]}><DriverPageHeader title="Confirm Arrival" onBack={() => router.back()} />
    {loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : !trip ? <View style={styles.center}><Text style={{ color: colors.textMuted }}>Trip unavailable.</Text></View> : <View style={styles.content}>
      <View style={styles.illustration}><View style={[styles.pinCircle, { backgroundColor: colors.primarySoft }]}><Feather name="map-pin" size={47} color={colors.primary} /></View><View style={styles.buildings}><Feather name="truck" size={56} color={colors.primary} /><Feather name="home" size={70} color={colors.iconMuted} /></View></View>
      <Text style={[styles.title, { color: colors.text }]}>Confirm Arrival at {tripDestination(trip)}</Text><Text style={[styles.message, { color: colors.textMuted }]}>By confirming, you are indicating that the truck has arrived at the destination warehouse.</Text>
      <DriverCard style={styles.card}><Text style={[styles.label, { color: colors.textMuted }]}>Trip</Text><Text style={[styles.value, { color: colors.text }]}>{tripNumber(trip)}</Text><View style={[styles.separator, { backgroundColor: colors.border }]} /><Text style={[styles.label, { color: colors.textMuted }]}>Destination Warehouse</Text><Text style={[styles.value, { color: colors.text }]}>{tripDestination(trip)}</Text></DriverCard>
      <View style={styles.actions}><TouchableOpacity style={[styles.primary, { backgroundColor: colors.primary }]} disabled={submitting} onPress={confirm}>{submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Confirm Arrival</Text>}</TouchableOpacity><TouchableOpacity style={[styles.cancel, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()} disabled={submitting}><Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text></TouchableOpacity></View>
    </View>}
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, content: { flex: 1, padding: 14 }, illustration: { height: 190, alignItems: "center", justifyContent: "center" }, pinCircle: { width: 86, height: 86, borderRadius: 43, alignItems: "center", justifyContent: "center" }, buildings: { marginTop: -12, flexDirection: "row", alignItems: "flex-end", gap: 4 }, title: { fontSize: 14, lineHeight: 19, fontWeight: "900", textAlign: "center" }, message: { marginTop: 7, fontSize: 10, lineHeight: 15, textAlign: "center", paddingHorizontal: 13 }, card: { marginTop: 17, padding: 13, borderRadius: 12 }, label: { fontSize: 8, fontWeight: "700" }, value: { marginTop: 3, fontSize: 10, fontWeight: "900" }, separator: { height: 1, marginVertical: 11 }, actions: { marginTop: 17, gap: 8 }, primary: { height: 43, borderRadius: 7, alignItems: "center", justifyContent: "center" }, primaryText: { color: "#fff", fontSize: 10, fontWeight: "900" }, cancel: { height: 41, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" }, cancelText: { fontSize: 10, fontWeight: "800" } });
