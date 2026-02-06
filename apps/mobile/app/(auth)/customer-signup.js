import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

import { auth, db } from "../../firebase";
import AtlasInput from "../../components/ui/AtlasInput";
import GradientButton from "../../components/ui/figma/GradientButton";
import LoginHeader from "../../components/auth/LoginHeader";

export default function CustomerSignupScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [disabled, setDisabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const validateEmail = (value) => /\S+@\S+\.\S+/.test(value);

  const updateDisabled = (
    fullNameValue,
    emailValue,
    passwordValue,
    confirmPasswordValue,
    phoneValue,
  ) => {
    const isEmailValid = validateEmail(emailValue);
    const hasAllFields =
      !!fullNameValue &&
      !!emailValue &&
      !!passwordValue &&
      !!confirmPasswordValue &&
      !!phoneValue;
    const passwordsMatch = passwordValue === confirmPasswordValue;

    if (!hasAllFields || !isEmailValid || !passwordsMatch) {
      setDisabled(true);
    } else {
      setDisabled(false);
    }
  };

  const handleFullNameChange = (value) => {
    setFullName(value);
    updateDisabled(value, email, password, confirmPassword, phoneNumber);
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    updateDisabled(fullName, value, password, confirmPassword, phoneNumber);
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    updateDisabled(fullName, email, value, confirmPassword, phoneNumber);
  };

  const handleConfirmPasswordChange = (value) => {
    setConfirmPassword(value);
    updateDisabled(fullName, email, password, value, phoneNumber);
  };

  const handlePhoneChange = (value) => {
    setPhoneNumber(value);
    updateDisabled(fullName, email, password, confirmPassword, value);
  };

  const handleSignup = async () => {
    if (!fullName || !email || !password || !confirmPassword || !phoneNumber) {
      Alert.alert("Missing Fields", "Please fill out all fields.");
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Weak Password",
        "Password should be at least 6 characters long.",
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      const user = userCredential.user;

      // Create a corresponding user profile in Firestore with role "customer"
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, {
        // Align fields with web "Add New User" user document shape
        uid: user.uid,
        email,
        name: fullName,
        role: "customer",
        phoneNumber: phoneNumber || null,
        warehouseId: null,
        active: true,
        status: "active",
        provider: "password",
        createdAt: serverTimestamp(),
        lastAuthAt: null,
      });

      Alert.alert(
        "Account Created",
        "Your customer account has been created. You can now sign in.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/login"),
          },
        ],
      );
    } catch (error) {
      console.error("Signup Error:", error);

      let errorMessage = "Something went wrong while creating your account.";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "An account with this email already exists.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "The email address is invalid.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "The password is too weak.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Check your internet connection.";
      }

      Alert.alert("Signup Failed", errorMessage);
    } finally {
      setLoading(false);
      updateDisabled(fullName, email, password, confirmPassword, phoneNumber);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <LoginHeader
          title="CUSTOMER SIGNUP"
          subtitle="Create your ATLAS account"
        />

        <AtlasInput
          label="Full Name"
          placeholder="Juan Dela Cruz"
          value={fullName}
          onChangeText={handleFullNameChange}
        />

        <AtlasInput
          label="Email"
          placeholder="customer@email.com"
          value={email}
          onChangeText={handleEmailChange}
          keyboardType="email-address"
        />

        <AtlasInput
          label="Password"
          placeholder="••••••••"
          value={password}
          onChangeText={handlePasswordChange}
          secureTextEntry
        />

        <AtlasInput
          label="Confirm Password"
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={handleConfirmPasswordChange}
          secureTextEntry
        />

        <AtlasInput
          label="Phone Number"
          placeholder="+63 900 000 0000"
          value={phoneNumber}
          onChangeText={handlePhoneChange}
          keyboardType="phone-pad"
        />

        <GradientButton
          title="Create Account"
          onPress={handleSignup}
          loading={loading}
          disabled={disabled}
        />

        <View style={styles.footerTextContainer}>
          <Text style={styles.footerText}>
            Already have an account?{" "}
            <Text
              style={styles.footerLink}
              onPress={() => router.replace("/login")}
            >
              Sign in
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContainer: { flexGrow: 1, justifyContent: "center", padding: 20 },
  footerTextContainer: {
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    fontSize: 13,
    color: "#64748b",
  },
  footerLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2563eb",
    textDecorationLine: "underline",
  },
});

