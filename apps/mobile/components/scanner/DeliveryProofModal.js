import React from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function DeliveryProofModal({
  visible,
  uploading = false,
  photos = [],
  remarks = "",
  totalCount = 0,
  minImages = 1,
  maxImages = 5,
  canSubmit = false,
  onClose,
  onPickImage,
  onTakePhoto,
  onRemovePhoto,
  onRemarksChange,
  onSubmit,
}) {
  const limitReached = totalCount >= maxImages;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>Proof of Delivery</Text>
              <Text style={styles.title}>Complete Shipment</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={uploading}
              style={styles.closeButton}
              activeOpacity={0.8}
            >
              <FontAwesome5 name="times" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          <Text style={styles.message}>
            Add at least {minImages} delivery photo. You can attach up to{" "}
            {maxImages} images before marking this shipment completed.
          </Text>

          <View style={styles.countPill}>
            <Text style={styles.countText}>
              {totalCount}/{maxImages} images ready
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, limitReached && styles.disabled]}
              onPress={onPickImage}
              disabled={uploading || limitReached}
              activeOpacity={0.82}
            >
              <FontAwesome5 name="image" size={14} color="#2563eb" />
              <Text style={styles.actionText}>Upload Image</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, limitReached && styles.disabled]}
              onPress={onTakePhoto}
              disabled={uploading || limitReached}
              activeOpacity={0.82}
            >
              <FontAwesome5 name="camera" size={14} color="#2563eb" />
              <Text style={styles.actionText}>Open Camera</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.grid}
          >
            {photos.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => onRemovePhoto(index)}
                  disabled={uploading}
                >
                  <FontAwesome5 name="times" size={10} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View>
            <Text style={styles.remarksLabel}>Remarks</Text>
            <TextInput
              style={styles.remarksInput}
              value={remarks}
              onChangeText={onRemarksChange}
              placeholder="Add delivery notes or condition remarks..."
              placeholderTextColor="#94a3b8"
              multiline
              editable={!uploading}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.disabled]}
            onPress={onSubmit}
            disabled={!canSubmit}
            activeOpacity={0.86}
          >
            {uploading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <FontAwesome5 name="check-circle" size={15} color="#ffffff" />
            )}
            <Text style={styles.submitText}>
              {uploading ? "Uploading Proof..." : "Mark Shipment Completed"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  eyebrow: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    marginTop: 2,
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "900",
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  countPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  countText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "900",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "900",
  },
  grid: {
    flexDirection: "row",
    gap: 10,
    minHeight: 74,
  },
  thumbWrap: {
    width: 74,
    height: 74,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    alignItems: "center",
    justifyContent: "center",
  },
  remarksLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 7,
  },
  remarksInput: {
    minHeight: 86,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "700",
  },
  submitButton: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: "#16a34a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  submitText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.55,
  },
});
