import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
import { DriverCard, EmptyDriverState } from "./DriverUI";
import {
  formatTripDateTime,
  manilaDateKey,
  statusKey,
  statusLabel,
  toDate,
  tripDateKey,
  tripDestination,
  tripNumber,
  tripOrigin,
  tripPlate,
} from "./driverData";

const OVERVIEW = [
  { key: "ASSIGNED", label: "Assigned Trips", icon: "clipboard-list", tone: "primary" },
  { key: "IN_TRANSIT", label: "In Transit", icon: "truck", tone: "primary" },
  { key: "ARRIVED", label: "Arrived", icon: "map-marker-alt", tone: "success" },
  { key: "COMPLETED", label: "Completed", icon: "check-circle", tone: "success" },
  { key: "ISSUES", label: "Reported Issues", icon: "exclamation-circle", tone: "danger" },
  { key: "DELAYED", label: "Delayed", icon: "clock", tone: "warning" },
];

const HERO_APPEARANCES = {
  morning: { gradient: ["rgba(246, 199, 107, 0.26)", "rgba(22, 47, 76, 0.34)"], imageOpacity: 1 },
  afternoon: { gradient: ["rgba(79, 162, 224, 0.08)", "rgba(11, 54, 95, 0.14)"], imageOpacity: 1 },
  evening: { gradient: ["rgba(229, 126, 63, 0.30)", "rgba(24, 61, 116, 0.40)"], imageOpacity: 0.94 },
  night: { gradient: ["rgba(1, 13, 39, 0.64)", "rgba(7, 47, 99, 0.59)"], imageOpacity: 0.9 },
};

function heroTimePeriod(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 19) return "evening";
  return "night";
}

function greeting(period = heroTimePeriod()) {
  if (period === "morning") return "Good morning,";
  if (period === "afternoon") return "Good afternoon,";
  return "Good evening,";
}

