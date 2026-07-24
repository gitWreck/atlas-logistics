import React, { useEffect, useState } from "react";
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
import { useTheme } from "../../contexts/ThemeContext";
import {
  createInvoice,
  createUserProfile,
  upsertTruck,
} from "../utilities/FirebaseFunctions";

const EMPTY = {
  plateNumber: "",
  model: "",
  type: "10-Wheeler Wing Van",
  payloadCapacity: "",
  currentOdometer: "0",
  lastPmsOdometer: "0",
  email: "",
  password: "",
  displayName: "",
  phoneNumber: "",
  city: "",
  shipmentId: "",
  billingName: "",
  billingAddress: "",
  amount: "",
  dueDate: "",
};

const CONFIG = {
  trucks: {
    title: "Register Truck",
    fields: [
      ["plateNumber", "Plate Number"],
      ["model", "Truck Model"],
      ["type", "Truck Type"],
      ["payloadCapacity", "Payload Capacity (kg)", "numeric"],
      ["currentOdometer", "Current Odometer", "numeric"],
      ["lastPmsOdometer", "Last PMS Odometer", "numeric"],
    ],
  },
  customers: {
    title: "Add Customer",
    fields: [
      ["displayName", "Full Name"],
      ["email", "Email", "email-address"],
      ["password", "Temporary Password", "default", true],
      ["phoneNumber", "Phone"],
      ["city", "Municipality"],
    ],
  },
  invoices: {
    title: "Create Invoice",
    fields: [
      ["shipmentId", "Shipment ID"],
      ["billingName", "Billing Name"],
      ["billingAddress", "Billing Address"],
      ["amount", "Amount", "numeric"],
      ["dueDate", "Due Date (YYYY-MM-DD)"],
    ],
  },
};

export default function ManagerQuickCreateModal({
  type,
  visible,
  scope,
  onClose,
  onCreated,
}) {
  const { colors } = useTheme();
  const config = CONFIG[type];
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (visible) setForm(EMPTY);
  }, [visible, type]);
  if (!config) return null;

  const submit = async () => {
    try {
      setSaving(true);
      if (type === "trucks") {
        await upsertTruck({
          ...form,
          status: "IDLE",
          plateNumber: form.plateNumber.toUpperCase(),
          payloadCapacity: Number(form.payloadCapacity),
          currentOdometer: Number(form.currentOdometer),
          lastPmsOdometer: Number(form.lastPmsOdometer),
          warehouseCode: scope?.warehouses?.[0],
        });
      } else if (type === "customers") {
        await createUserProfile({
          email: form.email.trim(),
          password: form.password,
          displayName: form.displayName.trim(),
          role: "customer",
          phoneNumber: form.phoneNumber,
          city: form.city,
          warehouseCode: scope?.warehouses?.[0],
          warehouseName: scope?.warehouses?.[0],
        });
      } else {
        await createInvoice({
          shipmentId: form.shipmentId.trim(),
          billingName: form.billingName.trim(),
          billingAddress: form.billingAddress.trim(),
          amount: Number(form.amount),
          dueDate: form.dueDate || null,
          status: "DRAFT",
        });
      }
      onClose();
      await onCreated?.();
    } catch (error) {
      Alert.alert(`${config.title} failed`, error.message || "Please check the form and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>{config.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Web business rules and your assigned scope are enforced on save.
          </Text>
          <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
            {config.fields.map(([field, label, keyboardType = "default", secure = false]) => (
              <View key={field} style={styles.field}>
                <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
                <TextInput
                  value={form[field]}
                  onChangeText={(value) => setForm((current) => ({ ...current, [field]: value }))}
                  keyboardType={keyboardType}
                  secureTextEntry={secure}
                  autoCapitalize={field === "email" ? "none" : "sentences"}
                  style={[styles.input, { color: colors.text, backgroundColor: colors.cardMuted, borderColor: colors.border }]}
                  placeholder={label}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable disabled={saving} onPress={onClose} style={[styles.button, { borderColor: colors.border }]}>
              <Text style={[styles.cancel, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={submit} style={[styles.button, styles.save, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.55)" },
  sheet: { maxHeight: "90%", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 28 },
  title: { fontSize: 21, fontWeight: "900" },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  form: { marginTop: 15 },
  field: { marginBottom: 12 },
  label: { fontSize: 10, fontWeight: "900", marginBottom: 5, textTransform: "uppercase" },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14 },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  button: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  save: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  cancel: { fontWeight: "800" },
  saveText: { color: "#fff", fontWeight: "900" },
  disabled: { opacity: 0.6 },
});
