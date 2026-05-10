import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import GradientButton from "../../components/ui/figma/GradientButton"; // Adjust path
import { useTheme } from "../../contexts/ThemeContext";

export default function AddTrackingModal({
  visible,
  onClose,
  onAdd,
  isAdding,
}) {
  const { colors } = useTheme();
  const [trackingNumber, setTrackingNumber] = useState("");

  // Clear input when modal opens/closes
  useEffect(() => {
    if (!visible) setTrackingNumber("");
  }, [visible]);

  const handleSubmit = () => {
    onAdd(trackingNumber);
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Add a tracking number
          </Text>
          <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
            Enter a tracking number to link an existing shipment to your
            account.
          </Text>

          <View style={styles.modalInputWrapper}>
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
              Tracking Number
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. AT-20260203-DIV-ODI-123456"
              placeholderTextColor={colors.textMuted}
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.modalActionsRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <View style={styles.modalPrimaryBtnWrapper}>
              <GradientButton
                title="Add"
                onPress={handleSubmit}
                disabled={!trackingNumber || isAdding}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 16,
  },
  modalInputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: "600",
  },
  modalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCancelText: {
    fontSize: 13,
    color: "#64748b",
  },
  modalPrimaryBtnWrapper: {
    flex: 1,
  },
});
