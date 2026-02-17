import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

import { auth, db } from "../../firebase";
import AtlasInput from "../../components/ui/AtlasInput";
import GradientButton from "../../components/ui/figma/GradientButton";
import LoginHeader from "../../components/auth/LoginHeader";
import { Image } from "expo-image";

export default function CustomerSignupScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [disabled, setDisabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const validateEmail = (value) => /\S+@\S+\.\S+/.test(value.trim());

  const updateDisabled = (
    fullNameValue,
    emailValue,
    passwordValue,
    confirmPasswordValue,
    phoneValue,
  ) => {
    const hasAllFields =
      !!fullNameValue &&
      !!emailValue &&
      !!passwordValue &&
      !!confirmPasswordValue &&
      !!phoneValue;

    setDisabled(!hasAllFields);
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

  // Same as backend: +63, 63, 09... all normalize to 639xxxxxxxxx for matching
  const normalizePhilippinesMobile = (raw) => {
    if (!raw) return "";
    let d = String(raw).replace(/[^\d]/g, "");
    if (d.length === 11 && d.startsWith("0")) {
      d = "63" + d.slice(1); // 09xxxxxxxxx → 639xxxxxxxxx
    } else if (d.length === 10 && d.startsWith("9")) {
      d = "63" + d; // 9xxxxxxxxx → 639xxxxxxxxx
    }
    return d;
  };

  const handleSignup = async () => {
    if (!fullName || !email || !password || !confirmPassword || !phoneNumber) {
      Alert.alert("Missing Fields", "Please fill out all fields.");
      return;
    }

    const normalizedPhone = normalizePhilippinesMobile(phoneNumber);

    if (normalizedPhone.length !== 12 || !normalizedPhone.startsWith("639")) {
      Alert.alert(
        "Invalid Phone Number",
        "Please enter a valid PH mobile number (09XXXXXXXXX, +63..., or 63...).",
      );
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

    try {
      // Match both stored forms: 639... (canonical) or 09... (legacy)
      const phoneVariants =
        normalizedPhone.length === 12 && normalizedPhone.startsWith("639")
          ? [
              normalizedPhone,
              "0" + normalizedPhone.slice(2), // 639xxxxxxxxx → 09xxxxxxxxx
            ]
          : [normalizedPhone];

      // Check for duplicates in Firestore first
      const usersRef = collection(db, "users");
      const [emailSnap, identitySnap] = await Promise.all([
        getDocs(query(usersRef, where("email", "==", email.trim()))),
        getDocs(
          query(
            usersRef,
            where("name", "==", fullName.trim()),
            where("phoneNumber", "in", phoneVariants),
          ),
        ),
      ]);

      if (!emailSnap.empty) {
        Alert.alert(
          "Duplicate Email",
          "An account with this email already exists. Please sign in instead.",
        );
        return;
      }

      if (!identitySnap.empty) {
        Alert.alert(
          "Duplicate Customer",
          "A customer with the same name and phone number already exists.",
        );
        return;
      }

      setLoading(true);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      const user = userCredential.user;

      // Create a corresponding user profile in Firestore with role "customer"
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, {
        // Align fields with web "Add New User" user document shape
        uid: user.uid,
        email: email.trim(),
        name: fullName.trim(),
        role: "customer",
        phoneNumber: normalizedPhone || null,
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
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Image
              source={require("../../assets/icons/back.svg")}
              style={{ width: 20, height: 20 }}
            />
          </TouchableOpacity>
        </View>

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
          placeholder="09XX XXX XXXX"
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
  headerRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 8,
  },
  backBtn: {
    padding: 8,
    borderRadius: 9999,
    backgroundColor: "#e5f2ff",
  },
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
