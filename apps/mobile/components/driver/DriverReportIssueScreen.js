import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { storage } from "../../firebase";
import { useTheme } from "../../contexts/ThemeContext";
import { reportDriverTripIssue } from "../utilities/FirebaseFunctions";
import { getCurrentLocationSafe } from "../utilities/helpers";
import { DriverPageHeader } from "./DriverUI";

const TYPES = ["Vehicle Breakdown", "Traffic Delay", "Accident", "Road Closure", "Weather Delay", "Other"];

export default function DriverReportIssueScreen() {
  const { tripId } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [location, setLocation] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const choosePhoto = async () => { const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (permission.status !== "granted") return Alert.alert("Permission required", "Allow photo access to attach an issue photo."); const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.72, allowsEditing: false }); if (!result.canceled) setPhoto(result.assets[0]); };
  const locate = async () => { const next = await getCurrentLocationSafe(); if (!next) return Alert.alert("Location unavailable", "Location permission is required or a GPS position could not be obtained."); setLocation(next); };
  const upload = async () => { if (!photo?.uri) return null; const response = await fetch(photo.uri); const blob = await response.blob(); const target = ref(storage, `trip-issues/${String(tripId)}/${Date.now()}-driver.jpg`); await uploadBytes(target, blob, { contentType: photo.mimeType || "image/jpeg" }); return getDownloadURL(target); };
  const submit = async () => { if (!tripId) return Alert.alert("Trip required", "Open Report Issue from an assigned trip."); if (!type) return Alert.alert("Issue type required", "Select the issue type."); if (!description.trim()) return Alert.alert("Description required", "Describe what happened."); setSubmitting(true); try { const photoURL = await upload(); await reportDriverTripIssue({ tripId: String(tripId), issueType: type, description: description.trim(), photoURL, location }); Alert.alert("Issue reported", "The assigned Checker and Manager have been notified.", [{ text: "OK", onPress: () => router.back() }]); } catch (error) { Alert.alert("Unable to report issue", error?.message || "Please try again."); } finally { setSubmitting(false); } };
  return <View style={[styles.screen, { backgroundColor: colors.dashboardBg }]}><DriverPageHeader title="Report Issue" onBack={() => router.back()} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={[styles.label, { color: colors.text }]}>Issue Type</Text><TouchableOpacity style={[styles.select, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => setPickerOpen(true)}><Text style={[styles.selectText, { color: type ? colors.text : colors.textMuted }]}>{type || "Select issue type"}</Text><Feather name="chevron-down" size={17} color={colors.textMuted} /></TouchableOpacity>
      <Text style={[styles.label, { color: colors.text }]}>Description</Text><TextInput multiline value={description} onChangeText={setDescription} placeholder="Enter description" placeholderTextColor={colors.textMuted} style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} />
      {photo ? <Image source={{ uri: photo.uri }} style={styles.photo} /> : null}
      <View style={styles.tools}><TouchableOpacity style={[styles.tool, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={choosePhoto}><Feather name="camera" size={16} color={colors.primary} /><Text style={[styles.toolText, { color: colors.text }]}>{photo ? "Change Photo" : "Add Photo"}</Text></TouchableOpacity><TouchableOpacity style={[styles.tool, { backgroundColor: colors.surface, borderColor: location ? colors.success : colors.border }]} onPress={locate}><Feather name={location ? "check-circle" : "map-pin"} size={16} color={location ? colors.success : colors.primary} /><Text style={[styles.toolText, { color: colors.text }]}>{location ? "Location Added" : "Use Location"}</Text></TouchableOpacity></View>
      <TouchableOpacity style={[styles.submit, { backgroundColor: colors.primary }]} onPress={submit} disabled={submitting}>{submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Report</Text>}</TouchableOpacity>
    </ScrollView>
    <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}><Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}><Pressable style={[styles.modal, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}><Text style={[styles.modalTitle, { color: colors.text }]}>Select Issue Type</Text>{TYPES.map((item) => <TouchableOpacity key={item} style={[styles.option, { borderTopColor: colors.border }]} onPress={() => { setType(item); setPickerOpen(false); }}><Text style={[styles.optionText, { color: colors.text }]}>{item}</Text>{type === item ? <Feather name="check" size={17} color={colors.primary} /> : null}</TouchableOpacity>)}</Pressable></Pressable></Modal>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { padding: 14, paddingBottom: 30 }, label: { marginTop: 10, marginBottom: 7, fontSize: 10, fontWeight: "800" }, select: { height: 43, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }, selectText: { flex: 1, fontSize: 10 }, input: { minHeight: 104, borderRadius: 8, borderWidth: 1, padding: 12, textAlignVertical: "top", fontSize: 10, lineHeight: 15 }, photo: { marginTop: 11, width: "100%", height: 145, borderRadius: 10 }, tools: { marginTop: 12, flexDirection: "row", gap: 8 }, tool: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, toolText: { fontSize: 9, fontWeight: "800" }, submit: { marginTop: 18, height: 43, borderRadius: 7, alignItems: "center", justifyContent: "center" }, submitText: { color: "#fff", fontSize: 10, fontWeight: "900" }, backdrop: { flex: 1, backgroundColor: "rgba(2,8,23,.55)", justifyContent: "center", padding: 22 }, modal: { borderRadius: 14, padding: 14 }, modalTitle: { fontSize: 14, fontWeight: "900", marginBottom: 8 }, option: { height: 43, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center" }, optionText: { flex: 1, fontSize: 11, fontWeight: "700" } });
