import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
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

import { auth, db } from "../../../firebase";
import GradientButton from "../../../components/ui/figma/GradientButton";

// Import components
import SignupHeader from "../../../components/signup/customers/SignupHeader";
import SignupForm from "../../../components/signup/customers/SignupForm";
import SignupFooter from "../../../components/signup/customers/SignupFooter";

export default function CustomerSignupScreen() {
  const router = useRouter();

  // --- STATE ---
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phoneNumber: "",
    // ✅ NEW: Address State
    unit: "",
    street: "",
    barangay: "",
    province: "",
    city: "",
  });

  const [loading, setLoading] = useState(false);

  // Derived state for button disabling (Unit is left optional)
  const isDisabled =
    !formData.fullName ||
    !formData.email ||
    !formData.password ||
    !formData.confirmPassword ||
    !formData.phoneNumber ||
    !formData.street ||
    !formData.barangay ||
    !formData.province ||
    !formData.city;

  // --- HANDLERS ---
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Special handler to reset city when province changes
  const handleProvinceChange = (newProvince) => {
    setFormData((prev) => ({
      ...prev,
      province: newProvince,
      city: "", // Reset city so they don't submit a mismatched city/province
    }));
  };

  const validateEmail = (value) => /\S+@\S+\.\S+/.test(value.trim());

  // Helper: Normalize PH phone numbers
  const normalizePhilippinesMobile = (raw) => {
    if (!raw) return "";
    let d = String(raw).replace(/[^\d]/g, "");
    if (d.length === 11 && d.startsWith("0")) {
      return "63" + d.slice(1); // 09xxxxxxxxx -> 639xxxxxxxxx
    } else if (d.length === 10 && d.startsWith("9")) {
      return "63" + d; // 9xxxxxxxxx -> 639xxxxxxxxx
    }
    return d;
  };

  const handleSignup = async () => {
    const {
      fullName,
      email,
      password,
      confirmPassword,
      phoneNumber,
      unit,
      street,
      barangay,
      province,
      city,
    } = formData;

    if (isDisabled) {
      Alert.alert("Missing Fields", "Please fill out all required fields.");
      return;
    }

    // 1. Validations
    const normalizedPhone = normalizePhilippinesMobile(phoneNumber);

    if (normalizedPhone.length !== 12 || !normalizedPhone.startsWith("639")) {
      Alert.alert("Invalid Phone", "Please enter a valid PH mobile number.");
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak Password", "Password should be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      // 2. Check Duplicates (Firestore)
      const phoneVariants = [
        normalizedPhone,
        "0" + normalizedPhone.slice(2), // Check legacy format too
      ];

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
        throw new Error("EMAIL_EXISTS");
      }
      if (!identitySnap.empty) {
        throw new Error("USER_EXISTS");
      }

      // 3. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const user = userCredential.user;

      // 4. Create Firestore Profile (✅ NOW INCLUDES ADDRESS OBJECT)
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: email.trim(),
        name: fullName.trim(),
        role: "customer",
        phoneNumber: normalizedPhone,
        address: {
          unit: unit.trim(),
          street: street.trim(),
          barangay: barangay.trim(),
          city: city,
          province: province,
        },
        active: true,
        status: "active",
        provider: "password",
        createdAt: serverTimestamp(),
        lastAuthAt: null,
      });

      Alert.alert("Success", "Account created successfully!", [
        { text: "OK", onPress: () => router.replace("/login") },
      ]);
    } catch (error) {
      console.error("Signup Error:", error);
      let msg = "Something went wrong.";
      if (
        error.message === "EMAIL_EXISTS" ||
        error.code === "auth/email-already-in-use"
      ) {
        msg = "An account with this email already exists.";
      } else if (error.message === "USER_EXISTS") {
        msg = "A customer with this name and phone already exists.";
      } else if (error.code === "auth/weak-password") {
        msg = "Password is too weak.";
      }
      Alert.alert("Signup Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Component */}
        <SignupHeader onBack={() => router.back()} />

        {/* Form Component */}
        <SignupForm
          fullName={formData.fullName}
          email={formData.email}
          password={formData.password}
          confirmPassword={formData.confirmPassword}
          phoneNumber={formData.phoneNumber}
          onFullNameChange={(v) => handleChange("fullName", v)}
          onEmailChange={(v) => handleChange("email", v)}
          onPasswordChange={(v) => handleChange("password", v)}
          onConfirmPasswordChange={(v) => handleChange("confirmPassword", v)}
          onPhoneChange={(v) => handleChange("phoneNumber", v)}
          // ✅ NEW: Address Props
          unit={formData.unit}
          street={formData.street}
          barangay={formData.barangay}
          province={formData.province}
          city={formData.city}
          onUnitChange={(v) => handleChange("unit", v)}
          onStreetChange={(v) => handleChange("street", v)}
          onBarangayChange={(v) => handleChange("barangay", v)}
          onProvinceChange={handleProvinceChange} // Uses the special handler to reset city
          onCityChange={(v) => handleChange("city", v)}
        />

        {/* Action Button */}
        <View style={styles.buttonWrapper}>
          <GradientButton
            title="Create Account"
            onPress={handleSignup}
            loading={loading}
            disabled={isDisabled}
          />
        </View>

        {/* Footer Component */}
        <SignupFooter onLoginPress={() => router.replace("/login")} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContainer: { flexGrow: 1, padding: 20 },
  buttonWrapper: { marginTop: 20 },
});