function alpha(color, opacity) {
  const raw = String(color || "").replace("#", "");
  if (raw.length !== 6) return color;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function softBorder(colors) {
  return alpha(colors.text, 0.07);
}

function cardSurface(colors) {
  return alpha(colors.dashboardSurface, 0.98);
}

function softCard(colors) {
  return {
    backgroundColor: cardSurface(colors),
    borderColor: softBorder(colors),
    borderWidth: 1,
    shadowColor: colors.dashboardShadow,
  };
}

function secondaryText(colors) {
  return alpha(colors.text, 0.72);
}

function captionText(colors) {
  return alpha(colors.text, 0.56);
}

function primaryAccent(colors, opacity = 0.76) {
  return alpha(colors.primaryDeep || colors.primary, opacity);
}

function primarySoftAccent(colors, opacity = 0.58) {
  return alpha(colors.primarySoft || colors.dashboardSurfaceMuted, opacity);
}

function initials(name) {
  const parts = String(name || "Driver").trim().split(/\s+/).filter(Boolean);
  return (parts.length ? parts.map((part) => part[0]).join("").slice(0, 2) : "DR").toUpperCase();
}

function formatTime(value, fallback = "Pending") {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function toneColor(tone, colors) {
  if (tone === "danger") return colors.danger;
  if (tone === "warning") return colors.warning;
  if (tone === "success") return colors.success;
  return primaryAccent(colors);
}

function toneSoft(tone, colors) {
  if (tone === "danger") return colors.dangerSoft;
  if (tone === "warning") return colors.warningSoft;
  if (tone === "success") return colors.successSoft;
  return primarySoftAccent(colors);
}

function tripStatusTone(status, colors) {
  const key = statusKey(status);
  if (key === "COMPLETED" || key === "ARRIVED") return { color: colors.success, bg: colors.successSoft };
  if (key === "DELAYED") return { color: colors.warning, bg: colors.warningSoft };
  if (key.includes("ISSUE") || key.includes("FAILED")) return { color: colors.danger, bg: colors.dangerSoft };
  return { color: primaryAccent(colors), bg: primarySoftAccent(colors) };
}

function driverAvailability(data, trip, colors) {
  if (data.loading) return { label: "Checking", color: colors.warning, bg: colors.warningSoft };
  if (statusKey(trip?.status) === "IN_TRANSIT") return { label: "On Trip", color: primaryAccent(colors), bg: primarySoftAccent(colors) };
  return { label: "Online", color: colors.success, bg: colors.successSoft };
}

function Notifications({ visible, onClose, userId, onOpen }) {
  const { colors } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible || !userId) return undefined;
    setLoading(true);
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

  useEffect(() => {
    if (!user?.uid) return undefined;
    return onSnapshot(collection(db, "users", user.uid, "notifications"), (snapshot) => setUnread(snapshot.docs.filter((row) => row.data().read !== true).length));
  }, [user?.uid]);

  const todayKey = manilaDateKey();
  const todaysTrips = useMemo(() => data.trips.filter((item) => tripDateKey(item) === todayKey), [data.trips, todayKey]);
  const counts = useMemo(() => todaysTrips.reduce((result, item) => {
    const status = statusKey(item.status);
    if (["CREATED", "READY", "LOADED", "ASSIGNED"].includes(status)) result.ASSIGNED += 1;
    if (status === "IN_TRANSIT") result.IN_TRANSIT += 1;
    if (status === "ARRIVED") result.ARRIVED += 1;
    if (status === "COMPLETED") result.COMPLETED += 1;
    if (item.delayCleared === false || item.lastDelayReason || item.delayReason) result.DELAYED += 1;
    if (item.hasIssue || Number(item.issueCount || 0) > 0 || item.lastIssueType) result.ISSUES += 1;
    return result;
  }, { ASSIGNED: 0, IN_TRANSIT: 0, ARRIVED: 0, COMPLETED: 0, DELAYED: 0, ISSUES: 0 }), [todaysTrips]);

  const todayLabel = useMemo(() => new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date()), []);

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
    { label: "Start Trip", icon: "play", tone: "primary", action: handleStart, loading: starting },
    { label: "View Trip", icon: "eye", tone: "primary", action: openTrip },
    { label: "Report Issue", icon: "exclamation-triangle", tone: "danger", action: () => router.push({ pathname: "/(driver)/report-issue", params: { tripId: trip?.id || "" } }) },
    { label: "Contact Checker", icon: "comments", tone: "primary", action: () => router.navigate("/(driver)/(tabs)/messages") },
  ];

  return <View style={[styles.screen, { backgroundColor: colors.dashboardBg }]}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <DriverHeader
        colors={colors}
        name={name}
        status={driverAvailability(data, trip, colors)}
        unread={unread}
        onNotifications={() => setNotificationsOpen(true)}
      />

      <View style={styles.body}>
        <FadeIn delay={60}>
          <SectionTitle title="Current Trip" actionLabel="View Details" onAction={openTrip} colors={colors} compact />
          {data.loading ? (
            <DriverCard style={[styles.loadingCard, softCard(colors)]}>
              <ActivityIndicator color={primaryAccent(colors)} />
            </DriverCard>
          ) : trip ? (
            <CurrentTripCard
              trip={trip}
              colors={colors}
            />
          ) : (
            <DriverCard style={[styles.emptyCard, softCard(colors)]}>
              <EmptyDriverState icon="truck" title="No current trip" message="Your assigned warehouse-transfer trip will appear here." />
            </DriverCard>
          )}
        </FadeIn>

        <FadeIn delay={140}>
          <SummarySection
            counts={counts}
            colors={colors}
            todayLabel={todayLabel}
          />
        </FadeIn>

        <FadeIn delay={220}>
          <QuickActionsSection actions={actions} colors={colors} />
        </FadeIn>
      </View>
    </ScrollView>
    <Notifications visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} userId={user?.uid} onOpen={(item) => { setNotificationsOpen(false); const tripId = item?.data?.tripId || item?.tripId || (String(item?.type || "").includes("TRIP") ? item?.entityId : null); setTimeout(() => tripId ? router.push({ pathname: "/(driver)/trip-details", params: { tripId } }) : router.navigate("/(driver)/(tabs)/messages"), 0); }} />
  </View>;
}

