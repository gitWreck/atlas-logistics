import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
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
import CustomerBottomNav from "../../../components/customer/CustomerBottomNav";
import { displayMessagePreview, formatListTime } from "../../../components/chat/chatUtils";

const TWO_PANEL_WIDTH = 900;
const BG = "#020b18";
const PANEL = "#071d34";
const TEXT = "#f1f5f9";
const MUTED = "#aab8cf";
const BLUE = "#0b7dff";
const GREEN = "#2bd66f";
const BORDER = "#143353";

function supportPalette(theme, scheme) {
  const dark = scheme === "dark";
  return {
    bg: dark ? "#07111F" : theme.dashboardBg,
    bg2: dark ? "#020916" : theme.dashboardBg,
    surface: theme.surface,
    surface2: theme.cardMuted,
    card: dark ? theme.cardMuted : theme.surface,
    border: theme.border,
    text: theme.text,
    muted: theme.textMuted,
    primary: theme.primary,
    primarySoft: theme.primarySoft,
    onPrimary: theme.onPrimary,
    success: theme.success,
    warning: theme.warning,
    danger: theme.danger,
    iconMuted: theme.iconMuted,
    navBg: dark ? "rgba(8,17,29,0.94)" : theme.surface,
    overlay: dark ? "rgba(0,0,0,0.42)" : "rgba(15,23,42,0.18)",
  };
}

const CONCERN_CATEGORIES = [
  {
    key: "delivery_status",
    title: "Delivery Status",
    description: "Check the current shipment status.",
    icon: "map-pin",
    starter: "I need help checking my delivery status.",
  },
  {
    key: "delivery_concern",
    title: "Delivery Concern",
    description: "Report delivery issues such as delays or missing parcels.",
    icon: "alert-triangle",
    starter: "I need help with a delivery concern.",
  },
  {
    key: "change_delivery",
    title: "Change Delivery",
    description: "Request a delivery schedule or address change.",
    icon: "calendar",
    starter: "I would like to request a delivery change.",
  },
  {
    key: "other",
    title: "Other Concerns",
    description: "General inquiries or service concerns.",
    icon: "message-circle",
    starter: "I need help with another concern.",
  },
];

function SupportAvatar({ ui, size = 52, packageIcon = false, showPresence = false }) {
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: packageIcon ? ui.surface2 : ui.primary,
          },
        ]}
      >
        <Feather
          name={packageIcon ? "package" : "headphones"}
          size={packageIcon ? size * 0.42 : size * 0.39}
          color={packageIcon ? ui.warning : ui.onPrimary}
        />
      </View>
      {showPresence && (
        <>
          <View style={[styles.presence, { right: -2, bottom: size * 0.12, backgroundColor: ui.success, borderColor: ui.bg }]} />
        </>
      )}
    </View>
  );
}

function TruckIllustration({ ui }) {
  return (
    <Image
      source={require("../../../assets/customer/support-truck-3d.png")}
      style={styles.truckImage}
      resizeMode="contain"
      accessibilityLabel="Atlas delivery truck"
    />
  );
}

