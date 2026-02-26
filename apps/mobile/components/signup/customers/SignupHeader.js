import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import LoginHeader from "../../../components/auth/LoginHeader"; // Adjust path as needed

export default function SignupHeader({ onBack }) {
  return (
    <View>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Image
            source={require("../../../assets/icons/back.svg")}
            style={{ width: 20, height: 20 }}
          />
        </TouchableOpacity>
      </View>

      <LoginHeader
        title="CUSTOMER SIGNUP"
        subtitle="Create your ATLAS account"
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
});
