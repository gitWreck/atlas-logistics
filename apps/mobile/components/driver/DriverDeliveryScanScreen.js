import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, PanResponder, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Polyline } from "react-native-svg";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { storage } from "../../firebase";
import { useTheme } from "../../contexts/ThemeContext";
import useDriverOperations from "../../hooks/useDriverOperations";
import { updateShipmentStatus } from "../utilities/FirebaseFunctions";
import { getCurrentLocationSafe } from "../utilities/helpers";
import ScannerCameraPane from "../scanner/ScannerCameraPane";
import { manilaDateKey, shipmentAddress, shipmentRecipient } from "./driverData";

const RETURN_REASONS = [
  ["CUSTOMER_REFUSED", "Customer Refused", "FAILED_DELIVERY"],
  ["CUSTOMER_UNAVAILABLE", "Customer Unavailable", "FAILED_DELIVERY"],
  ["RETURN_TO_WAREHOUSE", "Return to Warehouse", "FAILED_DELIVERY"],
  ["RESCHEDULE_DELIVERY", "Reschedule Delivery", "FAILED_DELIVERY"],
  ["WRONG_ADDRESS", "Wrong Address", "FAILED_DELIVERY"],
  ["CUSTOMER_CANCELLED", "Customer Cancelled", "CANCELLED"],
  ["DAMAGED_PACKAGE", "Damaged Package", "DAMAGED"],
];

function codesFor(shipment) {
  return [shipment.id, shipment.shipmentId, shipment.trackingNumber, shipment.trackingShipmentId, ...(Array.isArray(shipment.packages) ? shipment.packages.flatMap((pkg) => [pkg.packageId, pkg.trackingNumber]) : [])]
    .filter(Boolean).map((value) => String(value).trim().toUpperCase());
}

function SignaturePad({ points, onChange, colors }) {
  const current = useRef([]);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => { current.current = [{ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }]; onChange([...current.current]); },
    onPanResponderMove: (event) => { current.current.push({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }); onChange([...current.current]); },
  }), [onChange]);
  const polyline = points.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(" ");
  return <View style={[styles.signature, { backgroundColor: colors.inputBg, borderColor: colors.border }]} {...responder.panHandlers}><Svg width="100%" height="100%"><Polyline points={polyline} fill="none" stroke={colors.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></Svg>{points.length === 0 ? <Text pointerEvents="none" style={[styles.signatureHint, { color: colors.textMuted }]}>Sign inside this box</Text> : null}</View>;
}

