import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import GridButton from "../../components/ui/GridButton"; // ✅ Correct Import

export default function CheckerDashboard() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Hub</Text>
        <Text style={styles.subtitle}>Select Operation</Text>
      </View>

      <View style={styles.gridContainer}>
        {/* ROW 1 */}
        <View style={styles.row}>
          <GridButton
            title="LOAD TRUCK"
            icon="truck"
            color="#2563eb"
            mode="loading"
          />
          <GridButton
            title="UNLOAD / RECEIVE"
            icon="inbox"
            color="#0f172a"
            mode="receiving"
          />
        </View>

        {/* ROW 2 */}
        <View style={styles.row}>
          <GridButton
            title="SINGLE CHECK"
            icon="search"
            color="#64748b"
            mode="manual"
          />

          {/* Placeholder for future 4th button */}
          <View style={[styles.cardPlaceholder]}>
            <FontAwesome name="plus" size={24} color="#e2e8f0" />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 24 },
  header: { marginTop: 40, marginBottom: 30 },
  title: { fontSize: 32, fontWeight: "800", color: "#0f172a" },
  subtitle: { fontSize: 16, color: "#64748b" },
  gridContainer: { gap: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 16 },

  // Only the placeholder style remains here since GridButton handles itself
  cardPlaceholder: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
});
