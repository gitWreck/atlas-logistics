import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

export default function LoginHeader({ title, subtitle }) {
  return (
    <View style={styles.header}>
      <View style={styles.logoContainer}>
        {/* If you have a local image, put it in apps/mobile/assets/ 
           and use: require('../../assets/atlas-logo.png')
           For now, we will use a simple placeholder view or icon.
        */}
        {/* <Text style={{ fontSize: 40 }}>🚚</Text> */}
        <FontAwesome name="truck" size={40} color="white" />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: "#2563eb", // blue-600
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    elevation: 10,
    shadowColor: "#3b82f6",
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    letterSpacing: 1.5,
  },
  subtitle: {
    color: "#94a3b8", // slate-400
    fontSize: 14,
    marginTop: 8,
  },
});
