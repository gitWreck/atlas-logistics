import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "../../contexts/ThemeContext";
import { createTruckTrip } from "../utilities/FirebaseFunctions";
import { displayName } from "./ManagerUI";

const TRIP_TYPES = [
  ["HUB_TRANSFER", "Transfer"],
  ["LOCAL_PICKUP", "Pickup"],
  ["DELIVERY", "Delivery"],
];

function dateInput(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

export default function ManagerCreateTripModal({
  visible,
  scope,
  staff,
  onClose,
  onCreated,
}) {
  const { colors } = useTheme();
  const drivers = useMemo(
    () => (staff || []).filter((member) => String(member.role).toLowerCase() === "driver"),
    [staff],
  );
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm({
      tripType: "HUB_TRANSFER",
      origin: scope?.warehouses?.[0] || "",
      destination: "",
      plannedDeparture: dateInput(1),
      estimatedArrival: dateInput(9),
      driverId: "",
      driverName: "",
      truckPlateNumber: "",
      helperName: "",
    });
  }, [visible, scope]);

  const setField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const selectDriver = (driver) =>
    setForm((current) => ({
      ...current,
      driverId: driver.id,
      driverName: displayName(driver),
    }));

  const save = async () => {
    if (
      !form.plannedDeparture ||
      !form.estimatedArrival ||
      !form.truckPlateNumber?.trim() ||
      (form.tripType === "HUB_TRANSFER" &&
        (!form.origin?.trim() || !form.destination?.trim()))
    ) {
      Alert.alert("Missing information", "Complete the required trip fields.");
      return;
    }
    try {
      setSaving(true);
      const response = await createTruckTrip({
        tripType: form.tripType,
        origin: form.origin?.trim() || null,
        originCode: form.origin?.trim() || null,
        destination: form.destination?.trim() || form.origin?.trim() || null,
        destinationCode:
          form.destination?.trim() || form.origin?.trim() || null,
        plannedDeparture: new Date(form.plannedDeparture).toISOString(),
        estimatedArrival: new Date(form.estimatedArrival).toISOString(),
        driverId: form.driverId || null,
        driverName: form.driverName || null,
        truckPlateNumber: form.truckPlateNumber.trim().toUpperCase(),
        helperName: form.helperName?.trim() || null,
      });
      Alert.alert(
        "Trip created",
        response?.data?.tripId || "The trip was created successfully.",
      );
      onClose();
      await onCreated?.();
    } catch (error) {
      Alert.alert("Trip not created", error.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: colors.text }]}>Create trip</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Uses the same Manager trip workflow as web
              </Text>
            </View>
            <Pressable disabled={saving} onPress={onClose} style={[styles.close, { backgroundColor: colors.cardMuted }]}>
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.textMuted }]}>TRIP TYPE</Text>
            <View style={styles.types}>
              {TRIP_TYPES.map(([value, label]) => {
                const selected = form.tripType === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setField("tripType", value)}
                    style={[
                      styles.type,
                      {
                        backgroundColor: selected ? "#0f766e" : colors.cardMuted,
                        borderColor: selected ? "#0f766e" : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? "#fff" : colors.text, fontWeight: "800", fontSize: 11 }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field label="Origin warehouse *" value={form.origin || ""} onChangeText={(value) => setField("origin", value)} colors={colors} />
            <Field label={form.tripType === "HUB_TRANSFER" ? "Destination warehouse *" : "Destination"} value={form.destination || ""} onChangeText={(value) => setField("destination", value)} colors={colors} />
            <Field label="Departure (YYYY-MM-DDTHH:mm) *" value={form.plannedDeparture || ""} onChangeText={(value) => setField("plannedDeparture", value)} colors={colors} />
            <Field label="Estimated arrival (YYYY-MM-DDTHH:mm) *" value={form.estimatedArrival || ""} onChangeText={(value) => setField("estimatedArrival", value)} colors={colors} />
            <Field label="Truck plate *" value={form.truckPlateNumber || ""} onChangeText={(value) => setField("truckPlateNumber", value)} autoCapitalize="characters" colors={colors} />
            <Field label="Helper" value={form.helperName || ""} onChangeText={(value) => setField("helperName", value)} colors={colors} />
            {drivers.length ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>AUTHORIZED DRIVER</Text>
                <View style={styles.driverList}>
                  {drivers.map((driver) => {
                    const selected = form.driverId === driver.id;
                    return (
                      <Pressable
                        key={driver.id}
                        onPress={() => selectDriver(driver)}
                        style={[
                          styles.driver,
                          {
                            borderColor: selected ? "#0f766e" : colors.border,
                            backgroundColor: selected ? colors.cardMuted : colors.surface,
                          },
                        ]}
                      >
                        <Feather name={selected ? "check-circle" : "user"} size={16} color={selected ? "#0f766e" : colors.textMuted} />
                        <Text style={[styles.driverText, { color: colors.text }]}>{displayName(driver)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </ScrollView>
          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            <Pressable disabled={saving} onPress={onClose} style={[styles.button, { borderColor: colors.border }]}>
              <Text style={[styles.cancel, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={save} style={[styles.button, styles.primary]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create trip</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, colors, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text, backgroundColor: colors.cardMuted, borderColor: colors.border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.58)" },
  sheet: { maxHeight: "94%", borderTopLeftRadius: 25, borderTopRightRadius: 25, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", padding: 18, gap: 12 },
  headerCopy: { flex: 1 },
  title: { fontSize: 20, fontWeight: "900" },
  subtitle: { fontSize: 12, marginTop: 3 },
  close: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  form: { paddingHorizontal: 18, paddingBottom: 20, gap: 12 },
  label: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  types: { flexDirection: "row", gap: 8 },
  type: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  field: { gap: 5 },
  input: { minHeight: 47, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, fontSize: 14 },
  driverList: { gap: 8 },
  driver: { minHeight: 45, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  driverText: { flex: 1, fontWeight: "700" },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 10, padding: 16 },
  button: { flex: 1, minHeight: 49, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  cancel: { fontWeight: "800" },
  primaryText: { color: "#fff", fontWeight: "900" },
});
