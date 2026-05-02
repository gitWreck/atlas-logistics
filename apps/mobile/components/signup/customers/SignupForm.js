import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import AtlasInput from "../../../components/ui/AtlasInput"; // Adjust path
import { PROVINCES, getCities } from "../../utilities/PhilippinesData"; // Adjust path

// --- HELPER COMPONENT: The Bottom Sheet List ---
const SelectorModal = ({ visible, onClose, title, data, onSelect }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <FontAwesome5 name="times" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={data}
            keyExtractor={(item) => item.value}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listItem}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
              >
                <Text style={styles.listText}>{item.label}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No options available.</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

export default function SignupForm({
  fullName,
  email,
  password,
  confirmPassword,
  phoneNumber,
  onFullNameChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onPhoneChange,

  unit,
  street,
  barangay,
  province,
  city,
  onUnitChange,
  onStreetChange,
  onBarangayChange,
  onProvinceChange,
  onCityChange,
}) {
  // Modal States
  const [provinceModalVisible, setProvinceModalVisible] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);

  // Format data for the lists
  const provinceOptions = PROVINCES.map((prov) => ({
    label: prov,
    value: prov,
  }));

  const availableCities = province ? getCities(province) : [];
  const cityOptions = availableCities.map((c) => ({
    label: c.name,
    value: c.name,
  }));

  return (
    <View style={styles.formContainer}>
      {/* --- ACCOUNT DETAILS --- */}
      <AtlasInput
        label="Full Name"
        placeholder="Juan Dela Cruz"
        value={fullName}
        onChangeText={onFullNameChange}
      />
      <AtlasInput
        label="Email"
        placeholder="customer@email.com"
        value={email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
      />
      <AtlasInput
        label="Password"
        placeholder="••••••••"
        value={password}
        onChangeText={onPasswordChange}
        secureTextEntry
      />
      <AtlasInput
        label="Confirm Password"
        placeholder="••••••••"
        value={confirmPassword}
        onChangeText={onConfirmPasswordChange}
        secureTextEntry
      />
      <AtlasInput
        label="Phone Number"
        placeholder="09XX XXX XXXX"
        value={phoneNumber}
        onChangeText={onPhoneChange}
        keyboardType="phone-pad"
      />

      {/* --- ADDRESS DETAILS --- */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Address Information</Text>
      </View>

      <AtlasInput
        label="Unit / House No. / Block"
        placeholder="e.g. Blk 2 Lot 3, Unit 4B"
        value={unit}
        onChangeText={onUnitChange}
      />
      <AtlasInput
        label="Street Name"
        placeholder="e.g. Mabini St."
        value={street}
        onChangeText={onStreetChange}
      />
      <AtlasInput
        label="Barangay"
        placeholder="e.g. Brgy. San Jose"
        value={barangay}
        onChangeText={onBarangayChange}
      />

      {/* --- PURE JS PROVINCE DROPDOWN --- */}
      <View style={styles.dropdownContainer}>
        <Text style={styles.dropdownLabel}>Province</Text>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setProvinceModalVisible(true)}
        >
          <Text
            style={[
              styles.dropdownButtonText,
              !province && styles.placeholderText,
            ]}
          >
            {province || "Select a Province..."}
          </Text>
          <FontAwesome5 name="chevron-down" size={14} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* --- PURE JS CITY DROPDOWN --- */}
      <View style={styles.dropdownContainer}>
        <Text style={styles.dropdownLabel}>City / Municipality</Text>
        <TouchableOpacity
          style={[styles.dropdownButton, !province && styles.dropdownDisabled]}
          onPress={() => {
            if (province) setCityModalVisible(true);
          }}
          activeOpacity={province ? 0.7 : 1}
        >
          <Text
            style={[
              styles.dropdownButtonText,
              (!city || !province) && styles.placeholderText,
            ]}
          >
            {province ? city || "Select a City..." : "Select a Province first"}
          </Text>
          <FontAwesome5 name="chevron-down" size={14} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <SelectorModal
        visible={provinceModalVisible}
        onClose={() => setProvinceModalVisible(false)}
        title="Select Province"
        data={provinceOptions}
        onSelect={(val) => {
          onProvinceChange(val);
          onCityChange(""); // Reset city when province changes
        }}
      />

      <SelectorModal
        visible={cityModalVisible}
        onClose={() => setCityModalVisible(false)}
        title="Select City / Municipality"
        data={cityOptions}
        onSelect={onCityChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: { gap: 2 },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },

  // Custom Dropdown Button Styles
  dropdownContainer: { marginBottom: 12 },
  dropdownLabel: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 6,
    fontWeight: "500",
  },
  dropdownButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 16,
    height: 50,
  },
  dropdownDisabled: { backgroundColor: "#f1f5f9", opacity: 0.75 },
  dropdownButtonText: {
    fontSize: 15,
    color: "#0f172a",
    flex: 1,
    fontWeight: "600",
  },
  placeholderText: { color: "#94a3b8" },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%", // Prevents list from taking up the entire screen
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  closeBtn: {
    padding: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
  },
  listContainer: { paddingHorizontal: 20, paddingTop: 10 },
  listItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  listText: { fontSize: 16, color: "#0f172a" },
  emptyText: { textAlign: "center", color: "#94a3b8", marginTop: 20 },
});