function DriverHeader({ colors, name, status, unread, onNotifications }) {
  const [period, setPeriod] = useState(() => heroTimePeriod());
  const transition = useRef(new Animated.Value(1)).current;
  const appearance = HERO_APPEARANCES[period];

  useEffect(() => {
    const updatePeriod = () => setPeriod((current) => {
      const next = heroTimePeriod();
      return current === next ? current : next;
    });
    const timer = setInterval(updatePeriod, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    transition.setValue(0);
    Animated.timing(transition, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [period, transition]);

  return (
    <View
      style={[styles.hero, { borderColor: softBorder(colors), shadowColor: colors.dashboardShadow }]}
    >
      <Image
        source={require("../../assets/driver-hero-truck.png")}
        resizeMode="cover"
        style={[styles.heroBackgroundImage, { opacity: appearance.imageOpacity }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.heroImageOverlay, { opacity: transition }]}
      >
        <LinearGradient
          colors={appearance.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        />
        {period === "night" ? <View style={styles.heroHeadlightGlow} /> : null}
      </Animated.View>
      <View style={styles.heroTop}>
        <View style={styles.heroCopy}>
          <Text style={[styles.greeting, { color: "rgba(248, 251, 255, 0.82)" }]}>{greeting(period)}</Text>
          <Text style={[styles.name, { color: "#F8FBFF" }]} numberOfLines={1}>{name}</Text>
          <View style={[styles.driverStatus, { backgroundColor: status.bg, borderColor: alpha(status.color, 0.18) }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.driverStatusText, { color: status.color }]}>Driver</Text>
          </View>
        </View>
        <View style={styles.heroActions}>
          <Pressable
            onPress={onNotifications}
            style={({ pressed }) => [
              styles.notificationButton,
              {
                backgroundColor: alpha(colors.dashboardSurface, 0),
                borderColor: softBorder(colors),
                shadowColor: colors.dashboardShadow,
              },
              pressed && styles.pressed,
            ]}
          >
            <Feather name="bell" size={17} color="#F8FBFF" />
            {unread ? (
              <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.dashboardSurface }]}>
                <Text style={[styles.badgeText, { color: colors.onDanger }]}>{unread > 9 ? "9+" : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function CurrentTripCard({ trip, colors }) {
  const statusTheme = tripStatusTone(trip.status, colors);
  const departure = trip.plannedDeparture || trip.scheduledDeparture || trip.departureTime || trip.scheduledDate || trip.departureDate;
  const arrival = trip.estimatedArrival || trip.arrivalEta || trip.eta;
  const arrivedAt = trip.arrivedAt || trip.actualArrival || trip.completedAt || arrival;
  const arrivalLabel = ["ARRIVED", "COMPLETED"].includes(statusKey(trip.status)) ? "Date Arrived" : "Est. Arrival";

  return (
    <DriverCard style={[styles.tripCard, softCard(colors)]}>
      <View style={styles.tripTop}>
        <Text style={[styles.tripNo, { color: colors.text }]} numberOfLines={1}>{tripNumber(trip)}</Text>
        <View style={[styles.status, { backgroundColor: statusTheme.bg, borderColor: alpha(statusTheme.color, 0.16) }]}>
          <Text style={[styles.statusText, { color: statusTheme.color }]}>{statusLabel(trip.status)}</Text>
        </View>
      </View>

      <View style={[styles.tripDivider, { backgroundColor: softBorder(colors) }]} />

      <View style={styles.tripMain}>
        <View style={styles.timeline}>
          <RouteStop
            colors={colors}
            tone="primary"
            label="Pickup"
            title={tripOrigin(trip)}
            time={formatTime(departure, "Time pending")}
            first
          />
          <View style={styles.timelineConnector}>
            <View style={[styles.timelineLine, { backgroundColor: softBorder(colors) }]} />
          </View>
          <RouteStop
            colors={colors}
            tone="success"
            label="Destination"
            title={tripDestination(trip)}
            time={formatTime(arrival, "ETA pending")}
          />
        </View>
      </View>

      <View style={styles.truckIllustration}>
        <FontAwesome5 name="truck" size={38} color={primaryAccent(colors, 0.92)} />
      </View>

      <View style={[styles.tripFacts, { borderTopColor: softBorder(colors) }]}>
        <Fact label="Truck" value={trip.truckName || trip.truckType || "Assigned truck"} colors={colors} />
        <Fact label="Plate Number" value={tripPlate(trip)} colors={colors} />
        <Fact label={arrivalLabel} value={formatTripDateTime(arrivedAt)} colors={colors} />
      </View>
    </DriverCard>
  );
}

function SummarySection({ counts, colors, todayLabel }) {
  return (
    <View style={styles.overviewSection}>
      <View style={styles.overviewHeader}>
        <Text style={[styles.overviewTitle, { color: colors.text }]}>Today's Overview</Text>
        <Text style={[styles.overviewDate, { color: secondaryText(colors) }]}>{todayLabel}</Text>
      </View>
      <View style={styles.statsGrid}>
        {OVERVIEW.map((item) => {
          const color = toneColor(item.tone, colors);
          const soft = toneSoft(item.tone, colors);
          return (
            <View
              key={item.key}
              style={[
                styles.statCard,
                softCard(colors),
              ]}
            >
              <View style={[styles.statIcon, { backgroundColor: soft }]}>
                <FontAwesome5 name={item.icon} size={13} color={color} />
              </View>
              <Text style={[styles.statLabel, { color: secondaryText(colors) }]} numberOfLines={2}>{item.label}</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{counts[item.key]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function QuickActionsSection({ actions, colors }) {
  return (
    <View style={styles.quickActionsSection}>
      <SectionTitle title="Quick Actions" colors={colors} compact />
      <View style={styles.actionGrid}>
        {actions.map((item) => {
          const color = toneColor(item.tone, colors);
          const soft = toneSoft(item.tone, colors);
          return (
            <Pressable
              key={item.label}
              onPress={item.action}
              disabled={item.loading}
              style={({ pressed }) => [
                styles.actionItem,
                pressed && styles.pressed,
                item.loading && styles.disabled,
              ]}
            >
              <View style={[styles.actionIcon, softCard(colors), { backgroundColor: soft }]}>
                {item.loading ? <ActivityIndicator size="small" color={color} /> : <FontAwesome5 name={item.icon} size={19} color={color} />}
              </View>
              <Text style={[styles.actionTitle, { color: colors.text }]} numberOfLines={2}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SectionTitle({ title, subtitle, actionLabel, onAction, colors, compact = false }) {
  return (
    <View style={[styles.sectionHeaderRow, compact && styles.sectionHeaderRowCompact]}>
      <View style={styles.sectionHeaderCopy}>
        <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sectionSubtitle, { color: secondaryText(colors) }]}>{subtitle}</Text> : null}
      </View>
      {actionLabel ? (
        <TouchableOpacity style={styles.sectionAction} onPress={onAction} activeOpacity={0.75}>
          <Text style={[styles.sectionActionText, compact && styles.sectionActionTextCompact, { color: primaryAccent(colors) }]}>{actionLabel}</Text>
          <Feather name="chevron-right" size={compact ? 16 : 18} color={primaryAccent(colors)} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function RouteStop({ colors, tone, label, title, time, first }) {
  const color = toneColor(tone, colors);
  return (
    <View style={styles.routeStop}>
      <View style={styles.routeMarkerWrap}>
        <View style={[styles.routeMarker, { borderColor: color, backgroundColor: cardSurface(colors) }]} />
      </View>
      <View style={[styles.routeStopCopy, first && styles.routeStopCopyFirst]}>
        <Text style={[styles.location, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.routeLabel, { color }]}>{label}</Text>
        <Text style={[styles.routeTime, { color: captionText(colors) }]}>{time}</Text>
      </View>
    </View>
  );
}

function Fact({ label, value, colors }) {
  return <View style={styles.fact}><Text style={[styles.factLabel, { color: captionText(colors) }]}>{label}</Text><Text style={[styles.factValue, { color: colors.text }]} numberOfLines={2}>{value}</Text></View>;
}

function FadeIn({ children, delay = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 360, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 360, delay, useNativeDriver: true }),
    ]).start();
  }, [delay, opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 30 },
  body: { paddingTop: 28 },
  hero: {
    height: 110,
    marginHorizontal: 0,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  heroBackgroundImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
    borderRadius: 13,
    zIndex: 0,
  },
  heroImageOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  heroGradient: { flex: 1 },
  heroHeadlightGlow: {
    position: "absolute",
    right: 34,
    bottom: -28,
    width: 106,
    height: 72,
    borderRadius: 53,
    backgroundColor: "rgba(105, 190, 255, 0.15)",
  },
  heroTop: {
    zIndex: 2,
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 10,
  },
  heroCopy: { flex: 1, minWidth: 0, paddingTop: 22 },
  greeting: { fontSize: 12, lineHeight: 15, fontWeight: "400" },
  name: { marginTop: 2, fontSize: 20, lineHeight: 24, fontWeight: "700" },
  driverStatus: {
    marginTop: 6,
    alignSelf: "flex-start",
    minHeight: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  driverStatusText: { fontSize: 10, fontWeight: "700" },
  heroActions: { width: 64, alignItems: "flex-end", justifyContent: "flex-start", paddingVertical: 4 },
  notificationButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 9, lineHeight: 11, fontWeight: "700" },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, lineHeight: 24, fontWeight: "700" },
  section: { marginTop: 36 },
  sectionHeaderRow: {
    minHeight: 36,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  sectionHeaderRowCompact: { minHeight: 24, marginBottom: 8 },
  sectionHeaderCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 23, lineHeight: 29, fontWeight: "600" },
  sectionTitleCompact: { fontSize: 16, lineHeight: 20, fontWeight: "700" },
  sectionSubtitle: { marginTop: 3, fontSize: 13, lineHeight: 17, fontWeight: "400" },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  sectionActionText: { fontSize: 13, fontWeight: "500" },
  sectionActionTextCompact: { fontSize: 9, fontWeight: "700" },
  loadingCard: { minHeight: 150, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  emptyCard: { borderRadius: 12 },
  tripCard: {
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 13,
    borderRadius: 11,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 2,
  },
  tripTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  tripDivider: { height: StyleSheet.hairlineWidth, marginTop: 12 },
  tripNo: { flex: 1, fontSize: 10, lineHeight: 13, fontWeight: "800" },
  status: { borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 8, fontWeight: "800" },
  tripMain: { marginTop: 13, minHeight: 112, flexDirection: "row", alignItems: "flex-start", gap: 12, paddingLeft: 4, paddingRight: 94 },
  timeline: { flex: 1, minWidth: 0 },
  routeStop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  routeMarkerWrap: { width: 18, alignItems: "center", paddingTop: 4 },
  routeMarker: { width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  routeStopCopy: { flex: 1, minWidth: 0 },
  routeStopCopyFirst: { paddingBottom: 3 },
  routeLabel: { marginTop: 2, fontSize: 9, lineHeight: 11, fontWeight: "700" },
  location: { fontSize: 13, lineHeight: 17, fontWeight: "700" },
  routeTime: { marginTop: 5, fontSize: 9, lineHeight: 11, fontWeight: "400" },
  timelineConnector: { width: 18, height: 35, alignItems: "center", justifyContent: "center" },
  timelineLine: { width: StyleSheet.hairlineWidth, flex: 1, borderRadius: 1 },
  truckIllustration: {
    position: "absolute",
    right: 42,
    top: 88,
    width: 48,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  tripFacts: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 0,
  },
  fact: { flex: 1, minWidth: 0, paddingRight: 6 },
  factLabel: { fontSize: 8, lineHeight: 10, fontWeight: "700" },
  factValue: { marginTop: 3, fontSize: 8, lineHeight: 11, fontWeight: "800" },
  overviewSection: { marginTop: 22 },
  overviewHeader: {
    minHeight: 22,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  overviewTitle: { fontSize: 16, lineHeight: 20, fontWeight: "700" },
  overviewDate: { fontSize: 10, lineHeight: 13, fontWeight: "500" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 8, rowGap: 8 },
  statCard: {
    width: "31.6%",
    minHeight: 85,
    borderRadius: 10,
    padding: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  statIcon: { width: 24, height: 24, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  statLabel: { marginTop: 9, fontSize: 8, lineHeight: 10, fontWeight: "700" },
  statValue: { marginTop: 8, fontSize: 18, lineHeight: 22, fontWeight: "800" },
  actionGrid: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  quickActionsSection: { marginTop: 22 },
  actionItem: {
    flex: 1,
    alignItems: "center",
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  actionTitle: { marginTop: 7, fontSize: 8, lineHeight: 11, textAlign: "center", fontWeight: "700" },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.64 },
  notificationPage: { flex: 1 },
  notificationHeader: { height: 58, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth },
  iconButton: { width: 52, alignItems: "center" },
  notificationTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "600" },
});
