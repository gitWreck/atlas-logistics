import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
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
import { createConversation } from "../../../components/utilities/FirebaseFunctions";
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

export default function CustomerChatListScreen() {
  const router = useRouter();
  const { colors, resolvedScheme } = useTheme();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

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
    try {
      setStarting(true);
      const result = await createConversation({});
      const conversationId = result?.data?.conversationId;
      if (conversationId) {
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

  const renderItem = ({ item }) => {
    const unread = Number(item.unreadCounts?.[auth.currentUser?.uid] || 0);
    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        activeOpacity={0.85}
        onPress={() =>
          router.push({
            pathname: "/(customer)/chat/[conversationId]",
            params: { conversationId: item.id },
          })
        }
      >
        <View style={styles.avatar}>
          <FontAwesome5 name="headset" size={16} color="#2563eb" />
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
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {item.status || "open"} · {item.customerName || "You"}
          </Text>
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
        <TouchableOpacity
          style={styles.startBtn}
          onPress={handleStartGeneral}
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
                onPress={handleStartGeneral}
              >
                <Text style={styles.emptyButtonText}>Start Chat</Text>
              </TouchableOpacity>
            </View>
          }
        />
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
    marginTop: 3,
    fontSize: 12,
    textTransform: "capitalize",
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
});
