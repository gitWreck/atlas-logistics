import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";

import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import useDriverOperations from "../../hooks/useDriverOperations";
import { startTrip } from "../utilities/FirebaseFunctions";
import CustomerNotificationsList from "../notifications/CustomerNotificationsList";
import { DriverAvatar, DriverCard, EmptyDriverState } from "./DriverUI";
import { formatTripDateTime, manilaDateKey, statusKey, statusLabel, tripDateKey, tripDestination, tripNumber, tripOrigin, tripPlate } from "./driverData";

const PRIMARY = "#2563eb";
const DANGER = "#dc2626";

const roleConfig = {
  driver: {
    icon: "truck",
    label: "Driver",
    color: "#9333ea",
    bg: "#faf5ff",
    border: "#e9d5ff",
  },
};

const OVERVIEW = [
  { key: "ASSIGNED", label: "Assigned Trips", icon: "clipboard", tone: "primary" },
  { key: "IN_TRANSIT", label: "In Transit", icon: "truck", tone: "primary" },
  { key: "ARRIVED", label: "Arrived", icon: "map-pin", tone: "success" },
  { key: "COMPLETED", label: "Completed", icon: "check-circle", tone: "success" },
  { key: "ISSUES", label: "Reported Issues", icon: "alert-triangle", tone: "danger" },
  { key: "DELAYED", label: "Delayed", icon: "clock", tone: "warning" },
];

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return hour < 12 ? "Good morning," : hour < 18 ? "Good afternoon," : "Good evening,";
}