export default function DriverDeliveryScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mode = String(params.mode || "delivery");
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const data = useDriverOperations(String(params.date || manilaDateKey()));
  const [flash, setFlash] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [shipment, setShipment] = useState(null);
  const [manual, setManual] = useState("");
  const [podOpen, setPodOpen] = useState(false);
  const [receiverName, setReceiverName] = useState("");
  const [signature, setSignature] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const assigned = useMemo(() => {
    const source = params.tripId ? data.trips.find((trip) => trip.id === String(params.tripId)) : data.activeTrip || data.primaryTrip;
    const rows = source ? data.shipmentsByTrip?.[source.id] || data.shipments : data.shipments;
    return params.shipmentId ? rows.filter((item) => item.id === String(params.shipmentId)) : rows;
  }, [data, params.shipmentId, params.tripId]);

  const acceptCode = (raw) => {
    const code = String(raw || "").trim().toUpperCase();
    const match = assigned.find((item) => codesFor(item).includes(code));
    if (!match) {
      setScanned(true);
      Alert.alert("Delivery not authorized", "This package is not assigned to your Driver trip.", [{ text: "Scan again", onPress: () => setScanned(false) }]);
      return;
    }
    setShipment(match);
    setScanned(true);
  };

  const choosePhoto = async () => {
    const result = Platform.OS === "web"
      ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 })
      : await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 });
    if (!result.canceled && result.assets?.[0]?.uri) setPhoto(result.assets[0]);
  };

  const uploadPhoto = async () => {
    const response = await fetch(photo.uri);
    const blob = await response.blob();
    const target = ref(storage, `delivery-proofs/${shipment.id}/${Date.now()}-driver.jpg`);
    await uploadBytes(target, blob, { contentType: photo.mimeType || "image/jpeg" });
    return getDownloadURL(target);
  };

  const finishDelivery = async () => {
    if (!receiverName.trim() || signature.length < 2 || !photo) return Alert.alert("Proof incomplete", "Receiver name, signature, and delivery photo are required.");
    setSaving(true);
    try {
      const gps = await getCurrentLocationSafe();
      if (!gps) throw new Error("GPS coordinates are required. Enable location access and try again.");
      const photoUrl = await uploadPhoto();
      await updateShipmentStatus({ shipmentId: shipment.id, tripId: shipment.tripId || String(params.tripId || ""), newStatus: "DELIVERED", receiverName: receiverName.trim(), receiverSignature: { points: signature, capturedAt: new Date().toISOString() }, proofOfDelivery: [photoUrl], gpsCoordinates: gps, location: `${gps.lat},${gps.lng}`, remarks: remarks.trim() || `Received by ${receiverName.trim()}.`, sourceUI: "DRIVER_MOBILE" });
      Alert.alert("Delivery completed", "Proof of delivery was saved successfully.", [{ text: "Done", onPress: () => router.replace("/(driver)/(tabs)/deliveries") }]);
    } catch (error) { Alert.alert("Delivery not completed", error?.message || "Please try again."); }
    finally { setSaving(false); }
  };

  const recordReturn = async ([code, label, nextStatus]) => {
    setSaving(true);
    try {
      const gps = await getCurrentLocationSafe();
      await updateShipmentStatus({ shipmentId: shipment.id, tripId: shipment.tripId || String(params.tripId || ""), newStatus: nextStatus, failureReasonCode: code, returnDisposition: code, gpsCoordinates: gps, location: gps ? `${gps.lat},${gps.lng}` : null, remarks: label, sourceUI: "DRIVER_MOBILE" });
      Alert.alert("Delivery updated", `${label} was recorded.`, [{ text: "Done", onPress: () => router.replace("/(driver)/(tabs)/deliveries") }]);
    } catch (error) { Alert.alert("Update failed", error?.message || "Please try again."); }
    finally { setSaving(false); }
  };

  if (!permission) return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!permission.granted) return <View style={[styles.permission, { backgroundColor: colors.bg }]}><Feather name="camera" size={36} color={colors.primary} /><Text style={[styles.permissionTitle, { color: colors.text }]}>Camera access required</Text><Text style={[styles.permissionText, { color: colors.textMuted }]}>Delivery and return scans verify that the package belongs to your assigned trip.</Text><TouchableOpacity style={[styles.permissionButton, { backgroundColor: colors.primary }]} onPress={requestPermission}><Text style={{ color: colors.onPrimary, fontWeight: "900" }}>Allow Camera</Text></TouchableOpacity><TouchableOpacity onPress={() => router.back()}><Text style={{ color: colors.primary, fontWeight: "800" }}>Go back</Text></TouchableOpacity></View>;

  return <View style={styles.screen}>
    <ScannerCameraPane scanned={scanned} processing={saving} flashEnabled={flash} modeLabel={mode === "return" ? "Return Scan" : "Delivery Scan"} detailsSheetHeight={shipment ? 330 : 140} onBack={() => router.back()} onToggleFlash={() => setFlash((value) => !value)} onBarcodeScanned={({ data: value }) => acceptCode(value)} />
    <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {!shipment ? <><Text style={[styles.sheetTitle, { color: colors.text }]}>Scan assigned package</Text><Text style={[styles.sheetText, { color: colors.textMuted }]}>Load and offload modes are not available to Drivers.</Text><View style={styles.manualRow}><TextInput value={manual} onChangeText={setManual} placeholder="Enter tracking number" placeholderTextColor={colors.textMuted} style={[styles.manualInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} /><TouchableOpacity style={[styles.manualButton, { backgroundColor: colors.primary }]} onPress={() => acceptCode(manual)}><Feather name="arrow-right" size={18} color={colors.onPrimary} /></TouchableOpacity></View></> : <ScrollView><View style={styles.verified}><Feather name="check-circle" size={18} color={colors.success} /><Text style={[styles.verifiedText, { color: colors.success }]}>Assigned delivery verified</Text></View><Text style={[styles.customer, { color: colors.text }]}>{shipmentRecipient(shipment)}</Text><Text style={[styles.address, { color: colors.textMuted }]}>{shipmentAddress(shipment)}</Text><Text style={[styles.tracking, { color: colors.textMuted }]}>{shipment.shipmentId || shipment.trackingNumber || shipment.id}</Text>{mode === "return" ? <View style={styles.reasonList}>{RETURN_REASONS.map((reason) => <TouchableOpacity key={reason[0]} disabled={saving} style={[styles.reason, { borderColor: colors.border }]} onPress={() => recordReturn(reason)}><Text style={[styles.reasonText, { color: colors.text }]}>{reason[1]}</Text><Feather name="chevron-right" size={18} color={colors.textMuted} /></TouchableOpacity>)}</View> : <View style={styles.deliveryActions}><TouchableOpacity style={[styles.deliverButton, { backgroundColor: colors.success }]} onPress={() => setPodOpen(true)}><Feather name="check-circle" size={18} color="#fff" /><Text style={styles.deliverText}>Delivered — Add Proof</Text></TouchableOpacity><TouchableOpacity style={[styles.failButton, { borderColor: colors.danger }]} onPress={() => router.setParams({ mode: "return" })}><Text style={[styles.failText, { color: colors.danger }]}>Failed Delivery</Text></TouchableOpacity></View>}</ScrollView>}
    </View>
    <Modal visible={podOpen} transparent animationType="slide" onRequestClose={() => !saving && setPodOpen(false)}><View style={styles.modalBackdrop}><ScrollView contentContainerStyle={[styles.pod, { backgroundColor: colors.surface }]}><View style={styles.podHeader}><Text style={[styles.podTitle, { color: colors.text }]}>Proof of Delivery</Text><TouchableOpacity disabled={saving} onPress={() => setPodOpen(false)}><Feather name="x" size={22} color={colors.text} /></TouchableOpacity></View><TextInput value={receiverName} onChangeText={setReceiverName} placeholder="Receiver name" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} /><Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Receiver signature</Text><SignaturePad points={signature} onChange={setSignature} colors={colors} /><TouchableOpacity onPress={() => setSignature([])}><Text style={[styles.clear, { color: colors.primary }]}>Clear signature</Text></TouchableOpacity><Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Delivery photo</Text>{photo ? <Image source={{ uri: photo.uri }} style={styles.photo} /> : null}<TouchableOpacity style={[styles.photoButton, { borderColor: colors.primary }]} onPress={choosePhoto}><Feather name="camera" size={18} color={colors.primary} /><Text style={[styles.photoText, { color: colors.primary }]}>{photo ? "Retake Photo" : "Take Delivery Photo"}</Text></TouchableOpacity><TextInput value={remarks} onChangeText={setRemarks} placeholder="Delivery notes (optional)" placeholderTextColor={colors.textMuted} multiline style={[styles.notes, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]} /><TouchableOpacity disabled={saving} style={[styles.submit, { backgroundColor: colors.success, opacity: saving ? 0.6 : 1 }]} onPress={finishDelivery}>{saving ? <ActivityIndicator color="#fff" /> : <><Feather name="check" size={18} color="#fff" /><Text style={styles.submitText}>Complete Delivery</Text></>}</TouchableOpacity></ScrollView></View></Modal>
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#000" }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, permission: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }, permissionTitle: { fontSize: 20, fontWeight: "900" }, permissionText: { textAlign: "center", lineHeight: 20 }, permissionButton: { height: 48, borderRadius: 12, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" }, sheet: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 140, maxHeight: 360, borderTopWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 }, sheetTitle: { fontSize: 17, fontWeight: "900" }, sheetText: { marginTop: 5, fontSize: 11 }, manualRow: { marginTop: 14, flexDirection: "row", gap: 8 }, manualInput: { flex: 1, height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 }, manualButton: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" }, verified: { flexDirection: "row", gap: 7, alignItems: "center" }, verifiedText: { fontSize: 11, fontWeight: "900" }, customer: { marginTop: 10, fontSize: 17, fontWeight: "900" }, address: { marginTop: 4, fontSize: 12, lineHeight: 17 }, tracking: { marginTop: 4, fontSize: 10 }, deliveryActions: { marginTop: 15, gap: 9 }, deliverButton: { height: 48, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, deliverText: { color: "#fff", fontWeight: "900" }, failButton: { height: 42, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center" }, failText: { fontWeight: "800" }, reasonList: { marginTop: 12 }, reason: { minHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center" }, reasonText: { flex: 1, fontSize: 12, fontWeight: "800" }, modalBackdrop: { flex: 1, backgroundColor: "rgba(2,8,23,.6)", justifyContent: "flex-end" }, pod: { padding: 20, paddingBottom: 34, borderTopLeftRadius: 24, borderTopRightRadius: 24 }, podHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }, podTitle: { fontSize: 20, fontWeight: "900" }, input: { height: 48, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12 }, fieldLabel: { marginTop: 14, marginBottom: 7, fontSize: 10, fontWeight: "800", textTransform: "uppercase" }, signature: { height: 120, borderWidth: 1, borderRadius: 11, overflow: "hidden" }, signatureHint: { position: "absolute", alignSelf: "center", top: 50, fontSize: 12 }, clear: { marginTop: 6, fontSize: 11, fontWeight: "800", textAlign: "right" }, photo: { height: 150, borderRadius: 12, marginBottom: 9 }, photoButton: { height: 46, borderWidth: 1, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, photoText: { fontSize: 12, fontWeight: "900" }, notes: { minHeight: 72, marginTop: 12, borderWidth: 1, borderRadius: 11, padding: 12, textAlignVertical: "top" }, submit: { height: 50, borderRadius: 12, marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, submitText: { color: "#fff", fontWeight: "900" } });
