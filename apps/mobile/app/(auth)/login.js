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

import { auth, db } from "../../firebase";
import AtlasInput from "../../components/ui/AtlasInput";
import AtlasButton from "../../components/ui/AtlasButton";
import LoginHeader from "../../components/auth/LoginHeader";

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        const role = (userData.role ?? "").toString().toLowerCase();

        console.log("User Role:", role);

        // 4. Route based on Role (checker, driver only)
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
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Reusable Header Component */}
        <LoginHeader
          title="ATLAS LOGIN"
          subtitle="Secure Gateway for Operations"
        />

        <View style={styles.formContainer}>
          {/* Reusable Input Components */}
          <AtlasInput
            label="Email Address"
            placeholder="user@atlas.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          <AtlasInput
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
          />

          {/* Reusable Button Component */}
          <AtlasButton
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            iconName="lock"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  scrollContainer: { flexGrow: 1, justifyContent: "center", padding: 20 },
  formContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    elevation: 8,
  },
});
