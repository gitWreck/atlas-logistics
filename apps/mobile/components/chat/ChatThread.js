// Reusable, Messenger-style chat thread. Rendered both by the
// /(customer)/chat/[conversationId] route and inline in the two-panel
// desktop/tablet layout on the conversation list screen.
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, db, storage } from "../../firebase";
import {
  markConversationRead,
  sendChatMessage,
} from "../utilities/FirebaseFunctions";
import { useTheme } from "../../contexts/ThemeContext";
import {
  buildMessageItems,
  encodeTextAttachment,
  formatClockTime,
  getChatColors,
  getMessageAttachment,
  getMessageText,
  getStatusMeta,
} from "./chatUtils";
import {
  PersonAvatar,
  SupportAvatar,
  ThreadSkeleton,
  TypingDots,
} from "./ChatComponents";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤗", "🤔", "😴", "😢", "😭", "😅", "😳", "🥳",
  "👍", "👎", "👏", "🙏", "💪", "🙌", "👌", "✌️",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🔥", "✨",
  "🎉", "⭐", "✅", "❌", "⚠️", "❓", "📦", "🚚",
];

function AttachmentImage({ uri, colors, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.attachmentImageWrap}>
      <Image
        source={{ uri }}
        style={styles.attachmentImage}
        contentFit="cover"
        transition={180}
      />
    </Pressable>
  );
}

