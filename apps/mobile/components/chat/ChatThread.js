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
  Alert,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
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
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  startConversationCall,
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

function getCallHistoryView(message = {}) {
  const text = String(message.text || "").replace(/ðŸ“ž|📞/g, "").trim();
  const lower = text.toLowerCase();
  const type = String(message.callType || "").toLowerCase() === "video" || lower.includes("video")
    ? "video"
    : "voice";
  const durationMatch = text.match(/\b\d{1,2}:\d{2}\b/);
  const seconds = Math.max(0, Number(message.duration || 0));
  const duration = durationMatch?.[0] || (seconds > 0
    ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
    : null);
  let status = duration ? "Call ended" : "Call ended";
  if (lower.includes("missed") || lower.includes("unanswered") || lower.includes("no answer")) status = "Missed";
  else if (lower.includes("declined")) status = "Declined";
  else if (lower.includes("cancel")) status = "Cancelled";
  else if (lower.includes("ongoing")) status = "Ongoing";
  const exceptional = ["Missed", "Declined", "Cancelled"].includes(status);
  return {
    type,
    duration,
    status,
    exceptional,
    title: exceptional ? `${status} ${type} call` : `${type === "video" ? "Video" : "Voice"} call`,
  };
}

function CallHistoryCard({ message, mine, colors, onCall }) {
  const call = getCallHistoryView(message);
  const primaryColor = mine ? colors.sentText : colors.receivedText;
  const secondaryColor = mine ? "rgba(255,255,255,0.78)" : colors.textMuted;
  return (
    <View style={styles.callHistoryCard}>
      <View style={styles.callHistoryTop}>
        <View style={[styles.callHistoryIcon, { backgroundColor: call.exceptional ? colors.danger : mine ? "rgba(255,255,255,0.16)" : colors.surface }]}>
          <FontAwesome5 name={call.type === "video" ? "video" : "phone-alt"} size={18} color={call.exceptional || mine ? "#FFFFFF" : colors.text} />
        </View>
        <View style={styles.callHistoryCopy}>
          <Text style={[styles.callHistoryTitle, { color: primaryColor }]}>{call.title}</Text>
          <Text style={[styles.callHistoryStatus, { color: secondaryColor }]}>{call.status}</Text>
          {call.duration ? <Text style={[styles.callHistoryDuration, { color: primaryColor }]}>Duration {call.duration}</Text> : null}
        </View>
      </View>
      {call.exceptional && onCall ? (
        <TouchableOpacity style={[styles.callHistoryAction, { backgroundColor: mine ? "rgba(255,255,255,0.14)" : colors.surface }]} onPress={() => onCall(call.type)}>
          <FontAwesome5 name={call.type === "video" ? "video" : "phone-alt"} size={13} color={primaryColor} />
          <Text style={[styles.callHistoryActionText, { color: primaryColor }]}>{mine ? "Call again" : "Call back"}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function MessageBubble({ item, colors, onOpenImage, onCall }) {
  const { message, mine, isFirstInGroup, isLastInGroup } = item;
  const attachment = getMessageAttachment(message);
  const text = getMessageText(message);
  const appear = useRef(new Animated.Value(0)).current;
  const sentStatusColor = item.seenByOther ? colors.accent : colors.textMuted;

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
  const isCall = String(message.type || "").trim().toLowerCase() === "call";

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
            {isCall ? (
              <CallHistoryCard message={message} mine colors={colors} onCall={onCall} />
            ) : isFile ? (
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
            {isCall ? (
              <CallHistoryCard message={message} mine={false} colors={colors} onCall={onCall} />
            ) : isFile ? (
              <FileChip attachment={attachment} tint={colors.accent} />
            ) : (
              <Text style={[styles.bubbleText, { color: colors.receivedText }]}>
                {text}
              </Text>
            )}
          </View>
        )}

        {(isCall || isLastInGroup) && !mine && (
          <View
            style={[
              styles.metaRow,
              { justifyContent: "flex-start" },
            ]}
          >
            <Text style={[styles.metaTime, { color: colors.textMuted }]}>
              {formatClockTime(message.createdAt)}
            </Text>
          </View>
        )}

        {(isCall || isLastInGroup) && mine ? (
          <View style={styles.sentMetaRow}>
            <Text style={[styles.metaTime, { color: colors.textMuted }]}>
              {formatClockTime(message.createdAt)}
            </Text>
            <FontAwesome5 name="check-double" size={11} color={sentStatusColor} />
          </View>
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
  const summary = conversation?.shipmentSummary || {};
  const status = summary.status || "Out for Delivery";
  const receiver = summary.recipientName || summary.recipient?.name || "Not available";
  const timeline = [
    ["Order Confirmed", "Jun 28, 8:30 AM", true],
    ["Picked Up", "Jun 28, 10:15 AM", true],
    ["In Transit", "Jun 29, 7:45 AM", true],
    ["Out for Delivery", "Jun 29, 9:20 AM", true, true],
    ["Delivered", "", false],
  ];

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={[styles.fullScreen, { backgroundColor: ui.bg }]}>
        <View style={styles.screenHeader}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <FontAwesome5 name="chevron-left" size={20} color={ui.text} />
          </TouchableOpacity>
          <View style={styles.screenHeaderCopy}>
            <Text style={[styles.screenTitle, { color: ui.text }]}>Shipment Details</Text>
            <Text style={[styles.screenSubtitle, { color: ui.muted }]} numberOfLines={1}>
              {trackingNumber.replace("#", "")}
            </Text>
          </View>
          <View style={styles.screenHeaderAction} />
        </View>
        <ScrollView contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.detailsCard, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <View style={styles.detailsTop}>
              <View style={[styles.detailsIcon, { backgroundColor: ui.primarySoft || ui.surface2 }]}>
                <FontAwesome5 name="cube" size={21} color={ui.blue} />
              </View>
              <View style={styles.detailsHeading}>
                <Text style={[styles.detailsEyebrow, { color: ui.muted }]}>SHIPMENT ID</Text>
                <Text style={[styles.detailsShipment, { color: ui.text }]} numberOfLines={1}>{trackingNumber.replace("#", "")}</Text>
              </View>
              <View style={[styles.detailsStatusBadge, { backgroundColor: ui.successSoft || ui.surface2 }]}>
                <View style={[styles.detailsStatusDot, { backgroundColor: ui.green }]} />
                <Text style={[styles.detailsStatus, { color: ui.green }]}>{status}</Text>
              </View>
            </View>
            <View style={[styles.detailsDivider, { backgroundColor: ui.border }]} />
            <InfoLine ui={ui} icon="clock" label="Estimated Arrival" value="Today, 3:30 PM" />
            <InfoLine ui={ui} icon="user" label="Driver" value="Juan Dela Cruz" actionIcon="phone-alt" />
            <InfoLine ui={ui} icon="truck" label="Vehicle" value="ABC-1234" />
            <InfoLine ui={ui} icon="user-check" label="Receiver" value={receiver} />
            <InfoLine ui={ui} icon="map-marker-alt" label="Delivery Address" value="123 Rizal St, Cebu City, Cebu 6000" actionIcon="map" />
          </View>

          <View style={[styles.progressCard, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <View style={styles.progressHeading}>
              <View style={[styles.progressIcon, { backgroundColor: ui.primarySoft || ui.surface2 }]}>
                <FontAwesome5 name="route" size={16} color={ui.blue} />
              </View>
              <View>
                <Text style={[styles.progressTitle, { color: ui.text }]}>Delivery Progress</Text>
                <Text style={[styles.progressSubtitle, { color: ui.muted }]}>Your shipment journey</Text>
              </View>
            </View>
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
                    {current ? <View style={[styles.currentDot, { backgroundColor: ui.onPrimary || "#ffffff" }]} /> : null}
                  </View>
                  {index < timeline.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        { backgroundColor: done && !current ? ui.green : ui.border },
                      ]}
                    />
                  )}
                </View>
                <View style={styles.timelineCopy}>
                  <Text style={[styles.timelineTitle, { color: current ? ui.blue : done ? ui.text : ui.muted }]}>{title}</Text>
                  {!!time && <Text style={[styles.timelineTime, { color: ui.muted }]}>{time}</Text>}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.detailsActions}>
            <TouchableOpacity
              style={[styles.detailsSecondaryAction, { backgroundColor: ui.surface, borderColor: ui.border }]}
              onPress={onClose}
              activeOpacity={0.84}
            >
              <FontAwesome5 name="headset" size={16} color={ui.blue} />
              <Text style={[styles.detailsSecondaryText, { color: ui.text }]}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function InfoLine({ ui = UI, icon, label, value, actionIcon, valueColor, dotColor }) {
  return (
    <View style={styles.infoLine}>
      <View style={styles.infoLineLabel}>
        <FontAwesome5 name={icon} size={12} color={ui.muted} />
        <Text style={[styles.infoLineLabelText, { color: ui.muted }]}>{label}</Text>
      </View>
      <View style={styles.infoLineValueWrap}>
        {dotColor && <View style={[styles.smallDot, { backgroundColor: dotColor }]} />}
        <Text style={[styles.infoLineValue, { color: valueColor || ui.text }]} numberOfLines={2}>{value}</Text>
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
  onViewTracking,
  onOpenMedia,
}) {
  const media = messages
    .map((message) => getMessageAttachment(message))
    .filter((attachment) => attachment?.type === "image");
  const shownMedia = media.slice(-4);
  const hasMedia = shownMedia.length > 0;
  const supportTeam = conversation?.supportTeam || "Customer Support Team";
  const supportDescription = conversation?.supportDescription || conversation?.supportAbout ||
    "We're here to assist you with shipment inquiries, delivery concerns, and general questions.";
  const supportEmail = conversation?.supportEmail || "support@atlasexpress.com";
  const supportPhone = conversation?.supportPhone || conversation?.supportHotline || "(+63) 999 123 4567";
  const supportWebsite = conversation?.supportWebsite || "www.atlasexpress.com";
  const supportAddress = conversation?.supportAddress || conversation?.supportOfficeAddress ||
    "123 Atlas Building, Logistics Ave.,\nMakati City, Metro Manila, Philippines";
  const infoScrollRef = useRef(null);
  const [infoScrollOffset, setInfoScrollOffset] = useState(0);

  const launchUrl = async (url, fallbackMessage) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Unavailable", fallbackMessage);
      }
    } catch (err) {
      console.error("Linking error:", err);
      Alert.alert("Unable to open", fallbackMessage);
    }
  };

  const copyConversationId = async () => {
    if (!conversation?.id) return;
    await Clipboard.setStringAsync(String(conversation.id));
    Alert.alert("Copied!", "Conversation ID copied to clipboard.");
  };

  const openMail = (email) => launchUrl(`mailto:${email}`, "Email is not available on this device.");
  const openPhone = (phone) => launchUrl(`tel:${phone}`, "Phone dialer is not available on this device.");
  const openWebsite = (url) => {
    const target = String(url || "").trim();
    if (!target) return;
    const normalized = target.startsWith("http") ? target : `https://${target}`;
    launchUrl(normalized, "Unable to open the website.");
  };
  const openMaps = (address) => {
    const query = encodeURIComponent(String(address || "").trim());
    if (!query) return;
    launchUrl(`https://www.google.com/maps/search/?api=1&query=${query}`, "Maps is not available on this device.");
  };

  useEffect(() => {
    if (visible && infoScrollRef.current && infoScrollOffset > 0) {
      infoScrollRef.current.scrollTo({ y: infoScrollOffset, animated: false });
    }
  }, [visible]);

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={[styles.fullScreen, { backgroundColor: ui.bg }]}> 
        <View style={[styles.chatInfoHeader, { borderBottomColor: ui.border }]}> 
          <TouchableOpacity style={styles.chatInfoHeaderButton} onPress={onClose}>
            <FontAwesome5 name="chevron-left" size={20} color={ui.text} />
          </TouchableOpacity>
          <Text style={[styles.chatInfoHeaderTitle, { color: ui.text }]}>Chat Information</Text>
          <View style={styles.chatInfoHeaderButton}>
            <FontAwesome5 name="ellipsis-v" size={20} color={ui.text} />
          </View>
        </View>

        <ScrollView
          ref={infoScrollRef}
          style={styles.infoScrollView}
          contentContainerStyle={styles.infoScreenContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={({ nativeEvent }) => setInfoScrollOffset(nativeEvent.contentOffset.y)}
        >
          <View style={styles.chatInfoHero}>
            <SupportAvatar size={96} online={false} ringColor={ui.bg} />
            <Text style={[styles.chatInfoHeroName, { color: ui.text }]} numberOfLines={1}>
              {conversation?.supportName || "Atlas Support"}
            </Text>
            <View style={styles.chatInfoHeroStatus}>
              <View style={[styles.chatInfoHeroDot, { backgroundColor: ui.green }]} />
              <Text style={[styles.chatInfoHeroStatusText, { color: ui.text }]}>
                {conversation?.onlineStatus || "Online"}
              </Text>
            </View>
          </View>

          <View style={[styles.chatInfoCard, { backgroundColor: ui.surface, borderColor: ui.cardBorder || ui.border }]}> 
            <ChatInfoContentRow
              ui={ui}
              icon="info"
              title="About Atlas Support"
              primary={supportTeam}
              text={supportDescription}
            />
            <ChatInfoContentRow
              ui={ui}
              icon="clock"
              title="Support Hours"
              primary="Monday – Sunday"
              text="8:00 AM – 8:00 PM"
            />
            {hasMedia ? (
              <ChatInfoMediaSection
                ui={ui}
                media={media}
                shownMedia={shownMedia}
                onOpenMedia={onOpenMedia}
              />
            ) : null}
          </View>

          <View style={[styles.chatInfoCard, { backgroundColor: ui.surface, borderColor: ui.cardBorder || ui.border }]}> 
            <ChatInfoContactHeader ui={ui} />
            <ChatInfoContactRow ui={ui} icon="envelope" value={supportEmail} onPress={() => openMail(supportEmail)} />
            <ChatInfoContactRow ui={ui} icon="phone" value={supportPhone} onPress={() => openPhone(supportPhone)} />
            <ChatInfoContactRow ui={ui} icon="globe" value={supportWebsite} onPress={() => openWebsite(supportWebsite)} chevron />
            <ChatInfoContactRow
              ui={ui}
              icon="map-marker-alt"
              title="Head Office"
              value={supportAddress}
              onPress={() => openMaps(supportAddress)}
              chevron
              last
            />
          </View>

          <View style={[styles.chatInfoCard, { backgroundColor: ui.surface, borderColor: ui.border }]}> 
            <View style={styles.chatInfoContactHeader}>
              <View style={[styles.chatInfoLargeIcon, { backgroundColor: ui.surface2 }]}>
                <FontAwesome5 name="bell" size={22} color={ui.blue} />
              </View>
              <Text style={[styles.chatInfoContentTitle, { color: ui.text }]}>Notifications</Text>
            </View>
            <View style={styles.chatInfoSettingRow}>
              <View style={[styles.chatInfoSettingIcon, { backgroundColor: ui.surface2 }]}> 
                <FontAwesome5 name="bell" size={22} color={ui.blue} />
              </View>
              <View style={styles.chatInfoSettingCopy}>
                <Text style={[styles.chatInfoSettingTitle, { color: ui.text }]}>Receive Notifications</Text>
                <Text style={[styles.chatInfoSettingText, { color: ui.muted }]}>Get updates about this shipment</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: ui.border, true: ui.blue }}
                thumbColor={ui.onPrimary || "#ffffff"}
              />
            </View>
            <View style={[styles.chatInfoDivider, { backgroundColor: ui.border }]} />
            <View style={styles.chatInfoSettingRow}>
              <View style={[styles.chatInfoSettingIcon, { backgroundColor: ui.surface2 }]}> 
                <FontAwesome5 name="bell-slash" size={21} color={ui.muted} />
              </View>
              <View style={styles.chatInfoSettingCopy}>
                <Text style={[styles.chatInfoSettingTitle, { color: ui.text }]}>Mute Conversation</Text>
                <Text style={[styles.chatInfoSettingText, { color: ui.muted }]}>Disable notifications for this chat</Text>
              </View>
              <Switch
                value={muted}
                onValueChange={setMuted}
                trackColor={{ false: ui.border, true: ui.blue }}
                thumbColor={ui.onPrimary || "#ffffff"}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function DirectStaffInfoScreen({ visible, onClose, contact, messages, ui = UI, onOpenMedia }) {
  const [rendered, setRendered] = useState(visible);
  const translateX = useRef(new Animated.Value(Dimensions.get("window").width)).current;
  const media = messages
    .map((message) => getMessageAttachment(message))
    .filter((attachment) => attachment?.type === "image")
    .slice(-4);
  const location = contact?.municipality || contact?.warehouseName || "Assigned warehouse";

  useEffect(() => {
    if (!visible) return;
    setRendered(true);
    translateX.setValue(Dimensions.get("window").width);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [translateX, visible]);

  const closeFromRight = useCallback(() => {
    Animated.timing(translateX, {
      toValue: Dimensions.get("window").width,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setRendered(false);
        onClose();
      }
    });
  }, [onClose, translateX]);

  if (!rendered) return null;

  return (
    <Modal animationType="none" visible={rendered} onRequestClose={closeFromRight} transparent>
      <Animated.View style={[styles.fullScreen, { backgroundColor: ui.bg, transform: [{ translateX }] }]}>
        <View style={[styles.chatInfoHeader, { borderBottomColor: ui.border }]}>
          <TouchableOpacity style={styles.chatInfoHeaderButton} onPress={closeFromRight}>
            <FontAwesome5 name="chevron-left" size={20} color={ui.text} />
          </TouchableOpacity>
          <Text style={[styles.chatInfoHeaderTitle, { color: ui.text }]}>Chat Information</Text>
          <View style={styles.chatInfoHeaderButton} />
        </View>
        <ScrollView contentContainerStyle={styles.infoScreenContent} showsVerticalScrollIndicator={false}>
          <View style={styles.chatInfoHero}>
            <PersonAvatar
              name={contact?.name || "Atlas staff"}
              photoURL={contact?.photoURL}
              online={!!contact?.online}
              ringColor={ui.bg}
              size={96}
            />
            <Text style={[styles.chatInfoHeroName, { color: ui.text }]} numberOfLines={1}>
              {contact?.name || "Atlas staff"}
            </Text>
            <View style={styles.chatInfoHeroStatus}>
              <View style={[styles.chatInfoHeroDot, { backgroundColor: contact?.online ? ui.green : ui.muted }]} />
              <Text style={[styles.chatInfoHeroStatusText, { color: ui.text }]}>
                {contact?.online ? "Active now" : contact?.lastActiveLabel || "Offline"}
              </Text>
            </View>
          </View>

          <View style={[styles.chatInfoCard, { backgroundColor: ui.surface, borderColor: ui.cardBorder || ui.border }]}>
            <ChatInfoContentRow ui={ui} icon="user" title="Role" primary={contact?.roleLabel || contact?.role || "Atlas staff"} />
            <ChatInfoContentRow ui={ui} icon="map-marker-alt" title="Assigned location" primary={location} />
            {contact?.warehouseName && contact?.warehouseName !== location ? (
              <ChatInfoContentRow ui={ui} icon="warehouse" title="Warehouse" primary={contact.warehouseName} />
            ) : null}
            {media.length ? (
              <ChatInfoMediaSection ui={ui} media={media} shownMedia={media} onOpenMedia={onOpenMedia} />
            ) : null}
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function ChatInfoContentRow({ ui = UI, icon, title, primary, text }) {
  return (
    <View style={[styles.chatInfoContentRow, { borderBottomColor: ui.border }]}>
      <View style={[styles.chatInfoLargeIcon, { backgroundColor: ui.surface2 }]}>
        <FontAwesome5 name={icon} size={22} color={ui.blue} />
      </View>
      <View style={styles.chatInfoContentCopy}>
        <Text style={[styles.chatInfoContentTitle, { color: ui.text }]}>{title}</Text>
        {!!primary && <Text style={[styles.chatInfoContentPrimary, { color: ui.text }]}>{primary}</Text>}
        {!!text && <Text style={[styles.chatInfoContentText, { color: ui.muted }]}>{text}</Text>}
      </View>
    </View>
  );
}

function ChatInfoMediaSection({ ui = UI, media, shownMedia, onOpenMedia }) {
  return (
    <View style={styles.chatInfoContentRowLast}>
      <View style={[styles.chatInfoLargeIcon, { backgroundColor: ui.surface2 }]}>
        <FontAwesome5 name="image" size={22} color={ui.blue} />
      </View>
      <View style={styles.chatInfoContentCopy}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => onOpenMedia(shownMedia[0]?.url)}
          style={styles.chatInfoMediaHeader}
        >
          <Text style={[styles.chatInfoContentTitle, { color: ui.text }]}>Uploaded Media</Text>
          <View style={styles.chatInfoSectionAction}>
            <Text style={[styles.chatInfoMediaCount, { color: ui.blue }]}>{media.length}</Text>
            <FontAwesome5 name="chevron-right" size={18} color={ui.blue} />
          </View>
        </TouchableOpacity>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chatInfoMediaStrip}
        >
          {shownMedia.map((attachment, index) => {
            const moreCount = media.length - shownMedia.length;
            const isMore = index === shownMedia.length - 1 && moreCount > 0;
            return (
              <TouchableOpacity
                key={`${attachment.url}-${index}`}
                style={styles.chatInfoMediaThumbWrap}
                onPress={() => onOpenMedia(attachment.url)}
                activeOpacity={0.9}
              >
                <Image source={{ uri: attachment.url }} style={styles.chatInfoMediaThumb} contentFit="cover" />
                {isMore ? (
                  <View style={styles.chatInfoMediaMoreShade}>
                    <Text style={[styles.chatInfoMediaMoreText, { color: ui.onPrimary || "#ffffff" }]}>+{moreCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function ChatInfoContactRow({ ui = UI, icon, title, value, onPress, chevron, last }) {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[styles.chatInfoContactRow, !last && { borderBottomColor: ui.border, borderBottomWidth: 1 }]}
    >
      <View style={[styles.chatInfoSmallIcon, { backgroundColor: ui.surface2 }]}> 
        <FontAwesome5 name={icon} size={20} color={ui.blue} />
      </View>
      <View style={styles.chatInfoContactCopy}>
        {!!title && <Text style={[styles.chatInfoContactTitle, { color: ui.text }]}>{title}</Text>}
        <Text style={[styles.chatInfoContactValue, { color: ui.muted }]} numberOfLines={title ? undefined : 1}>
          {value}
        </Text>
      </View>
      {chevron ? <FontAwesome5 name="chevron-right" size={18} color={ui.muted} /> : null}
    </TouchableOpacity>
  );
}

function ChatInfoContactHeader({ ui = UI }) {
  return (
    <View style={styles.chatInfoContactHeader}>
      <View style={[styles.chatInfoLargeIcon, { backgroundColor: ui.surface2 }]}> 
        <FontAwesome5 name="user" size={22} color={ui.blue} />
      </View>
      <Text style={[styles.chatInfoContentTitle, { color: ui.text }]}>Support Contact</Text>
    </View>
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
  const insets = useSafeAreaInsets();
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
      cardBorder: resolvedScheme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.08)",
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
  const [startingCall, setStartingCall] = useState(null);
  const [pendingAttachment, setPendingAttachment] = useState(null);
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
      orderBy("createdAt", "desc"),
      limit(200),
    );
    return onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .reverse();
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

  const { items } = useMemo(
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
  const isDirectStaff = conversation?.type === "direct_staff";
  const directContact = useMemo(() => {
    if (!isDirectStaff) return null;
    const contactId = (conversation?.participantIds || []).find((id) => id !== myUid);
    return contactId ? conversation?.participantProfiles?.[contactId] || null : null;
  }, [conversation, isDirectStaff, myUid]);
  const headerTitle = isDirectStaff ? directContact?.name || "Atlas staff" : "Atlas Support";
  const hasShipment = !!(conversation?.trackingNumber || conversation?.shipmentId);
  const canSend = !!draft.trim() || !!pendingAttachment;
  const showSendButton = canSend || sending || uploading;

  const openTracking = useCallback(() => {
    const trackingNumber = conversation?.trackingNumber || conversation?.shipmentId;
    if (!trackingNumber) return;
    router.push({
      pathname: "/(customer)/tracking",
      params: { trackingId: trackingNumber },
    });
  }, [conversation?.shipmentId, conversation?.trackingNumber, router]);

  const startCall = useCallback(
    async (callType) => {
      if (!conversationId || startingCall) return;
      if (isClosed) {
        return;
      }

      try {
        setStartingCall(callType);
        await startConversationCall({
          conversationId: String(conversationId),
          type: callType,
        });
      } catch (error) {
        console.error("Start call failed:", error);
        const fallbackMessage = isDirectStaff
          ? `Unable to call ${headerTitle} right now.`
          : "Unable to call Atlas Support right now.";
        const busyReason = error?.details?.reason || error?.customData?.details?.reason;
        const errorMessage = busyReason === "caller-busy"
          ? "This account is currently in an active call on another device."
          : busyReason === "receiver-busy"
            ? `${headerTitle} is currently on another call.`
            : busyReason === "both-busy"
              ? "You and this contact currently have active calls."
              : String(error?.message || fallbackMessage)
                .replace(/^Firebase:\s*/i, "")
                .replace(/^\[functions\/[\w-]+\]\s*/i, "");
        Alert.alert(
          callType === "video" ? "Video call unavailable" : "Voice call unavailable",
          errorMessage,
        );
      } finally {
        setStartingCall(null);
      }
    },
    [conversationId, headerTitle, isClosed, isDirectStaff, startingCall],
  );

  const handleVoiceCall = useCallback(async () => {
    await startCall("voice");
  }, [startCall]);

  const handleVideoCall = useCallback(async () => {
    await startCall("video");
  }, [startCall]);

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
    if ((!text && !pendingAttachment) || isClosed || sending || uploading) return;

    // Upload staged images/documents first, matching the attachment scheme
    // shared by the customer mobile chat and the web messaging console.
    if (pendingAttachment) {
      try {
        setUploading(true);
        const attachmentType = pendingAttachment.type === "image" ? "image" : "file";
        const fallbackName = attachmentType === "image" ? `photo_${Date.now()}.jpg` : `file_${Date.now()}`;
        const name = pendingAttachment.name || fallbackName;
        const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const response = await fetch(pendingAttachment.uri);
        const blob = await response.blob();
        const storageRef = ref(
          storage,
          `chat/${conversationId}/${Date.now()}_${safeName}`,
        );
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        await doSend({
          text: encodeTextAttachment({ url, type: attachmentType, name }),
          attachmentUrl: url,
          attachmentType,
          attachmentName: name,
        });
      } catch (error) {
        console.error("Attachment upload failed:", error);
        Alert.alert("Upload failed", "The attachment could not be sent. Please try again.");
      } finally {
        setUploading(false);
        setPendingAttachment(null);
      }
    }

    if (text) {
      setDraft("");
      await doSend({ text });
    }
  }, [draft, pendingAttachment, isClosed, sending, uploading, conversationId, doSend]);

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
        setPendingAttachment({
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          type: "image",
        });
        setEmojiOpen(false);
      }
    } catch (error) {
      console.error("Image pick failed:", error);
    }
  }, [isClosed]);

  const handlePickFile = useCallback(async () => {
    if (isClosed) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        if (Number(asset.size || 0) > 15 * 1024 * 1024) {
          Alert.alert("File too large", "Choose a file smaller than 15 MB.");
          return;
        }
        setPendingAttachment({
          uri: asset.uri,
          name: asset.name || `file_${Date.now()}`,
          type: "file",
        });
        setEmojiOpen(false);
      }
    } catch (error) {
      console.error("File pick failed:", error);
      Alert.alert("File unavailable", "The selected file could not be opened.");
    }
  }, [isClosed]);

  const statusMeta = getStatusMeta(conversation?.status);
  const headerSubtitle = isDirectStaff
    ? [
        directContact?.roleLabel || directContact?.role,
        directContact?.municipality,
        directContact?.online ? "Online" : "Offline",
      ]
        .filter(Boolean)
        .join(" · ")
    : "Online";

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
    return (
      <MessageBubble
        item={item}
        colors={colors}
        onOpenImage={setLightbox}
        onCall={startCall}
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
        {isDirectStaff ? (
          <PersonAvatar
            name={headerTitle}
            photoURL={directContact?.photoURL}
            online={!!directContact?.online}
            ringColor={colors.chatBg}
            size={48}
          />
        ) : (
          <SupportAvatar size={48} online ringColor={colors.chatBg} />
        )}
        <View style={styles.headerText}>
          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {headerTitle}
          </Text>
          <Text
            style={[styles.headerSubtitle, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {headerSubtitle}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={handleVoiceCall}
            disabled={!!startingCall}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="Voice call"
          >
            {startingCall === "voice" ? (
              <ActivityIndicator size="small" color={colors.online} />
            ) : (
              <FontAwesome5 name="phone-alt" size={20} color={colors.online} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={handleVideoCall}
            disabled={!!startingCall}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="Video call"
          >
            {startingCall === "video" ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <FontAwesome5 name="video" size={21} color={colors.accent} />
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.headerBtn, styles.headerInfoBtn, { backgroundColor: colors.accentSoft }]}
          onPress={() => setInfoOpen(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Chat information"
        >
          <FontAwesome5 name="info-circle" size={17} color={colors.accent} />
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
          keyboardVerticalOffset={
            Platform.OS === "ios" && !embedded ? -insets.bottom : 0
          }
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
            ListHeaderComponent={!isDirectStaff ? (
              <View style={styles.welcomeBubbleRow}>
                <SupportAvatar size={36} online={false} ringColor={colors.chatBg} />
                <View style={[styles.welcomeBubble, { backgroundColor: colors.receivedBg }]}>
                  <Text style={[styles.bubbleText, { color: colors.receivedText }]}>
                    Hello! Welcome to Atlas Customer Support. How can we help you today?
                  </Text>
                </View>
              </View>
            ) : null}
            ListEmptyComponent={
              <View style={styles.emptyThread}>
                <FontAwesome5
                  name="comment-dots"
                  size={30}
                  color={colors.textMuted}
                />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {isDirectStaff
                    ? `Send a message to ${headerTitle}.`
                    : "Send a message and the Atlas team will reply here."}
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

          {/* Pending image/file preview */}
          {pendingAttachment && (
            <View
              style={[
                styles.pendingBar,
                { backgroundColor: colors.surface, borderTopColor: colors.border },
              ]}
            >
              {pendingAttachment.type === "image" ? (
                <Image
                  source={{ uri: pendingAttachment.uri }}
                  style={styles.pendingThumb}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.pendingFileIcon, { backgroundColor: colors.accentSoft }]}>
                  <FontAwesome5 name="file-alt" size={19} color={colors.accent} />
                </View>
              )}
              <Text
                style={[styles.pendingName, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {pendingAttachment.name}
              </Text>
              <TouchableOpacity
                onPress={() => setPendingAttachment(null)}
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

          {isDirectStaff && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.staffQuickActions}
              keyboardShouldPersistTaps="handled"
            >
              {["Shipment update: ", "Delivery status: ", "Package issue: "].map((template) => (
                <TouchableOpacity
                  key={template}
                  style={[styles.staffQuickChip, { backgroundColor: colors.accentSoft }]}
                  onPress={() => setDraft((current) => current || template)}
                >
                  <FontAwesome5 name="box" size={12} color={colors.accent} />
                  <Text style={[styles.staffQuickText, { color: colors.accent }]}>
                    {template.trim().replace(":", "")}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Sticky composer — styled to match the manager messaging console */}
          <View
            style={[
              styles.composer,
              { backgroundColor: colors.chatBg, borderTopColor: colors.border },
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
                size={22}
                color={isClosed ? colors.textMuted : colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.composerIcon}
              onPress={handlePickFile}
              disabled={isClosed || uploading}
              hitSlop={6}
            >
              <FontAwesome5
                name="paperclip"
                size={22}
                color={isClosed ? colors.textMuted : colors.text}
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
                  size={22}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            {showSendButton ? (
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  {
                    backgroundColor:
                      !canSend || isClosed ? colors.textMuted : colors.accent,
                  },
                ]}
                onPress={handleSend}
                disabled={!canSend || sending || uploading || isClosed}
                activeOpacity={0.82}
              >
                {sending || uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <FontAwesome5 name="paper-plane" size={17} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            ) : null}
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
      {!isDirectStaff && <QuickActionsSheet
        visible={quickOpen}
        onClose={() => setQuickOpen(false)}
        onTrack={openTracking}
        onDetails={() => setDetailsOpen(true)}
        onProblem={() => sendQuickMessage("I need to report a delivery problem.")}
        onChange={() => sendQuickMessage("I need to change my delivery details.")}
        onAgent={() => sendQuickMessage("Please connect me with a live support representative.")}
        ui={supportUi}
      />}
      {!isDirectStaff && <ShipmentDetailsScreen
        visible={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        conversation={conversation}
        onTrack={openTracking}
        ui={supportUi}
      />}
      {!isDirectStaff && <ChatInfoScreen
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        conversation={conversation}
        messages={messages}
        notificationsEnabled={notificationsEnabled}
        setNotificationsEnabled={setNotificationsEnabled}
        muted={muted}
        setMuted={setMuted}
        ui={supportUi}
        onViewTracking={openTracking}
        onOpenMedia={setLightbox}
      />}
      {isDirectStaff && <DirectStaffInfoScreen
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        contact={directContact}
        messages={messages}
        ui={supportUi}
        onOpenMedia={setLightbox}
      />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 0,
  },
  headerBtn: {
    width: 44,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  headerInfoBtn: {
    width: 36,
    height: 36,
    minWidth: 36,
    minHeight: 36,
    borderRadius: 18,
    marginLeft: 2,
    overflow: "hidden",
  },
  headerActionBtn: {
    width: 42,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  headerSubtitle: { marginTop: 2, fontSize: 14, fontWeight: "400" },
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  referenceBanner: {
    minHeight: 43,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  referenceText: { flex: 1, fontSize: 13, fontWeight: "600" },
  referenceAction: { fontSize: 12, fontWeight: "800" },
  messages: { paddingHorizontal: 16, paddingBottom: 10, paddingTop: 0 },
  welcomeBubbleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  welcomeBubble: {
    maxWidth: "70%",
    borderRadius: 10,
    borderTopLeftRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  agentCardWrap: {
    paddingLeft: 48,
    paddingRight: 33,
    paddingBottom: 6,
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
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 10,
    padding: 9,
    alignSelf: "stretch",
  },
  shipmentCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shipmentTitleWrap: { flex: 1, minWidth: 0 },
  shipmentEyebrow: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  shipmentTitle: { marginTop: 0, fontSize: 12, fontWeight: "800" },
  shipmentStatusPill: {
    minHeight: 20,
    borderRadius: 6,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  shipmentStatusText: { fontSize: 10, fontWeight: "800" },
  shipmentRows: {
    marginTop: 9,
    gap: 7,
  },
  shipmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  shipmentLabel: { fontSize: 11, fontWeight: "500" },
  shipmentValue: { flex: 1, textAlign: "right", fontSize: 11, fontWeight: "700" },
  trackingButton: {
    marginTop: 10,
    height: 34,
    borderRadius: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  trackingButtonText: { fontSize: 12, fontWeight: "800" },
  dayDivider: { alignItems: "center", marginVertical: 12 },
  dayText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  avatarSlot: { width: 28, alignItems: "center", justifyContent: "flex-end" },
  bubbleColumn: { maxWidth: "76%" },
  senderName: { fontSize: 11, fontWeight: "700", marginBottom: 3, marginLeft: 4 },
  bubble: { paddingHorizontal: 12, paddingVertical: 9 },
  bubbleText: { fontSize: 12, lineHeight: 18 },
  callHistoryCard: { width: 216, maxWidth: "100%", gap: 12 },
  callHistoryTop: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  callHistoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  callHistoryCopy: { flex: 1, minWidth: 0, paddingTop: 1 },
  callHistoryTitle: { fontSize: 14, lineHeight: 18, fontWeight: "900", textTransform: "capitalize" },
  callHistoryStatus: { marginTop: 2, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  callHistoryDuration: { marginTop: 5, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  callHistoryAction: {
    minHeight: 38,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  callHistoryActionText: { fontSize: 13, fontWeight: "900" },
  metaRow: { flexDirection: "row", marginTop: 5, paddingHorizontal: 4 },
  metaTime: { fontSize: 12, fontWeight: "600" },
  sentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
    marginTop: 6,
    marginRight: 4,
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
  pendingFileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingName: { flex: 1, fontSize: 13 },
  staffQuickActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  staffQuickChip: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  staffQuickText: { fontSize: 12, fontWeight: "800" },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 16 : 12,
    borderTopWidth: 1,
  },
  composerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 24,
    paddingLeft: 18,
    paddingRight: 12,
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.OS === "ios" ? 11 : 7,
    maxHeight: 110,
  },
  emojiToggle: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0A7CFF",
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  lightbox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxClose: { position: "absolute", top: 50, right: 24, zIndex: 2, padding: 8 },
  lightboxImage: { width: "92%", height: "80%" },
  fullScreen: { flex: 1 },
  screenHeader: {
    minHeight: 62,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  screenTitle: {
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
  },
  screenHeaderCopy: { flex: 1, minWidth: 0, alignItems: "center" },
  screenSubtitle: { marginTop: 3, maxWidth: "100%", fontSize: 11, fontWeight: "600" },
  screenHeaderAction: {
    width: 42,
    height: 42,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  detailsContent: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
    gap: 16,
  },
  detailsCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 4,
  },
  detailsTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 18,
  },
  detailsIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsHeading: { flex: 1, minWidth: 0 },
  detailsEyebrow: { fontSize: 10, lineHeight: 14, fontWeight: "800", letterSpacing: 0.7 },
  detailsShipment: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  detailsStatus: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  detailsStatusBadge: {
    maxWidth: "42%",
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  detailsStatusDot: { width: 6, height: 6, borderRadius: 3 },
  detailsDivider: { height: 1, marginBottom: 3 },
  infoLine: {
    minHeight: 55,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },
  infoLineLabel: {
    flex: 0.8,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  infoLineLabelText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  infoLineValueWrap: {
    flex: 1.2,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  smallDot: { width: 7, height: 7, borderRadius: 4 },
  infoLineValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  progressCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 3,
  },
  progressTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  progressHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  progressIcon: {
    width: 40,
    height: 40,
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  progressSubtitle: { marginTop: 1, fontSize: 11, lineHeight: 15, fontWeight: "500" },
  timelineRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "stretch",
  },
  timelineRail: {
    width: 28,
    alignItems: "center",
  },
  timelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  timelineLine: {
    position: "absolute",
    top: 18,
    bottom: -1,
    width: 2,
  },
  timelineCopy: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 18,
  },
  timelineTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  timelineTime: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  currentDot: { width: 6, height: 6, borderRadius: 3 },
  detailsActions: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailsSecondaryAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 12,
  },
  detailsSecondaryText: { flexShrink: 1, fontSize: 12, fontWeight: "800", textAlign: "center" },
  infoScrollView: { flex: 1 },
  chatInfoHeader: {
    paddingTop: Platform.OS === "ios" ? 20 : 14,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  chatInfoHeaderButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  chatInfoHeaderTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0,
  },
  infoScreenContent: {
    paddingBottom: 36,
    paddingTop: 18,
  },
  chatInfoHero: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  chatInfoHeroName: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0,
  },
  chatInfoHeroStatus: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  chatInfoHeroDot: { width: 14, height: 14, borderRadius: 7 },
  chatInfoHeroStatusText: { fontSize: 13, fontWeight: "400", lineHeight: 18, marginTop: 4 },
  chatInfoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOpacity: 0.035,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  chatInfoCardTitle: { fontSize: 16, fontWeight: "800", marginBottom: 14 },
  chatInfoContentRow: {
    flexDirection: "row",
    gap: 14,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  chatInfoContentRowLast: {
    flexDirection: "row",
    gap: 14,
  },
  chatInfoLargeIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  chatInfoContentCopy: { flex: 1, minWidth: 0 },
  chatInfoContentTitle: { fontSize: 16, fontWeight: "800" },
  chatInfoContentPrimary: { marginTop: 8, fontSize: 15, fontWeight: "600", lineHeight: 22 },
  chatInfoContentText: { marginTop: 8, fontSize: 13, lineHeight: 20 },
  chatInfoMediaHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  chatInfoCardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  chatInfoShipmentMain: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  chatInfoPackageIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  chatInfoShipmentCopy: { flex: 1, minWidth: 0 },
  chatInfoShipmentLabel: { fontSize: 12, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase" },
  chatInfoShipmentTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  chatInfoShipmentTitle: { flex: 1, fontSize: 18, fontWeight: "900" },
  chatInfoStatusPill: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chatInfoStatusText: { fontSize: 14, fontWeight: "800" },
  chatInfoShipmentMetaGrid: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  chatInfoMetaCell: { flex: 1, minWidth: 0 },
  chatInfoMetaDivider: { width: 1, height: 45, marginHorizontal: 12 },
  chatInfoMetaLabel: { fontSize: 15, fontWeight: "500" },
  chatInfoMetaValue: { marginTop: 11, fontSize: 16, fontWeight: "700" },
  chatInfoSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  chatInfoSectionAction: { flexDirection: "row", alignItems: "center", gap: 12 },
  chatInfoMediaCount: { fontSize: 15, fontWeight: "700" },
  chatInfoMediaStrip: {
    marginTop: 14,
    paddingVertical: 2,
    flexDirection: "row",
    gap: 10,
  },
  chatInfoMediaThumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  chatInfoMediaThumb: { width: "100%", height: "100%" },
  chatInfoMediaBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.74)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatInfoSettingRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  chatInfoSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  chatInfoMediaMoreShade: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.74)",
  },
  chatInfoMediaMoreText: { fontSize: 16, fontWeight: "900" },
  chatInfoContactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 14,
  },
  chatInfoContactRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
    marginLeft: 0,
  },
  chatInfoSmallIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chatInfoContactCopy: { flex: 1, minWidth: 0 },
  chatInfoContactTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  chatInfoContactValue: { fontSize: 14, lineHeight: 20 },
  chatInfoSettingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chatInfoSettingCopy: { flex: 1, minWidth: 0 },
  chatInfoSettingTitle: { fontSize: 15, fontWeight: "600" },
  chatInfoSettingText: { marginTop: 4, fontSize: 13, lineHeight: 19 },
  chatInfoDivider: { height: 1, marginVertical: 10 },
  chatInfoAboutRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
  },
  chatInfoAboutIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chatInfoAboutCopy: { flex: 1, minWidth: 0 },
  chatInfoAboutTitle: { fontSize: 17, fontWeight: "700" },
  chatInfoAboutText: { marginTop: 6, fontSize: 14, lineHeight: 19 },
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
