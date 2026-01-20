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
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

// 1. IMPORT YOUR COMPONENTS
import { auth, db } from "../firebase"; // Adjust path if needed
import AtlasInput from "../components/ui/AtlasInput";
import AtlasButton from "../components/ui/AtlasButton";
import LoginHeader from "../components/auth/LoginHeader"; // (Assume you made this too)

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    // ... logic same as before ...
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
