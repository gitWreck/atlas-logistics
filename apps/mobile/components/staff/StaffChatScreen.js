import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../../firebase";
import {
  createStaffConversation,
  listStaffChatContacts,
} from "../utilities/FirebaseFunctions";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { PersonAvatar } from "../chat/ChatComponents";
import {
  displayMessagePreview,
  formatListTime,
  getChatColors,
} from "../chat/chatUtils";

const CUSTOMER_THREAD_TYPES = new Set([
  "customer_support",
  "guest_support",
  "shipment",
]);

function threadTitle(conversation, uid) {
  const type = String(conversation?.type || "");
  if (type === "shipment") {
    return (
      conversation.customerName ||
      conversation.trackingNumber ||
      conversation.shipmentId ||
      "Shipment customer"
    );
  }
  if (type === "guest_support") {
    return conversation.customerName || conversation.guestName || "Website guest";
  }
  if (type === "customer_support") {
    return conversation.customerName || "Customer support";
  }
  const profiles = conversation?.participantProfiles || {};
  const otherId = (conversation?.participantIds || []).find((id) => id !== uid);
  return profiles[otherId]?.name || conversation?.lastMessageByName || "Conversation";
}

function threadSubtitle(conversation) {
  const type = String(conversation?.type || "");
  if (type === "shipment") {
    return [
      conversation.trackingNumber,
      conversation.shipmentId ? `Shipment ${conversation.shipmentId}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (type === "guest_support") return "Guest support";
  if (type === "customer_support") return "Customer support";
  return "Team chat";
}

export default function StaffChatScreen({
  chatPathname = "/(staff)/chat/[conversationId]",
}) {
  const router = useRouter();
  const { colors: themeColors, resolvedScheme } = useTheme();
  const { user, role } = useAuth();
  const colors = useMemo(
    () => getChatColors(themeColors, resolvedScheme),
    [themeColors, resolvedScheme],
  );

  const [tab, setTab] = useState("customers"); // customers | team
  const [contacts, setContacts] = useState([]);
  const [teamConversations, setTeamConversations] = useState([]);
  const [customerConversations, setCustomerConversations] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const uid = auth.currentUser?.uid || user?.uid;
  const roleLabel = String(role || user?.role || "staff").toUpperCase();

  const loadContacts = useCallback(async ({ refresh = false } = {}) => {
    try {
      if (refresh) setRefreshing(true);
      const result = await listStaffChatContacts();
      setContacts(Array.isArray(result?.data?.contacts) ? result.data.contacts : []);
    } catch (error) {
      console.error("Staff contacts load failed:", error);
      Alert.alert(
        "Messages unavailable",
        "Team contacts could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (!uid) return undefined;
    const teamQuery = query(
      collection(db, "conversations"),
      where("type", "==", "direct_staff"),
      where("participantIds", "array-contains", uid),
    );
    return onSnapshot(
      teamQuery,
      (snapshot) => {
        const next = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .sort((a, b) => {
            const left = a.lastMessageAt?.toMillis?.() || 0;
            const right = b.lastMessageAt?.toMillis?.() || 0;
            return right - left;
          });
        setTeamConversations(next);
      },
      (error) => console.error("Staff team conversations failed:", error),
    );
  }, [uid]);

  useEffect(() => {
    const inboxQuery = query(
      collection(db, "conversations"),
      orderBy("lastMessageAt", "desc"),
      limit(120),
    );
    return onSnapshot(
      inboxQuery,
      (snapshot) => {
        const next = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((conversation) =>
            CUSTOMER_THREAD_TYPES.has(String(conversation.type || "")),
          );
        setCustomerConversations(next);
      },
      (error) => console.error("Staff customer inbox failed:", error),
    );
  }, []);

  const conversationByContact = useMemo(() => {
    const result = new Map();
    teamConversations.forEach((conversation) => {
      const contactId = (conversation.participantIds || []).find((id) => id !== uid);
      if (contactId) result.set(contactId, conversation);
    });
    return result;
  }, [teamConversations, uid]);

  const filteredCustomerConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customerConversations;
    return customerConversations.filter((conversation) =>
      [
        threadTitle(conversation, uid),
        threadSubtitle(conversation),
        conversation.lastMessageText,
        conversation.trackingNumber,
        conversation.customerName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [customerConversations, search, uid]);

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

  const openConversation = useCallback(
    (conversationId) => {
      if (!conversationId) return;
      router.push({
        pathname: chatPathname,
        params: { conversationId: String(conversationId) },
      });
    },
    [chatPathname, router],
  );

  const openContact = useCallback(
    async (contact) => {
      if (openingId) return;
      try {
        setOpeningId(contact.id);
        const result = await createStaffConversation({ contactId: contact.id });
        const conversationId = result?.data?.conversationId;
        if (!conversationId) throw new Error("Conversation was not created.");
        openConversation(conversationId);
      } catch (error) {
        console.error("Staff conversation open failed:", error);
        Alert.alert(
          "Contact unavailable",
          error?.message || "Unable to open this conversation.",
        );
        void loadContacts({ refresh: true });
      } finally {
        setOpeningId(null);
      }
    },
    [loadContacts, openConversation, openingId],
  );

  const renderCustomerRow = ({ item }) => {
    const unread = Number(item.unreadCounts?.[uid] || 0);
    return (
      <Pressable
        onPress={() => openConversation(item.id)}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: colors.border },
          pressed && styles.rowPressed,
        ]}
      >
        <PersonAvatar
          name={threadTitle(item, uid)}
          avatarSeed={item.id}
          size={48}
        />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
              {threadTitle(item, uid)}
            </Text>
            <Text style={[styles.rowTime, { color: colors.textMuted }]}>
              {formatListTime(item.lastMessageAt)}
            </Text>
          </View>
          <Text style={[styles.role, { color: colors.accent }]} numberOfLines={1}>
            {threadSubtitle(item)}
          </Text>
          <Text
            style={[
              styles.preview,
              { color: unread ? colors.text : colors.textMuted },
              unread > 0 && styles.previewUnread,
            ]}
            numberOfLines={1}
          >
            {displayMessagePreview({ text: item.lastMessageText })}
          </Text>
        </View>
        {unread > 0 ? (
          <View style={[styles.unread, { backgroundColor: colors.unread }]}>
            <Text style={styles.unreadText}>{unread > 99 ? "99+" : unread}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const renderContactRow = ({ item }) => {
    const conversation = conversationByContact.get(item.id);
    const unread = Number(conversation?.unreadCounts?.[uid] || 0);
    const preview = conversation?.lastMessageText
      ? displayMessagePreview({ text: conversation.lastMessageText })
      : "Start a conversation";

    return (
      <Pressable
        onPress={() => openContact(item)}
        disabled={openingId === item.id}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: colors.border },
          pressed && styles.rowPressed,
        ]}
      >
        <View style={{ width: 48, height: 48 }}>
          <PersonAvatar
            name={item.name}
            avatarSeed={item.id || item.name}
            photoURL={item.photoURL}
            size={48}
          />
          {item.online ? (
            <View
              style={[
                styles.presence,
                { backgroundColor: colors.online, borderColor: colors.chatBg },
              ]}
            />
          ) : null}
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.rowTime, { color: colors.textMuted }]}>
              {formatListTime(conversation?.lastMessageAt)}
            </Text>
          </View>
          <Text style={[styles.role, { color: colors.accent }]} numberOfLines={1}>
            {[item.roleLabel, item.warehouseName].filter(Boolean).join(" · ")}
          </Text>
          <Text
            style={[
              styles.preview,
              { color: unread ? colors.text : colors.textMuted },
              unread > 0 && styles.previewUnread,
            ]}
            numberOfLines={1}
          >
            {openingId === item.id ? "Opening…" : preview}
          </Text>
        </View>
        {unread > 0 ? (
          <View style={[styles.unread, { backgroundColor: colors.unread }]}>
            <Text style={styles.unreadText}>{unread > 99 ? "99+" : unread}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.chatBg }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>{roleLabel}</Text>
        <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
        <Text style={[styles.scope, { color: colors.textMuted }]}>
          Customers, support, and team
        </Text>
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.inputBar }]}>
        {[
          ["customers", "Customers"],
          ["team", "Team"],
        ].map(([value, label]) => {
          const active = tab === value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.tab, active && { backgroundColor: colors.accentSoft }]}
              onPress={() => setTab(value)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.accent : colors.textMuted },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.search, { backgroundColor: colors.inputBar }]}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={tab === "team" ? "Search team" : "Search customers"}
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

      {loading && tab === "team" ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : tab === "customers" ? (
        <FlatList
          data={filteredCustomerConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderCustomerRow}
          contentContainerStyle={
            filteredCustomerConversations.length === 0 ? styles.emptyWrap : undefined
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              No customer conversations yet. Open a shipment to start one.
            </Text>
          }
        />
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContactRow}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadContacts({ refresh: true })}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={
            filteredContacts.length === 0 ? styles.emptyWrap : undefined
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              No team contacts found.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { fontSize: 28, fontWeight: "800", marginTop: 2 },
  scope: { fontSize: 13, marginTop: 4 },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabText: { fontSize: 13, fontWeight: "700" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: { opacity: 0.7 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: "700" },
  rowTime: { fontSize: 12 },
  role: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  preview: { fontSize: 13, marginTop: 2 },
  previewUnread: { fontWeight: "700" },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  presence: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { flexGrow: 1, justifyContent: "center", padding: 32 },
  empty: { textAlign: "center", fontSize: 14, lineHeight: 20 },
});
