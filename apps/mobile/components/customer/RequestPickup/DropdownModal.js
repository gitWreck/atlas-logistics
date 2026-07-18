import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TextInput,
} from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";

export default function DropdownModal({
  visible,
  title,
  options,
  onSelect,
  onClose,
  searchable = true,
  emptyMessage = "No options found.",
}) {
  const { colors } = useTheme();
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (!visible) setSearch("");
  }, [visible]);

  const getLabel = React.useCallback((item) => {
    if (item && typeof item === "object") {
      return String(item.name || item.label || item.value || "");
    }
    return String(item || "");
  }, []);

  const filteredOptions = React.useMemo(() => {
    const list = Array.isArray(options) ? options : [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((item) => getLabel(item).toLowerCase().includes(term));
  }, [getLabel, options, search]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalBg}>
        <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
          {title && (
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {title}
            </Text>
          )}

          {searchable && (
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search..."
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
            />
          )}

          <FlatList
            data={filteredOptions}
            // Ensures a unique key whether the item is a string or an object
            keyExtractor={(item, index) =>
              String(item?.id || item?.code || getLabel(item)) + index
            }
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {emptyMessage}
              </Text>
            }
            renderItem={({ item }) => {
              // Automatically grabs the display name whether it's an object {name: "Cebu"} or string "Box"
              const displayLabel = getLabel(item);

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
    marginBottom: 12,
    textAlign: "center",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 24,
    fontSize: 14,
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
