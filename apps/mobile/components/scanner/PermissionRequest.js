import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function PermissionRequest({ onRequest }) {
  return (
    <View style={styles.center}>
      <Text style={styles.text}>Camera permission is required.</Text>
      <Text onPress={onRequest} style={styles.link}>
        Grant Permission
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 16, color: "#0f172a" },
  link: { color: "#2563eb", marginTop: 10, fontWeight: "bold", fontSize: 16 },
});