function Notifications({ visible, onClose, userId, onOpen }) {
  const { colors } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!visible || !userId) return undefined;
    return onSnapshot(collection(db, "users", userId, "notifications"), (snapshot) => {
      setItems(snapshot.docs.map((row) => ({ id: row.id, ...row.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
      setLoading(false);
    }, () => setLoading(false));
  }, [userId, visible]);
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={[styles.notificationPage, { backgroundColor: colors.bg }]}>
      <View style={[styles.notificationHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.iconButton} onPress={onClose}><FontAwesome5 name="arrow-left" size={20} color={colors.text} /></TouchableOpacity>
        <Text style={[styles.notificationTitle, { color: colors.text }]}>Notifications</Text><View style={styles.iconButton} />
      </View>
      <CustomerNotificationsList notifications={items} loading={loading} onPressNotification={(item) => {
        if (item.read !== true) updateDoc(doc(db, "users", userId, "notifications", item.id), { read: true }).catch(() => {});
        onOpen(item);
      }} />
    </SafeAreaView>
  </Modal>;
}

export default function DriverDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const data = useDriverOperations(manilaDateKey());
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [starting, setStarting] = useState(false);
  const trip = data.activeTrip || data.latestAssignedTrip;
  const name = user?.name || user?.fullName || user?.displayName || "Driver";
  const config = roleConfig.driver || {
    icon: "user-circle",
    label: "Driver",
    color: "#9333ea",
    bg: "#faf5ff",
    border: "#e9d5ff",
  };

  useEffect(() => {
    if (!user?.uid) return undefined;
    return onSnapshot(collection(db, "users", user.uid, "notifications"), (snapshot) => setUnread(snapshot.docs.filter((row) => row.data().read !== true).length));
  }, [user?.uid]);

  const counts = useMemo(() => data.trips.filter((item) => tripDateKey(item) === manilaDateKey()).reduce((result, item) => {
    const status = statusKey(item.status);
    if (["CREATED", "READY", "LOADED", "ASSIGNED"].includes(status)) result.ASSIGNED += 1;
    if (status === "IN_TRANSIT") result.IN_TRANSIT += 1;
    if (status === "ARRIVED") result.ARRIVED += 1;
    if (status === "COMPLETED") result.COMPLETED += 1;
    if (item.delayCleared === false || item.lastDelayReason || item.delayReason) result.DELAYED += 1;
    if (item.hasIssue || Number(item.issueCount || 0) > 0 || item.lastIssueType) result.ISSUES += 1;
    return result;
  }, { ASSIGNED: 0, IN_TRANSIT: 0, ARRIVED: 0, COMPLETED: 0, DELAYED: 0, ISSUES: 0 }), [data.trips]);

  const openTrip = () => trip ? router.push({ pathname: "/(driver)/trip-details", params: { tripId: trip.id } }) : Alert.alert("No current trip", "There is no assigned trip to display.");
  const handleStart = () => {
    if (!trip) return Alert.alert("No assigned trip", "A trip must be assigned before it can be started.");
    const current = statusKey(trip.status);
    if (current === "IN_TRANSIT") return openTrip();
    if (!["LOADED", "READY"].includes(current)) return Alert.alert("Trip not ready", "The warehouse must finish loading and lock the manifest before departure.");
    Alert.alert("Start Trip", `Start ${tripNumber(trip)} now?`, [{ text: "Cancel", style: "cancel" }, { text: "Start", onPress: async () => {
      setStarting(true);
      try { await startTrip({ tripId: trip.id }); Alert.alert("Trip started", "Drive safely."); }
      catch (error) { Alert.alert("Unable to start trip", error?.message || "Please try again."); }
      finally { setStarting(false); }
    } }]);
  };

  const actions = [
    { label: "Start Trip", icon: "play", color: colors.primary, action: handleStart },
    { label: "View Trip", icon: "eye", color: colors.primary, action: openTrip },
    { label: "Report Issue", icon: "exclamation-triangle", color: colors.danger, action: () => router.push({ pathname: "/(driver)/report-issue", params: { tripId: trip?.id || "" } }) },
    { label: "Contact Checker", icon: "comments", color: colors.primary, action: () => router.navigate("/(driver)/(tabs)/messages") },
  ];

  return <View style={[styles.screen, { backgroundColor: colors.dashboardBg }]}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <LinearGradient colors={[colors.primaryDeep, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}><Text style={styles.heroTitle}>Dashboard</Text>
          <TouchableOpacity style={styles.bell} onPress={() => setNotificationsOpen(true)}><FontAwesome5 name="bell" size={18} color="#fff" />{unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text></View> : null}</TouchableOpacity>
        </View>
        <View style={styles.identity}><View style={styles.identityCopy}><Text style={styles.greeting}>{greeting()}</Text><Text style={styles.name} numberOfLines={1}>{name}</Text><View style={[styles.role, { backgroundColor: colors.primarySoft || config.bg, borderColor: colors.primarySoftBorder || config.border }]}><FontAwesome5 name={config.icon} size={10} color={config.color} /><Text style={[styles.roleText, { color: config.color }]}>{config.label}</Text></View></View><DriverAvatar user={user} size={62} /></View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.cardEyebrow, { color: colors.textMuted }]}>Driver</Text>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Current Trip</Text>
          </View>
        </View>
        {data.loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View> : trip ? <DriverCard style={styles.tripCard}>
          <View style={styles.cardHeading}><Text style={[styles.tripNo, { color: colors.text }]} numberOfLines={1}>{tripNumber(trip)}</Text><View style={[styles.status, { backgroundColor: statusKey(trip.status) === "IN_TRANSIT" ? colors.primarySoft : colors.successSoft }]}><Text style={[styles.statusText, { color: statusKey(trip.status) === "IN_TRANSIT" ? colors.primary : colors.success }]}>{statusLabel(trip.status)}</Text></View></View>
          <View style={styles.routeRow}><View style={styles.routeRail}><View style={[styles.dot, { backgroundColor: colors.primary }]} /><View style={[styles.line, { backgroundColor: colors.border }]} /><View style={[styles.dot, { backgroundColor: colors.success }]} /></View><View style={styles.routeCopy}><Text style={[styles.location, { color: colors.text }]} numberOfLines={1}>{tripOrigin(trip)}</Text><Text style={[styles.location, { color: colors.text }]} numberOfLines={1}>{tripDestination(trip)}</Text></View><FontAwesome5 name="truck" size={40} color={colors.primary} /></View>
          <View style={[styles.tripFacts, { borderTopColor: colors.border }]}><Fact label="Truck" value={trip.truckName || trip.truckType || "Assigned truck"} colors={colors} /><Fact label="Plate Number" value={tripPlate(trip)} colors={colors} /><Fact label="Est. Arrival" value={formatTripDateTime(trip.estimatedArrival)} colors={colors} /></View>
        </DriverCard> : <DriverCard><EmptyDriverState icon="truck" title="No current trip" message="Your assigned warehouse-transfer trip will appear here." /></DriverCard>}

        <View style={styles.sectionRow}>
          <View>
            <Text style={[styles.cardEyebrow, { color: colors.textMuted }]}>Trip Statistics</Text>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Today's Overview</Text>
          </View>
          <Text style={[styles.date, { color: colors.textMuted }]}>{new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }).format(new Date())}</Text>
        </View>
        <View style={styles.overview}>{OVERVIEW.map((item) => { const color = item.tone === "danger" ? colors.danger : item.tone === "warning" ? colors.warning : item.tone === "success" ? colors.success : colors.primary; return <DriverCard key={item.key} style={styles.statCard}><FontAwesome5 name={item.icon} size={15} color={color} /><Text style={[styles.statLabel, { color: colors.textMuted }]}>{item.label}</Text><Text style={[styles.statValue, { color: colors.text }]}>{counts[item.key]}</Text></DriverCard>; })}</View>
        <View>
          <Text style={[styles.cardEyebrow, { color: colors.textMuted }]}>Actions</Text>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Quick Actions</Text>
        </View>
        <View style={styles.actions}>{actions.map((item) => <TouchableOpacity key={item.label} style={styles.action} onPress={item.action} disabled={starting}><View style={[styles.actionIcon, { backgroundColor: item.color === colors.danger ? colors.dangerSoft : colors.primarySoft }]}>{starting && item.label === "Start Trip" ? <ActivityIndicator size="small" color={item.color} /> : <FontAwesome5 name={item.icon} size={17} color={item.color} />}</View><Text style={[styles.actionText, { color: colors.text }]}>{item.label}</Text></TouchableOpacity>)}</View>
      </View>
    </ScrollView>
    <Notifications visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} userId={user?.uid} onOpen={(item) => { setNotificationsOpen(false); const tripId = item?.data?.tripId || item?.tripId || (String(item?.type || "").includes("TRIP") ? item?.entityId : null); setTimeout(() => tripId ? router.push({ pathname: "/(driver)/trip-details", params: { tripId } }) : router.navigate("/(driver)/(tabs)/messages"), 0); }} />
  </View>;
}

