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
import { createShipment } from "../utilities/FirebaseFunctions";

const EMPTY_FORM = {
  senderName: "",
  senderPhone: "",
  recipientName: "",
  recipientPhone: "",
  municipality: "",
  address: "",
  origin: "",
  destination: "",
  description: "",
  quantity: "1",
  remarks: "",
};

export default function ManagerCreateShipmentModal({
  visible,
  scope,
  onClose,
  onCreated,
}) {
  const { colors } = useTheme();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const warehouses = useMemo(() => scope?.warehouses || [], [scope]);
  const municipalities = useMemo(
    () => scope?.municipalities || [],
    [scope],
  );

  useEffect(() => {
    if (!visible) return;
    const warehouse = warehouses[0] || "";
    const municipality = municipalities[0] || "";
    setForm({
      ...EMPTY_FORM,
      origin: warehouse,
      destination: warehouse,
      municipality,
    });
  }, [visible, warehouses, municipalities]);

  const setField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    const quantity = Number(form.quantity);
    if (
      !form.senderName.trim() ||
      !form.senderPhone.trim() ||
      !form.recipientName.trim() ||
      !form.recipientPhone.trim() ||
      !form.origin.trim() ||
      !form.destination.trim() ||
      !form.description.trim() ||
      !Number.isFinite(quantity) ||
      quantity < 1
    ) {
      Alert.alert("Missing information", "Complete all required shipment fields.");
      return;
    }

    try {
      setSaving(true);
      const response = await createShipment({
        sender: {
          name: form.senderName.trim(),
          phone: form.senderPhone.trim(),
          address: {
            city: form.origin.trim(),
            province: "Philippines",
          },
        },
        recipient: {
          name: form.recipientName.trim(),
          phone: form.recipientPhone.trim(),
          address: {
            street: form.address.trim(),
            city: form.municipality.trim() || form.destination.trim(),
            municipality: form.municipality.trim() || null,
            province: "Romblon",
          },
        },
        origin: form.origin.trim(),
        originCode: form.origin.trim(),
        destination: form.destination.trim(),
        destinationCode: form.destination.trim(),
        municipality: form.municipality.trim() || null,
        items: [
          {
            description: form.description.trim(),
            quantity,
            packagingGroup: "SINGLE",
            packagingType: "Box",
          },
        ],
        remarks: form.remarks.trim(),
        status: "RECEIVED",
        currentLocation: form.origin.trim(),
        notifySms: false,
        notifyEmail: false,
        notifyPush: false,
      });
      Alert.alert(
        "Shipment created",
        response?.data?.shipmentId || "The shipment was created successfully.",
      );
      onClose();
      await onCreated?.();
    } catch (error) {
      Alert.alert("Shipment not created", error.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => !saving && onClose()}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: colors.text }]}>Create shipment</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                New warehouse shipment inside your authorized scope
              </Text>
            </View>
            <Pressable
              disabled={saving}
              onPress={onClose}
              style={[styles.close, { backgroundColor: colors.cardMuted }]}
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
          >
            <Section label="Sender" colors={colors} />
            <Field label="Full name *" value={form.senderName} onChangeText={(value) => setField("senderName", value)} colors={colors} />
            <Field label="Phone *" value={form.senderPhone} onChangeText={(value) => setField("senderPhone", value)} keyboardType="phone-pad" colors={colors} />
            <Section label="Recipient" colors={colors} />
            <Field label="Full name *" value={form.recipientName} onChangeText={(value) => setField("recipientName", value)} colors={colors} />
            <Field label="Phone *" value={form.recipientPhone} onChangeText={(value) => setField("recipientPhone", value)} keyboardType="phone-pad" colors={colors} />
            {municipalities.length ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>MUNICIPALITY *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chips}>
                    {municipalities.map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => setField("municipality", value)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor:
                              form.municipality === value ? "#0f766e" : colors.cardMuted,
                            borderColor:
                              form.municipality === value ? "#0f766e" : colors.border,
                          },
                        ]}
                      >
                        <Text style={{ color: form.municipality === value ? "#fff" : colors.text, fontWeight: "700" }}>
                          {value}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </>
            ) : (
              <Field label="Municipality" value={form.municipality} onChangeText={(value) => setField("municipality", value)} colors={colors} />
            )}
            <Field label="Street / barangay" value={form.address} onChangeText={(value) => setField("address", value)} colors={colors} />
            <Section label="Route and package" colors={colors} />
            <Field label="Origin warehouse *" value={form.origin} onChangeText={(value) => setField("origin", value)} colors={colors} />
            <Field label="Destination warehouse *" value={form.destination} onChangeText={(value) => setField("destination", value)} colors={colors} />
            <Field label="Package description *" value={form.description} onChangeText={(value) => setField("description", value)} colors={colors} />
            <Field label="Quantity *" value={form.quantity} onChangeText={(value) => setField("quantity", value)} keyboardType="number-pad" colors={colors} />
            <Field label="Remarks" value={form.remarks} onChangeText={(value) => setField("remarks", value)} multiline colors={colors} />
          </ScrollView>
          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            <Pressable disabled={saving} onPress={onClose} style={[styles.button, { borderColor: colors.border }]}>
              <Text style={[styles.cancel, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={save} style={[styles.button, styles.primary]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create shipment</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Section({ label, colors }) {
  return <Text style={[styles.section, { color: colors.text }]}>{label}</Text>;
}

function Field({ label, colors, multiline = false, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          multiline && styles.multiline,
          { color: colors.text, backgroundColor: colors.cardMuted, borderColor: colors.border },
        ]}
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
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  close: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  scroll: { flexGrow: 0 },
  form: { paddingHorizontal: 18, paddingBottom: 18, gap: 11 },
  section: { fontSize: 15, fontWeight: "900", marginTop: 5 },
  field: { gap: 5 },
  label: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  input: { minHeight: 47, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, fontSize: 14 },
  multiline: { minHeight: 82, paddingTop: 12, textAlignVertical: "top" },
  chips: { flexDirection: "row", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 10, padding: 16 },
  button: { flex: 1, minHeight: 49, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  cancel: { fontWeight: "800" },
  primaryText: { color: "#fff", fontWeight: "900" },
});
