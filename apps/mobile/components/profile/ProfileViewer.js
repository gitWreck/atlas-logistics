import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { normalizePhoneNumber } from "../utilities/helpers";
import { useAuth } from "../../contexts/AuthContext";
import { updateUserProfileMobile } from "../utilities/FirebaseFunctions";
import AtlasInput from "../ui/AtlasInput";

export default function ProfileViewer() {
  const router = useRouter();
  const { user, refreshUser, signOut } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const isCustomer = user?.role === "customer";
  const isStaff = user?.role === "checker" || user?.role === "driver";

  const [formData, setFormData] = useState({
    name: user?.name || "",
    phoneNumber: user?.phoneNumber || "",
    password: "",
    confirmPassword: "",
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

    // 1. Password Match Check
    const hasPassword =
      formData.password && formData.password.trim().length > 0;
    if (hasPassword) {
      if (formData.password.length < 6)
        return Alert.alert("Error", "Password too short");
      if (formData.password !== formData.confirmPassword)
        return Alert.alert("Error", "Passwords do not match");
    }

    setLoading(true);
    try {
      const payload = {
        targetUid: user.uid,
        name: formData.name,
      };

      if (isCustomer) {
        payload.phoneNumber = normalizePhoneNumber(formData.phoneNumber);
        payload.address = formData.address;
      }

      if (hasPassword) payload.password = formData.password;

      // Execute the cloud function
      await updateUserProfileMobile(payload);

      // If we reach this line, the cloud function succeeded without throwing an error.
      if (hasPassword) {
        // Show the alert, but don't wait for the user to press a button
        Alert.alert(
          "Security Update",
          "Password changed. Please log in again.",
        );

        // Immediately force the sign out and redirect
        try {
          await signOut();
        } catch (err) {
          console.log("Forced sign out error:", err);
        } finally {
          router.replace("/(auth)/login");
        }
      } else {
        await refreshUser();
        setIsEditing(false);
        Alert.alert("Success", "Profile updated!");
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const renderField = (
    label,
    value,
    key,
    isAddress = false,
    editable = true,
    isSecure = false,
  ) => {
    const showInput = isEditing && editable;

    if (showInput) {
      return (
        <AtlasInput
          label={label}
          value={isAddress ? formData.address[key] : formData[key]}
          placeholder={`Enter ${label}`}
          secureTextEntry={isSecure}
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
        />
      );
    }

    return (
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.valueText}>
          {value ? (isSecure ? "••••••••" : value) : "—"}
        </Text>
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
              {isEditing
                ? "Cancel"
                : isStaff
                  ? "Update Password"
                  : "Edit Profile"}
            </Text>
          </TouchableOpacity>
        </View>

        {renderField("Name", formData.name, "name", false, isCustomer)}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email Address</Text>
          <Text style={styles.valueText}>{user?.email}</Text>
        </View>

        {renderField(
          "Phone",
          formData.phoneNumber,
          "phoneNumber",
          false,
          isCustomer,
        )}

        {isStaff && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Warehouse</Text>
            <Text style={styles.valueText}>
              {user?.warehouseName} ({user?.warehouseCode})
            </Text>
          </View>
        )}

        {isEditing && (
          <View>
            <View style={styles.sectionDivider} />

            {renderField(
              "New Password",
              formData.password,
              "password",
              false,
              true,
              true,
            )}

            {renderField(
              "Confirm Password",
              formData.confirmPassword,
              "confirmPassword",
              false,
              true,
              true,
            )}
          </View>
        )}

        {isEditing && (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        )}
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
