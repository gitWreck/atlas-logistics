import React from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Image } from "expo-image";

export default function ProofOfDeliverySection({
  photos,
  onPickImage,
  onRemovePhoto,
}) {
  return (
    <View style={styles.proofContainer}>
      <Text style={styles.sectionTitle}>Proof of Delivery</Text>
      <Text style={styles.helperText}>
        Take up to 3 photos of the delivered items.
      </Text>

      <View style={styles.photoRow}>
        {/* Photo Thumbnails */}
        {photos.map((uri, index) => (
          <View key={index} style={styles.photoWrapper}>
            <Image source={{ uri }} style={styles.thumbnail} />
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => onRemovePhoto(index)}
            >
              <FontAwesome5 name="times" size={10} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        {/* Add Button (Hide if 3 photos) */}
        {photos.length < 3 && (
          <TouchableOpacity
            style={styles.addPhotoBtn}
            onPress={() => {
              Alert.alert("Add Photo", "Choose a source", [
                { text: "Camera", onPress: () => onPickImage(true) },
                { text: "Gallery", onPress: () => onPickImage(false) },
                { text: "Cancel", style: "cancel" },
              ]);
            }}
          >
            <FontAwesome5 name="camera" size={24} color="#3b82f6" />
            <Text style={styles.addPhotoText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 24,
    marginBottom: 8,
  },
  proofContainer: { marginTop: 20 },
  helperText: { fontSize: 13, color: "#64748b", marginBottom: 12 },
  photoRow: { flexDirection: "row", gap: 12 },
  photoWrapper: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  thumbnail: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  addPhotoText: {
    fontSize: 12,
    color: "#3b82f6",
    fontWeight: "600",
    marginTop: 4,
  },
});
