import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
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
  onProfilePress,
  currentDate = new Date(),
  onDatePress,
  dateLoading,
}) {
  const { width } = useWindowDimensions();
  const heroHeight = clamp(width * 0.58, 238, 292);
  const avatarSize = clamp(width * 0.14, 50, 66);
  const dateWidth = clamp(width * 0.48, 190, 230);
  const artScale = clamp(width / 430, 0.78, 1);

  return (
    <LinearGradient
      colors={["#086cff", "#0757e1", "#043eb7"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { minHeight: heroHeight }]}
    >
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
            <FontAwesome5
              name="user-check"
              size={clamp(avatarSize * 0.38, 20, 28)}
              color="#0b63ef"
            />
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
          <FontAwesome5 name="calendar-alt" size={18} color="#ffffff" />
          <View style={styles.dateTextBlock}>
            <Text style={styles.dateMain}>
              {format(currentDate, "MMM d, yyyy")}
            </Text>
            <Text style={styles.dateSub}>{format(currentDate, "EEEE")}</Text>
          </View>
          {dateLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <FontAwesome5 name="chevron-down" size={14} color="#ffffff" />
          )}
        </TouchableOpacity>

        <View style={[styles.heroArt, { transform: [{ scale: artScale }] }]}>
          <View style={styles.cityBarTall} />
          <View style={styles.cityBar} />
          <View style={styles.routeLine} />
          <FontAwesome5 name="truck" size={58} color="#edf5ff" />
          <View style={styles.boxStack}>
            <FontAwesome5 name="box" size={21} color="#f4b65b" />
            <FontAwesome5 name="box" size={18} color="#f4b65b" />
          </View>
          <FontAwesome5 name="map-marker-alt" size={40} color="#8ab7ff" />
        </View>
      </View>
    </LinearGradient>
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
          <Text style={[styles.statTitle, { color: colors.text }]} numberOfLines={1}>
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
  const ringSize = clamp(cardWidth * 0.42, 60, 76);
  const ringStroke = clamp(ringSize * 0.1, 6, 8);
  const percentage =
    total > 0 ? clamp(Math.round((delivered / total) * 100), 0, 100) : 0;
  const rightRotation = -180 + Math.min(percentage, 50) * 3.6;
  const leftRotation =
    percentage > 50 ? -180 + (percentage - 50) * 3.6 : -180;
  const completedText = `${formatCount(delivered)} of ${formatCount(
    goal || total,
  )} completed`;

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
          <Text
            style={[styles.completionText, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {completedText}
          </Text>
        </View>
      ) : (
        <View style={styles.progressEmpty}>
          <View style={[styles.emptyProgressIcon, { backgroundColor: colors.cardMuted }]}>
            <FontAwesome5 name="route" size={22} color={COLORS.blue} />
          </View>
          <View style={styles.progressEmptyCopy}>
            <Text style={[styles.emptyProgressTitle, { color: colors.text }]}>
              No deliveries yet
            </Text>
            <Text style={[styles.emptyProgressText, { color: colors.textMuted }]}>
              Load shipments to your route to start today's progress.
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
  const cardHeight = clamp(cardWidth * 0.82, 156, 184);

  return (
    <View style={styles.dashboardPanel}>
      <SectionTitle
        icon="chart-bar"
        title="Today at a Glance"
        onViewAll={onViewAll}
      />
      <View style={styles.statGrid}>
        {cards.map((card) => (
          <View
            key={card.key}
            style={[styles.statGridItem, { width: cardWidth }]}
          >
            <DashboardStatCard {...card} style={{ height: cardHeight }} />
          </View>
        ))}
        <View
          style={[styles.statGridItem, { width: cardWidth }]}
        >
          <DeliveryProgressCard {...progress} style={{ height: cardHeight }} />
        </View>
      </View>
    </View>
  );
}

export function QuickActionCard({
  title,
  subtitle,
  icon,
  color,
  softColor,
  onPress,
}) {
  const { colors, resolvedScheme } = useTheme();
  const cardBg = resolvedScheme === "dark" ? colors.surface : softColor;
  return (
    <TouchableOpacity
      style={[
        styles.quickCard,
        { borderColor: resolvedScheme === "dark" ? colors.border : `${color}33`, backgroundColor: cardBg },
      ]}
      onPress={onPress}
      activeOpacity={0.84}
    >
      <View style={styles.quickGraphic}>
        <View style={[styles.quickIconCircle, { backgroundColor: color }]}>
          <FontAwesome5 name={icon} size={21} color="#ffffff" />
        </View>
      </View>
      <View style={styles.quickCopy}>
        <Text style={[styles.quickTitle, { color }]}>{title}</Text>
        <Text style={[styles.quickSubtitle, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      </View>
      <View style={[styles.quickArrow, { backgroundColor: color }]}>
        <FontAwesome5 name="chevron-right" size={16} color="#ffffff" />
      </View>
    </TouchableOpacity>
  );
}

export function QuickActions({ onLoad, onRoute, onOffload, onInfo }) {
  const { width } = useWindowDimensions();
  const actionWidth = clamp(width * 0.56, 188, 238);

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
            title="My Route"
            subtitle="View your delivery route"
            icon="map-marker-alt"
            color={SECTION.route.accent}
            softColor="#f3fff7"
            onPress={onRoute}
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
            <View style={[styles.historyIcon, { backgroundColor: colors.successSoft }]}>
              <FontAwesome5 name="check-circle" size={20} color={COLORS.green} />
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
            <View style={[styles.deliveredBadge, { backgroundColor: colors.successSoft }]}>
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
  hero: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 18,
    paddingBottom: 24,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    overflow: "hidden",
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
    gap: 12,
  },
  heroAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
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
    marginTop: 5,
    lineHeight: 18,
  },
  heroBottom: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  dateCard: {
    minHeight: 64,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(2, 43, 143, 0.72)",
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
    marginTop: 3,
  },
  heroArt: {
    flex: 1,
    minHeight: 92,
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
  },
  cityBarTall: {
    position: "absolute",
    right: 55,
    bottom: 28,
    width: 22,
    height: 92,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  cityBar: {
    position: "absolute",
    right: 28,
    bottom: 28,
    width: 18,
    height: 64,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  routeLine: {
    position: "absolute",
    right: 0,
    bottom: 11,
    width: 120,
    height: 28,
    borderBottomWidth: 5,
    borderColor: "rgba(180,216,255,0.7)",
    borderRadius: 70,
    transform: [{ rotate: "-9deg" }],
  },
  boxStack: {
    position: "absolute",
    right: 58,
    bottom: 0,
    flexDirection: "row",
    gap: 2,
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
  dashboardPanel: {
    marginTop: -18,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 18,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
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
    minHeight: 148,
    borderRadius: 18,
    padding: 14,
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
    gap: 8,
  },
  statIcon: {
    width: 40,
    height: 40,
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
    marginTop: 4,
    flexShrink: 1,
  },
  statBottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    paddingRight: 42,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0,
  },
  trendPill: {
    marginTop: 10,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
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
    right: 14,
    bottom: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    ...cardShadow,
  },
  progressCard: {
    minHeight: 148,
    borderRadius: 18,
    padding: 16,
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
    fontSize: 13,
    fontWeight: "400",
    marginTop: 4,
  },
  progressBody: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingTop: 4,
  },
  ringWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
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
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
  },
  ringLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "400",
  },
  completionText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "400",
    marginTop: 8,
    maxWidth: "100%",
    textAlign: "center",
  },
  progressEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressEmptyCopy: {
    flex: 1,
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
    fontSize: 14,
    fontWeight: "700",
  },
  emptyProgressText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 17,
    marginTop: 5,
    flexShrink: 1,
  },
  quickSection: {
    marginTop: 20,
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
    minHeight: 96,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...cardShadow,
  },
  quickGraphic: {
    width: 50,
    alignItems: "center",
  },
  quickIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  quickCopy: {
    flex: 1,
  },
  quickTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  quickSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 17,
    marginTop: 8,
  },
  quickArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  historyCard: {
    marginHorizontal: SCREEN_PADDING,
    marginTop: 18,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: COLORS.border,
    ...cardShadow,
  },
  historyRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
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
