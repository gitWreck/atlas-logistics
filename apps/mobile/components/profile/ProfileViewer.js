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
  Image,
  Modal,
  Pressable,
  StatusBar as RNStatusBar,
  Linking,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { normalizePhoneNumber } from "../utilities/helpers";
import { useAuth } from "../../contexts/AuthContext";
import {
  deleteMyAccount,
  updateUserThemePreference,
  updateUserProfileMobile,
} from "../utilities/FirebaseFunctions";
import { useTheme } from "../../contexts/ThemeContext";
import { storage } from "../../firebase";
import ShipmentDetailHeader from "../shipments/ShipmentDetailHeader";
import DropdownModal from "../customer/RequestPickup/DropdownModal";
import { PROVINCES, getCities } from "../utilities/PhilippinesData";

const EMPTY_VALUE = "Not provided";
const ACCOUNT_DELETION_POLICY_URL =
  "https://atlastransport.ph/account-deletion";
const PRIMARY = "#2563eb";
const DANGER = "#dc2626";

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

export default function ProfileViewer({
  showBackButton = false,
  compactTop = false,
  minimalStaff = false,
  driverAssignment = {},
}) {
  const router = useRouter();
  const { user, refreshUser, signOut } = useAuth();
  const { preference, setPreference, resolvedScheme, colors } = useTheme();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [themeLoading, setThemeLoading] = useState(false);
  const [formData, setFormData] = useState(() => getInitialFormData(user));
  const [cities, setCities] = useState([]);
  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [photoActionVisible, setPhotoActionVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const isCustomer = user?.role === "customer";
  const isDriver = user?.role === "driver";
  const isStaff = user?.role === "checker" || user?.role === "driver";
  const profilePhotoURL = String(user?.photoURL || "").trim();
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
  const isDark = resolvedScheme === "dark";

  const selectProfilePhoto = async (source) => {
    try {
      const permission = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          source === "camera"
            ? "Allow camera access to take a profile photo."
            : "Allow photo library access to choose a profile photo.",
        );
        return;
      }

      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets?.[0]?.uri) {
        setPhotoActionVisible(false);
        setSelectedPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error("Profile photo selection failed:", error);
      Alert.alert("Unable to select photo", "Please try again.");
    }
  };

  const uploadProfilePhoto = async () => {
    if (!selectedPhoto?.uri || !user?.uid || photoUploading) return;

    setPhotoUploading(true);
    try {
      const response = await fetch(selectedPhoto.uri);
      const blob = await response.blob();
      const avatarRef = ref(storage, `users/${user.uid}/profile/avatar.jpg`);

      await uploadBytes(avatarRef, blob, {
        contentType: selectedPhoto.mimeType || "image/jpeg",
      });
      const photoURL = await getDownloadURL(avatarRef);

      await updateUserProfileMobile({ targetUid: user.uid, photoURL });
      await refreshUser();

      setSelectedPhoto(null);
      Alert.alert("Profile photo updated", "Your new profile photo is saved.");
    } catch (error) {
      console.error("Profile photo upload failed:", error);
      const message = /network|internet|offline|failed to fetch/i.test(
        String(error?.message || ""),
      )
        ? "No internet connection. Check your connection and try again."
        : "We could not upload your profile photo. Please try again.";
      Alert.alert("Upload failed", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Retry", onPress: uploadProfilePhoto },
      ]);
    } finally {
      setPhotoUploading(false);
    }
  };

  const addressSummary = [user?.address?.city, user?.address?.province]
    .filter(Boolean)
    .join(", ");

  const warehouseSummary = [user?.warehouseName, user?.warehouseCode]
    .filter(Boolean)
    .join(" - ");
  const driverMunicipality = driverAssignment.municipality || user?.assignedMunicipality || user?.municipality || (Array.isArray(user?.assignedMunicipalities) ? user.assignedMunicipalities.join(", ") : null);
  const driverVehicle = driverAssignment.vehicle || [user?.vehiclePlate, user?.vehicleType].filter(Boolean).join(" · ");
  const driverPlate = driverAssignment.plateNumber || user?.vehiclePlate || user?.plateNumber;
  const driverRoute = driverAssignment.route || user?.assignedRoute || user?.routeName || user?.route;
  const driverLicense = user?.licenseNumber || user?.licenseNo || user?.driverLicenseNumber;
  const employmentStatus = user?.employmentStatus || user?.status || (user?.active === false ? "Inactive" : "Active");

  const profileSubtitle = isCustomer
    ? displayValue(addressSummary, "Customer Account")
    : isStaff
      ? displayValue(warehouseSummary, `${config.label} Account`)
      : "User Account";
  const avatarBg = isDark ? colors.cardMuted : config.bg;
  const avatarBorder = isDark ? colors.border : config.border;
  const roleBg = isDark ? colors.cardMuted : config.bg;
  const roleBorder = isDark ? colors.border : config.border;

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

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your customer profile and removes your access to Atlas Transport. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleteLoading(true);
            try {
              await deleteMyAccount();
              try {
                await signOut();
              } catch (err) {
                console.log("Sign out after account deletion failed:", err);
              }
              router.replace("/(auth)/login");
            } catch (error) {
              Alert.alert(
                "Account deletion failed",
                error?.message || "Please try again later.",
              );
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleThemePreferenceChange = async (nextPreference) => {
    if (
      nextPreference === preference ||
      !["light", "dark", "system"].includes(nextPreference)
    ) {
      return;
    }

    try {
      await setPreference(nextPreference);
    } catch (error) {
      Alert.alert(
        "Theme not saved locally",
        error?.message || "Please try changing your theme again.",
      );
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch (err) {
            console.log("Sign out failed:", err);
          } finally {
            router.replace("/(auth)/login");
          }
        },
      },
    ]);
  };

  const handleSyncThemePreference = async () => {
    if (themeLoading) return;

    if (!user?.uid) {
      Alert.alert("Error", "User profile is not available.");
      return;
    }

    setThemeLoading(true);

    try {
      await updateUserThemePreference({ themePreference: preference });
      refreshUser().catch((err) => {
        console.log("Theme preference refresh skipped:", err);
      });
      Alert.alert(
        "Theme synced",
        "Your theme preference was saved to your account.",
      );
    } catch (error) {
      Alert.alert(
        "Theme not synced",
        error?.message || "Please try syncing your theme again.",
      );
    } finally {
      setThemeLoading(false);
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
            <Text style={[styles.label, { color: colors.textMuted }]}>
              {label}
            </Text>
            <TouchableOpacity
              style={[
                styles.dropdownInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                },
              ]}
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
                style={[
                  value
                    ? styles.dropdownTextValue
                    : styles.dropdownTextPlaceholder,
                  { color: value ? colors.text : colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {value || `Select ${label}`}
              </Text>
              <FontAwesome5
                name="chevron-down"
                color={colors.textMuted}
                size={12}
              />
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View style={styles.fieldGroup} key={stateKey}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {label}
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={isAddress ? formData.address[stateKey] : formData[stateKey]}
            placeholder={`Enter ${label}`}
            placeholderTextColor={colors.textMuted}
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
        </View>
      );
    }

    return (
      <View
        style={[styles.detailRow, { borderTopColor: colors.border }]}
        key={stateKey}
      >
        <View
          style={[styles.fieldIconWrap, { backgroundColor: colors.cardMuted }]}
        >
          <FontAwesome5 name={icon} size={13} color={colors.textMuted} />
        </View>
        <View style={styles.detailTextBlock}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {label}
          </Text>
          <Text
            style={[
              styles.valueText,
              { color: colors.text },
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

  const Container = compactTop ? View : SafeAreaView;

  return (
    <Container
      style={[
        styles.container,
        compactTop && styles.containerCompactTop,
        { backgroundColor: colors.bg },
      ]}
    >
      {showBackButton && (
        <ShipmentDetailHeader
          title="Profile"
          subtitle="Account and address details"
          onBack={() => router.back()}
        />
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          compactTop && styles.scrollContentCompactTop,
        ]}
      >
        <View
          style={[
            styles.heroCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.avatar,
              profilePhotoURL && styles.photoAvatar,
              { backgroundColor: avatarBg, borderColor: avatarBorder },
            ]}
            onPress={() => setPhotoActionVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
          >
            {profilePhotoURL ? (
              <Image source={{ uri: profilePhotoURL }} style={styles.avatarImage} />
            ) : (
              <FontAwesome5 name={config.icon} size={24} color={config.color} />
            )}
          </TouchableOpacity>

          <View style={styles.heroTextBlock}>
            <View
              style={[
                styles.rolePill,
                {
                  backgroundColor: roleBg,
                  borderColor: roleBorder,
                },
              ]}
            >
              <Text style={[styles.roleText, { color: config.color }]}>
                {config.label}
              </Text>
            </View>
            <Text
              style={[styles.profileName, { color: colors.text }]}
              numberOfLines={1}
            >
              {displayValue(user?.name, "Guest User")}
            </Text>
            <Text
              style={[styles.profileSubtitle, { color: colors.textMuted }]}
              numberOfLines={2}
            >
              {profileSubtitle}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.cardEyebrow, { color: colors.textMuted }]}>
                Profile
              </Text>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Account Details
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.editButton,
                {
                  backgroundColor: isDark ? "#1d4ed8" : "#eff6ff",
                  borderColor: isDark ? "#3b82f6" : "#bfdbfe",
                },
              ]}
              onPress={() => setIsEditing(!isEditing)}
              activeOpacity={0.8}
            >
              <FontAwesome5
                name={isEditing ? "times" : "pen"}
                size={12}
                color={isDark ? "#eff6ff" : PRIMARY}
              />
              <Text
                style={[
                  styles.editToggle,
                  { color: isDark ? "#fff" : PRIMARY },
                ]}
              >
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
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SectionHeader
              icon="map-marker-alt"
              eyebrow="Customer"
              title="Address Details"
              colors={colors}
              isDark={isDark}
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
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SectionHeader
              icon="warehouse"
              eyebrow="Operations"
              title="Assignment"
              colors={colors}
              isDark={isDark}
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
            {isDriver && renderField({
              label: "Assigned Municipality",
              value: driverMunicipality,
              stateKey: "driverMunicipality",
              icon: "map-marker-alt",
              editable: false,
            })}
            {isDriver && renderField({
              label: "Assigned Vehicle",
              value: driverVehicle,
              stateKey: "driverVehicle",
              icon: "truck",
              editable: false,
            })}
            {isDriver && renderField({
              label: "Plate Number",
              value: driverPlate,
              stateKey: "driverPlate",
              icon: "credit-card",
              editable: false,
            })}
            {isDriver && renderField({
              label: "Assigned Route",
              value: driverRoute,
              stateKey: "driverRoute",
              icon: "route",
              editable: false,
            })}
            {isDriver && renderField({
              label: "License Number",
              value: driverLicense,
              stateKey: "driverLicense",
              icon: "id-card",
              editable: false,
            })}
            {isDriver && renderField({
              label: "Employment Status",
              value: employmentStatus,
              stateKey: "employmentStatus",
              icon: "user-check",
              editable: false,
            })}
          </View>
        )}

        {isEditing && (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SectionHeader
              icon="shield-alt"
              eyebrow="Security"
              title="Password"
              colors={colors}
              isDark={isDark}
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

        {!isEditing && !minimalStaff && (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SectionHeader
              icon="adjust"
              eyebrow="Appearance"
              title="Theme"
              colors={colors}
              isDark={isDark}
            />
            <Text style={[styles.hintMuted, { color: colors.textMuted }]}>
              Choose light, dark, or match this device.
            </Text>
            <View style={styles.themeRow}>
              {[
                { value: "light", label: "Light", icon: "sun" },
                { value: "dark", label: "Dark", icon: "moon" },
                { value: "system", label: "System", icon: "mobile-alt" },
              ].map((opt) => {
                const active = preference === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.themeChip,
                      {
                        borderColor: active ? PRIMARY : colors.border,
                        backgroundColor: active ? PRIMARY : colors.cardMuted,
                      },
                    ]}
                    onPress={() => handleThemePreferenceChange(opt.value)}
                    activeOpacity={0.85}
                  >
                    <FontAwesome5
                      name={opt.icon}
                      size={12}
                      color={active ? "#ffffff" : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.themeChipText,
                        { color: active ? "#ffffff" : colors.text },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[
                styles.themeSyncButton,
                {
                  backgroundColor: colors.cardMuted,
                  borderColor: colors.border,
                },
                themeLoading && styles.saveBtnDisabled,
              ]}
              onPress={handleSyncThemePreference}
              disabled={themeLoading}
              activeOpacity={0.85}
            >
              {themeLoading ? (
                <ActivityIndicator size="small" color={PRIMARY} />
              ) : (
                <FontAwesome5
                  name="cloud-upload-alt"
                  size={13}
                  color={PRIMARY}
                />
              )}
              <Text style={[styles.themeSyncText, { color: colors.text }]}>
                Save theme to account
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!isEditing && minimalStaff && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeader icon="shield-alt" eyebrow="Account" title="Security" colors={colors} isDark={isDark} />
            <TouchableOpacity style={[styles.signOutBtn, { backgroundColor: colors.cardMuted, borderColor: colors.border, marginBottom: 10 }]} onPress={() => setIsEditing(true)} activeOpacity={0.85}>
              <FontAwesome5 name="lock" size={14} color={PRIMARY} />
              <Text style={[styles.signOutBtnText, { color: PRIMARY }]}>Change Password</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.signOutBtn, { backgroundColor: colors.cardMuted, borderColor: colors.border }]} onPress={handleSignOut} activeOpacity={0.85}>
              <FontAwesome5 name="sign-out-alt" size={14} color={DANGER} />
              <Text style={styles.signOutBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isEditing && !minimalStaff && (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SectionHeader
              icon="sign-out-alt"
              eyebrow="Session"
              title="Sign Out"
              colors={colors}
              isDark={isDark}
            />
            <Text style={[styles.hintMuted, { color: colors.textMuted }]}>
              End this session and return to the login screen.
            </Text>
            <TouchableOpacity
              style={[
                styles.signOutBtn,
                {
                  backgroundColor: colors.cardMuted,
                  borderColor: colors.border,
                },
              ]}
              onPress={handleSignOut}
              activeOpacity={0.85}
            >
              <FontAwesome5 name="sign-out-alt" size={14} color={DANGER} />
              <Text style={styles.signOutBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        )}

        {isCustomer && !isEditing && (
          <View
            style={[
              styles.dangerCard,
              {
                backgroundColor: isDark ? "#2a1518" : "#fff7f7",
                borderColor: isDark ? "#7f1d1d" : "#fecaca",
              },
            ]}
          >
            <SectionHeader
              icon="exclamation-triangle"
              eyebrow="Account"
              title="Delete Account"
              colors={{
                ...colors,
                cardMuted: isDark ? "#451a1a" : "#fee2e2",
                textMuted: isDark ? "#fca5a5" : "#991b1b",
              }}
              isDark={isDark}
              accent={DANGER}
            />
            <Text style={[styles.hintMuted, { color: colors.textMuted }]}>
              Permanently delete your account and profile from Atlas Transport.
            </Text>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => Linking.openURL(ACCOUNT_DELETION_POLICY_URL)}
              activeOpacity={0.8}
            >
              <Text style={[styles.linkText, { color: PRIMARY }]}>
                Data deletion details
              </Text>
              <FontAwesome5
                name="external-link-alt"
                size={12}
                color={PRIMARY}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.deleteAccountBtn,
                deleteLoading && styles.saveBtnDisabled,
              ]}
              onPress={handleDeleteAccount}
              disabled={deleteLoading || loading}
              activeOpacity={0.85}
            >
              {deleteLoading ? (
                <ActivityIndicator color="#fef2f2" />
              ) : (
                <>
                  <FontAwesome5 name="trash-alt" size={14} color="#fef2f2" />
                  <Text style={styles.deleteAccountBtnText}>
                    Delete account
                  </Text>
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

      <Modal
        visible={photoActionVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPhotoActionVisible(false)}
      >
        <Pressable
          style={styles.photoSheetBackdrop}
          onPress={() => setPhotoActionVisible(false)}
        >
          <Pressable
            style={[styles.photoSheet, { backgroundColor: colors.surface }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.photoSheetTitle, { color: colors.text }]}>Profile photo</Text>
            <TouchableOpacity style={styles.photoSheetAction} onPress={() => selectProfilePhoto("camera")}>
              <FontAwesome5 name="camera" size={18} color={PRIMARY} />
              <Text style={[styles.photoSheetActionText, { color: colors.text }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoSheetAction} onPress={() => selectProfilePhoto("library")}>
              <FontAwesome5 name="images" size={18} color={PRIMARY} />
              <Text style={[styles.photoSheetActionText, { color: colors.text }]}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoSheetCancel} onPress={() => setPhotoActionVisible(false)}>
              <Text style={[styles.photoSheetCancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(selectedPhoto)}
        transparent
        animationType="fade"
        onRequestClose={() => !photoUploading && setSelectedPhoto(null)}
      >
        <View style={styles.photoPreviewBackdrop}>
          <View style={[styles.photoPreviewCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.photoSheetTitle, { color: colors.text }]}>Preview profile photo</Text>
            {selectedPhoto?.uri ? <Image source={{ uri: selectedPhoto.uri }} style={styles.photoPreviewImage} /> : null}
            <View style={styles.photoPreviewActions}>
              <TouchableOpacity
                disabled={photoUploading}
                style={[styles.photoPreviewButton, { borderColor: colors.border }]}
                onPress={() => setSelectedPhoto(null)}
              >
                <Text style={[styles.photoPreviewCancelText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={photoUploading}
                style={[styles.photoPreviewButton, styles.photoUploadButton]}
                onPress={uploadProfilePhoto}
              >
                {photoUploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.photoUploadText}>Upload</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Container>
  );
}

const SectionHeader = ({ icon, eyebrow, title, colors, accent }) => (
  <View style={styles.sectionHeader}>
    <View
      style={[styles.sectionIconWrap, { backgroundColor: colors.cardMuted }]}
    >
      <FontAwesome5 name={icon} size={13} color={accent || PRIMARY} />
    </View>
    <View>
      <Text style={[styles.cardEyebrow, { color: colors.textMuted }]}>
        {eyebrow}
      </Text>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0,
  },
  containerCompactTop: {
    paddingTop: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 14,
  },
  scrollContentCompactTop: {
    paddingTop: 12,
  },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  photoAvatar: {
    borderRadius: 32,
  },
  photoSheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  photoSheet: {
    padding: 20,
    paddingBottom: 32,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 4,
  },
  photoSheetTitle: { fontSize: 17, fontWeight: "700", marginBottom: 8 },
  photoSheetAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
  },
  photoSheetActionText: { fontSize: 16, fontWeight: "600" },
  photoSheetCancel: { alignItems: "center", paddingTop: 16, paddingBottom: 4 },
  photoSheetCancelText: { fontSize: 16, fontWeight: "600" },
  photoPreviewBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  photoPreviewCard: { width: "100%", maxWidth: 360, borderRadius: 20, padding: 20 },
  photoPreviewImage: { width: "100%", aspectRatio: 1, borderRadius: 14, backgroundColor: "#e2e8f0" },
  photoPreviewActions: { flexDirection: "row", gap: 12, marginTop: 18 },
  photoPreviewButton: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  photoPreviewCancelText: { fontWeight: "700" },
  photoUploadButton: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  photoUploadText: { color: "#fff", fontWeight: "700" },
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
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
  textInput: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    fontSize: 15,
    fontWeight: "600",
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
  hintMuted: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  themeRow: {
    flexDirection: "row",
    gap: 8,
  },
  themeChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
  },
  themeChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  themeSyncButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
  },
  themeSyncText: {
    fontSize: 13,
    fontWeight: "800",
  },
  signOutBtn: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
  },
  signOutBtnText: {
    color: "#dc2626",
    fontSize: 15,
    fontWeight: "800",
  },
  dangerCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  linkRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "800",
  },
  deleteAccountBtn: {
    backgroundColor: "#dc2626",
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  deleteAccountBtnText: {
    color: "#fef2f2",
    fontSize: 15,
    fontWeight: "900",
  },
});