function Fact({ label, value, colors }) { return <View style={styles.fact}><Text style={[styles.factLabel, { color: colors.textMuted }]}>{label}</Text><Text style={[styles.factValue, { color: colors.text }]} numberOfLines={2}>{value}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { paddingBottom: 24 }, hero: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }, heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heroTitle: { color: "#fff", fontSize: 15, fontWeight: "800" }, bell: { width: 38, height: 38, alignItems: "center", justifyContent: "center" }, badge: { position: "absolute", top: 1, right: 1, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }, badgeText: { color: "#fff", fontSize: 8, fontWeight: "900" }, identity: { flexDirection: "row", alignItems: "center", marginTop: 13 }, identityCopy: { flex: 1, minWidth: 0 }, greeting: { color: "rgba(255,255,255,.86)", fontSize: 11 }, name: { marginTop: 2, color: "#fff", fontSize: 21, lineHeight: 27, fontWeight: "800" }, role: { marginTop: 6, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,.18)", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 5 }, roleText: { color: "#fff", fontSize: 10, fontWeight: "700" }, body: { paddingHorizontal: 14, paddingTop: 15 }, cardHeader: { marginBottom: 12 }, cardEyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3 }, cardTitle: { fontSize: 14, fontWeight: "800", marginTop: 2 }, sectionTitle: { fontSize: 14, fontWeight: "800" }, tripCard: { marginTop: 9, padding: 13, borderRadius: 14 }, cardHeading: { flexDirection: "row", alignItems: "center", gap: 8 }, tripNo: { flex: 1, fontSize: 12, fontWeight: "900" }, status: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }, statusText: { fontSize: 8, fontWeight: "900" }, routeRow: { marginTop: 12, flexDirection: "row", alignItems: "center" }, routeRail: { width: 18, height: 46, alignItems: "center" }, dot: { width: 7, height: 7, borderRadius: 4 }, line: { width: 1, flex: 1 }, routeCopy: { flex: 1, height: 50, justifyContent: "space-between" }, location: { fontSize: 11, fontWeight: "700" }, tripFacts: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11, marginTop: 11 }, fact: { flex: 1, paddingRight: 6 }, factLabel: { fontSize: 8, fontWeight: "700" }, factValue: { marginTop: 3, fontSize: 9, lineHeight: 12, fontWeight: "800" }, loading: { height: 150, alignItems: "center", justifyContent: "center" }, sectionRow: { marginTop: 18, marginBottom: 9, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, date: { fontSize: 9 }, overview: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, statCard: { width: "31.7%", minHeight: 76, padding: 9, borderRadius: 12 }, statLabel: { marginTop: 7, fontSize: 8, lineHeight: 10, fontWeight: "700" }, statValue: { marginTop: 3, fontSize: 17, fontWeight: "900" }, quickTitle: { marginTop: 18 }, actions: { marginTop: 9, flexDirection: "row", gap: 7 }, action: { flex: 1, alignItems: "center" }, actionIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" }, actionText: { marginTop: 6, fontSize: 8, lineHeight: 11, textAlign: "center", fontWeight: "700" }, notificationPage: { flex: 1 }, notificationHeader: { height: 58, flexDirection: "row", alignItems: "center", borderBottomWidth: 1 }, iconButton: { width: 52, alignItems: "center" }, notificationTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800" },
});
