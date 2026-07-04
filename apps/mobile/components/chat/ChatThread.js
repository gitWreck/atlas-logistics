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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  Modal,
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
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

const UI = {
  bg: "#07111e",
  bg2: "#0a1423",
  surface: "#111c2d",
  surface2: "#162235",
  card: "#182438",
  border: "rgba(255,255,255,0.08)",
  text: "#f8fbff",
  muted: "#9ba8bb",
  blue: "#0a7cff",
  blueDark: "#0064e0",
  green: "#35d06f",
  orange: "#ff9d2e",
  red: "#ff453a",
};

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

function ShipmentInfoCard({ conversation, colors, onViewTracking }) {
  const trackingNumber = conversation?.trackingNumber || conversation?.shipmentId;
  if (!trackingNumber) return null;

  const summary = conversation?.shipmentSummary || {};
  const status = summary.status || "In progress";
  const destination = summary.destination || "Delivery destination";

  return (
    <View
      style={[
        styles.shipmentCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.shipmentCardHeader}>
        <View style={styles.shipmentTitleWrap}>
          <Text style={[styles.shipmentEyebrow, { color: colors.textMuted }]}>
            Linked shipment
          </Text>
          <Text style={[styles.shipmentTitle, { color: colors.text }]} numberOfLines={1}>
            {trackingNumber}
          </Text>
        </View>
        <View style={[styles.shipmentStatusPill, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.shipmentStatusText, { color: colors.accent }]}>
            {status}
          </Text>
        </View>
      </View>
      <View style={styles.shipmentRows}>
        <View style={styles.shipmentRow}>
          <Text style={[styles.shipmentLabel, { color: colors.textMuted }]}>ETA</Text>
          <Text style={[styles.shipmentValue, { color: colors.text }]}>
            Check live tracking
          </Text>
        </View>
        <View style={styles.shipmentRow}>
          <Text style={[styles.shipmentLabel, { color: colors.textMuted }]}>
            Destination
          </Text>
          <Text style={[styles.shipmentValue, { color: colors.text }]} numberOfLines={1}>
            {destination}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.trackingButton, { backgroundColor: colors.accentSoft }]}
        onPress={onViewTracking}
        activeOpacity={0.85}
      >
        <FontAwesome5 name="route" size={13} color={colors.accent} />
        <Text style={[styles.trackingButtonText, { color: colors.accent }]}>
          View Tracking
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function QuickActions({ colors, hasShipment, onTrack, onConcern, onAgent }) {
  return (
    <View
      style={[
        styles.quickActions,
        { backgroundColor: colors.surface, borderTopColor: colors.border },
      ]}
    >
      {hasShipment && (
        <TouchableOpacity
          style={[
            styles.quickAction,
            { backgroundColor: colors.inputBar, borderColor: colors.border },
          ]}
          onPress={onTrack}
          activeOpacity={0.82}
        >
          <FontAwesome5 name="map-marker-alt" size={13} color="#22C55E" />
          <Text style={[styles.quickActionText, { color: colors.text }]}>
            Track Shipment
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[
          styles.quickAction,
          { backgroundColor: colors.inputBar, borderColor: colors.border },
        ]}
        onPress={onConcern}
        activeOpacity={0.82}
      >
        <FontAwesome5 name="truck" size={13} color={colors.accent} />
        <Text style={[styles.quickActionText, { color: colors.text }]}>
          Delivery Concern
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.quickAction,
          { backgroundColor: colors.inputBar, borderColor: colors.border },
        ]}
        onPress={onAgent}
        activeOpacity={0.82}
      >
        <FontAwesome5 name="headset" size={13} color={colors.textMuted} />
        <Text style={[styles.quickActionText, { color: colors.text }]}>
          Talk to Agent
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function QuickActionsSheet({ visible, onClose, onTrack, onDetails, onProblem, onChange, onAgent, ui = UI }) {
  const actions = [
    {
      title: "Track My Shipment",
      description: "Get the latest updates about your shipment.",
      icon: "map-marker-alt",
      color: ui.blue,
      bg: ui.primarySoft || ui.surface2,
      onPress: onTrack,
    },
    {
      title: "Shipment Details",
      description: "View detailed information about your shipment.",
      icon: "cube",
      color: ui.green,
      bg: ui.successSoft || ui.surface2,
      onPress: onDetails,
    },
    {
      title: "Report a Problem",
      description: "Report an issue with your shipment or delivery.",
      icon: "exclamation-triangle",
      color: ui.orange,
      bg: ui.warningSoft || ui.surface2,
      onPress: onProblem,
    },
    {
      title: "Change Delivery",
      description: "Request to reschedule or change delivery details.",
      icon: "calendar-alt",
      color: ui.purple || ui.blue,
      bg: ui.purpleSoft || ui.surface2,
      onPress: onChange,
    },
    {
      title: "Talk to an Agent",
      description: "Connect with a live support agent.",
      icon: "headset",
      color: ui.blue,
      bg: ui.primarySoft || ui.surface2,
      onPress: onAgent,
    },
  ];

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={[styles.sheetBackdrop, { backgroundColor: ui.overlay }]}>
        <View style={[styles.quickSheet, { backgroundColor: ui.bg }]}>
          <View style={[styles.sheetHandle, { backgroundColor: ui.border }]} />
          <Text style={[styles.quickSheetTitle, { color: ui.text }]}>Quick Actions</Text>
          <View style={[styles.quickSheetCard, { backgroundColor: ui.surface }]}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.title}
                style={styles.quickSheetRow}
                activeOpacity={0.84}
                onPress={() => {
                  onClose();
                  action.onPress?.();
                }}
              >
                <View style={[styles.quickSheetIcon, { backgroundColor: action.bg }]}>
                  <FontAwesome5 name={action.icon} size={20} color={action.color} />
                </View>
                <View style={styles.quickSheetCopy}>
                  <Text style={[styles.quickSheetActionTitle, { color: ui.text }]}>{action.title}</Text>
                  <Text style={[styles.quickSheetActionText, { color: ui.muted }]}>{action.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.quickSheetCancel, { backgroundColor: ui.surface }]} onPress={onClose}>
            <Text style={[styles.quickSheetCancelText, { color: ui.blue }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ShipmentDetailsScreen({ visible, onClose, conversation, onTrack, ui = UI }) {
  const trackingNumber = conversation?.trackingNumber || conversation?.shipmentId || "#ATL-240701";
  const status = conversation?.shipmentSummary?.status || "Out for Delivery";
  const timeline = [
    ["Order Confirmed", "Jun 28, 8:30 AM", true],
    ["Picked Up", "Jun 28, 10:15 AM", true],
    ["In Transit", "Jun 29, 7:45 AM", true],
    ["Out for Delivery", "Jun 29, 9:20 AM", true, true],
    ["Delivered", "", false],
  ];

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={[styles.fullScreen, { backgroundColor: ui.bg }]}>
        <View style={styles.screenHeader}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <FontAwesome5 name="chevron-left" size={20} color={ui.text} />
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: ui.text }]}>Shipment Details</Text>
          <FontAwesome5 name="ellipsis-v" size={18} color={ui.text} />
        </View>
        <ScrollView contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.detailsCard, { backgroundColor: ui.surface }]}>
            <View style={styles.detailsTop}>
              <View style={[styles.detailsIcon, { backgroundColor: ui.blue }]}>
                <FontAwesome5 name="cube" size={22} color={ui.onPrimary || "#ffffff"} />
              </View>
              <View>
                <Text style={[styles.detailsShipment, { color: ui.text }]}>Shipment {trackingNumber}</Text>
                <Text style={[styles.detailsStatus, { color: ui.green }]}>{status}</Text>
              </View>
            </View>
            <InfoLine ui={ui} icon="clipboard-list" label="Tracking Number" value={trackingNumber.replace("#", "")} />
            <InfoLine ui={ui} icon="circle" label="Status" value={status} valueColor={ui.text} dotColor={ui.green} />
            <InfoLine ui={ui} icon="user" label="Driver" value="Juan Dela Cruz" actionIcon="phone-alt" />
            <InfoLine ui={ui} icon="truck" label="Vehicle" value="ABC-1234" />
            <InfoLine ui={ui} icon="clock" label="Estimated Arrival" value="Today, 3:30 PM" />
            <InfoLine ui={ui} icon="map-marker-alt" label="Delivery Address" value="123 Rizal St, Cebu City, Cebu 6000" actionIcon="map" />
          </View>

          <View style={[styles.progressCard, { backgroundColor: ui.surface }]}>
            <Text style={[styles.progressTitle, { color: ui.text }]}>Delivery Progress</Text>
            {timeline.map(([title, time, done, current], index) => (
              <View key={title} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View
                    style={[
                      styles.timelineDot,
                      { borderColor: ui.muted },
                      done && { backgroundColor: ui.green, borderColor: ui.green },
                      current && { backgroundColor: ui.blue, borderColor: ui.blue },
                    ]}
                  >
                    {done && !current ? <FontAwesome5 name="check" size={9} color={ui.onPrimary || "#ffffff"} /> : null}
                  </View>
                  {index < timeline.length - 1 && <View style={[styles.timelineLine, { backgroundColor: ui.border }]} />}
                </View>
                <View style={styles.timelineCopy}>
                  <Text style={[styles.timelineTitle, { color: ui.text }]}>{title}</Text>
                  {!!time && <Text style={[styles.timelineTime, { color: ui.muted }]}>{time}</Text>}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function InfoLine({ ui = UI, icon, label, value, actionIcon, valueColor = UI.text, dotColor }) {
  return (
    <View style={styles.infoLine}>
      <View style={styles.infoLineLabel}>
        <FontAwesome5 name={icon} size={12} color={ui.muted} />
        <Text style={[styles.infoLineLabelText, { color: ui.muted }]}>{label}</Text>
      </View>
      <View style={styles.infoLineValueWrap}>
        {dotColor && <View style={[styles.smallDot, { backgroundColor: dotColor }]} />}
        <Text style={[styles.infoLineValue, { color: valueColor }]} numberOfLines={2}>{value}</Text>
        {actionIcon && <FontAwesome5 name={actionIcon} size={12} color={ui.blue} />}
      </View>
    </View>
  );
}

function ChatInfoScreen({
  visible,
  onClose,
  conversation,
  messages,
  notificationsEnabled,
  setNotificationsEnabled,
  muted,
  setMuted,
  ui = UI,
}) {
  const media = messages
    .map((message) => getMessageAttachment(message))
    .filter((attachment) => attachment?.type === "image")
    .slice(-4);

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={[styles.fullScreen, { backgroundColor: ui.bg }]}>
        <View style={styles.screenHeader}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <FontAwesome5 name="chevron-left" size={20} color={ui.text} />
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: ui.text }]}>Chat Information</Text>
          <FontAwesome5 name="ellipsis-v" size={18} color={ui.text} />
        </View>
        <ScrollView contentContainerStyle={styles.infoScreenContent}>
          <View style={styles.profileBlock}>
            <SupportAvatar size={72} online ringColor={ui.bg} />
            <View style={styles.profileCopy}>
              <Text style={[styles.profileName, { color: ui.text }]}>Atlas Support</Text>
              <Text style={[styles.profileOnline, { color: ui.green }]}>Online</Text>
              <Text style={[styles.profileReply, { color: ui.muted }]}>Usually replies within 5 minutes</Text>
            </View>
          </View>

          <View style={[styles.infoPanel, { backgroundColor: ui.surface }]}>
            <Text style={[styles.infoPanelTitle, { color: ui.text }]}>Conversation</Text>
            <SettingRow ui={ui} label="Shipment" value={conversation?.trackingNumber || "#ATL-240701"} />
            <SettingRow ui={ui} label="Notifications">
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: ui.border, true: ui.blue }}
                thumbColor={ui.onPrimary || "#ffffff"}
              />
            </SettingRow>
            <SettingRow ui={ui} label="Mute">
              <Switch
                value={muted}
                onValueChange={setMuted}
                trackColor={{ false: ui.border, true: ui.blue }}
                thumbColor={ui.onPrimary || "#ffffff"}
              />
            </SettingRow>
          </View>

          <View style={[styles.infoPanel, { backgroundColor: ui.surface }]}>
            <View style={styles.panelHeaderRow}>
              <Text style={[styles.infoPanelTitle, { color: ui.text }]}>Shared Media</Text>
              <Text style={[styles.mediaCount, { color: ui.muted }]}>{media.length || 12}</Text>
            </View>
            <View style={styles.mediaStrip}>
              {media.length ? (
                media.map((attachment, index) => (
                  <Image key={`${attachment.url}-${index}`} source={{ uri: attachment.url }} style={styles.mediaThumb} contentFit="cover" />
                ))
              ) : (
                [0, 1, 2, 3].map((item) => (
                  <View key={item} style={[styles.mediaPlaceholder, { backgroundColor: ui.surface2 }]}>
                    <FontAwesome5 name={item % 2 ? "file-alt" : "image"} size={18} color={ui.muted} />
                  </View>
                ))
              )}
              <FontAwesome5 name="chevron-right" size={15} color={ui.muted} />
            </View>
          </View>

          <View style={[styles.infoPanel, { backgroundColor: ui.surface }]}>
            <Text style={[styles.infoPanelTitle, { color: ui.text }]}>Other</Text>
            <TouchableOpacity style={styles.infoActionRow}>
              <Text style={[styles.endConversationText, { color: ui.red }]}>End Conversation</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.infoActionRow}>
              <Text style={[styles.settingLabel, { color: ui.text }]}>Rate this Conversation</Text>
              <FontAwesome5 name="chevron-right" size={14} color={ui.muted} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function SettingRow({ ui = UI, label, value, children }) {
  return (
    <View style={styles.settingRow}>
      <Text style={[styles.settingLabel, { color: ui.text }]}>{label}</Text>
      {children || <Text style={[styles.settingValue, { color: ui.muted }]}>{value}</Text>}
    </View>
  );
}

