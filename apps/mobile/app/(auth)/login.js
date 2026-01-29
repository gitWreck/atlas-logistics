import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

// 1. IMPORT YOUR COMPONENTS
import { auth, db } from "../../firebase"; // Adjust path if needed
import AtlasInput from "../../components/ui/AtlasInput";
import AtlasButton from "../../components/ui/AtlasButton";
import LoginHeader from "../../components/auth/LoginHeader"; // (Assume you made this too)

export default function LoginScreen() {
  const router = useRouter();
  const [disabled, setDisabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const validateEmail = (value) => /\S+@\S+\.\S+/.test(value);

  const updateDisabled = (emailValue, passwordValue) => {
    const isEmailValid = validateEmail(emailValue);
    if (!emailValue || !passwordValue || !isEmailValid) {
      setDisabled(true);
    } else {
      setDisabled(false);
    }
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    updateDisabled(value, password);
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    updateDisabled(email, value);
  };

  const handleLogin = async () => {
    // 1. Basic Validation
    if (!email || !password) {
      Alert.alert("Missing Fields", "Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      // 2. Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      console.log("Logged in user:", user.uid);

      // 3. Fetch User Role from Firestore
      // We look up the 'users' collection using the User ID (uid)
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role; // e.g., 'driver', 'checker', 'admin'

        console.log("User Role:", role);

        // 4. Route based on Role
        // We use 'replace' so they can't swipe back to the login screen
        if (role === "driver") {
          router.replace("/(driver)/");
        } else if (role === "checker") {
          router.replace("/(checker)");
        } else {
          Alert.alert(
            "Access Denied",
            "Your account role is not authorized for this app.",
          );
          // Optional: Sign them out immediately if they have the wrong role
          await signOut(auth);
        }
      } else {
        Alert.alert("Error", "User profile not found in database.");
      }
    } catch (error) {
      console.error("Login Error:", error);

      // Better Error Messages for the user
      let errorMessage = "Something went wrong.";
      if (error.code === "auth/invalid-credential") {
        errorMessage = "Incorrect email or password.";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Try again later.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Check your internet connection.";
      }

      Alert.alert("Login Failed", errorMessage);
    } finally {
      setLoading(false);
      updateDisabled(email, password);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <LoginHeader
          title="ATLAS LOGIN"
          subtitle="Secure Gateway for Operations"
        />

        <AtlasInput
          label="Email Address"
          placeholder="user@atlas.com"
          value={email}
          onChangeText={handleEmailChange}
          keyboardType="email-address"
        />

        <AtlasInput
          label="Password"
          placeholder="••••••••"
          value={password}
          onChangeText={handlePasswordChange}
          secureTextEntry={true}
        />

        <AtlasButton
          title="Sign In"
          onPress={handleLogin}
          loading={loading}
          disabled={disabled}
          />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContainer: { flexGrow: 1, justifyContent: "center", padding: 20 },
});
