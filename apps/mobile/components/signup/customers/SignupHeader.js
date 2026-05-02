import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import LoginHeader from "../../../components/auth/LoginHeader"; // Adjust path as needed

export default function SignupHeader({ onBack }) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <FontAwesome5 name="arrow-left" size={15} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.textBlock}>
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSubtitle}>Customer signup</Text>
        </View>
      </View>

      <LoginHeader
        title="ATLAS SIGNUP"
        subtitle="Create your customer account"
        logoSize={150}
        marginBottom={20}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
});
