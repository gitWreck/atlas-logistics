import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal, // ✅ Add Modal
  FlatList, // ✅ Add FlatList
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import DropdownModal from "./DropdownModal";

const PACKAGING_TYPES = ["Box", "Sack", "Crate", "Bundle", "Roll", "Envelope"];

export default function ItemSectionMobile({
  items,
  onAdd,
  onRemove,
  onChange,
  onToggleTag,
  isDark = false,
}) {
  const [activePickerIndex, setActivePickerIndex] = useState(null);
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Package Items</Text>
        <TouchableOpacity style={styles.addButton} onPress={onAdd}>
          <FontAwesome5 name="plus" size={12} color="#2563eb" />
          <Text style={styles.addButtonText}>Item</Text>
        </TouchableOpacity>
      </View>

      {/* ITEMS LIST */}
      <View style={styles.list}>
        {items.map((item, idx) => (
          <View key={idx} style={styles.itemCard}>
            {/* ITEM HEADER (Index + Remove) */}
            <View style={styles.itemHeader}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{idx + 1}</Text>
              </View>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => onRemove(idx)}>
                  <FontAwesome5 name="trash" size={14} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>

            {/* DESCRIPTION */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Nike Shoes"
              value={item.description}
              onChangeText={(val) => onChange(idx, "description", val)}
            />

            {/* TYPE & QUANTITY ROW */}
            <View style={styles.row}>
              <View style={{ flex: 1.5 }}>
                <Text style={styles.label}>Type</Text>
                {/* Simplified: In Mobile, you might prefer a Modal Picker, but here is a simple TextInput placeholder */}
                {/* ✅ Replaced TextInput with TouchableOpacity */}
                <TouchableOpacity
                  style={[styles.input, { justifyContent: "center" }]}
                  onPress={() => setActivePickerIndex(idx)}
                >
                  <Text
                    style={{
                      color: item.packagingType ? "#0f172a" : "#94a3b8",
                    }}
                  >
                    {item.packagingType || "Select Type"}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.label}>Qty</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="1"
                  value={String(item.quantity || "")}
                  onChangeText={(val) => onChange(idx, "quantity", val)}
                />
              </View>
            </View>

            {/* DECLARED VALUE */}
            <Text style={styles.label}>Declared Value (₱)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="0.00"
              value={String(item.declaredValue || "")}
              onChangeText={(val) => onChange(idx, "declaredValue", val)}
            />

            {/* TAGS (Fragile / Perishable) */}
            <View style={styles.tagRow}>
              <TagButton
                active={item.isFragile}
                icon="glass-martini-alt"
                label="Fragile"
                color="amber"
                onPress={() => onToggleTag(idx, "isFragile")}
              />
              <TagButton
                active={item.isPerishable}
                icon="snowflake"
                label="Perishable"
                color="cyan"
                onPress={() => onToggleTag(idx, "isPerishable")}
              />
            </View>
          </View>
        ))}
      </View>
      {/* --- PACKAGING TYPE MODAL --- */}

      <DropdownModal
        visible={activePickerIndex !== null}
        title="Select Packaging"
        options={PACKAGING_TYPES}
        onSelect={(selectedItem) => {
          onChange(activePickerIndex, "packagingType", selectedItem);
          setActivePickerIndex(null);
        }}
        onClose={() => setActivePickerIndex(null)}
      />
    </View>
  );
}

function TagButton({ active, icon, label, color, onPress }) {
  const activeBg = color === "amber" ? "#fffbeb" : "#ecfeff";
  const activeBorder = color === "amber" ? "#f59e0b" : "#06b6d4";
  const activeText = color === "amber" ? "#b45309" : "#0e7490";

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.tagButton,
        active && { backgroundColor: activeBg, borderColor: activeBorder },
      ]}
    >
      <FontAwesome5
        name={icon}
        size={12}
        color={active ? activeText : "#64748b"}
      />
      <Text style={[styles.tagText, active && { color: activeText }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  addButtonText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#2563eb",
  },
  list: { gap: 12 },
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#64748b" },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 4,
    marginLeft: 2,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  row: { flexDirection: "row" },
  tagRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  tagButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  tagText: { marginLeft: 8, fontSize: 12, fontWeight: "700", color: "#64748b" },
});
