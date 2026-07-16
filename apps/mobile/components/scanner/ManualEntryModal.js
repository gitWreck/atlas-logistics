import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

export default function ManualEntryModal({
  visible,
  onClose,
  onSubmit,
  loading = false,
  mode = "loading",
  actionLabel = "",
  accentColor = "#2563eb",
}) {
  const { colors } = useTheme();
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!visible) {
      setCode("");
    }
  }, [visible]);

  const handleSubmit = () => {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned || loading) return;
    onSubmit(cleaned);
  };

  const modeLabel =
    mode === "offloading"
      ? actionLabel || "Receive Package"
      : mode === "info"
        ? "Find Package"
        : "Load Package";

  const helperText =
    mode === "info"
      ? "Enter the package barcode or tracking code to view shipment details."
      : "Enter the package barcode or tracking code to process it manually.";

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: `${accentColor}15`,
                  borderColor: accentColor,
                },
              ]}
            >
              <FontAwesome5 name="keyboard" size={18} color={accentColor} />
            </View>

            <View style={styles.headerTextWrap}>
              <Text style={[styles.title, { color: colors.text }]}>
                Manual Entry
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {helperText}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.modeBadge,
              {
                backgroundColor: colors.cardMuted,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.modeBadgeText, { color: colors.text }]}>
              {modeLabel}
            </Text>
          </View>

          <Text style={[styles.label, { color: colors.textMuted }]}>
            Package Code
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
            placeholder="AT-2026-..."
            placeholderTextColor={colors.textMuted}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <Text style={[styles.note, { color: colors.textMuted }]}>
            Bulk packages will ask for quantity in the next step.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                {
                  backgroundColor: colors.cardMuted,
                  borderColor: colors.border,
                },
              ]}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                { backgroundColor: accentColor },
                (!code.trim() || loading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!code.trim() || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <FontAwesome5 name="arrow-right" size={13} color="#fff" />
                  <Text style={styles.submitText}>Continue</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
    marginBottom: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  modeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 18,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  note: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 18,
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  cancelButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  submitButton: {
    flex: 1,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  cancelText: {
    fontWeight: "700",
    color: "#64748b",
    fontSize: 14,
  },
  submitText: {
    fontWeight: "800",
    color: "#ffffff",
    fontSize: 14,
  },
});
