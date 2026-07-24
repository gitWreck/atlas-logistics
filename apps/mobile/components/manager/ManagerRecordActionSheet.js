import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "../../contexts/ThemeContext";

export default function ManagerRecordActionSheet({
  visible,
  title,
  subtitle,
  actions = [],
  onClose,
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.heading}>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={2}>{subtitle}</Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} style={[styles.close, { backgroundColor: colors.cardMuted }]}>
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.actions}>
            {actions.map((action, index) => (
              <Pressable
                key={`${action.label}-${index}`}
                disabled={action.disabled}
                style={[
                  styles.action,
                  { borderTopColor: colors.border },
                  action.disabled && styles.disabled,
                ]}
                onPress={() => {
                  onClose();
                  action.onPress?.();
                }}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.danger ? colors.dangerSoft : colors.primarySoft }]}>
                  <Feather
                    name={action.icon || "chevron-right"}
                    size={19}
                    color={action.danger ? colors.danger : "#4f46e5"}
                  />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.actionLabel, { color: action.danger ? colors.danger : colors.text }]}>
                    {action.label}
                  </Text>
                  {action.description ? (
                    <Text style={[styles.actionDescription, { color: colors.textMuted }]}>
                      {action.description}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.55)" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28 },
  handle: { width: 42, height: 5, borderRadius: 999, alignSelf: "center", marginBottom: 15 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 19, fontWeight: "900" },
  subtitle: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  close: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  actions: { marginTop: 2 },
  action: { minHeight: 68, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12 },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 14, fontWeight: "800" },
  actionDescription: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  disabled: { opacity: 0.45 },
});
