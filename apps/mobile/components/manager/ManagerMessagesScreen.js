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
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { PersonAvatar } from "../chat/ChatComponents";
import {
  createStaffConversation,
  listManagerMobileConversations,
  listStaffChatContacts,
} from "../utilities/FirebaseFunctions";
import {
  EmptyState,
  ManagerHeader,
  formatDate,
} from "./ManagerUI";

function otherProfile(conversation = {}, uid) {
  const otherId = (conversation.participantIds || []).find((id) => id !== uid);
  return conversation.participantProfiles?.[otherId] || null;
}

function titleOf(conversation, uid) {
  return (
    otherProfile(conversation, uid)?.name ||
    conversation.customerName ||
    conversation.guestName ||
    conversation.trackingNumber ||
    "Conversation"
  );
}

export default function ManagerMessagesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState("messages");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingId, setOpeningId] = useState(null);

  const load = useCallback(async ({ refresh = false } = {}) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      const [inboxResult, contactsResult] = await Promise.all([
        listManagerMobileConversations(),
        listStaffChatContacts(),
      ]);
      setConversations(inboxResult?.data?.conversations || []);
      setCalls(inboxResult?.data?.recentCalls || []);
      setContacts(contactsResult?.data?.contacts || []);
    } catch (error) {
      console.error("Manager communications load failed:", error);
      Alert.alert("Communications unavailable", error.message || "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = tab === "contacts" ? contacts : tab === "calls" ? calls : conversations;
    if (!term) return source;
    return source.filter((item) =>
      [
        item.name,
        item.roleLabel,
        item.warehouseName,
        item.municipality,
        item.customerName,
        item.trackingNumber,
        item.lastMessageText,
        item.callerName,
        item.receiverName,
        titleOf(item, user?.uid),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [calls, contacts, conversations, search, tab, user?.uid]);

  const openConversation = (conversationId) => {
    if (!conversationId) return;
    router.push({
      pathname: "/(manager)/chat/[conversationId]",
      params: { conversationId: String(conversationId) },
    });
  };

  const openContact = async (contact) => {
    if (openingId) return;
    try {
      setOpeningId(contact.id);
      const result = await createStaffConversation({ contactId: contact.id });
      openConversation(result?.data?.conversationId);
    } catch (error) {
      Alert.alert("Contact unavailable", error.message || "Unable to open this contact.");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ManagerHeader title="Messages & Calls" subtitle="Authorized operational contacts" />
      <View style={[styles.toolbar, { backgroundColor: colors.surface }]}>
        <View style={[styles.tabs, { backgroundColor: colors.cardMuted }]}>
          {[
            ["messages", "Messages"],
            ["contacts", "Contacts"],
            ["calls", "Recent Calls"],
          ].map(([value, label]) => {
            const active = tab === value;
            return (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                style={[styles.tab, active && styles.activeTab]}
              >
                <Text style={[styles.tabText, { color: active ? "#fff" : colors.textMuted }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.search, { backgroundColor: colors.cardMuted }]}>
          <Feather name="search" size={17} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${tab}`}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#0f766e" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, index) => item.id || `${tab}-${index}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ refresh: true })}
              tintColor="#0f766e"
            />
          }
          contentContainerStyle={rows.length ? undefined : styles.emptyList}
          renderItem={({ item }) => {
            if (tab === "contacts") {
              return (
                <ContactRow
                  item={item}
                  colors={colors}
                  opening={openingId === item.id}
                  onPress={() => openContact(item)}
                />
              );
            }
            if (tab === "calls") {
              return <CallRow item={item} colors={colors} onPress={() => openConversation(item.conversationId)} />;
            }
            return (
              <ConversationRow
                item={item}
                uid={user?.uid}
                colors={colors}
                onPress={() => openConversation(item.id)}
              />
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon={tab === "calls" ? "phone" : "message-circle"}
              title={`No ${tab} found`}
              message="Only contacts and conversations inside your assigned scope are shown."
            />
          }
        />
      )}
    </View>
  );
}

function ConversationRow({ item, uid, colors, onPress }) {
  const name = titleOf(item, uid);
  const unread = Number(item.unreadCounts?.[uid] || item.unreadCounts?.staff || 0);
  return (
    <Pressable onPress={onPress} style={[styles.row, { borderBottomColor: colors.border }]}>
      <PersonAvatar name={name} avatarSeed={item.id} size={48} />
      <View style={styles.rowCopy}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>{formatDate(item.lastMessageAt)}</Text>
        </View>
        <Text style={[styles.context, { color: "#0f766e" }]} numberOfLines={1}>
          {item.trackingNumber || (item.type === "direct_staff" ? "Team chat" : "Customer support")}
        </Text>
        <Text style={[styles.preview, { color: colors.textMuted }, unread && styles.unreadPreview]} numberOfLines={1}>
          {item.lastMessageText || "Open conversation"}
        </Text>
      </View>
      {unread ? (
        <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text></View>
      ) : null}
    </Pressable>
  );
}

function ContactRow({ item, colors, opening, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={opening} style={[styles.row, { borderBottomColor: colors.border }]}>
      <PersonAvatar name={item.name} avatarSeed={item.id} photoURL={item.photoURL} size={48} />
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.context, { color: "#0f766e" }]} numberOfLines={1}>{item.roleLabel}</Text>
        <Text style={[styles.preview, { color: colors.textMuted }]} numberOfLines={1}>
          {opening ? "Opening…" : [item.warehouseName, item.municipality].filter(Boolean).join(" • ")}
        </Text>
      </View>
      <Feather name="message-circle" size={20} color="#0f766e" />
    </Pressable>
  );
}

function CallRow({ item, colors, onPress }) {
  const incoming = item.direction === "incoming";
  const missed = String(item.status || "").toLowerCase().includes("miss");
  return (
    <Pressable onPress={onPress} style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.callIcon, { backgroundColor: missed ? colors.dangerSoft : colors.successSoft }]}>
        <Feather name={item.videoEnabled ? "video" : "phone"} size={19} color={missed ? colors.danger : colors.success} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>
          {item.peerName || item.callerName || item.receiverName || "Operational call"}
        </Text>
        <Text style={[styles.preview, { color: colors.textMuted }]}>
          {incoming ? "Incoming" : "Voice / video"} • {String(item.status || "ended").replace(/_/g, " ")}
        </Text>
        <Text style={[styles.time, { color: colors.textMuted }]}>{formatDate(item.endedAt || item.updatedAt || item.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { padding: 13, gap: 10 },
  tabs: { flexDirection: "row", padding: 4, borderRadius: 13, gap: 3 },
  tab: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  activeTab: { backgroundColor: "#0f766e" },
  tabText: { fontSize: 10, fontWeight: "800" },
  search: { minHeight: 44, borderRadius: 13, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, padding: 0, fontSize: 13 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyList: { flexGrow: 1 },
  row: { minHeight: 78, paddingHorizontal: 15, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 11 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", gap: 8, alignItems: "center" },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: "800" },
  time: { fontSize: 9 },
  context: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  preview: { fontSize: 12, marginTop: 3 },
  unreadPreview: { fontWeight: "800" },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  callIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});
