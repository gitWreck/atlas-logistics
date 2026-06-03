import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../../../firebase";
import {
  createConversation,
  markConversationRead,
} from "../../../components/utilities/FirebaseFunctions";
import { useTheme } from "../../../contexts/ThemeContext";

function formatTime(value) {
  const date = value?.toDate?.() || null;
  if (!date) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getStatusStyle(status) {
  const normalized = String(status || "open").toLowerCase();

  if (normalized === "pending") {
    return {
      icon: "#d97706",
      border: "#f59e0b",
      soft: "#fffbeb",
      chip: "#f59e0b",
      text: "#92400e",
    };
  }

  if (normalized === "resolved") {
    return {
      icon: "#2563eb",
      border: "#60a5fa",
      soft: "#eff6ff",
      chip: "#2563eb",
      text: "#1d4ed8",
    };
  }

  if (normalized === "closed") {
    return {
      icon: "#64748b",
      border: "#cbd5e1",
      soft: "#f8fafc",
      chip: "#64748b",
      text: "#475569",
    };
  }

  return {
    icon: "#059669",
    border: "#34d399",
    soft: "#ecfdf5",
    chip: "#059669",
    text: "#047857",
  };
}

export default function CustomerChatListScreen() {
  const router = useRouter();
  const { colors, resolvedScheme } = useTheme();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [initialMessage, setInitialMessage] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return undefined;

    const q = query(
      collection(db, "conversations"),
      where("customerId", "==", user.uid),
      orderBy("lastMessageAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setConversations(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
        setLoading(false);
      },
      (error) => {
        console.error("Chat list subscription error:", error);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const unreadTotal = useMemo(() => {
    const uid = auth.currentUser?.uid;
    return conversations.reduce(
      (sum, item) => sum + Number(item.unreadCounts?.[uid] || 0),
      0,
    );
  }, [conversations]);

  const handleStartGeneral = async () => {
    const message = initialMessage.trim();
    if (!message) {
      Alert.alert("Message required", "Type a message to start a new chat.");
      return;
    }

    try {
      setStarting(true);
      const result = await createConversation({ message });
      const conversationId = result?.data?.conversationId;
      if (conversationId) {
        setInitialMessage("");
        setComposeVisible(false);
        router.push({
          pathname: "/(customer)/chat/[conversationId]",
          params: { conversationId },
        });
      }
    } catch (error) {
      console.error("Failed to start chat:", error);
    } finally {
      setStarting(false);
    }
  };

  const handleMarkAllRead = async () => {
    const uid = auth.currentUser?.uid;
    const unreadConversations = conversations.filter(
      (item) => Number(item.unreadCounts?.[uid] || 0) > 0,
    );

    if (!unreadConversations.length || markingRead) return;

    try {
      setMarkingRead(true);
      await Promise.all(
        unreadConversations.map((item) =>
          markConversationRead({ conversationId: item.id }),
        ),
      );
    } catch (error) {
      console.error("Failed to mark chats read:", error);
    } finally {
      setMarkingRead(false);
    }
  };

  const renderItem = ({ item }) => {
    const unread = Number(item.unreadCounts?.[auth.currentUser?.uid] || 0);
    const statusStyle = getStatusStyle(item.status);
    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: unread > 0 ? statusStyle.border : colors.border,
          },
          unread > 0 && styles.cardUnread,
        ]}
        activeOpacity={0.85}
        onPress={() =>
          router.push({
            pathname: "/(customer)/chat/[conversationId]",
            params: { conversationId: item.id },
          })
        }
      >
        <View style={[styles.avatar, { backgroundColor: statusStyle.soft }]}>
          <FontAwesome5 name="headset" size={16} color={statusStyle.icon} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Text style={[styles.title, { color: colors.text }]}>
              {item.trackingNumber || "Support"}
            </Text>
            <Text style={[styles.time, { color: colors.textMuted }]}>
              {formatTime(item.lastMessageAt)}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <View
              style={[styles.statusChip, { backgroundColor: statusStyle.soft }]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: statusStyle.chip },
                ]}
              />
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {item.status || "open"}
              </Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {item.customerName || "You"}
            </Text>
          </View>
          <Text
            style={[styles.preview, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.lastMessageText || "Conversation started"}
          </Text>
        </View>
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />

      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <FontAwesome5 name="chevron-left" size={16} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Messages
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {unreadTotal} unread
          </Text>
        </View>
        {unreadTotal > 0 && (
          <TouchableOpacity
            style={[
              styles.markReadBtn,
              { borderColor: colors.border, backgroundColor: colors.cardMuted },
            ]}
            onPress={handleMarkAllRead}
            disabled={markingRead}
          >
            {markingRead ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <FontAwesome5
                name="check-double"
                size={13}
                color={colors.textMuted}
              />
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => setComposeVisible(true)}
          disabled={starting}
        >
          {starting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <FontAwesome5 name="plus" size={14} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            conversations.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <FontAwesome5
                name="comments"
                size={34}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No messages yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Start a support chat when you need help with a shipment.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setComposeVisible(true)}
              >
                <Text style={styles.emptyButtonText}>Start Chat</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal
        transparent
        animationType="fade"
        visible={composeVisible}
        onRequestClose={() => setComposeVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              New message
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              The conversation appears only after you send this message.
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: colors.text,
                  backgroundColor: colors.cardMuted,
                  borderColor: colors.border,
                },
              ]}
              value={initialMessage}
              onChangeText={setInitialMessage}
              placeholder="How can Atlas help?"
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalCancel,
                  { borderColor: colors.border, backgroundColor: colors.cardMuted },
                ]}
                onPress={() => {
                  setComposeVisible(false);
                  setInitialMessage("");
                }}
                disabled={starting}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSend,
                  (!initialMessage.trim() || starting) && styles.sendDisabled,
                ]}
                onPress={handleStartGeneral}
                disabled={!initialMessage.trim() || starting}
              >
                {starting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSendText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0,
  },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  startBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  markReadBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardUnread: {
    borderWidth: 1.5,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  time: {
    fontSize: 11,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 12,
    textTransform: "capitalize",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  statusChip: {
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  preview: {
    marginTop: 5,
    fontSize: 13,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    backgroundColor: "#ef4444",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 28,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
  },
  emptyButton: {
    marginTop: 18,
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  emptyButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalSubtitle: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
  },
  modalInput: {
    minHeight: 112,
    maxHeight: 180,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: "top",
  },
  modalActions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancel: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontWeight: "800",
  },
  modalSend: {
    minWidth: 82,
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  sendDisabled: {
    opacity: 0.45,
  },
  modalSendText: {
    color: "#ffffff",
    fontWeight: "800",
  },
});
