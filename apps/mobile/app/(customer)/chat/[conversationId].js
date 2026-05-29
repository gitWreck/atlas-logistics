import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { auth, db } from "../../../firebase";
import {
  markConversationRead,
  sendChatMessage,
} from "../../../components/utilities/FirebaseFunctions";
import { useTheme } from "../../../contexts/ThemeContext";

function formatTime(value) {
  const date = value?.toDate?.() || null;
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function CustomerChatThreadScreen() {
  const { conversationId } = useLocalSearchParams();
  const router = useRouter();
  const { colors, resolvedScheme } = useTheme();
  const listRef = useRef(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!conversationId) return undefined;

    const unsubscribe = onSnapshot(
      doc(db, "conversations", String(conversationId)),
      (snapshot) => {
        setConversation(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
        setLoading(false);
      },
      (error) => {
        console.error("Conversation subscription error:", error);
        setLoading(false);
      },
    );

    markConversationRead({ conversationId: String(conversationId) }).catch(
      () => {},
    );

    return unsubscribe;
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return undefined;

    const q = query(
      collection(db, "conversations", String(conversationId), "messages"),
      orderBy("createdAt", "asc"),
      limit(200),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      },
      (error) => console.error("Messages subscription error:", error),
    );
  }, [conversationId]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !conversationId || sending) return;

    try {
      setSending(true);
      await sendChatMessage({
        conversationId: String(conversationId),
        text,
      });
      setDraft("");
      markConversationRead({ conversationId: String(conversationId) }).catch(
        () => {},
      );
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const mine = item.senderId === auth.currentUser?.uid;
    return (
      <View
        style={[
          styles.messageRow,
          mine ? styles.messageRowMine : styles.messageRowTheirs,
        ]}
      >
        <View
          style={[
            styles.bubble,
            mine
              ? styles.bubbleMine
              : {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
          ]}
        >
          {!mine && (
            <Text style={[styles.sender, { color: colors.textMuted }]}>
              {item.senderName || "Atlas Support"}
            </Text>
          )}
          <Text style={[styles.messageText, { color: mine ? "#fff" : colors.text }]}>
            {item.text}
          </Text>
          <Text
            style={[
              styles.messageTime,
              { color: mine ? "rgba(255,255,255,0.75)" : colors.textMuted },
            ]}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  const isClosed = conversation?.status === "closed";

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
            Atlas Support
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {conversation?.trackingNumber || "General support"} ·{" "}
            {conversation?.status || "open"}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messages}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
            ListEmptyComponent={
              <View style={styles.emptyThread}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Send a message and the Atlas team will reply here.
                </Text>
              </View>
            }
          />

          <View
            style={[
              styles.composer,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.cardMuted,
                  borderColor: colors.border,
                },
              ]}
              value={draft}
              onChangeText={setDraft}
              placeholder={isClosed ? "Conversation closed" : "Type a message..."}
              placeholderTextColor={colors.textMuted}
              editable={!isClosed}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!draft.trim() || sending || isClosed) && styles.sendBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={!draft.trim() || sending || isClosed}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <FontAwesome5 name="paper-plane" size={15} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
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
    fontSize: 17,
    fontWeight: "800",
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    textTransform: "capitalize",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  keyboard: {
    flex: 1,
  },
  messages: {
    padding: 16,
    paddingBottom: 20,
  },
  messageRow: {
    marginBottom: 10,
  },
  messageRowMine: {
    alignItems: "flex-end",
  },
  messageRowTheirs: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: "#2563eb",
    borderBottomRightRadius: 6,
  },
  sender: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTime: {
    alignSelf: "flex-end",
    marginTop: 5,
    fontSize: 10,
    fontWeight: "600",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 112,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  emptyThread: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
  },
});
