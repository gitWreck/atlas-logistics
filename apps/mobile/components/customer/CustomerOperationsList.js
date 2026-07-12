import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { InvoiceEmptyArt, ScheduleEmptyArt } from "./CustomerEmptyStateArt";

const INVOICE_TABS = ["All", "Paid", "Pending", "Overdue"];
const SCHEDULE_TABS = ["All", "Today", "Tomorrow", "This Week", "This Month"];

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function invoiceStatus(value) {
  const status = String(value || "PENDING").toUpperCase();
  if (status === "PAID") return "Paid";
  if (status === "OVERDUE") return "Overdue";
  return "Pending";
}

function statusTheme(status, colors) {
  if (status === "Paid") return { text: colors.success, bg: colors.successSoft };
  if (status === "Overdue") return { text: colors.danger, bg: colors.dangerSoft };
  return { text: colors.warning, bg: colors.warningSoft };
}

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value, includeTime = false) {
  const date = toDate(value);
  if (!date) return "Date unavailable";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function AnimatedButton({ children, onPress, style, accessibilityLabel }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (value) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 30 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={style}
        onPress={onPress}
        activeOpacity={0.9}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function EmptyState({ isInvoice, colors, onTrack }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyGroup}>
        <View style={styles.emptyIllustration}>
          {isInvoice ? <InvoiceEmptyArt /> : <ScheduleEmptyArt />}
        </View>

        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {isInvoice ? "No invoices yet" : "No schedules yet"}
        </Text>
        <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
          {isInvoice
            ? "You don't have any invoices at the moment.\nInvoices will appear here once your shipment is completed and billed."
            : "You don't have any upcoming schedules.\nYour pickup and delivery schedules will appear here once they are set."}
        </Text>
        <AnimatedButton
          style={[styles.trackButton, { backgroundColor: colors.primary }]}
          onPress={onTrack}
          accessibilityLabel="Track your shipments"
        >
          <Feather name={isInvoice ? "file-text" : "truck"} size={17} color={colors.onPrimary} />
          <Text style={[styles.trackText, { color: colors.onPrimary }]}>Track Your Shipments</Text>
        </AnimatedButton>
      </View>
      {isInvoice && (
        <View style={[styles.emptyFooter, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}>
          <Feather name="info" size={15} color={colors.primary} />
          <Text style={[styles.footerText, { color: colors.textMuted }]}>Invoices are generated after shipment delivery.</Text>
        </View>
      )}
    </View>
  );
}

function InvoiceCard({ invoice, colors }) {
  const status = invoiceStatus(invoice.status);
  const theme = statusTheme(status, colors);
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      style={[styles.card, styles.invoiceCard, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}
    >
      <View style={[styles.recordIcon, { backgroundColor: theme.bg }]}>
        <Feather name="file-text" size={25} color={theme.text} />
      </View>
      <View style={styles.recordBody}>
        <Text style={[styles.recordTitle, { color: colors.text }]} numberOfLines={1}>
          {invoice.invoiceNumber || invoice.id}
        </Text>
        <Text style={[styles.recordLink, { color: colors.primary }]} numberOfLines={1}>
          Shipment: {invoice.shipmentTrackingNumber || invoice.shipmentId || "Unavailable"}
        </Text>
        <Text style={[styles.recordMeta, { color: colors.textMuted }]}>
          {formatDate(invoice.createdAt || invoice.invoiceDate, true)}
        </Text>
      </View>
      <View style={styles.invoiceRight}>
        <View style={[styles.badge, { backgroundColor: theme.bg }]}>
          <Text style={[styles.badgeText, { color: theme.text }]}>{status}</Text>
        </View>
        <Text style={[styles.amount, { color: colors.text }]}>
          {formatCurrency(invoice.amount ?? invoice.totalAmount)}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.iconMuted} />
    </TouchableOpacity>
  );
}

