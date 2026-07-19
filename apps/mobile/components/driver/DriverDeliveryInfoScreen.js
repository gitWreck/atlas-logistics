import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";

import { db } from "../../firebase";
import { useTheme } from "../../contexts/ThemeContext";
import { DriverCard, DriverPageHeader, EmptyDriverState } from "./DriverUI";
import { shipmentAddress, shipmentRecipient } from "./driverData";

function first(row, paths, fallback = "Not provided") {
  for (const path of paths) {
    const value = path.split(".").reduce((item, key) => item?.[key], row);
    if (value !== undefined && value !== null && value !== "") return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  return fallback;
}

export default function DriverDeliveryInfoScreen() {
  const router = useRouter();
  const { shipmentId, tripId } = useLocalSearchParams();
  const { colors } = useTheme();
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const ref = tripId ? doc(db, "truck_trips", String(tripId), "trip_shipments", String(shipmentId)) : doc(db, "shipments", String(shipmentId));
        const snap = await getDoc(ref);
        if (active) setShipment(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [shipmentId, tripId]);

  const rows = shipment ? [
    ["Tracking Number", first(shipment, ["shipmentId", "trackingNumber", "trackingShipmentId", "id"], shipment.id)],
    ["Shipment ID", shipment.id],
    ["Customer Name", shipmentRecipient(shipment)],
    ["Address", shipmentAddress(shipment)],
    ["Contact Number", first(shipment, ["recipient.phone", "recipient.phoneNumber", "customerPhone", "contactNumber"])],
    ["COD Amount", Number(shipment.codAmount ?? shipment.CODAmount ?? shipment.amountToCollect ?? 0) > 0 ? `₱${Number(shipment.codAmount ?? shipment.CODAmount ?? shipment.amountToCollect).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "Not applicable"],
    ["Package Details", Array.isArray(shipment.packages) ? `${shipment.packages.length} package${shipment.packages.length === 1 ? "" : "s"}` : first(shipment, ["packageDescription", "itemDescription"])],
    ["Assigned Checker", first(shipment, ["assignedCheckerName", "checkerName"])],
    ["Vehicle", first(shipment, ["deliveryVehicleName", "truckPlateNumber", "vehiclePlate"])],
    ["Municipality", first(shipment, ["municipality", "recipient.address.municipality", "recipient.address.city"])],
    ["Warehouse", first(shipment, ["warehouseName", "origin", "warehouseCode"])],
  ] : [];

  return <View style={[styles.screen, { backgroundColor: colors.dashboardBg }]}>
    <DriverPageHeader title="Delivery Information" onBack={() => router.back()} />
    {loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View> : !shipment ? <EmptyDriverState icon="package" title="Delivery unavailable" message="This shipment is not part of your assigned trip." /> : <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.notice, { backgroundColor: colors.primarySoft }]}><Feather name="eye" size={16} color={colors.primary} /><Text style={[styles.noticeText, { color: colors.primary }]}>Read-only delivery record</Text></View>
      <DriverCard style={styles.card}>{rows.map(([label, value], index) => <View key={label} style={[styles.row, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}><Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text><Text selectable style={[styles.value, { color: colors.text }]}>{value}</Text></View>)}</DriverCard>
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, content: { padding: 16, paddingBottom: 30 }, notice: { minHeight: 42, borderRadius: 11, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }, noticeText: { fontSize: 11, fontWeight: "800" }, card: { paddingHorizontal: 14 }, row: { minHeight: 58, paddingVertical: 11, flexDirection: "row", gap: 12, alignItems: "center" }, label: { width: "38%", fontSize: 11, fontWeight: "700" }, value: { flex: 1, minWidth: 0, textAlign: "right", fontSize: 11, lineHeight: 16, fontWeight: "700" } });
