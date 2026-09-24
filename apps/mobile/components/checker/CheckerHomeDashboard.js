import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
  Modal,
  ActivityIndicator,
  Image as RNImage,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { FontAwesome5 } from "@expo/vector-icons";
import { format } from "date-fns";
import { useTheme } from "../../contexts/ThemeContext";
import { cardShadow, SECTION } from "./design/checkerTheme";
import {
  getDeliveryAddress,
  getReceiverName,
  getShipmentNumber,
} from "./dashboardData";

const atlasBannerImage = require("../../assets/atlas-banner-2.jpeg");

const COLORS = {
  blue: "#075de8",
  blueDark: "#043fbe",
  text: "#111a33",
  muted: "#53617f",
  border: "#e5edf8",
  bg: "#f7fbff",
  green: "#0aa047",
  red: "#e21f26",
  orange: "#f5820b",
};

const SCREEN_PADDING = 20;
const GRID_GAP = 12;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatCount(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString() : "0";
}

function LoadingProgressIndicator() {
  const [progressPercent, setProgressPercent] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgressPercent((current) => {
        if (current >= 100) {
          clearInterval(timer);
          return 100;
        }
        return current + 1;
      });
    }, 90);

    return () => clearInterval(timer);
  }, []);

  return (
    <View
      style={styles.loadingProgress}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Dashboard loading progress"
      accessibilityValue={{ min: 1, max: 100, now: progressPercent }}
    >
      <View style={styles.loadingProgressHeader}>
        <Text style={styles.loadingProgressLabel}>Loading dashboard</Text>
        <Text style={styles.loadingProgressPercent}>{progressPercent}%</Text>
      </View>
      <View style={styles.loadingProgressTrack}>
        <View
          style={[
            styles.loadingProgressFill,
            { width: `${progressPercent}%` },
          ]}
        />
      </View>
    </View>
  );
}