function MessageBubble({ item, colors, onOpenImage, statusLabel }) {
  const { message, mine, isFirstInGroup, isLastInGroup } = item;
  const attachment = getMessageAttachment(message);
  const text = getMessageText(message);
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(appear, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 90,
    }).start();
  }, [appear]);

  const bubbleRadius = {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: mine ? 18 : isLastInGroup ? 18 : 6,
    borderBottomRightRadius: mine ? (isLastInGroup ? 18 : 6) : 18,
  };

  const isImage = attachment?.type === "image";
  const isFile = attachment?.type === "file";

  return (
    <Animated.View
      style={[
        styles.messageRow,
        mine ? styles.rowMine : styles.rowTheirs,
        { marginTop: isFirstInGroup ? 10 : 2 },
        {
          opacity: appear,
          transform: [
            {
              translateY: appear.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      {!mine && (
        <View style={styles.avatarSlot}>
          {isLastInGroup ? (
            <PersonAvatar name={message.senderName || "Atlas Support"} size={28} />
          ) : (
            <View style={{ width: 28 }} />
          )}
        </View>
      )}

      <View style={styles.bubbleColumn}>
        {!mine && isFirstInGroup && (
          <Text style={[styles.senderName, { color: colors.textMuted }]}>
            {message.senderName || "Atlas Support"}
          </Text>
        )}

        {isImage ? (
          <AttachmentImage
            uri={attachment.url}
            colors={colors}
            onPress={() => onOpenImage(attachment.url)}
          />
        ) : mine ? (
          <LinearGradient
            colors={[colors.accent, colors.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubble, bubbleRadius]}
          >
            {isFile ? (
              <FileChip attachment={attachment} tint="#FFFFFF" mine />
            ) : (
              <Text style={[styles.bubbleText, { color: colors.sentText }]}>
                {text}
              </Text>
            )}
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.bubble,
              bubbleRadius,
              { backgroundColor: colors.receivedBg },
            ]}
          >
            {isFile ? (
              <FileChip attachment={attachment} tint={colors.accent} />
            ) : (
              <Text style={[styles.bubbleText, { color: colors.receivedText }]}>
                {text}
              </Text>
            )}
          </View>
        )}

        {isLastInGroup && (
          <View
            style={[
              styles.metaRow,
              { justifyContent: mine ? "flex-end" : "flex-start" },
            ]}
          >
            <Text style={[styles.metaTime, { color: colors.textMuted }]}>
              {formatClockTime(message.createdAt)}
            </Text>
          </View>
        )}

        {mine && statusLabel ? (
          <Text style={[styles.receipt, { color: colors.textMuted }]}>
            {statusLabel}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

function FileChip({ attachment, tint, mine }) {
  return (
    <View style={styles.fileChip}>
      <FontAwesome5 name="file-alt" size={16} color={tint} />
      <Text
        style={[
          styles.fileName,
          { color: mine ? "#FFFFFF" : tint },
        ]}
        numberOfLines={1}
      >
        {attachment.name || "File"}
      </Text>
    </View>
  );
}

export default function ChatThread({ conversationId, onBack, embedded = false }) {
  const { colors: themeColors, resolvedScheme } = useTheme();
  const colors = useMemo(
    () => getChatColors(themeColors, resolvedScheme),
    [themeColors, resolvedScheme],
  );

  const listRef = useRef(null);
  const shouldAutoScroll = useRef(true);
  const lastReadRef = useRef(null);

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [newCount, setNewCount] = useState(0);

  const myUid = auth.currentUser?.uid;

  // Conversation metadata subscription.
  useEffect(() => {
    if (!conversationId) return undefined;
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "conversations", String(conversationId)),
      (snap) => {
        setConversation(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (error) => {
        console.error("Conversation subscription error:", error);
        setLoading(false);
      },
    );
    return unsub;
  }, [conversationId]);

  // Messages subscription.
  useEffect(() => {
    if (!conversationId) return undefined;
    const q = query(
      collection(db, "conversations", String(conversationId), "messages"),
      orderBy("createdAt", "asc"),
      limit(200),
    );
    return onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        LayoutAnimation.configureNext(
          LayoutAnimation.create(220, "easeInEaseOut", "opacity"),
        );
        setMessages((prev) => {
          if (!shouldAutoScroll.current && prev.length && next.length > prev.length) {
            const added = next.length - prev.length;
            const lastNew = next[next.length - 1];
            if (lastNew?.senderId !== myUid) {
              setNewCount((c) => c + added);
            }
          }
          return next;
        });
        if (shouldAutoScroll.current) {
          setTimeout(
            () => listRef.current?.scrollToEnd({ animated: true }),
            60,
          );
        }
      },
      (error) => console.error("Messages subscription error:", error),
    );
  }, [conversationId, myUid]);

  // Mark read on open and whenever a new inbound message arrives.
  useEffect(() => {
    if (!conversationId || !messages.length) return;
    const last = messages[messages.length - 1];
    if (last?.senderId && last.senderId !== myUid && lastReadRef.current !== last.id) {
      lastReadRef.current = last.id;
      markConversationRead({ conversationId: String(conversationId) }).catch(
        () => {},
      );
    }
  }, [messages, conversationId, myUid]);

  useEffect(() => {
    if (!conversationId) return;
    markConversationRead({ conversationId: String(conversationId) }).catch(
      () => {},
    );
  }, [conversationId]);

  const { items, lastSeenMineId, lastMineId } = useMemo(
    () => buildMessageItems(messages, myUid),
    [messages, myUid],
  );

  const scrollToBottom = useCallback((animated = true) => {
    shouldAutoScroll.current = true;
    setNewCount(0);
    setShowScrollDown(false);
    listRef.current?.scrollToEnd({ animated });
  }, []);

  const handleScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } =
      event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const nearBottom = distanceFromBottom < 120;
    shouldAutoScroll.current = nearBottom;
    setShowScrollDown(!nearBottom);
    if (nearBottom) setNewCount(0);
  }, []);

  const isClosed = conversation?.status === "closed";

  const doSend = useCallback(
    async (payload) => {
      if (!conversationId) return;
      try {
        setSending(true);
        await sendChatMessage({
          conversationId: String(conversationId),
          ...payload,
        });
        shouldAutoScroll.current = true;
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
      } catch (error) {
        console.error("Failed to send message:", error);
      } finally {
        setSending(false);
      }
    },
    [conversationId],
  );

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if ((!text && !pendingImage) || isClosed || sending || uploading) return;

    // Upload the staged image first, matching the web attachment scheme.
    if (pendingImage) {
      try {
        setUploading(true);
        const name = pendingImage.name || `photo_${Date.now()}.jpg`;
        const response = await fetch(pendingImage.uri);
        const blob = await response.blob();
        const storageRef = ref(
          storage,
          `chat/${conversationId}/${Date.now()}_${name}`,
        );
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        await doSend({
          text: encodeTextAttachment({ url, type: "image", name }),
          attachmentUrl: url,
          attachmentType: "image",
          attachmentName: name,
        });
      } catch (error) {
        console.error("Attachment upload failed:", error);
      } finally {
        setUploading(false);
        setPendingImage(null);
      }
    }

    if (text) {
      setDraft("");
      await doSend({ text });
    }
  }, [draft, pendingImage, isClosed, sending, uploading, conversationId, doSend]);

  const handlePickImage = useCallback(async () => {
    if (isClosed) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
      });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        setPendingImage({
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
        });
        setEmojiOpen(false);
      }
    } catch (error) {
      console.error("Image pick failed:", error);
    }
  }, [isClosed]);

  const statusMeta = getStatusMeta(conversation?.status);
  const subtitle = conversation?.trackingNumber
    ? `${conversation.trackingNumber} · ${statusMeta.label}`
    : `General support · ${statusMeta.label}`;

  const renderItem = ({ item }) => {
    if (item.type === "day") {
      return (
        <View style={styles.dayDivider}>
          <Text style={[styles.dayText, { color: colors.textMuted }]}>
            {item.label}
          </Text>
        </View>
      );
    }
    let statusLabel = null;
    if (item.mine && item.id === lastSeenMineId) statusLabel = "Seen";
    else if (item.mine && item.id === lastMineId && lastMineId !== lastSeenMineId)
      statusLabel = "Sent";
    return (
      <MessageBubble
        item={item}
        colors={colors}
        onOpenImage={setLightbox}
        statusLabel={statusLabel}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.chatBg }]}>
      {/* Sticky header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        {onBack && (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={onBack}
            hitSlop={8}
          >
            <FontAwesome5 name="chevron-left" size={18} color={colors.accent} />
          </TouchableOpacity>
        )}
        <SupportAvatar size={40} online ringColor={colors.surface} />
        <View style={styles.headerText}>
          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            Atlas Support
          </Text>
          <Text
            style={[styles.headerSubtitle, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: colors.accentSoft }]}>
          <View style={[styles.statusDot, { backgroundColor: statusMeta.dot }]} />
          <Text style={[styles.statusPillText, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      {loading ? (
        <ThreadSkeleton colors={colors} />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? (embedded ? 0 : 8) : 0}
        >
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.messages}
            onScroll={handleScroll}
            scrollEventThrottle={32}
            onContentSizeChange={() => {
              if (shouldAutoScroll.current) {
                listRef.current?.scrollToEnd({ animated: false });
              }
            }}
            ListHeaderComponent={
              <View style={styles.threadIntro}>
                <SupportAvatar size={68} online ringColor={colors.chatBg} />
                <Text style={[styles.introTitle, { color: colors.text }]}>
                  Atlas Support
                </Text>
                <Text style={[styles.introText, { color: colors.textMuted }]}>
                  {conversation?.trackingNumber
                    ? `Conversation about shipment ${conversation.trackingNumber}.`
                    : "We typically reply within a few minutes."}
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyThread}>
                <FontAwesome5
                  name="comment-dots"
                  size={30}
                  color={colors.textMuted}
                />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Send a message and the Atlas team will reply here.
                </Text>
              </View>
            }
          />

          {/* Optimistic "sending" bubble */}
          {sending || uploading ? (
            <View style={styles.sendingRow}>
              <View
                style={[
                  styles.sendingBubble,
                  { backgroundColor: colors.receivedBg },
                ]}
              >
                <TypingDots color={colors.textMuted} />
              </View>
            </View>
          ) : null}

          {/* Scroll-to-bottom FAB */}
          {showScrollDown && (
            <TouchableOpacity
              style={[
                styles.scrollFab,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => scrollToBottom(true)}
              activeOpacity={0.85}
            >
              <FontAwesome5 name="chevron-down" size={14} color={colors.text} />
              {newCount > 0 && (
                <View style={[styles.fabBadge, { backgroundColor: colors.unread }]}>
                  <Text style={styles.fabBadgeText}>
                    {newCount > 9 ? "9+" : newCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Emoji panel */}
          {emojiOpen && (
            <View
              style={[
                styles.emojiPanel,
                { backgroundColor: colors.surface, borderTopColor: colors.border },
              ]}
            >
              {EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiBtn}
                  onPress={() => setDraft((prev) => prev + emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Pending image preview */}
          {pendingImage && (
            <View
              style={[
                styles.pendingBar,
                { backgroundColor: colors.surface, borderTopColor: colors.border },
              ]}
            >
              <Image
                source={{ uri: pendingImage.uri }}
                style={styles.pendingThumb}
                contentFit="cover"
              />
              <Text
                style={[styles.pendingName, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {pendingImage.name}
              </Text>
              <TouchableOpacity
                onPress={() => setPendingImage(null)}
                hitSlop={8}
              >
                <FontAwesome5 name="times-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Sticky composer — styled to match the manager messaging console */}
          <View
            style={[
              styles.composer,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.composerIcon}
              onPress={handlePickImage}
              disabled={isClosed || uploading}
              hitSlop={6}
            >
              <FontAwesome5
                name="plus"
                size={18}
                color={isClosed ? colors.textMuted : colors.accent}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.composerIcon}
              onPress={handlePickImage}
              disabled={isClosed || uploading}
              hitSlop={6}
            >
              <FontAwesome5
                name="image"
                size={16}
                color={isClosed ? colors.textMuted : colors.accent}
              />
            </TouchableOpacity>

            <View style={[styles.inputWrap, { backgroundColor: colors.inputBar }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={draft}
                onChangeText={setDraft}
                placeholder={isClosed ? "Conversation is closed" : "Aa"}
                placeholderTextColor={colors.textMuted}
                editable={!isClosed}
                multiline
              />
              <TouchableOpacity
                style={styles.emojiToggle}
                onPress={() => setEmojiOpen((v) => !v)}
                disabled={isClosed}
                hitSlop={6}
              >
                <FontAwesome5
                  name="smile"
                  size={17}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.composerIcon}
              onPress={handleSend}
              disabled={sending || uploading || isClosed}
              activeOpacity={0.7}
              hitSlop={6}
            >
              {sending || uploading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <FontAwesome5
                  name={draft.trim() || pendingImage ? "paper-plane" : "thumbs-up"}
                  size={17}
                  color={isClosed ? colors.textMuted : colors.accent}
                />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Image lightbox */}
      <Modal visible={!!lightbox} transparent animationType="fade">
        <Pressable style={styles.lightbox} onPress={() => setLightbox(null)}>
          <TouchableOpacity
            style={styles.lightboxClose}
            onPress={() => setLightbox(null)}
          >
            <FontAwesome5 name="times" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          {lightbox && (
            <Image
              source={{ uri: lightbox }}
              style={styles.lightboxImage}
              contentFit="contain"
            />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 34,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 16, fontWeight: "800" },
  headerSubtitle: { marginTop: 2, fontSize: 12 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    height: 24,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  messages: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  threadIntro: {
    alignItems: "center",
    paddingVertical: 22,
    gap: 6,
  },
  introTitle: { fontSize: 17, fontWeight: "800", marginTop: 4 },
  introText: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  dayDivider: { alignItems: "center", marginVertical: 12 },
  dayText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  avatarSlot: { width: 28, alignItems: "center", justifyContent: "flex-end" },
  bubbleColumn: { maxWidth: "78%" },
  senderName: { fontSize: 11, fontWeight: "700", marginBottom: 3, marginLeft: 4 },
  bubble: { paddingHorizontal: 14, paddingVertical: 9 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  metaRow: { flexDirection: "row", marginTop: 3, paddingHorizontal: 4 },
  metaTime: { fontSize: 10, fontWeight: "600" },
  receipt: {
    fontSize: 10,
    fontWeight: "600",
    alignSelf: "flex-end",
    marginTop: 2,
    marginRight: 2,
  },
  attachmentImageWrap: {
    borderRadius: 16,
    overflow: "hidden",
  },
  attachmentImage: { width: 210, height: 210, borderRadius: 16 },
  fileChip: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 220 },
  fileName: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  emptyThread: { alignItems: "center", paddingTop: 40, paddingHorizontal: 30, gap: 12 },
  emptyText: { textAlign: "center", fontSize: 13, lineHeight: 19 },
  sendingRow: { paddingHorizontal: 20, paddingBottom: 4, alignItems: "flex-end" },
  sendingBubble: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
  },
  scrollFab: {
    position: "absolute",
    right: 16,
    bottom: 84,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  fabBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  emojiPanel: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    maxHeight: 180,
  },
  emojiBtn: { width: "12.5%", alignItems: "center", paddingVertical: 6 },
  emojiText: { fontSize: 24 },
  pendingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  pendingThumb: { width: 40, height: 40, borderRadius: 8 },
  pendingName: { flex: 1, fontSize: 13 },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 14 : 12,
    borderTopWidth: 1,
  },
  composerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 20,
    paddingLeft: 16,
    paddingRight: 10,
    minHeight: 36,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
    maxHeight: 110,
  },
  emojiToggle: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  lightbox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxClose: { position: "absolute", top: 50, right: 24, zIndex: 2, padding: 8 },
  lightboxImage: { width: "92%", height: "80%" },
});
