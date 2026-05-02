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
  Platform,
  StatusBar as RNStatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { normalizePhoneNumber } from "../utilities/helpers";
import { useAuth } from "../../contexts/AuthContext";
import { updateUserProfileMobile } from "../utilities/FirebaseFunctions";
import AtlasInput from "../ui/AtlasInput";
import DropdownModal from "../customer/RequestPickup/DropdownModal";
import { PROVINCES, getCities } from "../utilities/PhilippinesData";

const EMPTY_VALUE = "Not provided";

const getInitialFormData = (user = {}) => ({
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

const roleConfig = {
  customer: {
    icon: "user",
    label: "Customer",
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  driver: {
    icon: "truck",
    label: "Driver",
    color: "#9333ea",
    bg: "#faf5ff",
    border: "#e9d5ff",
  },
  checker: {
    icon: "user-check",
    label: "Checker",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
};

export default function ProfileViewer() {
  const router = useRouter();
  const { user, refreshUser, signOut } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => getInitialFormData(user));
  const [cities, setCities] = useState([]);
  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);

  const isCustomer = user?.role === "customer";
  const isStaff = user?.role === "checker" || user?.role === "driver";
  const config = roleConfig[user?.role] || {
    icon: "user-circle",
    label: user?.role || "User",
    color: "#475569",
    bg: "#f8fafc",
    border: "#e2e8f0",
  };
  const publicId = user?.publicId || user?.userCode || user?.driverCode;

  useEffect(() => {
    if (!isEditing) {
      setFormData(getInitialFormData(user));
    }
  }, [user, isEditing]);

  useEffect(() => {
    if (formData.address.province) {
      setCities(getCities(formData.address.province));
    } else {
      setCities([]);
    }
  }, [formData.address.province]);

  const displayValue = (value, fallback = EMPTY_VALUE) => {
    const cleaned = String(value ?? "").trim();
    return cleaned || fallback;
  };

  const addressSummary = [user?.address?.city, user?.address?.province]
    .filter(Boolean)
    .join(", ");

  const warehouseSummary = [user?.warehouseName, user?.warehouseCode]
    .filter(Boolean)
    .join(" - ");

  const profileSubtitle = isCustomer
    ? displayValue(addressSummary, "Customer Account")
    : isStaff
      ? displayValue(warehouseSummary, `${config.label} Account`)
      : "User Account";

  const handleSave = async () => {
    if (!user?.uid) {
      return Alert.alert("Error", "User profile is not available.");
    }

    if (!formData.name.trim()) {
      return Alert.alert("Error", "Name is required.");
    }

    if (isCustomer) {
      if (!formData.address.province || !formData.address.city) {
        return Alert.alert("Error", "Province and city are required.");
      }
    }

    const hasPassword = formData.password.trim().length > 0;
    if (hasPassword) {
      if (formData.password.length < 6) {
        return Alert.alert("Error", "Password must be at least 6 characters.");
      }
      if (formData.password !== formData.confirmPassword) {
        return Alert.alert("Error", "Passwords do not match.");
      }
    }

    setLoading(true);
    try {
      const payload = {
        targetUid: user.uid,
        name: formData.name.trim(),
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
        Alert.alert("Success", "Profile updated.");
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
    icon = "info-circle",
    isAddress = false,
    editable = true,
    isSecure = false,
    type = "text",
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
                if (stateKey === "province") setShowProvinceModal(true);
                if (stateKey === "city") {
                  if (!formData.address.province) {
                    Alert.alert("Notice", "Please select a province first.");
                    return;
                  }
                  setShowCityModal(true);
                }
              }}
              activeOpacity={0.8}
            >
              <Text
                style={
                  value
                    ? styles.dropdownTextValue
                    : styles.dropdownTextPlaceholder
                }
                numberOfLines={1}
              >
                {value || `Select ${label}`}
              </Text>
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

    return (
      <View style={styles.detailRow} key={stateKey}>
        <View style={styles.fieldIconWrap}>
          <FontAwesome5 name={icon} size={13} color="#64748b" />
        </View>
        <View style={styles.detailTextBlock}>
          <Text style={styles.label}>{label}</Text>
          <Text
            style={[
              styles.valueText,
              !String(value ?? "").trim() && styles.fallbackText,
            ]}
            numberOfLines={2}
          >
            {isSecure ? "********" : displayValue(value)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroCard}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: config.bg, borderColor: config.border },
            ]}
          >
            <FontAwesome5 name={config.icon} size={24} color={config.color} />
          </View>

          <View style={styles.heroTextBlock}>
            <View style={styles.rolePill}>
              <Text style={[styles.roleText, { color: config.color }]}>
                {config.label}
              </Text>
            </View>
            <Text style={styles.profileName} numberOfLines={1}>
              {displayValue(user?.name, "Guest User")}
            </Text>
            <Text style={styles.profileSubtitle} numberOfLines={2}>
              {profileSubtitle}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardEyebrow}>Profile</Text>
              <Text style={styles.cardTitle}>Account Details</Text>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditing(!isEditing)}
              activeOpacity={0.8}
            >
              <FontAwesome5
                name={isEditing ? "times" : "pen"}
                size={12}
                color="#2563eb"
              />
              <Text style={styles.editToggle}>
                {isEditing
                  ? "Cancel"
                  : isStaff
                    ? "Update Password"
                    : "Edit Profile"}
              </Text>
            </TouchableOpacity>
          </View>

          {publicId &&
            renderField({
              label: "User ID",
              value: publicId,
              stateKey: "publicId",
              icon: "id-card",
              editable: false,
            })}

          {renderField({
            label: "Name",
            value: formData.name,
            stateKey: "name",
            icon: "user",
            editable: isCustomer,
          })}

          {renderField({
            label: "Email Address",
            value: user?.email,
            stateKey: "email",
            icon: "envelope",
            editable: false,
          })}

          {renderField({
            label: "Phone",
            value: formData.phoneNumber,
            stateKey: "phoneNumber",
            icon: "phone-alt",
            editable: isCustomer,
          })}
        </View>

        {isCustomer && (
          <View style={styles.card}>
            <SectionHeader
              icon="map-marker-alt"
              eyebrow="Customer"
              title="Address Details"
            />

            {renderField({
              label: "Unit / Building / Phase",
              value: formData.address.unit,
              stateKey: "unit",
              icon: "home",
              isAddress: true,
            })}
            {renderField({
              label: "Street",
              value: formData.address.street,
              stateKey: "street",
              icon: "road",
              isAddress: true,
            })}
            {renderField({
              label: "Barangay",
              value: formData.address.barangay,
              stateKey: "barangay",
              icon: "map-signs",
              isAddress: true,
            })}
            {renderField({
              label: "Province",
              value: formData.address.province,
              stateKey: "province",
              icon: "map",
              isAddress: true,
              type: "dropdown",
            })}
            {renderField({
              label: "City / Municipality",
              value: formData.address.city,
              stateKey: "city",
              icon: "city",
              isAddress: true,
              type: "dropdown",
            })}
          </View>
        )}

        {isStaff && (
          <View style={styles.card}>
            <SectionHeader
              icon="warehouse"
              eyebrow="Operations"
              title="Assignment"
            />

            {renderField({
              label: "Warehouse",
              value: warehouseSummary,
              stateKey: "warehouse",
              icon: "warehouse",
              editable: false,
            })}
            {renderField({
              label: "Role",
              value: config.label,
              stateKey: "role",
              icon: "id-badge",
              editable: false,
            })}
          </View>
        )}

        {isEditing && (
          <View style={styles.card}>
            <SectionHeader
              icon="shield-alt"
              eyebrow="Security"
              title="Password"
            />

            {renderField({
              label: "New Password",
              value: formData.password,
              stateKey: "password",
              icon: "lock",
              isSecure: true,
            })}
            {renderField({
              label: "Confirm Password",
              value: formData.confirmPassword,
              stateKey: "confirmPassword",
              icon: "lock",
              isSecure: true,
            })}

            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <FontAwesome5 name="check" size={13} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <DropdownModal
        visible={showProvinceModal}
        title="Select Province"
        options={PROVINCES}
        onSelect={(selectedProvince) => {
          setFormData((prev) => ({
            ...prev,
            address: {
              ...prev.address,
              province: selectedProvince?.name || "",
              city: "",
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
          setFormData((prev) => ({
            ...prev,
            address: {
              ...prev.address,
              city: selectedCity?.name || "",
            },
          }));
          setShowCityModal(false);
        }}
        onClose={() => setShowCityModal(false)}
      />
    </SafeAreaView>
  );
}

const SectionHeader = ({ icon, eyebrow, title }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionIconWrap}>
      <FontAwesome5 name={icon} size={13} color="#2563eb" />
    </View>
    <View>
      <Text style={styles.cardEyebrow}>{eyebrow}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 14,
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextBlock: {
    flex: 1,
    marginLeft: 14,
  },
  rolePill: {
    alignSelf: "flex-start",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginBottom: 8,
  },
  roleText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  profileName: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "900",
  },
  profileSubtitle: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  sectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  cardEyebrow: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  editToggle: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "800",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  fieldIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  detailTextBlock: {
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94a3b8",
    marginBottom: 5,
    textTransform: "uppercase",
  },
  valueText: {
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "600",
    lineHeight: 21,
  },
  fallbackText: {
    color: "#94a3b8",
    fontWeight: "600",
  },
  dropdownInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  dropdownTextValue: {
    flex: 1,
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "600",
  },
  dropdownTextPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: "#94a3b8",
    fontWeight: "600",
  },
  saveBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
  },
});
