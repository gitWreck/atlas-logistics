// Shared presentational components for the customer chat redesign.
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { avatarGradient, initials } from "./chatUtils";

// A small green presence dot. Presence is not tracked per-user by the backend,
// so on the support avatar this represents "support channel available" rather
// than a live user status (see docs / limitations).
export function PresenceDot({ size = 14, color = "#31A24C", ringColor }) {
  return (
    <View
      style={[
        styles.presenceDot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderColor: ringColor || "#FFFFFF",
          borderWidth: Math.max(2, size * 0.16),
        },
      ]}
    />
  );
}

// Brand avatar for "Atlas Support" conversations.
export function SupportAvatar({ size = 52, online = false, ringColor, iconName = "headset" }) {
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={["#0A7CFF", "#0064E0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <FontAwesome5 name={iconName} size={size * 0.4} color="#FFFFFF" />
      </LinearGradient>
      {online && (
        <View style={styles.presenceWrap}>
          <PresenceDot size={size * 0.28} ringColor={ringColor} />
        </View>
      )}
    </View>
  );
}

// Initials avatar (used for individual staff senders inside a thread).
export function PersonAvatar({ name, size = 28 }) {
  const gradient = avatarGradient(name);
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>
        {initials(name)}
      </Text>
    </LinearGradient>
  );
}

// Reusable shimmer block used to compose skeleton loaders.
export function Shimmer({ style, colors }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <Animated.View
      style={[
        { backgroundColor: colors?.skeletonBase || "#E2E8F0", opacity },
        style,
      ]}
    />
  );
}

// Skeleton row matching the conversation list layout.
export function ConversationSkeleton({ colors }) {
  return (
    <View style={styles.skeletonRow}>
      <Shimmer colors={colors} style={styles.skeletonAvatar} />
      <View style={styles.skeletonBody}>
        <Shimmer colors={colors} style={[styles.skeletonLine, { width: "55%" }]} />
        <Shimmer colors={colors} style={[styles.skeletonLine, { width: "80%", height: 11 }]} />
      </View>
      <Shimmer colors={colors} style={styles.skeletonTime} />
    </View>
  );
}

// Skeleton bubbles for the thread loading state.
export function ThreadSkeleton({ colors }) {
  const rows = [
    { mine: false, w: "62%" },
    { mine: true, w: "48%" },
    { mine: false, w: "72%" },
    { mine: false, w: "40%" },
    { mine: true, w: "55%" },
  ];
  return (
    <View style={styles.threadSkeleton}>
      {rows.map((row, i) => (
        <View
          key={i}
          style={[
            styles.skeletonBubbleRow,
            { justifyContent: row.mine ? "flex-end" : "flex-start" },
          ]}
        >
          <Shimmer
            colors={colors}
            style={[
              styles.skeletonBubble,
              { width: row.w, borderRadius: 18 },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

// Animated three-dot indicator (used as the outgoing "sending" affordance).
export function TypingDots({ color = "#8A94A6" }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, {
            toValue: 1,
            duration: 320,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 320,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.typingRow}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              backgroundColor: color,
              opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [
                {
                  translateY: dot.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -3],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  presenceWrap: {
    position: "absolute",
    right: -1,
    bottom: -1,
  },
  presenceDot: {},
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  skeletonAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  skeletonBody: {
    flex: 1,
    gap: 8,
  },
  skeletonLine: {
    height: 13,
    borderRadius: 7,
  },
  skeletonTime: {
    width: 28,
    height: 11,
    borderRadius: 6,
  },
  threadSkeleton: {
    padding: 16,
    gap: 14,
  },
  skeletonBubbleRow: {
    flexDirection: "row",
  },
  skeletonBubble: {
    height: 40,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
