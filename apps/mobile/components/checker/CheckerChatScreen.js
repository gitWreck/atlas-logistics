import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";

import { auth, db } from "../../firebase";
import {
  createCheckerConversation,
  listCheckerChatContacts,
} from "../utilities/FirebaseFunctions";
import { useTheme } from "../../contexts/ThemeContext";
import ChatThread from "../chat/ChatThread";
import { PersonAvatar } from "../chat/ChatComponents";
import {
  displayMessagePreview,
  formatListTime,
  getChatColors,
} from "../chat/chatUtils";

const TWO_PANEL_WIDTH = 900;

function ContactAvatar({ contact, colors, size = 54 }) {
  return (
    <View style={{ width: size, height: size }}>
      {contact.photoURL ? (
        <Image
          source={{ uri: contact.photoURL }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          accessibilityLabel={`${contact.name} profile picture`}
        />
      ) : (
        <PersonAvatar name={contact.name} size={size} />
      )}
      {contact.online ? (
        <View
          style={[
            styles.presence,
            { backgroundColor: colors.online, borderColor: colors.chatBg },
          ]}
        />
      ) : null}
    </View>
  );
}

function ContactRow({ contact, conversation, unread, active, colors, onPress }) {
  const preview = conversation?.lastMessageText
    ? displayMessagePreview({ text: conversation.lastMessageText })
    : `${contact.roleLabel} · ${contact.municipality}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border },
        active && { backgroundColor: colors.accentSoft },
        pressed && styles.rowPressed,
      ]}
    >
      <ContactAvatar contact={contact} colors={colors} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
            {contact.name}
          </Text>
          <Text style={[styles.rowTime, { color: colors.textMuted }]}>
            {formatListTime(conversation?.lastMessageAt)}
          </Text>
        </View>
        <Text style={[styles.role, { color: colors.accent }]} numberOfLines={1}>
          {contact.roleLabel}
        </Text>
        <View style={styles.previewLine}>
          <Text
            style={[
              styles.preview,
              { color: unread ? colors.text : colors.textMuted },
              unread > 0 && styles.previewUnread,
            ]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {unread > 0 ? (
            <View style={[styles.unread, { backgroundColor: colors.unread }]}>
              <Text style={styles.unreadText}>{unread > 99 ? "99+" : unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function CheckerChatScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const twoPanel = width >= TWO_PANEL_WIDTH;
  const { colors: themeColors, resolvedScheme } = useTheme();
  const colors = useMemo(
    () => getChatColors(themeColors, resolvedScheme),
    [themeColors, resolvedScheme],
  );

  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [accessToken, setAccessToken] = useState(null);
  const [scope, setScope] = useState({ warehouseName: null, municipalities: [] });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const uid = auth.currentUser?.uid;

  const loadContacts = useCallback(async ({ refresh = false } = {}) => {
    try {
      if (refresh) setRefreshing(true);
      const result = await listCheckerChatContacts();
      const data = result?.data || {};
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
      setAccessToken(data.accessToken || null);
      setScope({
        warehouseName: data.warehouseName || null,
        municipalities: Array.isArray(data.municipalities) ? data.municipalities : [],
      });
    } catch (error) {
      console.error("Checker contacts load failed:", error);
      Alert.alert("Messages unavailable", "Authorized contacts could not be loaded. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return undefined;
    }

    let assignmentSignature = null;
    return onSnapshot(
      doc(db, "users", uid),
      (snapshot) => {
        const profile = snapshot.data() || {};
        const nextSignature = JSON.stringify({
          warehouseId: profile.warehouseId || null,
          warehouseCode: profile.warehouseCode || null,
          warehouseName: profile.warehouseName || null,
          assignedMunicipalities: profile.assignedMunicipalities || [],
        });
        if (nextSignature !== assignmentSignature) {
          assignmentSignature = nextSignature;
          setAccessToken(null);
          setConversations([]);
          setSelectedId(null);
          void loadContacts();
        }
      },
      (error) => {
        console.error("Checker assignment subscription failed:", error);
        setLoading(false);
      },
    );
  }, [loadContacts]);

  useEffect(() => {
    if (!accessToken || !uid) return undefined;
    const conversationsQuery = query(
      collection(db, "conversations"),
      where("participantIds", "array-contains", uid),
    );
    return onSnapshot(
      conversationsQuery,
      (snapshot) => {
        const next = snapshot.docs
          .map((conversation) => ({ id: conversation.id, ...conversation.data() }))
          .filter((conversation) => conversation.type === "direct_staff")
          .sort((a, b) => {
            const left = a.lastMessageAt?.toMillis?.() || 0;
            const right = b.lastMessageAt?.toMillis?.() || 0;
            return right - left;
          });
        setConversations(next);
      },
      (error) => console.error("Checker conversations subscription failed:", error),
    );
  }, [accessToken, uid]);

  const conversationByContact = useMemo(() => {
    const result = new Map();
    conversations.forEach((conversation) => {
      const contactId = (conversation.participantIds || []).find((id) => id !== uid);
      if (contactId) result.set(contactId, conversation);
    });
    return result;
  }, [conversations, uid]);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visible = contacts.filter((contact) => {
      if (!term) return true;
      return [contact.name, contact.roleLabel, contact.municipality, contact.warehouseName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
    return visible.sort((a, b) => {
      const left = conversationByContact.get(a.id)?.lastMessageAt?.toMillis?.() || 0;
      const right = conversationByContact.get(b.id)?.lastMessageAt?.toMillis?.() || 0;
      return right - left || a.name.localeCompare(b.name);
    });
  }, [contacts, conversationByContact, search]);

  const openContact = useCallback(
    async (contact) => {
      if (openingId) return;
      try {
        setOpeningId(contact.id);
        const result = await createCheckerConversation({ contactId: contact.id });
        const conversationId = result?.data?.conversationId;
        if (!conversationId) throw new Error("Conversation was not created.");
        if (twoPanel) setSelectedId(conversationId);
        else {
          router.push({
            pathname: "/(checker)/chat/[conversationId]",
            params: { conversationId },
          });
        }
      } catch (error) {
        console.error("Checker conversation open failed:", error);
        Alert.alert(
          "Contact unavailable",
          error?.message || "This contact is no longer available for your current assignment.",
        );
        void loadContacts({ refresh: true });
      } finally {
        setOpeningId(null);
      }
    },
    [loadContacts, openingId, router, twoPanel],
  );

  const scopeLabel = [scope.warehouseName, scope.municipalities.join(", ")]
    .filter(Boolean)
    .join(" · ");

  const renderList = () => (
    <LinearGradient
      colors={
        resolvedScheme === "dark"
          ? ["#07111F", "#020916", "#07111F"]
          : [themeColors.dashboardBg, colors.chatBg, themeColors.dashboardBg]
      }
      style={styles.listPanel}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>CHECKER</Text>
          <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
          <Text style={[styles.scope, { color: colors.textMuted }]} numberOfLines={1}>
            {scopeLabel || "No warehouse or municipality assigned"}
          </Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: colors.accentSoft }]}>
          <Feather name="message-circle" size={26} color={colors.accent} />
        </View>
      </View>

      <View style={[styles.search, { backgroundColor: colors.inputBar }]}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search authorized contacts"
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.text }]}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading authorized contacts…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadContacts({ refresh: true })}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => {
            const conversation = conversationByContact.get(item.id);
            return (
              <ContactRow
                contact={item}
                conversation={conversation}
                unread={Number(conversation?.unreadCounts?.[uid] || 0)}
                active={twoPanel && conversation?.id === selectedId}
                colors={colors}
                onPress={() => openContact(item)}
              />
            );
          }}
          contentContainerStyle={filteredContacts.length ? styles.rows : styles.emptyList}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
                <Feather name={search ? "search" : "users"} size={30} color={colors.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {search ? "No authorized matches" : "No authorized contacts"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {search
                  ? "Try searching by name, role, or municipality."
                  : "Contacts will appear automatically when warehouse and municipality assignments match yours."}
              </Text>
            </View>
          }
        />
      )}
    </LinearGradient>
  );

  if (!twoPanel) return renderList();

  return (
    <View style={[styles.split, { backgroundColor: colors.chatBg }]}>
      <View style={[styles.splitList, { borderRightColor: colors.border }]}>{renderList()}</View>
      <View style={styles.splitThread}>
        {selectedId ? (
          <ChatThread conversationId={selectedId} embedded />
        ) : (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <Feather name="message-square" size={32} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Your messages</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Select an authorized contact to start a conversation.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: "row" },
  splitList: { width: 410, borderRightWidth: StyleSheet.hairlineWidth },
  splitThread: { flex: 1 },
  listPanel: { flex: 1 },
  header: {
    minHeight: 112,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  title: { marginTop: 3, fontSize: 29, fontWeight: "900" },
  scope: { marginTop: 4, maxWidth: 290, fontSize: 12, fontWeight: "600" },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    minHeight: 46,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 10 },
  rows: { paddingBottom: 90 },
  row: {
    minHeight: 86,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  rowPressed: { opacity: 0.72 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: "800" },
  rowTime: { fontSize: 11, fontWeight: "700" },
  role: { marginTop: 3, fontSize: 12, fontWeight: "700" },
  previewLine: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 },
  preview: { flex: 1, minWidth: 0, fontSize: 13 },
  previewUnread: { fontWeight: "800" },
  unread: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  presence: {
    position: "absolute",
    right: -1,
    bottom: 2,
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 3,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13, fontWeight: "600" },
  emptyList: { flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 19, fontWeight: "900", textAlign: "center" },
  emptyText: { marginTop: 8, maxWidth: 330, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
