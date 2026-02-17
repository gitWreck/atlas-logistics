import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";

export default function ProofOfDelivery({ photos }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Proof of Delivery / Images</Text>
        {photos.length > 0 && (
          <Text style={styles.sectionCount}>({photos.length})</Text>
        )}
      </View>

      {photos.length === 0 ? (
        <Text style={styles.sectionEmpty}>
          No images have been uploaded yet.
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoRow}
        >
          {photos.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: photo.downloadUrl || photo.url }}
              style={styles.photo}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { color: "#0f172a", fontSize: 13, fontWeight: "600" },
  sectionCount: { color: "#64748b", fontSize: 11 },
  sectionEmpty: { color: "#64748b", fontSize: 12 },
  photoRow: { gap: 10 },
  photo: {
    width: 120,
    height: 90,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
});
