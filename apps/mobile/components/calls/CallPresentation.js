import React from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

function initials(name = "") {
  return String(name || "Atlas")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}

export function CallAvatar({ name, size = 40, pulse = false }) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        pulse && styles.avatarPulse,
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{initials(name)}</Text>
    </View>
  );
}

function HeaderAction({ icon, label, onPress }) {
  if (!onPress) return null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.78}
      onPress={onPress}
      style={styles.headerAction}
    >
      <FontAwesome5 name={icon} size={16} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

export function VideoCallHeader({
  name,
  status,
  timer,
  onMinimize,
  onToggleFullscreen,
  fullscreen = false,
}) {
  return (
    <LinearGradient
      colors={["rgba(0,0,0,0.82)", "rgba(0,0,0,0.38)", "transparent"]}
      locations={[0, 0.58, 1]}
      style={styles.header}
    >
      <View style={styles.identity}>
        <CallAvatar name={name} size={40} />
        <View style={styles.identityCopy}>
          <Text numberOfLines={1} style={styles.headerName}>{name}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, status === "Failed" && styles.statusDotFailed]} />
            <Text numberOfLines={1} style={styles.headerStatus}>{status}</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.headerTimer, { pointerEvents: "none" }]}>{timer}</Text>

      <View style={styles.headerActions}>
        <HeaderAction icon="chevron-down" label="Minimize call" onPress={onMinimize} />
        {Platform.OS === "web" ? (
          <HeaderAction
            icon={fullscreen ? "compress" : "expand"}
            label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onPress={onToggleFullscreen}
          />
        ) : null}
      </View>
    </LinearGradient>
  );
}

export function VideoPlaceholder({ name, status }) {
  return (
    <LinearGradient
      colors={["#07111F", "#0B1B31", "#07111F"]}
      style={styles.placeholder}
    >
      <CallAvatar name={name} size={128} pulse />
      <Text style={styles.placeholderName}>{name}</Text>
      <View style={styles.placeholderStatusRow}>
        <ActivityIndicator size="small" color="#22C55E" />
        <Text style={styles.placeholderStatus}>{status}</Text>
      </View>
    </LinearGradient>
  );
}

function CallControl({ label, icon, active, danger, disabled, loading, onPress }) {
  return (
    <View style={styles.controlItem}>
      <Text style={styles.controlLabel}>{label}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        activeOpacity={0.76}
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.controlButton,
          active && styles.controlButtonActive,
          danger && styles.controlButtonDanger,
          disabled && styles.controlButtonDisabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <FontAwesome5 name={icon} size={18} color={active ? "#0F172A" : "#FFFFFF"} />
        )}
      </TouchableOpacity>
    </View>
  );
}

export function CallControls({
  video,
  muted,
  speakerOn,
  cameraOn,
  processing,
  onMute,
  onSpeaker,
  onCamera,
  onSwitchCamera,
  onEnd,
}) {
  return (
    <View style={styles.controlsDock}>
      <CallControl
        label="Mute"
        icon={muted ? "microphone-slash" : "microphone"}
        active={muted}
        onPress={onMute}
      />
      <CallControl
        label="Speaker"
        icon={speakerOn ? "volume-up" : "volume-mute"}
        active={!speakerOn}
        onPress={onSpeaker}
      />
      {video ? (
        <CallControl
          label="Camera"
          icon={cameraOn ? "video" : "video-slash"}
          active={!cameraOn}
          onPress={onCamera}
        />
      ) : null}
      {video ? (
        <CallControl label="Switch" icon="sync-alt" onPress={onSwitchCamera} />
      ) : null}
      <CallControl
        label="End Call"
        icon="phone-slash"
        danger
        disabled={processing}
        loading={processing}
        onPress={onEnd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.92)",
    shadowColor: "#2563EB",
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 9,
  },
  avatarPulse: {
    borderWidth: 3,
    shadowOpacity: 0.52,
    shadowRadius: 28,
    elevation: 14,
  },
  avatarText: { color: "#FFFFFF", fontWeight: "900" },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    minHeight: Platform.OS === "ios" ? 118 : 94,
    paddingTop: Platform.OS === "ios" ? 48 : 20,
    paddingHorizontal: 18,
    paddingBottom: 28,
    zIndex: 60,
    elevation: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, zIndex: 2 },
  identityCopy: { flex: 1, minWidth: 0 },
  headerName: { color: "#FFFFFF", fontSize: 14, lineHeight: 18, fontWeight: "800" },
  statusRow: { marginTop: 3, flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22C55E" },
  statusDotFailed: { backgroundColor: "#EF4444" },
  headerStatus: { color: "rgba(255,255,255,0.82)", fontSize: 11, fontWeight: "600" },
  headerTimer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: Platform.OS === "ios" ? 58 : 30,
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 10, zIndex: 2 },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.68)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingBottom: 70,
  },
  placeholderName: { color: "#FFFFFF", fontSize: 22, lineHeight: 28, fontWeight: "900" },
  placeholderStatusRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  placeholderStatus: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },
  controlsDock: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: Platform.OS === "ios" ? 24 : 16,
    zIndex: 70,
    elevation: 70,
    minHeight: 78,
    maxWidth: 440,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(2,6,23,0.76)",
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  controlItem: { flex: 1, minWidth: 45, maxWidth: 68, alignItems: "center", gap: 6 },
  controlLabel: { color: "rgba(255,255,255,0.82)", fontSize: 9, fontWeight: "700" },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  controlButtonActive: { backgroundColor: "#FFFFFF" },
  controlButtonDanger: { backgroundColor: "#EF4444" },
  controlButtonDisabled: { opacity: 0.62 },
});
