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
import { Stack, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";

// Adjust these paths to match your project structure
import AtlasInput from "../../components/ui/AtlasInput";
import GradientButton from "../../components/ui/figma/GradientButton";
import { requestRecoveryOTP } from "../../components/utilities/FirebaseFunctions";
import { normalizePhoneNumber } from "../../components/utilities/helpers";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [deliveryMethod, setDeliveryMethod] = useState("email"); // 'email' or 'phone'
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!inputValue.trim()) {
      Alert.alert(
        "Missing Information",
        `Please enter your ${deliveryMethod === "email" ? "email address" : "phone number"}.`,
      );
      return;
    }

    // Normalize it quietly in the background right before sending
    const finalTarget =
      deliveryMethod === "phone"
        ? normalizePhoneNumber(inputValue)
        : inputValue.trim().toLowerCase();

    setLoading(true);

    try {
      // 1. Call the Firebase Cloud Function
      await requestRecoveryOTP({
        target: finalTarget,
        deliveryMethod: deliveryMethod,
      });

      // 2. Alert & Navigate on Success
      Alert.alert(
        "OTP Sent",
        `A recovery code has been sent to your ${deliveryMethod}.`,
        [
          {
            text: "OK",
            onPress: () => {
              // Pass the target so the next screen knows who to verify!
              router.push({
                pathname: "/(auth)/verify-otp",
                params: { target: finalTarget, deliveryMethod },
              });
            },
          },
        ],
        { cancelable: false },
      );
    } catch (error) {
      console.error("OTP Request Error:", error);
      // Firebase functions usually return clean error messages in error.message
      Alert.alert(
        "Error",
        error.message || "Failed to send OTP. Please try again.",
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
          {/* Header section (Customized since we didn't import LoginHeader) */}
          <View style={styles.header}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Choose where you want us to send your recovery OTP.
            </Text>
          </View>

          {/* Delivery Method Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                deliveryMethod === "email" && styles.toggleBtnActive,
              ]}
              onPress={() => {
                setDeliveryMethod("email");
                setInputValue("");
              }}
              activeOpacity={0.8}
            >
              <FontAwesome5
                name="envelope"
                size={16}
                color={deliveryMethod === "email" ? "#2563eb" : "#64748b"}
              />
              <Text
                style={[
                  styles.toggleText,
                  deliveryMethod === "email" && styles.toggleTextActive,
                ]}
              >
                Email
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleBtn,
                deliveryMethod === "phone" && styles.toggleBtnActive,
              ]}
              onPress={() => {
                setDeliveryMethod("phone");
                setInputValue("");
              }}
              activeOpacity={0.8}
            >
              <FontAwesome5
                name="mobile-alt"
                size={16}
                color={deliveryMethod === "phone" ? "#2563eb" : "#64748b"}
              />
              <Text
                style={[
                  styles.toggleText,
                  deliveryMethod === "phone" && styles.toggleTextActive,
                ]}
              >
                SMS
              </Text>
            </TouchableOpacity>
          </View>

          {/* Dynamic Input Field */}
          <View style={styles.inputWrapper}>
            {deliveryMethod === "email" ? (
              <AtlasInput
                label="Email Address"
                placeholder="user@atlas.com"
                value={inputValue}
                onChangeText={setInputValue}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            ) : (
              <AtlasInput
                label="Phone Number"
                placeholder="09XX XXX XXXX"
                value={inputValue}
                onChangeText={setInputValue}
                keyboardType="phone-pad"
              />
            )}
          </View>

          <GradientButton
            title="Send OTP"
            onPress={handleSendOTP}
            loading={loading}
            disabled={!inputValue.trim() || loading}
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
    // marginTop: Platform.OS === "android" ? 20 : 0, // Handle Android status bar
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60, // Adjust based on your safe area
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
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  toggleBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  toggleTextActive: {
    color: "#2563eb",
  },
  inputWrapper: {
    marginBottom: 24,
  },
});
