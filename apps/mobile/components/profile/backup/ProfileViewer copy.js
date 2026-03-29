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
import { normalizePhoneNumber } from "../../utilities/helpers";

export default function ProfileViewer({ user, onUpdate, updating }) {
  // const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  // Role checks
  const isCustomer = user?.role === "customer";
  const isStaff = user?.role === "checker" || user?.role === "driver";

  console.log("Rendering ProfileViewer for user:", user);

  const [formData, setFormData] = useState({
    name: user?.name || "",
    phoneNumber: user?.phoneNumber || "",
    password: "",
    confirmPassword: "", // ✅ Added this
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

    // ✅ New Password Validation
    if (formData.password) {
      if (formData.password.length < 6) {
        return Alert.alert("Error", "Password must be at least 6 characters");
      }
      if (formData.password !== formData.confirmPassword) {
        return Alert.alert("Error", "Passwords do not match");
      }
    }

    // 1. Validate Phone if Customer
    let normalizedPhone = formData.phoneNumber;
    if (isCustomer) {
      normalizedPhone = normalizePhoneNumber(formData.phoneNumber);
      if (!normalizedPhone) {
        return Alert.alert(
          "Error",
          "Please enter a valid PH phone number (e.g. 0917...)",
        );
      }
    }

    const updatePayload = {
      uid: user.uid,
      targetUid: user.uid, // Assuming users can only update their own profile
      name: formData.name,
    };

    // If customer, include phone and address updates
    if (isCustomer) {
      updatePayload.phoneNumber = normalizedPhone;
      updatePayload.address = {
        unit: formData.address.unit,
        street: formData.address.street,
        barangay: formData.address.barangay,
        city: formData.address.city,
        province: formData.address.province,
      };
    }

    if (formData.password) {
      if (formData.password.length < 6) {
        return Alert.alert("Error", "Password must be at least 6 characters");
      }
      updatePayload.password = formData.password;
    }

    const success = await onUpdate(updatePayload);
    if (success) {
      setIsEditing(false);
      setFormData((prev) => ({ ...prev, password: "" })); // Clear password field
    }
  };

  const renderField = (
    label,
    value,
    key,
    isAddress = false,
    editable = true,
  ) => {
    const showInput = isEditing && editable;

    return (
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{label}</Text>
        {showInput ? (
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
          <Text style={styles.valueText}>{value || "—"}</Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Account Details</Text>
          <TouchableOpacity
            onPress={() => {
              if (isEditing) {
                // Clear passwords on cancel
                setFormData((prev) => ({
                  ...prev,
                  password: "",
                  confirmPassword: "",
                }));
              }
              setIsEditing(!isEditing);
            }}
          >
            <Text style={styles.editToggle}>
              {isEditing ? "Cancel" : "Edit Profile"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* SECTION: IDENTITY */}
        {renderField("Name", formData.name, "name", false, isCustomer)}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email Address</Text>
          <Text style={styles.valueText}>{user?.email}</Text>
          {!!isCustomer && (
            <Text style={styles.lockedNote}>Email cannot be changed</Text>
          )}
        </View>

        {renderField(
          "Phone Number",
          formData.phoneNumber,
          "phoneNumber",
          false,
          isCustomer,
        )}

        {/* SECTION: STAFF SPECIFIC */}
        {isStaff && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Assigned Warehouse</Text>
            <Text style={styles.valueText}>
              {/* Check both common naming conventions */}
              {user?.warehouseName || "No Warehouse Name"} (
              {user?.warehouseCode || user?.warehouseId || "N/A"})
            </Text>
          </View>
        )}

        {/* SECTION: PASSWORD (Editable for everyone) */}
        {isEditing && (
          <View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New Password</Text>
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

            {/* ✅ ADDED: Confirm Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                value={formData.confirmPassword}
                onChangeText={(text) =>
                  setFormData({ ...formData, confirmPassword: text })
                }
                placeholder="Repeat your new password"
                secureTextEntry
              />
            </View>
          </View>
        )}

        {/* SECTION: ADDRESS (Customer only or Editing) */}
        {isCustomer && (
          <View style={styles.addressSection}>
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionTitle}>Shipping Address</Text>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                {renderField(
                  "Unit/No.",
                  formData.address.unit,
                  "unit",
                  true,
                  true,
                )}
              </View>
              <View style={{ flex: 2, marginLeft: 10 }}>
                {renderField(
                  "Street",
                  formData.address.street,
                  "street",
                  true,
                  true,
                )}
              </View>
            </View>

            {renderField(
              "Barangay",
              formData.address.barangay,
              "barangay",
              true,
              true,
            )}
            {renderField("City", formData.address.city, "city", true, true)}
            {renderField(
              "Province",
              formData.address.province,
              "province",
              true,
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

      <View style={styles.footer}>
        <Text style={styles.footerText}>UID: {user?.uid}</Text>
        <Text style={styles.footerText}>Role: {user?.role?.toUpperCase()}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 35,
    paddingHorizontal: 16,
    backgroundColor: "#f8fafc",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    marginBottom: 30,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  editToggle: { color: "#3b82f6", fontWeight: "600" },
  fieldGroup: { marginBottom: 18 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  valueText: { fontSize: 15, color: "#1e293b", fontWeight: "500" },
  lockedNote: {
    fontSize: 10,
    color: "#cbd5e1",
    marginTop: 2,
    fontStyle: "italic",
  },
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
  footer: { alignItems: "center", marginBottom: 40 },
  footerText: { fontSize: 10, color: "#cbd5e1", marginBottom: 4 },
});
