import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";

import AtlasInput from "../../components/ui/AtlasInput";
import GradientButton from "../../components/ui/figma/GradientButton";
import { verifyRecoveryOTP } from "../../components/utilities/FirebaseFunctions";

export default function VerifyOTPScreen() {
  const router = useRouter();
  // Grab the data passed from the forgot-password screen
  const { target, deliveryMethod } = useLocalSearchParams();

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerifyAndReset = async () => {
    if (!otp.trim() || !newPassword || !confirmPassword) {
      Alert.alert("Missing Fields", "Please fill out all fields.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      // 1. Call the Verify Cloud Function
      //   const verifyOTP = httpsCallable(functions, "verifyRecoveryOTP");
      await verifyRecoveryOTP({
        target: target,
        otp: otp.trim(),
        newPassword: newPassword,
      });

      // 2. Success! Route them back to login.
      Alert.alert(
        "Success!",
        "Your password has been securely reset. You can now log in.",
        [
          {
            text: "Go to Login",
            onPress: () => router.replace("/(auth)/login"),
          },
        ],
        { cancelable: false },
      );
    } catch (error) {
      console.error("OTP Verification Error:", error);
      Alert.alert(
        "Verification Failed",
        error.message || "Invalid or expired code.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header section */}
          <View style={styles.header}>
            {/* <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <FontAwesome5 name="arrow-left" size={20} color="#0f172a" />
            </TouchableOpacity> */}
            <Text style={styles.title}>Secure Reset</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to your {deliveryMethod} along with
              your new password.
            </Text>
          </View>

          <View style={styles.inputWrapper}>
            <AtlasInput
              label="6-Digit Recovery Code"
              placeholder="123456"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
            />

            <View style={styles.divider} />

            <AtlasInput
              label="New Password"
              placeholder="••••••••"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={true}
            />

            <AtlasInput
              label="Confirm New Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={true}
            />
          </View>

          <GradientButton
            title="Reset Password"
            onPress={handleVerifyAndReset}
            loading={loading}
            disabled={!otp || !newPassword || !confirmPassword || loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#64748b",
    lineHeight: 22,
  },
  inputWrapper: {
    marginBottom: 24,
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 12,
  },
});
