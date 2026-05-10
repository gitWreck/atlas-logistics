import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import DropdownModal from "./DropdownModal";
import { useTheme } from "../../../contexts/ThemeContext";

const PACKAGING_TYPES = ["Box", "Sack", "Crate", "Bundle", "Roll", "Envelope"];

export default function ItemSectionMobile({
  items,
  onAdd,
  onRemove,
  onChange,
  onToggleTag,
}) {
  const { colors, resolvedScheme } = useTheme();
  const isDark = resolvedScheme === "dark";
  const [activePickerIndex, setActivePickerIndex] = useState(null);
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          Package Items
        </Text>
        <TouchableOpacity
          style={[
            styles.addButton,
            {
              backgroundColor: isDark ? "#1e3a8a" : "#eff6ff",
              borderColor: isDark ? "#3b82f6" : "#bfdbfe",
            },
          ]}
          onPress={onAdd}
        >
          <FontAwesome5 name="plus" size={12} color="#2563eb" />
          <Text style={styles.addButtonText}>Item</Text>
        </TouchableOpacity>
      </View>

      {/* ITEMS LIST */}
      <View style={styles.list}>
        {items.map((item, idx) => (
          <View
            key={idx}
            style={[
              styles.itemCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {/* ITEM HEADER (Index + Remove) */}
            <View style={styles.itemHeader}>
              <View style={[styles.badge, { backgroundColor: colors.cardMuted }]}>
                <Text style={[styles.badgeText, { color: colors.textMuted }]}>
                  {idx + 1}
                </Text>
              </View>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => onRemove(idx)}>
                  <FontAwesome5 name="trash" size={14} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>

            {/* DESCRIPTION */}
            <Text style={[styles.label, { color: colors.textMuted }]}>
              Description
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
              placeholder="e.g. Nike Shoes"
              placeholderTextColor={colors.textMuted}
              value={item.description}
              onChangeText={(val) => onChange(idx, "description", val)}
            />

            {/* TYPE & QUANTITY ROW */}
            <View style={styles.row}>
              <View style={{ flex: 1.5 }}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Type
                </Text>
                {/* Simplified: In Mobile, you might prefer a Modal Picker, but here is a simple TextInput placeholder */}
                {/* ✅ Replaced TextInput with TouchableOpacity */}
                <TouchableOpacity
                  style={[
                    styles.input,
                    {
                      justifyContent: "center",
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setActivePickerIndex(idx)}
                >
                  <Text
                    style={{
                      color: item.packagingType ? colors.text : colors.textMuted,
                    }}
                  >
                    {item.packagingType || "Select Type"}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Qty
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
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={colors.textMuted}
                  value={String(item.quantity || "")}
                  onChangeText={(val) => onChange(idx, "quantity", val)}
                />
              </View>
            </View>

            {/* DECLARED VALUE */}
            <Text style={[styles.label, { color: colors.textMuted }]}>
              Declared Value (₱)
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
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
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
                mutedColor={colors.textMuted}
                baseBg={colors.inputBg}
                baseBorder={colors.border}
                onPress={() => onToggleTag(idx, "isFragile")}
              />
              <TagButton
                active={item.isPerishable}
                icon="snowflake"
                label="Perishable"
                color="cyan"
                mutedColor={colors.textMuted}
                baseBg={colors.inputBg}
                baseBorder={colors.border}
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

function TagButton({
  active,
  icon,
  label,
  color,
  mutedColor,
  baseBg,
  baseBorder,
  onPress,
}) {
  const activeBg = color === "amber" ? "#fffbeb" : "#ecfeff";
  const activeBorder = color === "amber" ? "#f59e0b" : "#06b6d4";
  const activeText = color === "amber" ? "#b45309" : "#0e7490";

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.tagButton,
        { backgroundColor: baseBg, borderColor: baseBorder },
        active && { backgroundColor: activeBg, borderColor: activeBorder },
      ]}
    >
      <FontAwesome5
        name={icon}
        size={12}
        color={active ? activeText : mutedColor}
      />
      <Text
        style={[
          styles.tagText,
          { color: mutedColor },
          active && { color: activeText },
        ]}
      >
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
    // elevation: 2,
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
