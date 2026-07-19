import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";

import { useTheme } from "../../contexts/ThemeContext";
import useDriverOperations from "../../hooks/useDriverOperations";
import { createDriverConversation, listDriverChatContacts } from "../utilities/FirebaseFunctions";
import { DateSelector, DriverCard, DriverDatePicker, DriverPageHeader, EmptyDriverState } from "./DriverUI";
import { formatTripTime, manilaDateKey, shipmentAddress, shipmentRecipient, statusKey, statusLabel } from "./driverData";

const FILTERS = ["PENDING", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RETURNED"];

function matchesFilter(value, filter) {
  const status = statusKey(value);
  if (filter === "PENDING") return !["OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED", "FAILED_DELIVERY", "RETURNED", "CANCELLED"].includes(status);
  if (filter === "DELIVERED") return ["DELIVERED", "COMPLETED"].includes(status);
  if (filter === "FAILED") return status.includes("FAILED");
  if (filter === "RETURNED") return status.includes("RETURN") || status === "CANCELLED";
  return status === filter;
}

function valueOf(shipment, paths, fallback = "Not provided") {
  for (const path of paths) {
    const value = path.split(".").reduce((row, key) => row?.[key], shipment);
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return fallback;
}

function tone(status, colors) {
  const key = statusKey(status);
  if (["DELIVERED", "COMPLETED"].includes(key)) return { bg: colors.successSoft, text: colors.success };
  if (key.includes("FAIL") || key === "CANCELLED") return { bg: colors.dangerSoft, text: colors.danger };
  if (key.includes("RETURN")) return { bg: colors.warningSoft, text: colors.warning };
  return { bg: colors.primarySoft, text: colors.primary };
}

export default function DriverDeliveriesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [date, setDate] = useState(manilaDateKey());
  const [filter, setFilter] = useState("PENDING");
  const [dateOpen, setDateOpen] = useState(false);
  const [openingChecker, setOpeningChecker] = useState(null);
  const data = useDriverOperations(date);

  const shipments = useMemo(() => data.shipments.filter((item) => matchesFilter(item.status, filter)), [data.shipments, filter]);

  const openMaps = async (shipment) => {
    const address = shipmentAddress(shipment);
    const lat = shipment.latitude ?? shipment.deliveryLatitude ?? shipment.recipient?.address?.latitude;
    const lng = shipment.longitude ?? shipment.deliveryLongitude ?? shipment.recipient?.address?.longitude;
    const destination = lat != null && lng != null ? `${lat},${lng}` : address;
    try { await Linking.openURL(`https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destination)}`); }
    catch { Alert.alert("Maps unavailable", "A maps application could not be opened."); }
  };

  const callCustomer = async (shipment) => {
    const phone = valueOf(shipment, ["recipient.phone", "recipient.phoneNumber", "customerPhone", "contactNumber"], "");
    if (!phone) return Alert.alert("No contact number", "This delivery has no customer phone number.");
    const supported = await Linking.canOpenURL(`tel:${phone}`);
    if (!supported) return Alert.alert("Calling unavailable", "This device cannot start a phone call.");
    return Linking.openURL(`tel:${phone}`);
  };

  const messageChecker = async (shipment) => {
    if (openingChecker) return;
    setOpeningChecker(shipment.id);
    try {
      const response = await listDriverChatContacts();
      const contacts = response?.data?.contacts || [];
      const assignedId = shipment.assignedCheckerId || shipment.checkerId;
      const checker = contacts.find((item) => item.contactType === "checker" && item.id === assignedId)
        || contacts.find((item) => item.contactType === "checker" && item.sameMunicipality)
        || contacts.find((item) => item.contactType === "checker");
      if (!checker) return Alert.alert("Checker unavailable", "No authorized Checker is assigned to this delivery area.");
      const conversation = await createDriverConversation({ contactId: checker.id });
      router.push({ pathname: "/(driver)/chat/[conversationId]", params: { conversationId: conversation.data.conversationId } });
    } catch (error) { Alert.alert("Message unavailable", error?.message || "Unable to open the Checker conversation."); }
    finally { setOpeningChecker(null); }
  };

  const openInfo = (shipment) => router.push({ pathname: "/(driver)/delivery-info", params: { shipmentId: shipment.id, tripId: shipment.tripId || "" } });
  const openScan = (shipment) => router.push({ pathname: "/(driver)/delivery-scan", params: { mode: statusKey(shipment.status).includes("FAIL") ? "return" : "delivery", shipmentId: shipment.id, tripId: shipment.tripId || "", date } });

  return (
    <View style={[styles.screen, { backgroundColor: colors.dashboardBg }]}>
      <DriverPageHeader title="Deliveries" subtitle={`${data.shipments.length} assigned`} />
      <View style={styles.date}><DateSelector value={date} compact onPress={() => setDateOpen(true)} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((item) => <TouchableOpacity key={item} style={[styles.filter, { backgroundColor: filter === item ? colors.primary : colors.surface, borderColor: filter === item ? colors.primary : colors.border }]} onPress={() => setFilter(item)}><Text style={[styles.filterText, { color: filter === item ? colors.onPrimary : colors.textMuted }]}>{item === "OUT_FOR_DELIVERY" ? "Out for Delivery" : statusLabel(item)}</Text></TouchableOpacity>)}
      </ScrollView>
      {data.loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View> : shipments.length === 0 ? <EmptyDriverState icon="package" title={`No ${statusLabel(filter).toLowerCase()} deliveries`} message="Only shipments assigned to your Driver trip appear here." /> : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {shipments.map((shipment) => {
            const statusTone = tone(shipment.status, colors);
            const phone = valueOf(shipment, ["recipient.phone", "recipient.phoneNumber", "customerPhone", "contactNumber"]);
            const cod = Number(shipment.codAmount ?? shipment.CODAmount ?? shipment.amountToCollect ?? 0);
            return <DriverCard key={shipment.id} style={styles.card}>
              <View style={styles.cardTop}><View style={styles.flex}><Text style={[styles.eyebrow, { color: colors.textMuted }]}>TRACKING NUMBER</Text><Text style={[styles.tracking, { color: colors.text }]}>{shipment.shipmentId || shipment.trackingNumber || shipment.trackingShipmentId || shipment.id}</Text></View><View style={[styles.badge, { backgroundColor: statusTone.bg }]}><Text style={[styles.badgeText, { color: statusTone.text }]}>{statusLabel(shipment.status)}</Text></View></View>
              <Text style={[styles.customer, { color: colors.text }]}>{shipmentRecipient(shipment)}</Text>
              <Text style={[styles.address, { color: colors.textMuted }]}>{shipmentAddress(shipment)}</Text>
              <View style={styles.details}>
                <View style={styles.detail}><Text style={[styles.detailLabel, { color: colors.textMuted }]}>Contact</Text><Text style={[styles.detailValue, { color: colors.text }]}>{phone}</Text></View>
                <View style={styles.detail}><Text style={[styles.detailLabel, { color: colors.textMuted }]}>COD</Text><Text style={[styles.detailValue, { color: colors.text }]}>{cod > 0 ? `₱${cod.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "Not applicable"}</Text></View>
                <View style={styles.detail}><Text style={[styles.detailLabel, { color: colors.textMuted }]}>Checker</Text><Text style={[styles.detailValue, { color: colors.text }]}>{valueOf(shipment, ["assignedCheckerName", "checkerName"])}</Text></View>
                <View style={styles.detail}><Text style={[styles.detailLabel, { color: colors.textMuted }]}>Scheduled</Text><Text style={[styles.detailValue, { color: colors.text }]}>{formatTripTime(shipment.scheduledAt || shipment.deliveryTime || shipment.plannedDeliveryAt)}</Text></View>
              </View>
              <View style={[styles.actions, { borderTopColor: colors.border }]}>
                <TouchableOpacity style={[styles.primaryAction, { backgroundColor: colors.primary }]} onPress={() => openScan(shipment)}><Feather name="maximize" size={15} color={colors.onPrimary} /><Text style={[styles.primaryText, { color: colors.onPrimary }]}>Start Scan</Text></TouchableOpacity>
                <TouchableOpacity style={styles.iconAction} onPress={() => openInfo(shipment)} accessibilityLabel="Delivery information"><Feather name="info" size={18} color={colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={styles.iconAction} onPress={() => openMaps(shipment)} accessibilityLabel="Open maps"><Feather name="map-pin" size={18} color={colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={styles.iconAction} onPress={() => callCustomer(shipment)} accessibilityLabel="Call customer"><Feather name="phone" size={18} color={colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={styles.iconAction} onPress={() => messageChecker(shipment)} accessibilityLabel="Message Checker">{openingChecker === shipment.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="message-square" size={18} color={colors.primary} />}</TouchableOpacity>
              </View>
            </DriverCard>;
          })}
        </ScrollView>
      )}
      <DriverDatePicker visible={dateOpen} value={date} onChange={setDate} onClose={() => setDateOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, date: { paddingHorizontal: 16, paddingBottom: 10 }, filters: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 }, filter: { height: 34, borderRadius: 17, borderWidth: 1, paddingHorizontal: 13, justifyContent: "center" }, filterText: { fontSize: 11, fontWeight: "800" }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 }, card: { padding: 14 }, cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 }, flex: { flex: 1, minWidth: 0 }, eyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }, tracking: { marginTop: 3, fontSize: 14, fontWeight: "900" }, badge: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 }, badgeText: { fontSize: 9, fontWeight: "900" }, customer: { marginTop: 12, fontSize: 14, fontWeight: "800" }, address: { marginTop: 3, fontSize: 11, lineHeight: 16 }, details: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, rowGap: 10 }, detail: { width: "50%", paddingRight: 8 }, detailLabel: { fontSize: 9, fontWeight: "700" }, detailValue: { marginTop: 2, fontSize: 10, lineHeight: 14, fontWeight: "700" }, actions: { marginTop: 13, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 8 }, primaryAction: { flex: 1, minHeight: 38, borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, primaryText: { fontSize: 11, fontWeight: "900" }, iconAction: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
