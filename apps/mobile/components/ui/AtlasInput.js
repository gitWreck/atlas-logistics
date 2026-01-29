import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

export default function AtlasInput({
  label,
  value,
  onChangeText,
  secureTextEntry,
  placeholder,
  keyboardType,
  iconName,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isPasswordField = !!secureTextEntry;
  const effectiveSecureEntry = isPasswordField && !isPasswordVisible;

  return (
    <View style={styles.container}>
      {/* Label */}
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Input Box */}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused, // Change border color when focused
        ]}
      >
        {/* Icon (Optional) */}
        {iconName && (
          <FontAwesome
            name={iconName}
            size={20}
            color={isFocused ? "#2563eb" : "#94a3b8"} // Blue when focused, Gray when not
            style={styles.icon}
          />
        )}

        {/* The Actual Input */}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType={keyboardType}
          secureTextEntry={effectiveSecureEntry}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        {/* Password visibility toggle (eye icon) */}
        {isPasswordField && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible((prev) => !prev)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <FontAwesome
              name={isPasswordVisible ? "eye-slash" : "eye"}
              size={18}
              color={isFocused ? "#2563eb" : "#94a3b8"}
              style={styles.toggleIcon}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b", // slate-500
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff", // white
    borderWidth: 2,
    borderColor: "#e2e8f0", // slate-200
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56, // Modern taller touch target
    transition: "all 0.2s", // (Works on some platforms)
  },
  inputWrapperFocused: {
    borderColor: "#2563eb", // blue-600
    backgroundColor: "#eff6ff", // blue-50 (very light tint)
  },
  icon: {
    marginRight: 12,
  },
  toggleIcon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#0f172a", // slate-900
    height: "100%",
  },
});
