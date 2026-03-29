import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { normalizePhoneNumber } from "../utilities/helpers";
import { useAuth } from "../../contexts/AuthContext";
import { updateUserProfileMobile } from "../utilities/FirebaseFunctions";
import AtlasInput from "../ui/AtlasInput";
import DropdownModal from "../customer/RequestPickup/DropdownModal";
import { PROVINCES, getCities } from "../utilities/PhilippinesData";

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

  const [cities, setCities] = useState([]);
  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);

  // ✅ FIXED: Watch formData.address.province
  useEffect(() => {
    if (formData.address.province) {
      setCities(getCities(formData.address.province));
    } else {
      setCities([]);
    }
  }, [formData.address.province]);

  const openDropdown = (title, data, targetKey) => {
    setModalConfig({ visible: true, title, data, targetKey });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return Alert.alert("Error", "Name is required");

    if (isCustomer) {
      if (!formData.address.province || !formData.address.city) {
        return Alert.alert("Error", "Province and City are required.");
      }
    }

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

      await updateUserProfileMobile(payload);

      if (hasPassword) {
        Alert.alert(
          "Security Update",
          "Password changed. Please log in again.",
        );
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

  const renderField = ({
    label,
    value,
    stateKey,
    isAddress = false,
    editable = true,
    isSecure = false,
    type = "text",
    options = [],
  }) => {
    const showInput = isEditing && editable;

    if (showInput) {
      if (type === "dropdown") {
        return (
          <View style={styles.fieldGroup} key={stateKey}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity
              style={styles.dropdownInput}
              onPress={() => {
                // ✅ FIXED: Open the correct modal directly
                if (stateKey === "province") setShowProvinceModal(true);
                if (stateKey === "city") {
                  if (!formData.address.province) {
                    Alert.alert("Notice", "Please select a Province first.");
                    return;
                  }
                  setShowCityModal(true);
                }
              }}
            >
              <Text
                style={
                  value
                    ? styles.dropdownTextValue
                    : styles.dropdownTextPlaceholder
                }
              >
                {value || `Select ${label}`}
              </Text>

              {/* ✅ CHANGED TO FontAwesome5 */}
              <FontAwesome5 name="chevron-down" color="#94a3b8" size={12} />
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <AtlasInput
          key={stateKey}
          label={label}
          value={isAddress ? formData.address[stateKey] : formData[stateKey]}
          placeholder={`Enter ${label}`}
          secureTextEntry={isSecure}
          onChangeText={(text) => {
            if (isAddress) {
              setFormData({
                ...formData,
                address: { ...formData.address, [stateKey]: text },
              });
            } else {
              setFormData({ ...formData, [stateKey]: text });
            }
          }}
        />
      );
    }

    // Read-only View
    return (
      <View style={styles.fieldGroup} key={stateKey}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.valueText}>
          {value ? (isSecure ? "••••••••" : value) : "—"}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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

          {renderField({
            label: "Name",
            value: formData.name,
            stateKey: "name",
            editable: isCustomer,
          })}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address</Text>
            <Text style={styles.valueText}>{user?.email}</Text>
          </View>

          {renderField({
            label: "Phone",
            value: formData.phoneNumber,
            stateKey: "phoneNumber",
            editable: isCustomer,
          })}

          {/* --- CUSTOMER ADDRESS SECTION --- */}
          {isCustomer && (
            <View>
              <View style={styles.sectionDivider} />
              <Text style={styles.sectionTitle}>Address Details</Text>

              {renderField({
                label: "Unit/Bldg/Phase",
                value: formData.address.unit,
                stateKey: "unit",
                isAddress: true,
              })}
              {renderField({
                label: "Street",
                value: formData.address.street,
                stateKey: "street",
                isAddress: true,
              })}
              {renderField({
                label: "Barangay",
                value: formData.address.barangay,
                stateKey: "barangay",
                isAddress: true,
              })}

              {renderField({
                label: "Province",
                value: formData.address.province,
                stateKey: "province",
                isAddress: true,
                type: "dropdown",
              })}

              {renderField({
                label: "City / Municipality",
                value: formData.address.city,
                stateKey: "city",
                isAddress: true,
                type: "dropdown",
              })}
            </View>
          )}

          {/* --- STAFF WAREHOUSE SECTION --- */}
          {isStaff && (
            <View>
              <View style={styles.sectionDivider} />
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Warehouse</Text>
                <Text style={styles.valueText}>
                  {user?.warehouseName} ({user?.warehouseCode})
                </Text>
              </View>
            </View>
          )}

          {/* --- PASSWORD EDIT SECTION --- */}
          {isEditing && (
            <View>
              <View style={styles.sectionDivider} />
              <Text style={styles.sectionTitle}>Security</Text>

              {renderField({
                label: "New Password",
                value: formData.password,
                stateKey: "password",
                isSecure: true,
              })}
              {renderField({
                label: "Confirm Password",
                value: formData.confirmPassword,
                stateKey: "confirmPassword",
                isSecure: true,
              })}
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

      <DropdownModal
        visible={showProvinceModal}
        title="Select Province"
        options={PROVINCES}
        onSelect={(selectedProvince) => {
          // ✅ FIXED: Update formData properly and clear city
          setFormData((prev) => ({
            ...prev,
            address: {
              ...prev.address,
              province: selectedProvince.name,
              city: "", // Clear city when province changes
            },
          }));
          setShowProvinceModal(false);
        }}
        onClose={() => setShowProvinceModal(false)}
      />

      <DropdownModal
        visible={showCityModal}
        title="Select City"
        options={cities}
        onSelect={(selectedCity) => {
          // ✅ FIXED: Update formData properly
          setFormData((prev) => ({
            ...prev,
            address: {
              ...prev.address,
              city: selectedCity.name,
            },
          }));
          setShowCityModal(false);
        }}
        onClose={() => setShowCityModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scrollContent: { paddingTop: 35, paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    alignItems: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  editToggle: { color: "#3b82f6", fontWeight: "600", padding: 4 },
  fieldGroup: { marginBottom: 18 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  valueText: {
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "500",
    lineHeight: 22,
  },
  sectionDivider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 18 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Custom Dropdown Input Styles
  dropdownInput: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownTextValue: { fontSize: 15, color: "#1e293b" },
  dropdownTextPlaceholder: { fontSize: 15, color: "#94a3b8" },

  saveBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
