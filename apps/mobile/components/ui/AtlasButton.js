import React from "react";
import {
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";

export default function AtlasButton({
  onPress,
  title,
  loading,
  iconName,
  disabled,
}) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View style={styles.buttonContent}>
          {iconName && (
            <FontAwesome
              name={iconName}
              size={20}
              color="white"
              style={{ marginRight: 10 }}
            />
          )}
          <Text style={styles.buttonText}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    elevation: 4,
  },
  buttonDisabled: { backgroundColor: "#94a3b8" },
  buttonContent: { flexDirection: "row", alignItems: "center" },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 16 },
});