function ConversationRow({ ui, item, unread, active, onPress }) {
  const isShipment = !!item.trackingNumber;
  const status = String(item.status || "open").toLowerCase();
  const isResolved = ["resolved", "closed", "archived"].includes(status);
  const title = isShipment ? `Shipment #${item.trackingNumber}` : isResolved ? "Support Ticket #0021" : "Atlas Support";
  const statusLabel = isShipment
    ? item.shipmentSummary?.status || (status === "pending" ? "In Transit" : "Out for Delivery")
    : isResolved
      ? "Resolved"
      : "";
  const normalizedStatus = String(statusLabel || item.shipmentSummary?.status || item.status || "").toLowerCase();
  const statusColor = isResolved
    ? ui.success
    : normalizedStatus.includes("transit")
      ? ui.warning
      : normalizedStatus.includes("delivered")
        ? ui.muted
        : ui.primary;
  const preview = displayMessagePreview({ text: item.lastMessageText });
  const fallback = isShipment
    ? statusLabel === "In Transit"
      ? "Your shipment is now in transit."
      : "Your package is out for delivery. ETA..."
    : isResolved
      ? "Your issue has been resolved."
      : "How can we help you today?";

  const showPresence = active || (!isResolved && status === "open");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        active && { backgroundColor: ui.primarySoft },
        pressed && styles.rowPressed,
        { borderBottomColor: ui.border },
      ]}
    >
      <SupportAvatar ui={ui} packageIcon={isShipment} showPresence={showPresence} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <View style={styles.titleLine}>
            <Text style={[styles.rowTitle, { color: ui.text }]} numberOfLines={1}>{title}</Text>
            {!isShipment && !isResolved && (
              <View style={[styles.newPill, { backgroundColor: ui.primary }]}>
                <Text style={[styles.newPillText, { color: ui.onPrimary }]}>New</Text>
              </View>
            )}
          </View>
          <Text style={[styles.rowTime, { color: ui.muted }]}>{formatListTime(item.lastMessageAt) || "9:41 AM"}</Text>
        </View>
        {!!statusLabel && (
          <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
            {statusLabel}
          </Text>
        )}
        <View style={styles.previewLine}>
          <Text style={[styles.previewText, { color: ui.muted }]} numberOfLines={1}>
            {preview || fallback}
          </Text>
          {unread > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: ui.primary }]}>
              <Text style={[styles.unreadBadgeText, { color: ui.onPrimary }]}>{unread > 9 ? "9+" : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function CustomerChatListScreen() {
  const router = useRouter();
  const { colors: themeColors, resolvedScheme } = useTheme();
  const ui = useMemo(
    () => supportPalette(themeColors, resolvedScheme),
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
  const [selectedCategory, setSelectedCategory] = useState(CONCERN_CATEGORIES[0]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
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
        setConversations(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
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
    () => conversations.reduce((sum, item) => sum + Number(item.unreadCounts?.[uid] || 0), 0),
    [conversations, uid],
  );

  const filterCounts = useMemo(() => {
    const counts = { all: conversations.length, open: 0, resolved: 0 };
    conversations.forEach((item) => {
      const status = String(item.status || "open").toLowerCase();
      if (["resolved", "closed", "archived"].includes(status)) counts.resolved += 1;
      else counts.open += 1;
    });
    return counts;
  }, [conversations]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations.filter((item) => {
      const status = String(item.status || "open").toLowerCase();
      const resolved = ["resolved", "closed", "archived"].includes(status);
      if (filter === "open" && resolved) return false;
      if (filter === "resolved" && !resolved) return false;
      if (!term) return true;
      return [item.trackingNumber, item.customerName, item.status, item.lastMessageText]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [conversations, filter, search]);

  useEffect(() => {
    if (twoPanel && !selectedId && filtered.length) setSelectedId(filtered[0].id);
  }, [twoPanel, selectedId, filtered]);

  const openConversation = (id) => {
    if (twoPanel) setSelectedId(id);
    else {
      router.push({
        pathname: "/(customer)/chat/[conversationId]",
        params: { conversationId: id },
      });
    }
  };

  const handleStartGeneral = async () => {
    const detail = initialMessage.trim();
    const category = selectedCategory || CONCERN_CATEGORIES[0];
    const message = detail ? `${category.title}: ${detail}` : `${category.title}: ${category.starter}`;

    try {
      setStarting(true);
      const result = await createConversation({ message });
      const conversationId = result?.data?.conversationId;
      if (conversationId) {
        setInitialMessage("");
        setSelectedCategory(CONCERN_CATEGORIES[0]);
        setComposeVisible(false);
        openConversation(conversationId);
      }
    } catch (error) {
      console.error("Failed to start chat:", error);
      Alert.alert("Unable to start conversation", "Please try again in a moment.");
    } finally {
      setStarting(false);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadConversations = conversations.filter((item) => Number(item.unreadCounts?.[uid] || 0) > 0);
    if (!unreadConversations.length || markingRead) return;

    try {
      setMarkingRead(true);
      await Promise.all(unreadConversations.map((item) => markConversationRead({ conversationId: item.id })));
    } catch (error) {
      console.error("Failed to mark chats read:", error);
    } finally {
      setMarkingRead(false);
    }
  };

  const renderList = () => (
    <LinearGradient colors={[ui.bg2, ui.bg, ui.bg2]} style={styles.phone}>
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={[styles.brand, { color: ui.text }]}>ATLAS</Text>
          <Text style={[styles.brandSub, { color: ui.text }]}>Customer Support</Text>
        </View>
        <TruckIllustration />
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: ui.surface2 }]}>
          <Feather name="search" size={17} color={ui.muted} />
          <TextInput
            style={[styles.searchInput, { color: ui.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search conversations"
            placeholderTextColor={ui.muted}
          />
        </View>
       
      </View>

      <View style={styles.tabs}>
        {[
          { key: "all", label: "All", count: filterCounts.all },
          { key: "open", label: "Open", count: filterCounts.open },
          { key: "resolved", label: "Resolved", count: filterCounts.resolved },
        ].map((item) => {
          const active = filter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.tab, { backgroundColor: active ? ui.primary : ui.surface2 }]}
              onPress={() => setFilter(item.key)}
              activeOpacity={0.86}
            >
              <Text style={[styles.tabText, { color: active ? ui.onPrimary : ui.text }]}>{item.label}</Text>
              <View style={[styles.tabCount, { backgroundColor: active ? "rgba(255,255,255,0.20)" : ui.surface }]}>
                <Text style={[styles.tabCountText, { color: active ? ui.onPrimary : ui.muted }]}>{item.count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={ui.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationRow
              ui={ui}
              item={item}
              unread={Number(item.unreadCounts?.[uid] || 0)}
              active={twoPanel && item.id === selectedId}
              onPress={() => openConversation(item.id)}
            />
          )}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <SupportAvatar ui={ui} size={70} />
              <Text style={[styles.emptyTitle, { color: ui.text }]}>{search ? "No matches found" : "No messages yet"}</Text>
              <Text style={[styles.emptyText, { color: ui.muted }]}>
                {search ? "Try another tracking number or keyword." : "Start a support chat when you need help."}
              </Text>
            </View>
          }
        />
      )}

      <CustomerBottomNav active="messages" unreadMessages={unreadTotal} />
    </LinearGradient>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ui.bg }]}>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />
      {twoPanel ? (
        <View style={[styles.splitRoot, { backgroundColor: ui.bg }]}>
          <View style={[styles.splitList, { borderRightColor: ui.border }]}>{renderList()}</View>
          <View style={[styles.splitThread, { backgroundColor: ui.bg }]}>
            {selectedId ? (
              <ChatThread conversationId={selectedId} />
            ) : (
              <View style={styles.splitPlaceholder}>
                <SupportAvatar ui={ui} size={80} />
                <Text style={[styles.emptyTitle, { color: ui.text }]}>Your messages</Text>
                <Text style={[styles.emptyText, { color: ui.muted }]}>Select a conversation to start chatting with Atlas Support.</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        renderList()
      )}

      <TouchableOpacity
        style={[styles.floatingCompose, { backgroundColor: ui.primary }]}
        onPress={() => setComposeVisible(true)}
        disabled={starting}
        activeOpacity={0.88}
      >
        {starting ? <ActivityIndicator size="small" color={ui.onPrimary} /> : <Feather name="edit-3" size={23} color={ui.onPrimary} />}
      </TouchableOpacity>

      <Modal transparent animationType="slide" visible={composeVisible} onRequestClose={() => setComposeVisible(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: ui.overlay }]}>
          <View style={[styles.modalSheet, { backgroundColor: ui.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: ui.border }]} />
            <Text style={[styles.modalTitle, { color: ui.text }]}>Quick Actions</Text>
            <View style={styles.categoryList}>
              {CONCERN_CATEGORIES.map((category) => {
                const active = selectedCategory?.key === category.key;
                return (
                  <TouchableOpacity
                    key={category.key}
                    style={[styles.categoryOption, { borderBottomColor: ui.border }]}
                    onPress={() => setSelectedCategory(category)}
                    activeOpacity={0.84}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: active ? ui.primary : ui.primarySoft }]}>
                      <Feather name={category.icon} size={18} color={active ? ui.onPrimary : ui.primary} />
                    </View>
                    <View style={styles.categoryText}>
                      <Text style={[styles.categoryTitle, { color: ui.text }]}>{category.title}</Text>
                      <Text style={[styles.categoryDescription, { color: ui.muted }]}>{category.description}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={[styles.modalInput, { backgroundColor: ui.surface2, color: ui.text }]}
              value={initialMessage}
              onChangeText={setInitialMessage}
              placeholder="Add more details..."
              placeholderTextColor={ui.muted}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: ui.surface2 }]}
                onPress={() => {
                  setComposeVisible(false);
                  setInitialMessage("");
                  setSelectedCategory(CONCERN_CATEGORIES[0]);
                }}
                disabled={starting}
              >
                <Text style={[styles.cancelText, { color: ui.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.startButton, { backgroundColor: ui.primary }]} onPress={handleStartGeneral} disabled={starting}>
                {starting ? <ActivityIndicator size="small" color={ui.onPrimary} /> : <Text style={[styles.startText, { color: ui.onPrimary }]}>Start Conversation</Text>}
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
    backgroundColor: BG,
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0,
  },
  phone: { flex: 1 },
  splitRoot: { flex: 1, flexDirection: "row", backgroundColor: BG },
  splitList: { width: 396, borderRightWidth: 1, borderRightColor: BORDER },
  splitThread: { flex: 1, backgroundColor: BG },
  splitPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  hero: {
    height: 96,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  heroText: {
    paddingTop: 2,
  },
  brand: { fontSize: 24, fontWeight: "700", letterSpacing: 0 },
  brandSub: {
    fontSize: 14,
    fontWeight: "400",
    marginTop: 2,
  },
  truckImage: { width: 88, height: 54 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18 },
  searchBar: {
    flex: 1,
    height: 35,
    borderRadius: 10,
    backgroundColor: "rgba(28, 39, 58, 0.92)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: "400", paddingVertical: 0 },
  filterButton: { width: 26, height: 35, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: 9, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 13 },
  tab: {
    height: 29,
    borderRadius: 8,
    backgroundColor: PANEL,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  tabActive: { backgroundColor: "#075fcf" },
  tabText: { fontSize: 12, fontWeight: "600" },
  tabCount: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabCountActive: { backgroundColor: "rgba(255,255,255,0.20)" },
  tabCountText: { fontSize: 11, fontWeight: "600" },
  list: { paddingHorizontal: 18, paddingBottom: 94 },
  loadingWrap: { paddingTop: 40 },
  row: {
    minHeight: 83,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowActive: { backgroundColor: "rgba(10,124,255,0.08)" },
  rowPressed: { opacity: 0.78 },
  avatar: { alignItems: "center", justifyContent: "center" },
  presence: {
    position: "absolute",
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: GREEN,
    borderWidth: 2,
    borderColor: BG,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  titleLine: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  newPill: { backgroundColor: "#0a65ff", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  newPillText: { fontSize: 10, fontWeight: "600" },
  rowTime: { fontSize: 11, fontWeight: "400" },
  statusText: { marginTop: 4, fontSize: 12, fontWeight: "500" },
  previewLine: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 },
  previewText: { flex: 1, fontSize: 12, fontWeight: "400" },
  unreadBadge: { width: 21, height: 21, borderRadius: 11, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  unreadBadgeText: { fontSize: 11, fontWeight: "600" },
  floatingCompose: {
    position: "absolute",
    right: 26,
    bottom: Platform.OS === "ios" ? 100 : 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  emptyState: { alignItems: "center", paddingTop: 70, paddingHorizontal: 30, gap: 9 },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptyText: { textAlign: "center", fontSize: 13, lineHeight: 19 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#101b2b",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 18,
  },
  sheetHandle: { width: 34, height: 4, borderRadius: 2, backgroundColor: "#526078", alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: "600", textAlign: "center", marginBottom: 14 },
  categoryList: { gap: 0 },
  categoryOption: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(10,124,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIconActive: { backgroundColor: BLUE },
  categoryText: { flex: 1, minWidth: 0 },
  categoryTitle: { fontSize: 16, fontWeight: "600" },
  categoryDescription: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  modalInput: {
    marginTop: 14,
    minHeight: 76,
    maxHeight: 120,
    borderRadius: 12,
    backgroundColor: PANEL,
    color: TEXT,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: "top",
  },
  modalActions: { marginTop: 12, flexDirection: "row", gap: 10 },
  cancelButton: { flex: 1, height: 48, borderRadius: 10, backgroundColor: PANEL, alignItems: "center", justifyContent: "center" },
  cancelText: { color: BLUE, fontSize: 15, fontWeight: "800" },
  startButton: { flex: 1, height: 48, borderRadius: 10, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  startText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
});
