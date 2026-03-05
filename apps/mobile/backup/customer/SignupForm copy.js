import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Picker } from "@react-native-picker/picker";
import AtlasInput from "../../components/ui/AtlasInput"; // Adjust path
// ✅ IMPORT YOUR LOCATION DATA HERE (Adjust path as needed)
import {
  PROVINCES,
  getCities,
} from "../../components/utilities/PhilippinesData";

export default function SignupForm({
  // Account Props
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

  // ✅ NEW: Address Props
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
  // Dynamically load cities based on the currently selected province
  const availableCities = province ? getCities(province) : [];

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

      {/* Province Dropdown */}
      <View style={styles.dropdownContainer}>
        <Text style={styles.dropdownLabel}>Province</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={province}
            onValueChange={(itemValue) => {
              onProvinceChange(itemValue);
              // Note: Make sure your parent component resets the City state to ""
              // whenever onProvinceChange is triggered so they don't get stuck
              // with a city from the wrong province!
            }}
            style={styles.picker}
          >
            <Picker.Item
              label="Select a Province..."
              value=""
              color="#94a3b8"
            />
            {PROVINCES.map((prov) => (
              <Picker.Item
                key={prov}
                label={prov}
                value={prov}
                color="#0f172a"
              />
            ))}
          </Picker>
        </View>
      </View>

      {/* City/Municipality Dropdown */}
      <View style={styles.dropdownContainer}>
        <Text style={styles.dropdownLabel}>City / Municipality</Text>
        <View
          style={[styles.pickerWrapper, !province && styles.pickerDisabled]}
        >
          <Picker
            selectedValue={city}
            onValueChange={onCityChange}
            enabled={!!province} // Disable if no province is selected
            style={styles.picker}
          >
            <Picker.Item
              label={province ? "Select a City..." : "Select a Province first"}
              value=""
              color="#94a3b8"
            />
            {availableCities.map((c) => (
              <Picker.Item
                key={c.code}
                label={c.name}
                value={c.name}
                color="#0f172a"
              />
            ))}
          </Picker>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    gap: 4,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  // Dropdown specific styles to make the Picker look like a standard input field
  dropdownContainer: {
    marginBottom: 12,
  },
  dropdownLabel: {
    fontSize: 14,
    color: "#475569", // Matches standard label grey
    marginBottom: 6,
    fontWeight: "500",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#cbd5e1", // Matches standard input border
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden", // Ensures the picker respects border radius
  },
  pickerDisabled: {
    backgroundColor: "#f1f5f9", // Slight grey out when disabled
  },
  picker: {
    height: 50,
    width: "100%",
  },
});
