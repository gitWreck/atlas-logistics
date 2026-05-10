import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

export default function ExistingProofsViewer({
  proofOfReceipt,
  proofOfDelivery,
}) {
  const { colors } = useTheme();
  const [selectedImage, setSelectedImage] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const hasReceipts = proofOfReceipt?.length > 0;
  const hasDeliveries = proofOfDelivery?.length > 0;

  if (!hasReceipts && !hasDeliveries) return null;

  const openImage = (url) => {
    setSelectedImage(url);
    setIsModalVisible(true);
  };

  const renderImageRow = (urls, title) => (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.subLabel, { color: colors.textMuted }]}>
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 20 }}
      >
        {urls.map((url, index) => (
          <TouchableOpacity
            key={`${title}-${index}`}
            style={[
              styles.thumbnailWrapper,
              {
                backgroundColor: colors.cardMuted,
                borderColor: colors.border,
              },
            ]}
            activeOpacity={0.8}
            onPress={() => openImage(url)}
          >
            <Image
              source={{ uri: url }}
              style={styles.thumbnailImage}
              contentFit="cover"
            />
            <View style={styles.imageOverlay}>
              <FontAwesome5
                name="expand-arrows-alt"
                size={16}
                color="#ffffff"
              />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Documented Proofs
      </Text>

      {hasReceipts && renderImageRow(proofOfReceipt, "Pickup / Receipt")}
      {hasDeliveries && renderImageRow(proofOfDelivery, "Final Delivery")}

      {/* FULL SCREEN MODAL */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setIsModalVisible(false)}
          >
            <FontAwesome5 name="times" size={24} color="#ffffff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={{ width: "100%", height: "80%" }}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  subLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  thumbnailWrapper: {
    marginRight: 12,
    borderRadius: 12,
    overflow: "hidden",
    width: 110,
    height: 110,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  thumbnailImage: { width: "100%", height: "100%" },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
  },
});
