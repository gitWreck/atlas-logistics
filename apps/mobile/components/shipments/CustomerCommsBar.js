import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Modal,
  ActivityIndicator,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  getCustomerContactForShipment,
  getOrCreateShipmentConversation,
  startConversationCall,
} from "../utilities/FirebaseFunctions";

function cleanErrorMessage(error, fallback) {
  const raw = String(error?.message || "")
    .replace(/^Firebase:\s*/i, "")
    .replace(/^\[functions\/[\w-]+\]\s*/i, "")
    .trim();
  return raw || fallback;
}

async function dialNumber(rawNumber) {
  const number = String(rawNumber || "").trim();
  if (!number) return;
  const url = `tel:${number}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Phone dialer is not available on this device.");
    }
  } catch (err) {
    console.error("Dialer error:", err);
    Alert.alert("Error", "Could not open the phone dialer.");
  }
}

/**
 * Custody-gated customer communication controls for a shipment.
 *
 * The caller is responsible for only rendering this when communication is
 * permitted (checker holds custody / admin / manager). The backend re-validates
 * every action, so an unauthorized tap returns "403 Permission Denied".
 *
 * @param {object}  shipment      Shipment document (must include `id`).
 * @param {object}  colors        Theme colors.
 * @param {boolean} isDark        Dark mode flag.
 * @param {string}  [variant]     "full" (default) or "compact" for list rows.
 * @param {string}  [chatPathname] Expo-router path for the chat thread.
 */
export default function CustomerCommsBar({
  shipment,
  colors,
  isDark = false,
  variant = "full",
  chatPathname = "/(checker)/chat/[conversationId]",
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(null); // "call" | "message" | "cell"
  const [methodVisible, setMethodVisible] = useState(false);
  const [phoneChoice, setPhoneChoice] = useState(null); // { primaryPhone, secondaryPhone }

  const shipmentId = shipment?.id || shipment?.shipmentId;

  const ensureConversation = useCallback(async () => {
    const res = await getOrCreateShipmentConversation({ shipmentId });
    const conversationId = res?.data?.conversationId;
    if (!conversationId) {
      throw new Error("Conversation could not be opened.");
    }
    return String(conversationId);
  }, [shipmentId]);

  const startAtlasCall = useCallback(
    async (type) => {
      setMethodVisible(false);
      if (busy) return;
      setBusy("call");
      try {
        const conversationId = await ensureConversation();
        await startConversationCall({ conversationId, type });
        // The globally-mounted call listener surfaces the ringing UI.
      } catch (error) {
        console.error("Atlas call failed:", error);
        Alert.alert(
          type === "video" ? "Video call unavailable" : "Voice call unavailable",
          cleanErrorMessage(
            error,
            "Unable to start the call. In-app calling requires the customer to have an Atlas account — try Cell Phone Call instead.",
          ),
        );
      } finally {
        setBusy(null);
      }
    },
    [busy, ensureConversation],
  );

  const handleCellPhone = useCallback(async () => {
    setMethodVisible(false);
    if (busy) return;
    setBusy("cell");
    try {
      const res = await getCustomerContactForShipment({ shipmentId });
      const primaryPhone = res?.data?.primaryPhone || null;
      const secondaryPhone = res?.data?.secondaryPhone || null;

      // Secondary is optional: only prompt when both numbers exist.
      if (primaryPhone && secondaryPhone) {
        setPhoneChoice({ primaryPhone, secondaryPhone });
      } else {
        await dialNumber(primaryPhone || secondaryPhone);
      }
    } catch (error) {
      console.error("Get customer contact failed:", error);
      Alert.alert(
        "Cell phone unavailable",
        cleanErrorMessage(error, "You are not allowed to call this customer."),
      );
    } finally {
      setBusy(null);
    }
  }, [busy, shipmentId]);

  const handleMessage = useCallback(async () => {
    if (busy) return;
    setBusy("message");
    try {
      const conversationId = await ensureConversation();
      router.push({ pathname: chatPathname, params: { conversationId } });
    } catch (error) {
      console.error("Open chat failed:", error);
      Alert.alert(
        "Messaging unavailable",
        cleanErrorMessage(
          error,
          "Unable to open the chat. In-app messaging requires the customer to have an Atlas account.",
        ),
      );
    } finally {
      setBusy(null);
    }
  }, [busy, chatPathname, ensureConversation, router]);

  const isCompact = variant === "compact";
  // Teal for Call — green is reserved for delivery actions (Scan Delivery).
  const callColor = "#14b8a6";
  const msgColor = "#3b82f6";
  const iconSize = isCompact ? 13 : 15;
  // Full = solid tinted fills (primary surface on the details screen).
  // Compact = light outlined pills so they read as secondary to the main
  // "Scan Delivery" button on a My Deliveries card.
  const callFill = isCompact
    ? { backgroundColor: `${callColor}1F`, borderColor: `${callColor}55`, borderWidth: 1 }
    : { backgroundColor: isDark ? "#134e4a" : "#ccfbf1" };
  const msgFill = isCompact
    ? { backgroundColor: `${msgColor}1F`, borderColor: `${msgColor}55`, borderWidth: 1 }
    : { backgroundColor: isDark ? "#1e3a5f" : "#dbeafe" };
  const btnStyle = isCompact ? styles.actionBtnCompact : styles.actionBtn;
  const labelStyle = isCompact ? styles.actionLabelCompact : styles.actionLabel;

  return (
    <View
      style={[
        styles.wrap,
        isCompact ? styles.wrapCompact : null,
        !isCompact && {
          backgroundColor: colors?.surface,
          borderColor: colors?.border,
        },
      ]}
    >
      {!isCompact && (
        <Text style={[styles.title, { color: colors?.text }]}>
          Contact customer
        </Text>
      )}

      <View style={[styles.buttonRow, isCompact && styles.buttonRowCompact]}>
        <TouchableOpacity
          style={[btnStyle, callFill]}
          onPress={() => setMethodVisible(true)}
          disabled={!!busy}
          activeOpacity={0.75}
        >
          {busy === "call" || busy === "cell" ? (
            <ActivityIndicator size="small" color={callColor} />
          ) : (
            <FontAwesome5 name="phone-alt" size={iconSize} color={callColor} />
          )}
          <Text style={[labelStyle, { color: callColor }]}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[btnStyle, msgFill]}
          onPress={handleMessage}
          disabled={!!busy}
          activeOpacity={0.75}
        >
          {busy === "message" ? (
            <ActivityIndicator size="small" color={msgColor} />
          ) : (
            <FontAwesome5 name="comment-dots" size={iconSize} color={msgColor} />
          )}
          <Text style={[labelStyle, { color: msgColor }]}>Message</Text>
        </TouchableOpacity>
      </View>

      {/* Choose Call Method (spec section 15) */}
      <Modal
        visible={methodVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMethodVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setMethodVisible(false)}
        >
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors?.surface || "#ffffff" },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: colors?.text }]}>
              Choose Call Method
            </Text>

            <SheetOption
              icon="phone-alt"
              color="#14b8a6"
              label="Atlas Voice Call"
              colors={colors}
              onPress={() => startAtlasCall("voice")}
            />
            <SheetOption
              icon="video"
              color="#7c3aed"
              label="Atlas Video Call"
              colors={colors}
              onPress={() => startAtlasCall("video")}
            />
            <SheetOption
              icon="mobile-alt"
              color="#3b82f6"
              label="Cell Phone Call"
              colors={colors}
              onPress={handleCellPhone}
            />
            <SheetOption
              icon="times"
              color={colors?.textMuted || "#6b7280"}
              label="Cancel"
              colors={colors}
              onPress={() => setMethodVisible(false)}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Choose Phone Number — only when optional secondary exists */}
      <Modal
        visible={!!phoneChoice}
        transparent
        animationType="fade"
        onRequestClose={() => setPhoneChoice(null)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setPhoneChoice(null)}
        >
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors?.surface || "#ffffff" },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: colors?.text }]}>
              Choose Phone Number
            </Text>

            <SheetOption
              icon="phone-alt"
              color="#14b8a6"
              label="Primary"
              subLabel={phoneChoice?.primaryPhone}
              colors={colors}
              onPress={() => {
                const number = phoneChoice?.primaryPhone;
                setPhoneChoice(null);
                dialNumber(number);
              }}
            />
            {!!phoneChoice?.secondaryPhone && (
              <SheetOption
                icon="phone"
                color="#14b8a6"
                label="Secondary"
                subLabel={phoneChoice?.secondaryPhone}
                colors={colors}
                onPress={() => {
                  const number = phoneChoice?.secondaryPhone;
                  setPhoneChoice(null);
                  dialNumber(number);
                }}
              />
            )}
            <SheetOption
              icon="times"
              color={colors?.textMuted || "#6b7280"}
              label="Cancel"
              colors={colors}
              onPress={() => setPhoneChoice(null)}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function SheetOption({ icon, color, label, subLabel, colors, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.sheetOption, { borderTopColor: colors?.border || "#e5e7eb" }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <FontAwesome5 name={icon} size={16} color={color} style={styles.sheetIcon} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.sheetOptionLabel, { color: colors?.text || "#111827" }]}>
          {label}
        </Text>
        {!!subLabel && (
          <Text
            style={[styles.sheetOptionSub, { color: colors?.textMuted || "#6b7280" }]}
          >
            {subLabel}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  wrapCompact: {
    borderWidth: 0,
    padding: 0,
    marginBottom: 0,
    marginTop: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  buttonRowCompact: {
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 12,
  },
  actionBtnCompact: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 34,
    borderRadius: 9,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "800",
  },
  actionLabelCompact: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    opacity: 0.7,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderTopWidth: 1,
  },
  sheetIcon: {
    width: 28,
  },
  sheetOptionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  sheetOptionSub: {
    fontSize: 13,
    marginTop: 2,
  },
});
