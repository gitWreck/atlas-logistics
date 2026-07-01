import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
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
import ChatThread from "../../../components/chat/ChatThread";
import {
  ConversationSkeleton,
  SupportAvatar,
} from "../../../components/chat/ChatComponents";
import {
  displayMessagePreview,
  formatListTime,
  getChatColors,
  getStatusMeta,
} from "../../../components/chat/chatUtils";

// Breakpoint at which we switch to the Messenger-style two-panel layout
// (conversation list on the left, active thread on the right).
const TWO_PANEL_WIDTH = 900;

function ConversationRow({ item, colors, unread, active, onPress }) {
  const statusMeta = getStatusMeta(item.status);
  const isYou = item.lastMessageBy === auth.currentUser?.uid;
  const preview = displayMessagePreview({ text: item.lastMessageText });
  const previewText = preview
    ? `${isYou ? "You: " : ""}${preview}`
    : "Conversation started";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        active && { backgroundColor: colors.accentSoft },
        pressed && !active && { backgroundColor: colors.cardMuted },
      ]}
      android_ripple={{ color: colors.cardMuted }}
    >
      <SupportAvatar size={56} online ringColor={colors.surface} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text
            style={[
              styles.rowTitle,
              { color: colors.text },
              unread > 0 && styles.rowTitleUnread,
            ]}
            numberOfLines={1}
          >
            {item.trackingNumber || "Atlas Support"}
          </Text>
          <Text
            style={[
              styles.rowTime,
              { color: unread > 0 ? colors.accent : colors.textMuted },
            ]}
          >
            {formatListTime(item.lastMessageAt)}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[
              styles.rowPreview,
              { color: unread > 0 ? colors.text : colors.textMuted },
              unread > 0 && styles.rowPreviewUnread,
            ]}
            numberOfLines={1}
          >
            {previewText}
          </Text>
          {unread > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.unread }]}>
              <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
            </View>
          ) : (
            <View
              style={[styles.statusDotSm, { backgroundColor: statusMeta.dot }]}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function CustomerChatListScreen() {
  const router = useRouter();
  const { colors: themeColors, resolvedScheme } = useTheme();
  const colors = useMemo(
    () => getChatColors(themeColors, resolvedScheme),
    [themeColors, resolvedScheme],
  );
  const { width } = useWindowDimensions();
  const twoPanel = width >= TWO_PANEL_WIDTH;

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [initialMessage, setInitialMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

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

  const uid = auth.currentUser?.uid;

  const unreadTotal = useMemo(
    () =>
      conversations.reduce(
        (sum, item) => sum + Number(item.unreadCounts?.[uid] || 0),
        0,
      ),
    [conversations, uid],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((item) => {
      const haystack = [
        item.trackingNumber,
        item.customerName,
        item.status,
        item.lastMessageText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [conversations, search]);

  // Auto-select the first conversation when the two-panel layout is active.
  useEffect(() => {
    if (twoPanel && !selectedId && filtered.length) {
      setSelectedId(filtered[0].id);
    }
  }, [twoPanel, selectedId, filtered]);

  const openConversation = (id) => {
    if (twoPanel) {
      setSelectedId(id);
    } else {
      router.push({
        pathname: "/(customer)/chat/[conversationId]",
        params: { conversationId: id },
      });
    }
  };

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
        openConversation(conversationId);
      }
    } catch (error) {
      console.error("Failed to start chat:", error);
    } finally {
      setStarting(false);
    }
  };

  const handleMarkAllRead = async () => {
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

  const renderHeader = () => (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
      {!twoPanel && (
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <FontAwesome5 name="chevron-left" size={18} color={colors.accent} />
        </TouchableOpacity>
      )}
      <View style={styles.headerText}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Chats</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
          {unreadTotal > 0 ? `${unreadTotal} unread` : "All caught up"}
        </Text>
      </View>
      {unreadTotal > 0 && (
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.cardMuted }]}
          onPress={handleMarkAllRead}
          disabled={markingRead}
        >
          {markingRead ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <FontAwesome5 name="check-double" size={14} color={colors.textMuted} />
          )}
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.composeBtn, { backgroundColor: colors.accent }]}
        onPress={() => setComposeVisible(true)}
        disabled={starting}
      >
        {starting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <FontAwesome5 name="pen" size={14} color="#ffffff" />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderSearch = () => (
    <View style={styles.searchWrap}>
      <View
        style={[
          styles.searchBar,
          { backgroundColor: colors.inputBar, borderColor: colors.border },
        ]}
      >
        <FontAwesome5 name="search" size={13} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search messages"
          placeholderTextColor={colors.textMuted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <FontAwesome5 name="times-circle" size={15} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderList = () => (
    <>
      {renderSearch()}
      {loading ? (
        <View>
          {Array.from({ length: 7 }).map((_, i) => (
            <ConversationSkeleton key={i} colors={colors} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationRow
              item={item}
              colors={colors}
              unread={Number(item.unreadCounts?.[uid] || 0)}
              active={twoPanel && item.id === selectedId}
              onPress={() => openConversation(item.id)}
            />
          )}
          contentContainerStyle={
            filtered.length === 0 ? styles.emptyList : styles.list
          }
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <SupportAvatar size={72} online ringColor={colors.bg} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {search ? "No matches found" : "No messages yet"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {search
                  ? "Try a different tracking number or keyword."
                  : "Start a support chat when you need help with a shipment."}
              </Text>
              {!search && (
                <TouchableOpacity
                  style={[styles.emptyButton, { backgroundColor: colors.accent }]}
                  onPress={() => setComposeVisible(true)}
                >
                  <FontAwesome5 name="pen" size={13} color="#ffffff" />
                  <Text style={styles.emptyButtonText}>Start a chat</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />

      {twoPanel ? (
        <View style={styles.splitRoot}>
          <View
            style={[
              styles.splitList,
              { backgroundColor: colors.surface, borderRightColor: colors.border },
            ]}
          >
            {renderHeader()}
            {renderList()}
          </View>
          <View style={[styles.splitThread, { backgroundColor: colors.chatBg }]}>
            {selectedId ? (
              <ChatThread conversationId={selectedId} />
            ) : (
              <View style={styles.splitPlaceholder}>
                <SupportAvatar size={80} online ringColor={colors.chatBg} />
                <Text style={[styles.placeholderTitle, { color: colors.text }]}>
                  Your messages
                </Text>
                <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
                  Select a conversation to start chatting with Atlas Support.
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <>
          {renderHeader()}
          {renderList()}
        </>
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
                  backgroundColor: colors.inputBar,
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
                  { backgroundColor: colors.accent },
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
  splitRoot: { flex: 1, flexDirection: "row" },
  splitList: {
    width: 360,
    borderRightWidth: 1,
  },
  splitThread: { flex: 1 },
  splitPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 10,
  },
  placeholderTitle: { fontSize: 20, fontWeight: "800", marginTop: 6 },
  placeholderText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, marginLeft: 2 },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  composeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  list: { paddingVertical: 4 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowBody: { flex: 1, minWidth: 0, justifyContent: "center" },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: "600" },
  rowTitleUnread: { fontWeight: "800" },
  rowTime: { fontSize: 12, fontWeight: "600" },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 3,
  },
  rowPreview: { flex: 1, fontSize: 13 },
  rowPreviewUnread: { fontWeight: "700" },
  statusDotSm: { width: 8, height: 8, borderRadius: 4 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
  emptyState: { alignItems: "center", paddingHorizontal: 30, gap: 8 },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: "800" },
  emptyText: { textAlign: "center", fontSize: 13, lineHeight: 19 },
  emptyButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  emptyButtonText: { color: "#ffffff", fontWeight: "800" },
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
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalSubtitle: { marginTop: 5, fontSize: 13, lineHeight: 18 },
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
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: { fontWeight: "800" },
  modalSend: {
    minWidth: 88,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.45 },
  modalSendText: { color: "#ffffff", fontWeight: "800" },
});
