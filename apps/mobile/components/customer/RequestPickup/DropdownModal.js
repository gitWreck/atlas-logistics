import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";

export default function DropdownModal({
  visible,
  title,
  options,
  onSelect,
  onClose,
}) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalBg}>
        <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
          {title && (
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {title}
            </Text>
          )}

          <FlatList
            data={options}
            // Ensures a unique key whether the item is a string or an object
            keyExtractor={(item, index) =>
              String(item.id || item.name || item) + index
            }
            renderItem={({ item }) => {
              // Automatically grabs the display name whether it's an object {name: "Cebu"} or string "Box"
              const displayLabel = item.name || item.label || item;

              return (
                <TouchableOpacity
                  style={[styles.modalItem, { borderBottomColor: colors.border }]}
                  onPress={() => onSelect(item)}
                >
                  <Text style={[styles.modalItemText, { color: colors.text }]}>
                    {displayLabel}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity
            style={[
              styles.modalCloseBtn,
              { backgroundColor: colors.cardMuted },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.modalCloseText, { color: colors.textMuted }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "50%",
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
    textAlign: "center",
  },
  modalItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalItemText: {
    fontSize: 15,
    color: "#1e293b",
  },
  modalCloseBtn: {
    marginTop: 16,
    backgroundColor: "#f1f5f9",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseText: {
    fontWeight: "700",
    color: "#475569",
  },
});
