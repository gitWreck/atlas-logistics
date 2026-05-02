import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function ShipmentDetailHeader({
  title = "Shipment Details",
  subtitle = "Package and delivery information",
  onBack,
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <FontAwesome5 name="arrow-left" size={15} color="#0f172a" />
      </TouchableOpacity>
      <View style={styles.textBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
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
  title: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
});
