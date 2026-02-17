import React from "react";
import { View, StyleSheet } from "react-native";
import AtlasInput from "../../../components/ui/AtlasInput"; // Adjust path

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
}) {
  return (
    <View style={styles.formContainer}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    gap: 4, // Adds subtle spacing between inputs if supported, else rely on AtlasInput margins
  },
});