export function CheckerHomeSkeleton() {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseAnimation.start();
    return () => {
      pulseAnimation.stop();
    };
  }, [pulse]);

  const pulseStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.42, 0.82],
    }),
  };
  const placeholder = { backgroundColor: colors.cardMuted };
  const statIcons = [
    { icon: "box", color: "#2563eb", soft: "#dbeafe" },
    { icon: "truck", color: "#16a34a", soft: "#dcfce7" },
    { icon: "check", color: "#0891b2", soft: "#cffafe" },
    { icon: "undo", color: "#f97316", soft: "#ffedd5" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.skeletonContent}
      showsVerticalScrollIndicator={false}
      accessibilityLabel="Loading checker home data"
    >
      <LinearGradient
        colors={["#075de8", "#043fbe", "#032b78"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.loadingHero}
      >
        <View style={styles.loadingOrbLarge} />
        <View style={styles.loadingOrbSmall} />
        <View style={styles.loadingBrandRow}>
          <View style={styles.loadingBrandIcon}>
            <FontAwesome5 name="truck" size={16} color="#075de8" />
          </View>
          <Text style={styles.loadingBrandText}>ATLAS TRANSPORT</Text>
        </View>
        <View style={styles.loadingRouteIcon}>
          <FontAwesome5 name="route" size={25} color="#ffffff" />
        </View>
        <Text style={styles.loadingTitle}>Preparing your dashboard</Text>
        <Text style={styles.loadingSubtitle}>
          Syncing assignments and the latest delivery updates
        </Text>
        <LoadingProgressIndicator />
      </LinearGradient>

      <View style={styles.loadingBody}>
        <View style={styles.loadingSectionHeader}>
          <Text style={[styles.loadingSectionTitle, { color: colors.text }]}>
            Today at a Glance
          </Text>
          <View
            style={[
              styles.loadingSyncPill,
              { backgroundColor: colors.cardMuted },
            ]}
          >
            <View style={styles.loadingSyncDot} />
            <Text style={[styles.loadingSyncText, { color: colors.textMuted }]}>
              Updating
            </Text>
          </View>
        </View>

        <View style={styles.loadingStatsGrid}>
          {statIcons.map((item) => (
            <View
              key={item.icon}
              style={[
                styles.loadingStatCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.loadingStatIcon,
                  { backgroundColor: item.soft },
                ]}
              >
                <FontAwesome5 name={item.icon} size={15} color={item.color} />
              </View>
              <View style={styles.loadingStatCopy}>
                <Animated.View
                  style={[
                    styles.loadingLinePrimary,
                    placeholder,
                    pulseStyle,
                  ]}
                />
                <Animated.View
                  style={[
                    styles.loadingLineSecondary,
                    placeholder,
                    pulseStyle,
                  ]}
                />
              </View>
              <Animated.View
                style={[styles.loadingCount, placeholder, pulseStyle]}
              />
            </View>
          ))}
        </View>

        <Text style={[styles.loadingSectionTitle, { color: colors.text }]}>
          Quick Actions
        </Text>
        <View style={styles.loadingActionsRow}>
          {["truck-loading", "map-marker-alt"].map((icon, index) => (
            <View
              key={icon}
              style={[
                styles.loadingActionCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.loadingActionIcon,
                  { backgroundColor: index === 0 ? "#dbeafe" : "#dcfce7" },
                ]}
              >
                <FontAwesome5
                  name={icon}
                  size={17}
                  color={index === 0 ? "#2563eb" : "#16a34a"}
                />
              </View>
              <Animated.View
                style={[styles.loadingActionLine, placeholder, pulseStyle]}
              />
            </View>
          ))}
        </View>

        <View
          style={[
            styles.loadingNotice,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <FontAwesome5 name="shield-alt" size={14} color="#2563eb" />
          <Text style={[styles.loadingNoticeText, { color: colors.textMuted }]}>
            Securely refreshing only the newest route changes
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function SectionTitle({ icon, title, onViewAll }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleLeft}>
        <FontAwesome5 name={icon} size={17} color={COLORS.blue} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {title}
        </Text>
      </View>
      {onViewAll ? (
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={onViewAll}
          activeOpacity={0.75}
        >
          <Text style={styles.viewAllText}>View all</Text>
          <FontAwesome5 name="chevron-right" size={12} color={COLORS.blue} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function CheckerHomeHero({
  userName,
  photoURL,
  onProfilePress,
  currentDate = new Date(),
  onDatePress,
  dateLoading,
  assignedAreas = [],
}) {
  const { width } = useWindowDimensions();
  const heroHeight = clamp(width * 0.52, 220, 268);
  const hasAssignedAreas =
    Array.isArray(assignedAreas) && assignedAreas.length > 0;
  const avatarSize = clamp(width * 0.12, 44, 56);
  const dateWidth = clamp(width * 0.46, 176, 214);

  return (
    <View style={[styles.hero, { width, height: heroHeight }]}>
      <Image
        source={atlasBannerImage}
        style={{ width, height: heroHeight }}
        contentFit="cover"
        contentPosition="center"
        transition={0}
        priority="high"
        allowDownscaling
        cachePolicy="memory-disk"
      />
      <LinearGradient
        colors={[
          "rgba(3, 26, 45, 0.72)",
          "rgba(3, 26, 45, 0.38)",
          "rgba(3, 26, 45, 0.22)",
        ]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.heroContent}>
        <View style={styles.heroTop}>
          <TouchableOpacity
            style={styles.profileCluster}
            onPress={onProfilePress}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.heroAvatar,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                },
              ]}
            >
              {photoURL ? (
                <RNImage
                  source={{ uri: photoURL }}
                  style={styles.heroAvatarImage}
                />
              ) : (
                <FontAwesome5
                  name="user-check"
                  size={clamp(avatarSize * 0.38, 20, 28)}
                  color="#0b63ef"
                />
              )}
            </View>
            <View style={styles.heroGreeting}>
              <Text style={styles.heroHello}>Hello,</Text>
              <Text style={styles.heroName} numberOfLines={1}>
                {userName}
              </Text>
              <Text style={styles.heroMessage} numberOfLines={2}>
                Ready to deliver. Let's make it a great day!
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.heroBottom}>
          <TouchableOpacity
            style={[styles.dateCard, { width: dateWidth }]}
            onPress={onDatePress}
            activeOpacity={0.82}
          >
            <FontAwesome5 name="calendar-alt" size={16} color="#ffffff" />
            <View style={styles.dateTextBlock}>
              <Text style={styles.dateMain}>
                {format(currentDate, "MMM d, yyyy")}
              </Text>
              <Text style={styles.dateSub}>{format(currentDate, "EEEE")}</Text>
            </View>
            {dateLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <FontAwesome5 name="chevron-down" size={13} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.assignedAreaRow}>
          <FontAwesome5 name="map-marker-alt" size={13} color="#ffffff" />
          <Text style={styles.assignedAreaText} numberOfLines={2}>
            {hasAssignedAreas
              ? `Area assigned: ${assignedAreas.join(", ")}`
              : "Area assigned: No assigned areas"}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function DateFilterModal({
  visible,
  dates,
  selectedDate,
  onSelectDate,
  onClose,
}) {
  const { colors } = useTheme();
  const selectedKey = format(selectedDate || new Date(), "yyyy-MM-dd");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.dateModalCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.dateModalHeader}>
            <Text style={[styles.dateModalTitle, { color: colors.text }]}>
              Select date
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <FontAwesome5 name="times" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.dateOptions}
            showsVerticalScrollIndicator={false}
          >
            {dates.map((date) => {
              const key = format(date, "yyyy-MM-dd");
              const selected = key === selectedKey;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.dateOption,
                    {
                      backgroundColor: colors.cardMuted,
                      borderColor: colors.border,
                    },
                    selected && styles.dateOptionSelected,
                  ]}
                  onPress={() => onSelectDate(date)}
                  activeOpacity={0.78}
                >
                  <View>
                    <Text
                      style={[
                        styles.dateOptionMain,
                        { color: colors.text },
                        selected && styles.dateOptionMainSelected,
                      ]}
                    >
                      {format(date, "MMM d, yyyy")}
                    </Text>
                    <Text
                      style={[
                        styles.dateOptionSub,
                        { color: colors.textMuted },
                        selected && styles.dateOptionSubSelected,
                      ]}
                    >
                      {format(date, "EEEE")}
                    </Text>
                  </View>
                  {selected ? (
                    <FontAwesome5 name="check" size={14} color="#ffffff" />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function DashboardStatCard({
  title,
  subtitle,
  value,
  icon,
  color,
  softColor,
  trend,
  onPress,
  style,
}) {
  const { colors, resolvedScheme } = useTheme();
  const iconBg = resolvedScheme === "dark" ? colors.cardMuted : softColor;
  return (
    <TouchableOpacity
      style={[
        styles.statCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={!onPress}
    >
      <View style={styles.statTopRow}>
        <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
          <FontAwesome5 name={icon} size={21} color={color} />
        </View>
        <View style={styles.statCopy}>
          <Text
            style={[styles.statTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={[styles.statSubtitle, { color: colors.textMuted }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        </View>
      </View>
      <View style={styles.statBottomRow}>
        <View>
          <Text style={[styles.statValue, { color }]}>
            {formatCount(value)}
          </Text>
          {trend ? (
            <View
              style={[
                styles.trendPill,
                {
                  backgroundColor: trend.positive
                    ? colors.successSoft
                    : colors.dangerSoft,
                },
              ]}
            >
              <FontAwesome5
                name={trend.positive ? "arrow-up" : "arrow-down"}
                size={9}
                color={trend.positive ? COLORS.green : COLORS.red}
              />
              <Text
                style={[
                  styles.trendText,
                  { color: trend.positive ? COLORS.green : COLORS.red },
                ]}
              >
                {trend.label}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View
        style={[
          styles.chevronCircle,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <FontAwesome5 name="chevron-right" size={14} color={colors.text} />
      </View>
    </TouchableOpacity>
  );
}

export function DeliveryProgressCard({ delivered, total, goal, style }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - SCREEN_PADDING * 2 - GRID_GAP) / 2);
  const ringSize = clamp(cardWidth * 0.3, 48, 56);
  const ringStroke = clamp(ringSize * 0.1, 5, 7);
  const percentage =
    total > 0 ? clamp(Math.round((delivered / total) * 100), 0, 100) : 0;
  const rightRotation = -180 + Math.min(percentage, 50) * 3.6;
  const leftRotation = percentage > 50 ? -180 + (percentage - 50) * 3.6 : -180;
  const completedText = `${formatCount(delivered)} of ${formatCount(
    goal || total,
  )}\ncompleted`;

  return (
    <View
      style={[
        styles.progressCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
        total === 0 && styles.progressEmptyCard,
      ]}
    >
      <View style={styles.progressTitleBlock}>
        <Text style={[styles.progressTitle, { color: colors.text }]}>
          Delivery Progress
        </Text>
        <Text style={[styles.progressSub, { color: colors.textMuted }]}>
          Today
        </Text>
      </View>

      {total > 0 ? (
        <View style={styles.progressBody}>
          <Text
            style={[styles.completionText, { color: colors.textMuted }]}
            numberOfLines={2}
          >
            {completedText}
          </Text>
          <View
            style={[
              styles.ringWrap,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
              },
            ]}
          >
            <View
              style={[
                styles.ringTrack,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  backgroundColor: colors.dashboardBorder,
                },
              ]}
            />
            <View
              style={[
                styles.ringHalfMask,
                {
                  left: ringSize / 2,
                  width: ringSize / 2,
                  height: ringSize,
                },
              ]}
            >
              <View
                style={[
                  styles.ringRotator,
                  {
                    width: ringSize,
                    height: ringSize,
                    left: -ringSize / 2,
                    transform: [{ rotate: `${rightRotation}deg` }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.ringRightFill,
                    {
                      width: ringSize / 2,
                      height: ringSize,
                      borderTopRightRadius: ringSize / 2,
                      borderBottomRightRadius: ringSize / 2,
                    },
                  ]}
                />
              </View>
            </View>
            <View
              style={[
                styles.ringHalfMask,
                {
                  left: 0,
                  width: ringSize / 2,
                  height: ringSize,
                },
              ]}
            >
              <View
                style={[
                  styles.ringRotator,
                  {
                    width: ringSize,
                    height: ringSize,
                    left: 0,
                    transform: [{ rotate: `${leftRotation}deg` }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.ringLeftFill,
                    {
                      width: ringSize / 2,
                      height: ringSize,
                      borderTopLeftRadius: ringSize / 2,
                      borderBottomLeftRadius: ringSize / 2,
                    },
                  ]}
                />
              </View>
            </View>
            <View
              style={[
                styles.ringCenter,
                {
                  width: ringSize - ringStroke * 2,
                  height: ringSize - ringStroke * 2,
                  borderRadius: (ringSize - ringStroke * 2) / 2,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <Text style={[styles.ringPercent, { color: colors.text }]}>
                {percentage}%
              </Text>
              <Text style={[styles.ringLabel, { color: colors.textMuted }]}>
                of Goal
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.progressEmpty}>
          <View
            style={[
              styles.emptyProgressIcon,
              { backgroundColor: colors.cardMuted },
            ]}
          >
            <FontAwesome5 name="route" size={22} color={COLORS.blue} />
          </View>
          <View style={styles.progressEmptyCopy}>
            <Text style={[styles.emptyProgressTitle, { color: colors.text }]}>
              No deliveries yet
            </Text>
            <Text
              style={[styles.emptyProgressText, { color: colors.textMuted }]}
            >
              Load shipments to your deliveries to start today's progress.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export function TodayAtGlance({ cards, progress, onViewAll }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - SCREEN_PADDING * 2 - GRID_GAP) / 2);
  // slightly more compact cards: reduce multiplier and min/max
  const cardHeight = clamp(cardWidth * 0.58, 100, 122);

  return (
    <View style={styles.dashboardPanel}>
      <SectionTitle
        icon="chart-bar"
        title="Today at a Glance"
        onViewAll={onViewAll}
      />
      <View style={styles.statGrid}>
        {cards.map((card) => {
          const { key, ...cardProps } = card;
          return (
            <View key={key} style={[styles.statGridItem, { width: cardWidth }]}>
              <DashboardStatCard
                {...cardProps}
                style={{ height: cardHeight }}
              />
            </View>
          );
        })}
        <View style={[styles.statGridItem, { width: cardWidth }]}>
          <DeliveryProgressCard {...progress} style={{ height: cardHeight }} />
        </View>
      </View>
    </View>
  );
}

export function QuickActionCard({ title, subtitle, icon, color, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.quickCard, { borderColor: color, backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.84}
    >
      <View style={styles.quickGraphic}>
        <View style={styles.quickIconCircle}>
          <FontAwesome5 name={icon} size={21} color="#ffffff" />
        </View>
      </View>
      <View style={styles.quickCopy}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.quickArrow}>
        <FontAwesome5 name="chevron-right" size={16} color="#ffffff" />
      </View>
    </TouchableOpacity>
  );
}

export function QuickActions({ onLoad, onOffload, onInfo }) {
  const { width } = useWindowDimensions();
  const actionWidth = clamp(width * 0.52, 178, 222);

  return (
    <View style={styles.quickSection}>
      <View style={styles.quickTitleInset}>
        <SectionTitle icon="bolt" title="Quick Actions" />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickRail}
      >
        <View style={[styles.quickRailItem, { width: actionWidth }]}>
          <QuickActionCard
            title="Load to Van"
            subtitle="Load shipments"
            icon="truck"
            color={SECTION.load.accent}
            softColor="#f4f8ff"
            onPress={onLoad}
          />
        </View>
        <View style={[styles.quickRailItem, { width: actionWidth }]}>
          <QuickActionCard
            title="Offload"
            subtitle="Deliver or return items"
            icon="box-open"
            color={SECTION.offload.accent}
            softColor="#fff7ed"
            onPress={onOffload}
          />
        </View>
        <View style={[styles.quickRailItem, { width: actionWidth }]}>
          <QuickActionCard
            title="Scan Info"
            subtitle="Check shipment details"
            icon="search"
            color={SECTION.info.accent}
            softColor="#f5f3ff"
            onPress={onInfo}
          />
        </View>
      </ScrollView>
    </View>
  );
}

export function DeliveredHistoryList({
  shipments,
  onViewAll,
  onPressShipment,
  title = "History of Delivered",
  emptyMessage = "Completed deliveries will appear here automatically.",
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const showAddress = width >= 430;
  const timeWidth = clamp(width * 0.16, 58, 76);

  return (
    <View
      style={[
        styles.historyCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <SectionTitle icon="clipboard-list" title={title} onViewAll={onViewAll} />
      {shipments.length === 0 ? (
        <View style={styles.historyEmpty}>
          <Text style={[styles.historyEmptyTitle, { color: colors.text }]}>
            No delivered shipments yet
          </Text>
          <Text style={[styles.historyEmptySub, { color: colors.textMuted }]}>
            {emptyMessage}
          </Text>
        </View>
      ) : (
        shipments.map((shipment, index) => (
          <TouchableOpacity
            key={shipment.id || getShipmentNumber(shipment)}
            style={[
              styles.historyRow,
              index < shipments.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              },
            ]}
            onPress={() => onPressShipment?.(shipment)}
            activeOpacity={0.78}
          >
            <View
              style={[
                styles.historyIcon,
                { backgroundColor: colors.successSoft },
              ]}
            >
              <FontAwesome5
                name="check-circle"
                size={20}
                color={COLORS.green}
              />
            </View>
            <View style={styles.historyIdentity}>
              <Text
                style={[styles.historyShipment, { color: colors.text }]}
                numberOfLines={1}
              >
                {getShipmentNumber(shipment)}
              </Text>
              <Text
                style={[styles.historyName, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {getReceiverName(shipment)}
              </Text>
            </View>
            <View
              style={[
                styles.historyDetails,
                { borderLeftColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.historyTime,
                  { width: timeWidth, color: colors.text },
                ]}
                numberOfLines={1}
              >
                {shipment.deliveredAtDate
                  ? format(shipment.deliveredAtDate, "hh:mm a")
                  : "--:--"}
              </Text>
              {showAddress ? (
                <Text
                  style={[styles.historyAddress, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {getDeliveryAddress(shipment)}
                </Text>
              ) : null}
            </View>
            <View
              style={[
                styles.deliveredBadge,
                { backgroundColor: colors.successSoft },
              ]}
            >
              <Text style={styles.deliveredBadgeText}>Delivered</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color={colors.text} />
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonContent: {
    paddingBottom: 24,
  },
  loadingHero: {
    minHeight: 250,
    paddingHorizontal: 26,
    paddingTop: 22,
    paddingBottom: 28,
    alignItems: "center",
    overflow: "hidden",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    position: "relative",
  },
  loadingOrbLarge: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.07)",
    right: -65,
    top: -54,
  },
  loadingOrbSmall: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "rgba(255,255,255,0.06)",
    left: -34,
    bottom: 12,
  },
  loadingBrandRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  loadingBrandIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  loadingBrandText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  loadingRouteIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    marginTop: 22,
  },
  loadingTitle: {
    color: "#ffffff",
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
    marginTop: 14,
  },
  loadingSubtitle: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 5,
  },
  loadingProgress: {
    width: "72%",
    marginTop: 18,
  },
  loadingProgressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  loadingProgressLabel: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  loadingProgressPercent: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  loadingProgressTrack: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  loadingProgressFill: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    backgroundColor: "#ffffff",
  },
  loadingBody: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 22,
  },
  loadingSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
  },
  loadingSectionTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },
  loadingSyncPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  loadingSyncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#2563eb",
  },
  loadingSyncText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  loadingStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 22,
  },
  loadingStatCard: {
    width: "48%",
    minHeight: 112,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  loadingStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingStatCopy: {
    gap: 7,
    marginTop: 12,
  },
  loadingLinePrimary: {
    width: "78%",
    height: 9,
    borderRadius: 5,
  },
  loadingLineSecondary: {
    width: "52%",
    height: 7,
    borderRadius: 4,
  },
  loadingCount: {
    position: "absolute",
    width: 24,
    height: 18,
    borderRadius: 7,
    right: 14,
    bottom: 15,
  },
  loadingActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 13,
  },
  loadingActionCard: {
    width: "48%",
    height: 68,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  loadingActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingActionLine: {
    flex: 1,
    height: 10,
    borderRadius: 5,
  },
  loadingNotice: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  loadingNoticeText: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    backgroundColor: "#dbe7f5",
  },
  heroContent: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 14,
    paddingBottom: 22,
    justifyContent: "space-between",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  profileCluster: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  heroAvatarImage: { width: "100%", height: "100%" },
  heroGreeting: {
    flex: 1,
  },
  heroHello: {
    color: "#dbe9ff",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "400",
  },
  heroName: {
    color: "#ffffff",
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: 0,
  },
  heroMessage: {
    color: "#eef5ff",
    fontSize: 13,
    fontWeight: "400",
    marginTop: 2,
    lineHeight: 18,
  },
  heroBottom: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  dateCard: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(2, 43, 143, 0.72)",
    zIndex: 2,
    elevation: 2,
  },
  dateTextBlock: {
    flex: 1,
  },
  dateMain: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  dateSub: {
    color: "#e3edff",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  dateModalCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "70%",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...cardShadow,
  },
  dateModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dateModalTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },
  dateOptions: {
    maxHeight: 360,
  },
  dateOption: {
    minHeight: 58,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    backgroundColor: "#f7fbff",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateOptionSelected: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  dateOptionMain: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  dateOptionMainSelected: {
    color: "#ffffff",
  },
  dateOptionSub: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "400",
    marginTop: 3,
  },
  dateOptionSubSelected: {
    color: "#eaf1ff",
  },
  assignedAreaText: {
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: 13,
    fontWeight: "400",
    marginLeft: 8,
    lineHeight: 18,
    flex: 1,
  },
  assignedAreaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingRight: 8,
  },
  assignedAreaEmpty: {
    color: "rgba(255, 255, 255, 0.78)",
    fontSize: 13,
    fontWeight: "400",
    marginTop: 12,
  },
  dashboardPanel: {
    marginTop: -10,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 9,
  },
  sectionTitleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    flex: 1,
  },
  sectionTitle: {
    color: "#354260",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 8,
  },
  viewAllText: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: "700",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  statGridItem: {
    flexGrow: 0,
    flexShrink: 0,
  },
  statCard: {
    minHeight: 104,
    borderRadius: 18,
    padding: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "space-between",
    position: "relative",
    ...cardShadow,
  },
  statTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  statCopy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  statTitle: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  statSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 17,
    marginTop: 2,
    flexShrink: 1,
  },
  statBottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    paddingRight: 36,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0,
  },
  trendPill: {
    marginTop: 7,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  trendText: {
    fontSize: 12,
    fontWeight: "700",
  },
  chevronCircle: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    ...cardShadow,
  },
  progressCard: {
    minHeight: 104,
    borderRadius: 18,
    padding: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    overflow: "hidden",
    ...cardShadow,
  },
  progressEmptyCard: {
    justifyContent: "space-between",
  },
  progressTitleBlock: {
    width: "100%",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  progressTitle: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
  },
  progressSub: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 16,
    marginTop: 2,
  },
  progressBody: {
    flex: 1,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingTop: 0,
    gap: 18,
  },
  ringWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginTop: -10,
  },
  ringTrack: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#d6e1f2",
  },
  ringHalfMask: {
    position: "absolute",
    top: 0,
    overflow: "hidden",
  },
  ringRotator: {
    position: "absolute",
    top: 0,
  },
  ringRightFill: {
    position: "absolute",
    right: 0,
    top: 0,
    backgroundColor: "#2c6ff3",
  },
  ringLeftFill: {
    position: "absolute",
    left: 0,
    top: 0,
    backgroundColor: "#2c6ff3",
  },
  ringCenter: {
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  ringPercent: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 18,
  },
  ringLabel: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: "400",
  },
  completionText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 14,
    maxWidth: "42%",
    textAlign: "center",
    flexShrink: 1,
  },
  progressEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressEmptyCopy: {
    flex: 1,
    minWidth: 0,
  },
  emptyProgressIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5f0ff",
  },
  emptyProgressTitle: {
    color: COLORS.text,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  emptyProgressText: {
    color: COLORS.muted,
    fontSize: 8,
    fontWeight: "400",
    lineHeight: 11,
    marginTop: 2,
    flexShrink: 1,
  },
  quickSection: {
    marginTop: 13,
  },
  quickTitleInset: {
    paddingHorizontal: SCREEN_PADDING,
  },
  quickRail: {
    paddingHorizontal: SCREEN_PADDING,
    paddingRight: SCREEN_PADDING + 6,
    flexDirection: "row",
    gap: GRID_GAP,
  },
  quickRailItem: {
    flexShrink: 0,
  },
  quickCard: {
    width: "100%",
    minHeight: 74,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...cardShadow,
  },
  quickGraphic: {
    width: 42,
    alignItems: "center",
  },
  quickIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  quickCopy: {
    flex: 1,
  },
  quickTitle: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  quickSubtitle: {
    color: "rgba(255, 255, 255, 0.84)",
    fontSize: 10.5,
    fontWeight: "400",
    lineHeight: 14,
    marginTop: 4,
  },
  quickArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.16)",
  },
  historyCard: {
    marginHorizontal: SCREEN_PADDING,
    marginTop: 10,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: COLORS.border,
    ...cardShadow,
  },
  historyRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  historyDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#dce5f3",
  },
  historyIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dff6e8",
  },
  historyIdentity: {
    flex: 1,
    minWidth: 0,
  },
  historyShipment: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  historyName: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "400",
    marginTop: 4,
  },
  historyDetails: {
    flexShrink: 0,
    borderLeftWidth: 1,
    borderLeftColor: "#dce5f3",
    paddingLeft: 8,
  },
  historyTime: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "400",
    textAlign: "left",
  },
  historyAddress: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "400",
    marginTop: 5,
  },
  deliveredBadge: {
    borderRadius: 7,
    backgroundColor: "#dff5e7",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  deliveredBadgeText: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: "700",
  },
  historyEmpty: {
    alignItems: "center",
    paddingVertical: 26,
  },
  historyEmptyTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  historyEmptySub: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
});