function ScheduleCard({ schedule, colors }) {
  const isPickup = String(schedule.tripType || "").toUpperCase().includes("PICKUP");
  const accent = isPickup ? colors.primary : colors.warning;
  const accentBg = isPickup ? colors.primarySoft : colors.warningSoft;
  const departure = toDate(schedule.plannedDeparture || schedule.plannedLoadingStart || schedule.estimatedArrival);
  const shipmentId = schedule.shipmentTrackingNumber || schedule.shipmentId || schedule.shipmentIds?.[0];

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      style={[styles.card, styles.scheduleCard, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}
    >
      <View style={styles.scheduleTimeColumn}>
        <View style={[styles.typeBadge, { backgroundColor: accentBg }]}>
          <Text style={[styles.typeText, { color: accent }]}>{isPickup ? "PICKUP" : "DELIVERY"}</Text>
        </View>
        <Text style={[styles.time, { color: colors.text }]}>
          {departure ? departure.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
        </Text>
      </View>
      <View style={styles.routeLine}>
        <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
        <View style={[styles.routeStem, { backgroundColor: colors.dashboardBorder }]} />
        <View style={[styles.routeDot, { backgroundColor: colors.warning }]} />
      </View>
      <View style={styles.scheduleBody}>
        <Text style={[styles.location, { color: colors.text }]} numberOfLines={1}>{schedule.origin || "Pickup location unavailable"}</Text>
        <Text style={[styles.locationLabel, { color: colors.textMuted }]}>Pickup Location</Text>
        <Text style={[styles.location, styles.dropLocation, { color: colors.text }]} numberOfLines={1}>{schedule.destination || "Drop-off location unavailable"}</Text>
        <Text style={[styles.locationLabel, { color: colors.textMuted }]}>Drop-off Location</Text>
      </View>
      <View style={styles.scheduleRight}>
        <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>{schedule.status || "Scheduled"}</Text>
        </View>
        {shipmentId ? <Text style={[styles.shipmentId, { color: colors.primary }]} numberOfLines={1}>{shipmentId}</Text> : null}
      </View>
      <Feather name="chevron-right" size={20} color={colors.iconMuted} />
    </TouchableOpacity>
  );
}

export default function CustomerOperationsList({ type, loadRecords }) {
  const router = useRouter();
  const { colors, resolvedScheme } = useTheme();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const opacity = useRef(new Animated.Value(0)).current;
  const isInvoice = type === "invoice";
  const tabs = isInvoice ? INVOICE_TABS : SCHEDULE_TABS;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loadRecords();
      setRecords(result || []);
    } catch (loadError) {
      console.error(`Customer ${type} load failed:`, loadError);
      setError(`Unable to load ${isInvoice ? "invoices" : "schedules"}.`);
    } finally {
      setLoading(false);
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
  }, [isInvoice, loadRecords, opacity, type]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (isInvoice) {
      const term = search.trim().toLowerCase();
      return records.filter((record) => {
        const statusMatches = activeTab === "All" || invoiceStatus(record.status) === activeTab;
        const searchable = `${record.invoiceNumber || record.id || ""} ${record.shipmentTrackingNumber || record.shipmentId || ""}`.toLowerCase();
        return statusMatches && (!term || searchable.includes(term));
      });
    }

    const now = dateOnly(new Date());
    return records.filter((record) => {
      if (activeTab === "All") return true;
      const value = toDate(record.plannedDeparture || record.plannedLoadingStart || record.estimatedArrival);
      if (!value) return false;
      const target = dateOnly(value);
      const days = Math.round((target - now) / 86400000);
      if (activeTab === "Today") return days === 0;
      if (activeTab === "Tomorrow") return days === 1;
      if (activeTab === "This Week") return days >= 0 && days <= 6;
      return target.getMonth() === now.getMonth() && target.getFullYear() === now.getFullYear();
    });
  }, [activeTab, isInvoice, records, search]);

  const groupedSchedules = useMemo(() => {
    const groups = new Map();
    filtered.forEach((record) => {
      const date = toDate(record.plannedDeparture || record.plannedLoadingStart || record.estimatedArrival);
      const key = date ? dateOnly(date).toISOString() : "unknown";
      if (!groups.has(key)) groups.set(key, { date, records: [] });
      groups.get(key).records.push(record);
    });
    return [...groups.values()].sort((a, b) => (a.date?.getTime() || Infinity) - (b.date?.getTime() || Infinity));
  }, [filtered]);

  const onTrack = () => router.push("/(customer)/shipments");

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.dashboardBg }]}>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} backgroundColor={colors.dashboardBg} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.heading}>
          <Text style={[styles.title, { color: colors.text }]}>{isInvoice ? "Invoices" : "Trip Schedules"}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {isInvoice ? "View and download your shipment invoices." : "View your upcoming pickup and delivery schedules."}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {isInvoice && (
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}>
            <Feather name="search" size={17} color={colors.iconMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search invoice number or shipment ID"
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>
          <View style={[styles.filterButton, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}>
            <Feather name="filter" size={17} color={colors.iconMuted} />
          </View>
        </View>
      )}

      <ScrollView
        horizontal
        style={styles.tabsScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {tabs.map((tab) => {
          const selected = tab === activeTab;
          const tabColor = tab === "Paid" ? colors.success : tab === "Pending" ? colors.warning : tab === "Overdue" ? colors.danger : colors.primary;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, selected && { backgroundColor: colors.primary }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: selected ? colors.onPrimary : tabColor }]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.loading}>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{error}</Text>
          <TouchableOpacity onPress={load}><Text style={[styles.retry, { color: colors.primary }]}>Try again</Text></TouchableOpacity>
        </View>
      ) : (
        <Animated.View style={[styles.content, { opacity }]}>
          {records.length === 0 ? (
            <EmptyState isInvoice={isInvoice} colors={colors} onTrack={onTrack} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
              {isInvoice
                ? filtered.map((record) => <InvoiceCard key={record.id} invoice={record} colors={colors} />)
                : groupedSchedules.map((group) => (
                    <View key={group.date?.toISOString() || "unknown"}>
                      <View style={styles.groupHeader}>
                        <Feather name="calendar" size={15} color={colors.primary} />
                        <Text style={[styles.groupTitle, { color: colors.primary }]}>{group.date ? formatDate(group.date) : "Date unavailable"}</Text>
                      </View>
                      {group.records.map((record) => <ScheduleCard key={record.id} schedule={record} colors={colors} />)}
                    </View>
                  ))}
              {filtered.length === 0 && <Text style={[styles.noMatches, { color: colors.textMuted }]}>No matching records.</Text>}
              {isInvoice && (
                <View style={[styles.footer, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}>
                  <Feather name="info" size={15} color={colors.primary} />
                  <Text style={[styles.footerText, { color: colors.textMuted }]}>Invoices are generated after shipment delivery.</Text>
                </View>
              )}
            </ScrollView>
          )}
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0 },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14 },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  heading: { flex: 1, alignItems: "center", paddingTop: 4 },
  headerSpacer: { width: 42 },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 7 },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  searchBox: { flex: 1, height: 42, borderWidth: 1, borderRadius: 9, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, fontSize: 12, paddingVertical: 0 },
  filterButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { minWidth: "100%", paddingHorizontal: 16, paddingBottom: 12, gap: 6 },
  tab: { flexGrow: 1, minWidth: 62, height: 36, borderRadius: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  tabText: { fontSize: 11, fontWeight: "700" },
  content: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  retry: { fontSize: 14, fontWeight: "700" },
  emptyWrap: { flex: 1, alignItems: "center", paddingHorizontal: 28, paddingBottom: 8 },
  emptyGroup: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" },
  emptyIllustration: { width: 230, height: 170, marginBottom: 8 },
  emptyTitle: { fontSize: 21, fontWeight: "700", marginBottom: 14 },
  emptyMessage: { fontSize: 13, lineHeight: 20, textAlign: "center" },
  trackButton: { height: 48, minWidth: 220, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 22, marginTop: 24 },
  trackText: { fontSize: 13, fontWeight: "700" },
  emptyFooter: { width: "100%", minHeight: 48, borderWidth: 1, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  card: { borderWidth: 1, borderRadius: 12 },
  invoiceCard: { minHeight: 78, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  recordIcon: { width: 46, height: 52, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  recordBody: { flex: 1, minWidth: 0 },
  recordTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  recordLink: { fontSize: 10, marginBottom: 4 },
  recordMeta: { fontSize: 10 },
  invoiceRight: { alignItems: "flex-end", gap: 9 },
  badge: { borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 9, fontWeight: "700", textTransform: "capitalize" },
  amount: { fontSize: 12, fontWeight: "700" },
  footer: { minHeight: 48, borderWidth: 1, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 },
  footerText: { fontSize: 10 },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8, marginBottom: 8 },
  groupTitle: { fontSize: 11, fontWeight: "700" },
  scheduleCard: { minHeight: 116, flexDirection: "row", alignItems: "center", padding: 10, marginBottom: 8, gap: 8 },
  scheduleTimeColumn: { width: 58, alignItems: "center", alignSelf: "stretch" },
  typeBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 4, marginBottom: 13 },
  typeText: { fontSize: 8, fontWeight: "800" },
  time: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  routeLine: { width: 12, height: 63, alignItems: "center", justifyContent: "space-between" },
  routeDot: { width: 7, height: 7, borderRadius: 4 },
  routeStem: { position: "absolute", top: 7, bottom: 7, width: 1 },
  scheduleBody: { flex: 1, minWidth: 0 },
  location: { fontSize: 11, fontWeight: "700" },
  locationLabel: { fontSize: 8, marginTop: 2 },
  dropLocation: { marginTop: 14 },
  scheduleRight: { width: 74, alignItems: "flex-end", alignSelf: "stretch", justifyContent: "space-between" },
  shipmentId: { fontSize: 8, textAlign: "right" },
  noMatches: { fontSize: 13, textAlign: "center", marginTop: 42 },
});
