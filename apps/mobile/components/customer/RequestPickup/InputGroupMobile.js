import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import {
  PROVINCES,
  getCities,
} from "../../../components/utilities/PhilippinesData";
import { normalizePhoneNumber } from "../../../components/utilities/helpers";
import DropdownModal from "./DropdownModal";
import { useTheme } from "../../../contexts/ThemeContext";

export default function InputGroupMobile({
  label,
  values,
  onChange,
  color = "blue",
  user,
}) {
  const { colors } = useTheme();
  const [cities, setCities] = useState([]);
  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);

  useEffect(() => {
    if (values.province) {
      setCities(getCities(values.province));
    } else {
      setCities([]);
    }
  }, [values.province]);

  const handleProvinceSelect = (selectedProvince) => {
    const province =
      typeof selectedProvince === "string"
        ? selectedProvince
        : selectedProvince?.name || selectedProvince?.label || "";

    onChange({ ...values, province, city: "", barangay: "" });
    setShowProvinceModal(false);
  };

  const handleCitySelect = (selectedCity) => {
    const city =
      typeof selectedCity === "string"
        ? selectedCity
        : selectedCity?.name || selectedCity?.label || "";

    onChange({ ...values, city, barangay: "" });
    setShowCityModal(false);
  };

  const themeColor = color === "emerald" ? "#10b981" : "#3b82f6";

  // console.log("user: ", user);
  // console.log("input group:  ", values);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.title, { color: themeColor }]}>{label} Details</Text>

      <View style={styles.row}>
        <View style={{ flex: 1, zIndex: 10 }}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="Name"
            placeholderTextColor={colors.textMuted}
            value={values.name}
            onChangeText={(val) => {
              onChange({ ...values, name: val });
            }}
          />
        </View>

        <TextInput
          style={[
            styles.input,
            {
              flex: 1,
              marginLeft: 10,
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          placeholder="Phone"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          value={values.phone}
          onBlur={() =>
            onChange({ ...values, phone: normalizePhoneNumber(values.phone) })
          }
          onChangeText={(val) => onChange({ ...values, phone: val })}
        />
      </View>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.border,
            color: colors.text,
            marginBottom: 10,
          },
        ]}
        placeholder="Secondary Phone (optional)"
        placeholderTextColor={colors.textMuted}
        keyboardType="phone-pad"
        value={values.secondaryPhone || ""}
        onBlur={() =>
          onChange({
            ...values,
            secondaryPhone: normalizePhoneNumber(values.secondaryPhone || ""),
          })
        }
        onChangeText={(val) => onChange({ ...values, secondaryPhone: val })}
      />

      {/* Address Rows */}
      <View style={styles.row}>
        <TextInput
          style={[
            styles.input,
            {
              flex: 1,
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          placeholder="Unit"
          placeholderTextColor={colors.textMuted}
          value={values.unit}
          onChangeText={(val) => onChange({ ...values, unit: val })}
        />
        <TextInput
          style={[
            styles.input,
            {
              flex: 2,
              marginLeft: 10,
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          placeholder="Street"
          placeholderTextColor={colors.textMuted}
          value={values.street}
          onChangeText={(val) => onChange({ ...values, street: val })}
        />
      </View>

      <TextInput
        style={[
          styles.input,
          {
            marginBottom: 10,
            backgroundColor: colors.inputBg,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        placeholder="Barangay"
        placeholderTextColor={colors.textMuted}
        value={values.barangay}
        onChangeText={(val) => onChange({ ...values, barangay: val })}
      />

      {/* Province/City - Using standard Inputs for now, or you can add a Picker/Modal */}
      <View style={styles.row}>
        {/* Province Selector Button */}
        <TouchableOpacity
          style={[
            styles.input,
            {
              flex: 1,
              justifyContent: "center",
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setShowProvinceModal(true)}
          activeOpacity={0.78}
        >
          <Text style={{ color: values.province ? colors.text : colors.textMuted }}>
            {values.province || "Province"}
          </Text>
        </TouchableOpacity>

        {/* City Selector Button */}
        <TouchableOpacity
          style={[
            styles.input,
            {
              flex: 1,
              marginLeft: 10,
              justifyContent: "center",
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
            },
            !values.province && { opacity: 0.5 }, // Dim if disabled
          ]}
          onPress={() => {
            if (values.province) setShowCityModal(true);
          }}
          disabled={!values.province}
          activeOpacity={0.78}
        >
          <Text style={{ color: values.city ? colors.text : colors.textMuted }}>
            {values.city || (values.province ? "Municipality/City" : "Select province first")}
          </Text>
        </TouchableOpacity>
      </View>
      {/* --- PROVINCE MODAL --- */}
      <DropdownModal
        visible={showProvinceModal}
        title="Select Province"
        options={PROVINCES}
        onSelect={handleProvinceSelect}
        onClose={() => setShowProvinceModal(false)}
        emptyMessage="No provinces found."
      />

      {/* --- CITY MODAL --- */}
      <DropdownModal
        visible={showCityModal}
        title={`Select Municipality/City${values.province ? ` in ${values.province}` : ""}`}
        options={cities}
        onSelect={handleCitySelect}
        onClose={() => setShowCityModal(false)}
        emptyMessage="No municipalities or cities found."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  row: { flexDirection: "row", marginBottom: 10 },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  dropdown: {
    position: "absolute",
    top: 45,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  suggestionName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  suggestionPhone: { fontSize: 11, color: "#64748b" },

  modalBg: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end", // Opens from the bottom
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "60%", // Adjust height as needed
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
    textAlign: "center",
  },
  modalItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalItemText: {
    fontSize: 15,
    color: "#1e293b",
  },
  modalCloseBtn: {
    marginTop: 16,
    backgroundColor: "#f1f5f9",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseText: {
    fontWeight: "700",
    color: "#475569",
  },
});
