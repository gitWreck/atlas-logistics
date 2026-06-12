import React, { useEffect, useState } from "react";
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
import { CHECKER_FAILURE_REASONS } from "../constants/failureReasons";

export default function FailedDeliveryReasonModal({
  visible,
  uploading = false,
  customerName = "",
  pieceCount = 0,
  pieces = [],
  photos = [],
  maxPhotos = 3,
  onClose,
  onPickImage,
  onTakePhoto,
  onRemovePhoto,
  onConfirm,
}) {
  const [reasonCode, setReasonCode] = useState(
    CHECKER_FAILURE_REASONS[0]?.code || "OTHER",
  );
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (!visible) return;
    setReasonCode(CHECKER_FAILURE_REASONS[0]?.code || "OTHER");
    setRemarks("");
  }, [visible]);

  const limitReached = photos.length >= maxPhotos;

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
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Failed Delivery</Text>
              <Text style={styles.title}>{customerName || "Customer"}</Text>
              <Text style={styles.subtitle}>
                {pieceCount} piece{pieceCount === 1 ? "" : "s"} — custody stays
                with you until returned at Odiongan
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={uploading}
              style={styles.closeButton}
            >
              <FontAwesome5 name="times" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>

          {pieces.length > 0 && (
            <View style={styles.pieceList}>
              {pieces.map((piece) => (
                <Text key={piece.packageId} style={styles.pieceLine}>
                  • {piece.label}
                </Text>
              ))}
            </View>
          )}

          <Text style={styles.sectionLabel}>Failure reason</Text>
          <ScrollView
            style={styles.reasonList}
            contentContainerStyle={styles.reasonContent}
          >
            {CHECKER_FAILURE_REASONS.map((reason) => {
              const selected = reasonCode === reason.code;
              return (
                <TouchableOpacity
                  key={reason.code}
                  style={[styles.reasonRow, selected && styles.reasonRowActive]}
                  onPress={() => setReasonCode(reason.code)}
                  disabled={uploading}
                >
                  <FontAwesome5
                    name={selected ? "dot-circle" : "circle"}
                    size={14}
                    color={selected ? "#dc2626" : "#94a3b8"}
                  />
                  <Text
                    style={[
                      styles.reasonLabel,
                      selected && styles.reasonLabelActive,
                    ]}
                  >
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.sectionLabel}>Notes (optional)</Text>
          <TextInput
            style={styles.remarksInput}
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Add details for warehouse / admin"
            placeholderTextColor="#94a3b8"
            multiline
            editable={!uploading}
          />

          <Text style={styles.sectionLabel}>Photo (optional)</Text>
          <View style={styles.photoActions}>
            <TouchableOpacity
              style={[styles.photoBtn, limitReached && styles.disabled]}
              onPress={onTakePhoto}
              disabled={uploading || limitReached}
            >
              <FontAwesome5 name="camera" size={14} color="#dc2626" />
              <Text style={styles.photoBtnText}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.photoBtn, limitReached && styles.disabled]}
              onPress={onPickImage}
              disabled={uploading || limitReached}
            >
              <FontAwesome5 name="image" size={14} color="#dc2626" />
              <Text style={styles.photoBtnText}>Upload</Text>
            </TouchableOpacity>
          </View>

          {photos.length > 0 && (
            <ScrollView horizontal contentContainerStyle={styles.photoRow}>
              {photos.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.thumbWrap}>
                  <Image source={{ uri }} style={styles.thumb} />
                  <TouchableOpacity
                    style={styles.removePhoto}
                    onPress={() => onRemovePhoto(index)}
                    disabled={uploading}
                  >
                    <FontAwesome5 name="times" size={10} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, uploading && styles.disabled]}
            onPress={() => onConfirm({ reasonCode, remarks })}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome5 name="check" size={14} color="#ffffff" />
                <Text style={styles.confirmBtnText}>Confirm failed delivery</Text>
              </>
            )}
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
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  eyebrow: {
    color: "#dc2626",
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
  subtitle: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  pieceList: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
  },
  pieceLine: {
    color: "#7f1d1d",
    fontSize: 12,
    fontWeight: "700",
  },
  sectionLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 4,
  },
  reasonList: {
    maxHeight: 210,
    marginBottom: 8,
  },
  reasonContent: {
    gap: 6,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
  },
  reasonRowActive: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  reasonLabel: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
  },
  reasonLabelActive: {
    color: "#991b1b",
    fontWeight: "800",
  },
  remarksInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    color: "#0f172a",
    fontSize: 14,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  photoActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  photoBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoBtnText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "800",
  },
  photoRow: {
    gap: 8,
    marginBottom: 12,
  },
  thumbWrap: {
    position: "relative",
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
  },
  removePhoto: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtn: {
    marginTop: 8,
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: "#dc2626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  confirmBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.55,
  },
});
