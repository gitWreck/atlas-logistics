import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function ProfileViewer({ user, onUpdate, updating }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    password: "",
    address: {
      unit: user?.address?.unit || "",
      street: user?.address?.street || "",
      barangay: user?.address?.barangay || "",
      city: user?.address?.city || "",
      province: user?.address?.province || "",
    },
  });

  const handleSave = async () => {
    if (!formData.name.trim()) return Alert.alert("Error", "Name is required");

    // Logic to only send password if it's actually filled
    const updatePayload = { ...formData };
    if (!formData.password) delete updatePayload.password;

    const success = await onUpdate(updatePayload);
    if (success) setIsEditing(false);
  };

  const renderField = (label, value, key, isAddress = false) => {
    return (
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{label}</Text>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={(text) => {
              if (isAddress) {
                setFormData({
                  ...formData,
                  address: { ...formData.address, [key]: text },
                });
              } else {
                setFormData({ ...formData, [key]: text });
              }
            }}
            placeholder={`Enter ${label}`}
          />
        ) : (
          <Text style={styles.valueText}>{value || "Not Set"}</Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Account Details</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Text style={styles.editToggle}>
              {isEditing ? "Cancel" : "Edit Profile"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* BASIC INFO */}
        {renderField("Full Name", formData.name, "name")}

        {isEditing && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>New Password (Optional)</Text>
            <TextInput
              style={styles.input}
              value={formData.password}
              onChangeText={(text) =>
                setFormData({ ...formData, password: text })
              }
              placeholder="Leave blank to keep current"
              secureTextEntry
            />
          </View>
        )}

        {/* ADDRESS SECTION (Only if role is customer or in edit mode) */}
        {(user?.role === "customer" || isEditing) && (
          <View style={styles.addressSection}>
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionTitle}>Shipping Address</Text>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                {renderField("Unit/No.", formData.address.unit, "unit", true)}
              </View>
              <View style={{ flex: 2, marginLeft: 10 }}>
                {renderField("Street", formData.address.street, "street", true)}
              </View>
            </View>

            {renderField(
              "Barangay",
              formData.address.barangay,
              "barangay",
              true,
            )}
            {renderField("City", formData.address.city, "city", true)}
            {renderField(
              "Province",
              formData.address.province,
              "province",
              true,
            )}
          </View>
        )}

        {isEditing && (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* READ ONLY INFO */}
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>
          Email: <Text style={styles.infoValue}>{user?.email}</Text>
        </Text>
        <Text style={styles.infoLabel}>
          Phone: <Text style={styles.infoValue}>+{user?.phoneNumber}</Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f8fafc" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  editToggle: { color: "#3b82f6", fontWeight: "600" },
  fieldGroup: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  valueText: { fontSize: 15, color: "#1e293b", fontWeight: "500" },
  input: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#1e293b",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionDivider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 15,
  },
  row: { flexDirection: "row" },
  saveBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  infoCard: { marginTop: 20, padding: 16, alignItems: "center" },
  infoLabel: { color: "#94a3b8", fontSize: 13, marginBottom: 4 },
  infoValue: { color: "#475569", fontWeight: "600" },
});
