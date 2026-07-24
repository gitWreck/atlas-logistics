import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
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
} from "../../../components/utilities/FirebaseFunctions";
import { useTheme } from "../../../contexts/ThemeContext";
import ChatThread from "../../../components/chat/ChatThread";
import CustomerBottomNav from "../../../components/customer/CustomerBottomNav";
import { displayMessagePreview, formatListTime } from "../../../components/chat/chatUtils";

const atlasSupportBanner = require("../../../assets/atlas-banner-2.jpeg");
const BANNER_ASPECT_RATIO = 1774 / 887;
const BANNER_HEIGHT_SCALE = 0.84;

const TWO_PANEL_WIDTH = 900;
const BG = "#020b18";
const PANEL = "#071d34";
const TEXT = "#f1f5f9";
const MUTED = "#aab8cf";
const BLUE = "#0b7dff";
const GREEN = "#2bd66f";
const BORDER = "#143353";

function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== "string") return `rgba(255,255,255,${alpha})`;
  const normalized = hex.replace("#", "").trim();
  const full =
    normalized.length === 3
      ? normalized.split("").map((char) => char + char).join("")
      : normalized;
  const value = parseInt(full, 16);
  if (Number.isNaN(value)) return `rgba(255,255,255,${alpha})`;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

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

function ConversationRow({ ui, item, unread, active, onPress }) {
  const isShipment =
    !!item.trackingNumber ||
    !!item.shipmentId ||
    String(item.type || "") === "shipment";
  const isDefaultSupport =
    !isShipment &&
    (String(item.type || "") === "customer_support" || item.__defaultSupport);
  const status = String(item.status || "open").toLowerCase();
  const isResolved = ["resolved", "closed", "archived"].includes(status);
  const title = isShipment
    ? `Shipment #${item.trackingNumber || item.shipmentId}`
    : isDefaultSupport
      ? "Atlas Customer Support"
      : isResolved
        ? "Support Ticket"
        : "Atlas Support";
  const statusLabel = isShipment
    ? item.shipmentSummary?.status || (status === "pending" ? "In Transit" : "Out for Delivery")
    : isResolved
      ? "Resolved"
      : "Always available";
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

  const showPresence = active || (!isResolved && (isDefaultSupport || status === "open" || status === "active" || status === "unassigned"));

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
          </View>
          <Text style={[styles.rowTime, { color: ui.muted }]}>
            {formatListTime(item.lastMessageAt) || (isDefaultSupport ? "" : "9:41 AM")}
          </Text>
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
  const [composeVisible, setComposeVisible] = useState(false);
  const composeScrollRef = useRef(null);
  const [initialMessage, setInitialMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const ensuringDefaultRef = useRef(false);

  const isDefaultSupportConversation = (item) => {
    if (!item) return false;
    if (item.__defaultSupport) return true;
    const type = String(item.type || "");
    if (type === "shipment") return false;
    if (item.trackingNumber || item.shipmentId) return false;
    return type === "customer_support" || type === "guest_support";
  };

  const pickPrimarySupportConversation = (items = []) => {
    if (!items.length) return null;
    const uidKey = auth.currentUser?.uid ? `customer_support_${auth.currentUser.uid}` : null;
    const canonical = uidKey ? items.find((item) => item.id === uidKey) : null;
    if (canonical) return canonical;
    return [...items].sort((a, b) => {
      const left = a.lastMessageAt?.toMillis?.() || 0;
      const right = b.lastMessageAt?.toMillis?.() || 0;
      return right - left;
    })[0];
  };

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

  // Always keep a single default Atlas Customer Support thread in the inbox.
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || ensuringDefaultRef.current) return undefined;

    let cancelled = false;
    ensuringDefaultRef.current = true;

    (async () => {
      try {
        await createConversation({ ensureDefault: true });
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to ensure default Atlas Support conversation:", error);
        }
      } finally {
        ensuringDefaultRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const uid = auth.currentUser?.uid;

  const inboxConversations = useMemo(() => {
    const support = [];
    const rest = [];
    conversations.forEach((item) => {
      const status = String(item.status || "open").toLowerCase();
      if (["closed", "archived"].includes(status) && isDefaultSupportConversation(item)) {
        return;
      }
      if (isDefaultSupportConversation(item)) support.push(item);
      else rest.push(item);
    });
    const primary = pickPrimarySupportConversation(support);
    return primary ? [primary, ...rest] : rest;
  }, [conversations]);

  const unreadTotal = useMemo(
    () => inboxConversations.reduce((sum, item) => sum + Number(item.unreadCounts?.[uid] || 0), 0),
    [inboxConversations, uid],
  );

  const filterCounts = useMemo(() => {
    const counts = { all: inboxConversations.length, open: 0, resolved: 0 };
    inboxConversations.forEach((item) => {
      const status = String(item.status || "open").toLowerCase();
      if (["resolved", "closed", "archived"].includes(status)) counts.resolved += 1;
      else counts.open += 1;
    });
    if (!inboxConversations.some(isDefaultSupportConversation)) {
      counts.all += 1;
      counts.open += 1;
    }
    return counts;
  }, [inboxConversations]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = inboxConversations.filter((item) => {
      const status = String(item.status || "open").toLowerCase();
      const resolved = ["resolved", "closed", "archived"].includes(status);
      if (filter === "open" && resolved) return false;
      if (filter === "resolved" && !resolved) return false;
      if (!term) return true;
      return [
        item.trackingNumber,
        item.shipmentId,
        item.customerName,
        item.status,
        item.lastMessageText,
        isDefaultSupportConversation(item) ? "atlas customer support" : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });

    const support = list.filter(isDefaultSupportConversation);
    const rest = list.filter((item) => !isDefaultSupportConversation(item));
    const primary = pickPrimarySupportConversation(support);

    if (
      !primary &&
      filter !== "resolved" &&
      (!term || "atlas customer support".includes(term))
    ) {
      return [
        {
          id: "__atlas_customer_support__",
          __defaultSupport: true,
          type: "customer_support",
          status: "open",
          lastMessageText: "How can we help you today?",
        },
        ...rest,
      ];
    }

    return primary ? [primary, ...rest] : rest;
  }, [inboxConversations, filter, search]);

  useEffect(() => {
    if (twoPanel && !selectedId && filtered.length) setSelectedId(filtered[0].id);
  }, [twoPanel, selectedId, filtered]);

  const openConversation = async (id) => {
    let conversationId = id;
    if (id === "__atlas_customer_support__") {
      try {
        setStarting(true);
        const result = await createConversation({ ensureDefault: true });
        conversationId = result?.data?.conversationId;
        if (!conversationId) {
          Alert.alert("Unable to open support", "Please try again in a moment.");
          return;
        }
      } catch (error) {
        console.error("Failed to open default support:", error);
        Alert.alert("Unable to open support", "Please try again in a moment.");
        return;
      } finally {
        setStarting(false);
      }
    }

    if (twoPanel) setSelectedId(conversationId);
    else {
      router.push({
        pathname: "/(customer)/chat/[conversationId]",
        params: { conversationId },
      });
    }
  };

  const handleStartGeneral = async () => {
    const detail = initialMessage.trim();
    const message = detail || "Hello, I need help with a concern.";

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
      Alert.alert("Unable to start conversation", "Please try again in a moment.");
    } finally {
      setStarting(false);
    }
  };

  const isDark = resolvedScheme === "dark";
  const fadeBase = isDark ? ui.bg : "#ffffff";
  const bannerWidth = PixelRatio.roundToNearestPixel(width);
  const bannerNaturalHeight = bannerWidth / BANNER_ASPECT_RATIO;
  const bannerHeight = PixelRatio.roundToNearestPixel(
    bannerNaturalHeight * BANNER_HEIGHT_SCALE,
  );

  const renderList = () => (
    <View style={[styles.phone, { backgroundColor: fadeBase }]}>
      <View style={[styles.heroSection, { backgroundColor: fadeBase }]}>
        <View
          style={[
            styles.heroBannerWrap,
            { height: bannerHeight, backgroundColor: fadeBase },
          ]}
        >
          <Image
            source={atlasSupportBanner}
            style={{ width: bannerWidth, height: bannerNaturalHeight }}
            contentFit="fill"
            transition={0}
            priority="high"
            allowDownscaling={false}
          />
          {isDark ? (
            <LinearGradient
              pointerEvents="none"
              colors={[hexToRgba(fadeBase, 0.55), hexToRgba(fadeBase, 0.18), "transparent"]}
              locations={[0, 0.28, 0.58]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <LinearGradient
            pointerEvents="none"
            colors={["transparent", hexToRgba(fadeBase, 0.45), fadeBase]}
            locations={[0, 0.72, 1]}
            style={styles.heroBottomFade}
          />
          <View style={styles.heroContent}>
            <Text style={[styles.brand, { color: isDark ? ui.text : "#031A2D" }]}>
              ATLAS
            </Text>
            <Text style={[styles.brandSub, { color: isDark ? ui.text : "#64748b" }]}>
              Customer Support
            </Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: isDark ? ui.surface2 : "#ffffff",
                borderColor: isDark ? ui.border : "#e2e8f0",
              },
            ]}
          >
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
    </View>
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

      <Modal transparent animationType="slide" visible={composeVisible} onRequestClose={() => setComposeVisible(false)}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalBackdrop, { backgroundColor: ui.overlay }]}>
            <View style={[styles.modalSheet, { backgroundColor: ui.surface }]}>
              <ScrollView
                ref={composeScrollRef}
                style={styles.modalScroll}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.modalScrollContent}
                automaticallyAdjustKeyboardInsets
                showsVerticalScrollIndicator={false}
              >
                <View style={[styles.sheetHandle, { backgroundColor: ui.border }]} />
                <Text style={[styles.modalTitle, { color: ui.text }]}>Start a Conversation</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: ui.surface2, color: ui.text }]}
                  value={initialMessage}
                  onChangeText={setInitialMessage}
                  onFocus={() => {
                    setTimeout(() => composeScrollRef.current?.scrollToEnd({ animated: true }), 100);
                  }}
                  placeholder="Add more details..."
                  placeholderTextColor={ui.muted}
                  multiline
                  scrollEnabled
                  textAlignVertical="top"
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { backgroundColor: ui.surface2 }]}
                    onPress={() => {
                      setComposeVisible(false);
                      setInitialMessage("");
                    }}
                    disabled={starting}
                  >
                    <Text style={[styles.cancelText, { color: ui.primary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.startButton, { backgroundColor: ui.primary }]} onPress={handleStartGeneral} disabled={starting}>
                    {starting ? <ActivityIndicator size="small" color={ui.onPrimary} /> : <Text style={[styles.startText, { color: ui.onPrimary }]}>Start Conversation</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  heroSection: {
    position: "relative",
    overflow: "hidden",
    paddingBottom: 12,
  },
  heroBannerWrap: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
  },
  heroBottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "48%",
  },
  heroContent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 18,
    right: 18,
    justifyContent: "center",
    zIndex: 2,
  },
  brand: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  brandSub: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "400",
    marginTop: 3,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    zIndex: 2,
    marginTop: -10,
  },
  searchBar: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
  keyboardAvoider: { flex: 1 },
  modalSheet: {
    backgroundColor: "#101b2b",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 18,
    maxHeight: "100%",
  },
  modalScroll: { flexShrink: 1 },
  modalScrollContent: { flexGrow: 1 },
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
