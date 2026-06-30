import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  FlatList,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

function QueueItem({ item, colors }) {
  const isFailed = item.status === "failed" && item.lastError;

  return (
    <View
      style={[
        styles.item,
        {
          backgroundColor: colors.surface,
          borderColor: isFailed ? "#fca5a5" : colors.border,
        },
      ]}
    >
      <View style={styles.itemHeader}>
        <FontAwesome5
          name={isFailed ? "exclamation-circle" : "clock"}
          size={12}
          color={isFailed ? "#b91c1c" : "#b45309"}
          style={styles.itemIcon}
        />
        <Text style={[styles.itemLabel, { color: colors.text }]} numberOfLines={2}>
          {item.label}
        </Text>
      </View>
      {item.lastError ? (
        <Text style={[styles.itemError, { color: "#b91c1c" }]}>{item.lastError}</Text>
      ) : null}
    </View>
  );
}

export default function OfflineSyncQueueModal({
  visible,
  onClose,
  pendingSummaries = [],
  syncing = false,
  syncNow,
}) {
  const { colors } = useTheme();

  const failedCount = pendingSummaries.filter(
    (item) => item.status === "failed" && item.lastError,
  ).length;

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]}>
                Pending sync queue
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {pendingSummaries.length} scan
                {pendingSummaries.length === 1 ? "" : "s"}
                {failedCount > 0
                  ? ` — ${failedCount} need${failedCount === 1 ? "s" : ""} attention`
                  : ""}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <FontAwesome5 name="times" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={pendingSummaries}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <QueueItem item={item} colors={colors} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No pending scans in the queue.
              </Text>
            }
          />

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
              onPress={() => void syncNow?.()}
              disabled={syncing || pendingSummaries.length === 0}
            >
              <FontAwesome5
                name="cloud-upload-alt"
                size={14}
                color="#fff"
                style={styles.syncIcon}
              />
              <Text style={styles.syncText}>
                {syncing ? "Syncing..." : "Sync now"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    maxHeight: "75%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  item: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  itemIcon: {
    marginTop: 2,
  },
  itemLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  itemError: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
    marginLeft: 20,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    paddingVertical: 24,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  syncBtn: {
    backgroundColor: "#b45309",
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  syncBtnDisabled: {
    opacity: 0.7,
  },
  syncIcon: {
    marginRight: 8,
  },
  syncText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
