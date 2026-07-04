import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FontAwesome5 } from "@expo/vector-icons";
import { format } from "date-fns";
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
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleLeft}>
        <FontAwesome5 name={icon} size={17} color={COLORS.blue} />
        <Text style={styles.sectionTitle}>{title}</Text>
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
  onLogout,
  onProfilePress,
  currentDate = new Date(),
}) {
  const { width } = useWindowDimensions();
  const heroHeight = clamp(width * 0.58, 238, 292);
  const avatarSize = clamp(width * 0.14, 50, 66);
  const logoutSize = clamp(width * 0.12, 46, 62);
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

        <TouchableOpacity
          style={[
            styles.heroLogout,
            {
              width: logoutSize,
              height: logoutSize,
              borderRadius: clamp(logoutSize * 0.28, 14, 18),
            },
          ]}
          onPress={onLogout}
          activeOpacity={0.82}
        >
          <FontAwesome5
            name="sign-out-alt"
            size={clamp(logoutSize * 0.38, 18, 24)}
            color="#61708c"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.heroBottom}>
        <View style={[styles.dateCard, { width: dateWidth }]}>
          <FontAwesome5 name="calendar-alt" size={18} color="#ffffff" />
          <View style={styles.dateTextBlock}>
            <Text style={styles.dateMain}>
              {format(currentDate, "MMM d, yyyy")}
            </Text>
            <Text style={styles.dateSub}>{format(currentDate, "EEEE")}</Text>
          </View>
          <FontAwesome5 name="chevron-down" size={14} color="#ffffff" />
        </View>

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
  return (
    <TouchableOpacity
      style={[styles.statCard, style]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={!onPress}
    >
      <View style={styles.statTopRow}>
        <View style={[styles.statIcon, { backgroundColor: softColor }]}>
          <FontAwesome5 name={icon} size={21} color={color} />
        </View>
        <View style={styles.statCopy}>
          <Text style={styles.statTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.statSubtitle} numberOfLines={1}>
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
                { backgroundColor: trend.positive ? "#e0f7e9" : "#fee5e5" },
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
        <View style={styles.chevronCircle}>
          <FontAwesome5 name="chevron-right" size={14} color="#112044" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function DeliveryProgressCard({ delivered, total, goal, style }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - SCREEN_PADDING * 2 - GRID_GAP) / 2);
  const ringSize = clamp(cardWidth * 0.46, 66, 90);
  const ringBorder = clamp(ringSize * 0.11, 8, 10);
  const percentage = total > 0 ? Math.min(100, Math.round((delivered / total) * 100)) : 0;
  const ringRotation = `${Math.round((percentage / 100) * 270)}deg`;

  return (
    <View style={[styles.progressCard, style, total === 0 && styles.progressEmptyCard]}>
      <View style={styles.progressTitleBlock}>
        <Text style={styles.progressTitle}>Delivery Progress</Text>
        <Text style={styles.progressSub}>Today</Text>
      </View>

      {total > 0 ? (
        <View style={styles.progressBody}>
          <View style={[styles.confetti, styles.confettiAmber]} />
          <View style={[styles.confetti, styles.confettiTeal]} />
          <View style={[styles.confetti, styles.confettiBlue]} />
          <View style={[styles.confetti, styles.confettiPink]} />
          <View style={[styles.confetti, styles.confettiPurple]} />
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
                styles.ringBase,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  borderWidth: ringBorder,
                },
              ]}
            />
            <View
              style={[
                styles.ringArc,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  borderWidth: ringBorder,
                  transform: [{ rotate: ringRotation }],
                },
              ]}
            />
            <Text style={styles.ringPercent}>{percentage}%</Text>
            <Text style={styles.ringLabel}>of Goal</Text>
          </View>
          <View style={styles.goalRow}>
            <FontAwesome5 name="flag" size={17} color={COLORS.blue} />
            <Text style={styles.goalText}>
              Goal: {goal ? formatCount(goal) : formatCount(total)}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.progressEmpty}>
          <View style={styles.emptyProgressIcon}>
            <FontAwesome5 name="route" size={22} color={COLORS.blue} />
          </View>
          <View style={styles.progressEmptyCopy}>
            <Text style={styles.emptyProgressTitle}>No deliveries yet</Text>
            <Text style={styles.emptyProgressText}>
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
  const cardHeight = clamp(cardWidth * 0.78, 148, 178);

  return (
    <View style={styles.dashboardPanel}>
      <SectionTitle
        icon="chart-bar"
        title="TODAY AT A GLANCE"
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
  return (
    <TouchableOpacity
      style={[styles.quickCard, { borderColor: `${color}33`, backgroundColor: softColor }]}
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
        <Text style={styles.quickSubtitle}>{subtitle}</Text>
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
        <SectionTitle icon="bolt" title="QUICK ACTIONS" />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickRail}
      >
        <View style={[styles.quickRailItem, { width: actionWidth }]}>
          <QuickActionCard
            title="LOAD TO VAN"
            subtitle="Load shipments"
            icon="truck"
            color={SECTION.load.accent}
            softColor="#f4f8ff"
            onPress={onLoad}
          />
        </View>
        <View style={[styles.quickRailItem, { width: actionWidth }]}>
          <QuickActionCard
            title="MY ROUTE"
            subtitle="View your delivery route"
            icon="map-marker-alt"
            color={SECTION.route.accent}
            softColor="#f3fff7"
            onPress={onRoute}
          />
        </View>
        <View style={[styles.quickRailItem, { width: actionWidth }]}>
          <QuickActionCard
            title="OFFLOAD"
            subtitle="Deliver or return items"
            icon="box-open"
            color={SECTION.offload.accent}
            softColor="#fff7ed"
            onPress={onOffload}
          />
        </View>
        <View style={[styles.quickRailItem, { width: actionWidth }]}>
          <QuickActionCard
            title="SCAN INFO"
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
  title = "HISTORY OF DELIVERED",
}) {
  const { width } = useWindowDimensions();
  const showAddress = width >= 430;
  const timeWidth = clamp(width * 0.16, 58, 76);

  return (
    <View style={styles.historyCard}>
      <SectionTitle icon="clipboard-list" title={title} onViewAll={onViewAll} />
      {shipments.length === 0 ? (
        <View style={styles.historyEmpty}>
          <Text style={styles.historyEmptyTitle}>No delivered shipments yet</Text>
          <Text style={styles.historyEmptySub}>
            Completed deliveries will appear here automatically.
          </Text>
        </View>
      ) : (
        shipments.map((shipment, index) => (
          <TouchableOpacity
            key={shipment.id || getShipmentNumber(shipment)}
            style={[
              styles.historyRow,
              index < shipments.length - 1 && styles.historyDivider,
            ]}
            onPress={() => onPressShipment?.(shipment)}
            activeOpacity={0.78}
          >
            <View style={styles.historyIcon}>
              <FontAwesome5 name="check-circle" size={20} color={COLORS.green} />
            </View>
            <View style={styles.historyIdentity}>
              <Text style={styles.historyShipment} numberOfLines={1}>
                {getShipmentNumber(shipment)}
              </Text>
              <Text style={styles.historyName} numberOfLines={1}>
                {getReceiverName(shipment)}
              </Text>
            </View>
            <View style={styles.historyDetails}>
              <Text
                style={[styles.historyTime, { width: timeWidth }]}
                numberOfLines={1}
              >
                {shipment.deliveredAtDate
                  ? format(shipment.deliveredAtDate, "hh:mm a")
                  : "--:--"}
              </Text>
              {showAddress ? (
                <Text style={styles.historyAddress} numberOfLines={1}>
                  {getDeliveryAddress(shipment)}
                </Text>
              ) : null}
            </View>
            <View style={styles.deliveredBadge}>
              <Text style={styles.deliveredBadgeText}>Delivered</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color="#17284d" />
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
    fontSize: 16,
    fontWeight: "500",
  },
  heroName: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 4,
  },
  heroMessage: {
    color: "#eef5ff",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    lineHeight: 17,
  },
  heroLogout: {
    width: 62,
    height: 62,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
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
    fontWeight: "900",
  },
  dateSub: {
    color: "#e3edff",
    fontSize: 12,
    fontWeight: "600",
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
    fontSize: 16,
    fontWeight: "900",
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
    fontWeight: "800",
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
    padding: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "space-between",
    ...cardShadow,
  },
  statTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statCopy: {
    flex: 1,
  },
  statTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
  },
  statSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 7,
  },
  statBottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "900",
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
    fontWeight: "800",
  },
  chevronCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
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
    fontSize: 15,
    fontWeight: "900",
  },
  progressSub: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  progressBody: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingTop: 2,
  },
  ringWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  ringBase: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 10,
    borderColor: "#d6e1f2",
  },
  ringArc: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 10,
    borderLeftColor: "#2c6ff3",
    borderTopColor: "#2c6ff3",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  },
  ringPercent: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
  },
  ringLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    marginTop: 8,
    maxWidth: "100%",
  },
  goalText: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
  },
  confetti: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 2,
    transform: [{ rotate: "45deg" }],
  },
  confettiAmber: {
    right: 23,
    top: 7,
    backgroundColor: "#f8b400",
  },
  confettiTeal: {
    right: 12,
    top: 58,
    backgroundColor: "#62bdb2",
  },
  confettiBlue: {
    right: 28,
    top: 92,
    backgroundColor: "#66a7f5",
  },
  confettiPink: {
    right: 7,
    bottom: 27,
    backgroundColor: "#f5b6c4",
  },
  confettiPurple: {
    left: 20,
    top: 34,
    backgroundColor: "#d8c2f2",
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
    fontWeight: "900",
  },
  emptyProgressText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
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
    fontSize: 13,
    fontWeight: "900",
  },
  quickSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
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
    fontSize: 13,
    fontWeight: "900",
  },
  historyName: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "600",
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
    fontSize: 11,
    fontWeight: "700",
    textAlign: "left",
  },
  historyAddress: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "600",
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
    fontWeight: "800",
  },
  historyEmpty: {
    alignItems: "center",
    paddingVertical: 26,
  },
  historyEmptyTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
  },
  historyEmptySub: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
});