export default function ChatThread({ conversationId, onBack, embedded = false }) {
  const router = useRouter();
  const { colors: themeColors, resolvedScheme } = useTheme();
  const colors = useMemo(
    () => getChatColors(themeColors, resolvedScheme),
    [themeColors, resolvedScheme],
  );
  const supportUi = useMemo(
    () => ({
      ...UI,
      bg: colors.chatBg,
      bg2: themeColors.bg,
      surface: colors.surface,
      surface2: colors.inputBar,
      card: colors.receivedBg,
      border: colors.border,
      text: colors.text,
      muted: colors.textMuted,
      blue: colors.accent,
      blueDark: colors.accentDark,
      green: colors.online,
      orange: themeColors.warning,
      purple: themeColors.orange || colors.accent,
      primarySoft: colors.accentSoft,
      successSoft: themeColors.successSoft,
      warningSoft: themeColors.warningSoft,
      purpleSoft: themeColors.orangeSoft || colors.accentSoft,
      overlay: resolvedScheme === "dark" ? "rgba(0,0,0,0.42)" : "rgba(15,23,42,0.24)",
      onPrimary: themeColors.onPrimary,
      red: themeColors.danger,
    }),
    [colors, resolvedScheme, themeColors],
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
  const [infoOpen, setInfoOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [muted, setMuted] = useState(false);
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
  const hasShipment = !!(conversation?.trackingNumber || conversation?.shipmentId);

  const openTracking = useCallback(() => {
    const trackingNumber = conversation?.trackingNumber || conversation?.shipmentId;
    if (!trackingNumber) return;
    router.push({
      pathname: "/(customer)/tracking",
      params: { trackingId: trackingNumber },
    });
  }, [conversation?.shipmentId, conversation?.trackingNumber, router]);

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

  const sendQuickMessage = useCallback(
    (text) => {
      if (isClosed || sending || uploading) return;
      setDraft("");
      doSend({ text });
    },
    [doSend, isClosed, sending, uploading],
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
  const headerSubtitle = "Online";

  const handleViewDetails = useCallback(() => {
    if (hasShipment) setDetailsOpen(true);
  }, [hasShipment]);
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
      <View
        style={[
          styles.header,
          { backgroundColor: colors.chatBg, borderBottomColor: colors.border },
        ]}
      >
        {onBack && (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={onBack}
            hitSlop={8}
          >
            <FontAwesome5 name="chevron-left" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
        <SupportAvatar size={48} online ringColor={colors.chatBg} />
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
            {headerSubtitle}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setInfoOpen(true)}
          hitSlop={8}
        >
          <FontAwesome5 name="ellipsis-v" size={17} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {hasShipment && (
        <View style={styles.referenceWrap}>
          <View
            style={[
              styles.referenceBanner,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.referenceText, { color: colors.text }]}>
              Shipment #{conversation?.trackingNumber || conversation?.shipmentId}
            </Text>
            <TouchableOpacity onPress={handleViewDetails} activeOpacity={0.8}>
              <Text style={[styles.referenceAction, { color: colors.accent }]}>
                View Details
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
              <View style={styles.welcomeBubbleRow}>
                <SupportAvatar size={36} online={false} ringColor={colors.chatBg} />
                <View style={[styles.welcomeBubble, { backgroundColor: colors.receivedBg }]}>
                  <Text style={[styles.bubbleText, { color: colors.receivedText }]}>
                    Hello! Welcome to Atlas Customer Support. How can we help you today?
                  </Text>
                </View>
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

          {hasShipment && (
            <View style={styles.agentCardWrap}>
              <ShipmentInfoCard
                conversation={conversation}
                colors={colors}
                onViewTracking={openTracking}
              />
            </View>
          )}

          <QuickActions
            colors={colors}
            hasShipment={hasShipment}
            onTrack={() => setQuickOpen(true)}
            onConcern={() => setQuickOpen(true)}
            onAgent={() => setQuickOpen(true)}
          />

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
                placeholder={isClosed ? "Conversation is closed" : "Type your message..."}
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
                  name={draft.trim() || pendingImage ? "paper-plane" : "smile"}
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

      <Modal
        transparent
        animationType="slide"
        visible={false && infoOpen}
        onRequestClose={() => setInfoOpen(false)}
      >
        <View style={styles.infoBackdrop}>
          <View
            style={[
              styles.infoSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.infoHeader}>
              <SupportAvatar size={58} online ringColor={colors.surface} />
              <View style={styles.infoHeaderText}>
                <Text style={[styles.infoTitle, { color: colors.text }]}>
                  Atlas Support
                </Text>
                <Text style={[styles.infoSubtitle, { color: colors.textMuted }]}>
                  Online
                </Text>
                <Text style={[styles.infoReply, { color: colors.textMuted }]}>
                  Usually replies within 5 minutes
                </Text>
              </View>
              <TouchableOpacity
                style={styles.infoClose}
                onPress={() => setInfoOpen(false)}
              >
                <FontAwesome5 name="times" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.infoSection, { borderColor: colors.border }]}>
              <Text style={[styles.infoSectionTitle, { color: colors.text }]}>
                Conversation
              </Text>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.text }]}>
                  Shipment
                </Text>
                <Text style={[styles.infoValue, { color: colors.textMuted }]}>
                  {conversation?.trackingNumber || "General support"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.text }]}>
                  Notifications
                </Text>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: colors.border, true: colors.accent }}
                />
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.text }]}>
                  Mute
                </Text>
                <Switch
                  value={muted}
                  onValueChange={setMuted}
                  trackColor={{ false: colors.border, true: colors.accent }}
                />
              </View>
            </View>

            <View style={[styles.infoSection, { borderColor: colors.border }]}>
              <Text style={[styles.infoSectionTitle, { color: colors.text }]}>
                Shared Media
              </Text>
              <View style={styles.sharedMediaRow}>
                {messages
                  .map((message) => getMessageAttachment(message))
                  .filter((attachment) => attachment?.type === "image")
                  .slice(-4)
                  .map((attachment, index) => (
                    <Image
                      key={`${attachment.url}-${index}`}
                      source={{ uri: attachment.url }}
                      style={styles.sharedThumb}
                      contentFit="cover"
                    />
                  ))}
                {!messages.some(
                  (message) => getMessageAttachment(message)?.type === "image",
                ) && (
                  <Text style={[styles.noMedia, { color: colors.textMuted }]}>
                    No shared photos yet
                  </Text>
                )}
              </View>
            </View>

            <View style={[styles.infoSection, { borderColor: colors.border }]}>
              <TouchableOpacity style={styles.infoAction}>
                <Text style={[styles.endText, { color: "#EF4444" }]}>
                  End Conversation
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.infoAction}>
                <Text style={[styles.infoLabel, { color: colors.text }]}>
                  Rate this Conversation
                </Text>
                <FontAwesome5
                  name="chevron-right"
                  size={13}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <QuickActionsSheet
        visible={quickOpen}
        onClose={() => setQuickOpen(false)}
        onTrack={openTracking}
        onDetails={() => setDetailsOpen(true)}
        onProblem={() => sendQuickMessage("I need to report a delivery problem.")}
        onChange={() => sendQuickMessage("I need to change my delivery details.")}
        onAgent={() => sendQuickMessage("Please connect me with a live support representative.")}
        ui={supportUi}
      />
      <ShipmentDetailsScreen
        visible={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        conversation={conversation}
        onTrack={openTracking}
        ui={supportUi}
      />
      <ChatInfoScreen
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        conversation={conversation}
        messages={messages}
        notificationsEnabled={notificationsEnabled}
        setNotificationsEnabled={setNotificationsEnabled}
        muted={muted}
        setMuted={setMuted}
        ui={supportUi}
      />
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
  referenceWrap: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
  },
  referenceBanner: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  referenceText: { flex: 1, fontSize: 16, fontWeight: "700" },
  referenceAction: { fontSize: 15, fontWeight: "900" },
  messages: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  welcomeBubbleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 18,
    paddingBottom: 10,
  },
  welcomeBubble: {
    maxWidth: "74%",
    borderRadius: 14,
    borderTopLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  agentCardWrap: {
    paddingHorizontal: 64,
    paddingBottom: 8,
  },
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
  shipmentCard: {
    width: "100%",
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    alignSelf: "stretch",
  },
  shipmentCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shipmentTitleWrap: { flex: 1, minWidth: 0 },
  shipmentEyebrow: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  shipmentTitle: { marginTop: 2, fontSize: 15, fontWeight: "900" },
  shipmentStatusPill: {
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  shipmentStatusText: { fontSize: 11, fontWeight: "900" },
  shipmentRows: {
    marginTop: 10,
    gap: 8,
  },
  shipmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  shipmentLabel: { fontSize: 12, fontWeight: "700" },
  shipmentValue: { flex: 1, textAlign: "right", fontSize: 12, fontWeight: "800" },
  trackingButton: {
    marginTop: 12,
    height: 40,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  trackingButtonText: { fontSize: 13, fontWeight: "900" },
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
  quickActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  quickAction: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  quickActionText: { fontSize: 12, fontWeight: "800" },
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
  infoBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  infoSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 28 : 18,
    gap: 14,
  },
  infoHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoHeaderText: { flex: 1, minWidth: 0 },
  infoTitle: { fontSize: 16, fontWeight: "900" },
  infoSubtitle: { marginTop: 2, fontSize: 12, fontWeight: "800" },
  infoReply: { marginTop: 2, fontSize: 12 },
  infoClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  infoSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 10,
  },
  infoSectionTitle: { fontSize: 13, fontWeight: "900" },
  infoRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  infoLabel: { fontSize: 14, fontWeight: "700" },
  infoValue: { flex: 1, textAlign: "right", fontSize: 13, fontWeight: "700" },
  sharedMediaRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 8 },
  sharedThumb: { width: 54, height: 54, borderRadius: 10 },
  noMedia: { fontSize: 13 },
  infoAction: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  endText: { fontSize: 14, fontWeight: "800" },
});
