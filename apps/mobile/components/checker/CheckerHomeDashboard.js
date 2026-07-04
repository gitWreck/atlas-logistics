import React, { useMemo } from "react";
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
  return (
    <LinearGradient
      colors={["#086cff", "#0757e1", "#043eb7"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.heroTop}>
        <TouchableOpacity
          style={styles.profileCluster}
          onPress={onProfilePress}
          activeOpacity={0.8}
        >
          <View style={styles.heroAvatar}>
            <FontAwesome5 name="user-check" size={28} color="#0b63ef" />
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
          style={styles.heroLogout}
          onPress={onLogout}
          activeOpacity={0.82}
        >
          <FontAwesome5 name="sign-out-alt" size={24} color="#61708c" />
        </TouchableOpacity>
      </View>

      <View style={styles.heroBottom}>
        <View style={styles.dateCard}>
          <FontAwesome5 name="calendar-alt" size={22} color="#ffffff" />
          <View style={styles.dateTextBlock}>
            <Text style={styles.dateMain}>
              {format(currentDate, "MMM d, yyyy")}
            </Text>
            <Text style={styles.dateSub}>{format(currentDate, "EEEE")}</Text>
          </View>
          <FontAwesome5 name="chevron-down" size={14} color="#ffffff" />
        </View>

        <View style={styles.heroArt}>
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
}) {
  return (
    <TouchableOpacity
      style={styles.statCard}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={!onPress}
    >
      <View style={styles.statTopRow}>
        <View style={[styles.statIcon, { backgroundColor: softColor }]}>
          <FontAwesome5 name={icon} size={25} color={color} />
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

export function DeliveryProgressCard({ delivered, total, goal }) {
  const percentage = total > 0 ? Math.min(100, Math.round((delivered / total) * 100)) : 0;
  const ringRotation = `${Math.round((percentage / 100) * 270)}deg`;

  return (
    <View style={[styles.progressCard, total === 0 && styles.progressEmptyCard]}>
      <View style={styles.statTopRow}>
        <View style={[styles.statIcon, { backgroundColor: "#eaf1ff" }]}>
          <FontAwesome5 name="chart-pie" size={25} color={COLORS.blue} />
        </View>
        <View style={styles.statCopy}>
          <Text style={styles.progressTitle}>Delivery Progress</Text>
          <Text style={styles.progressSub}>Today</Text>
        </View>
      </View>

      {total > 0 ? (
        <View style={styles.progressBody}>
          <View style={styles.ringWrap}>
            <View style={styles.ringBase} />
            <View style={[styles.ringArc, { transform: [{ rotate: ringRotation }] }]} />
            <Text style={styles.ringPercent}>{percentage}%</Text>
            <Text style={styles.ringLabel}>of Goal</Text>
          </View>
          <View style={styles.goalRow}>
            <FontAwesome5 name="flag" size={15} color={COLORS.blue} />
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
  const compact = width < 390;

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
            style={[styles.statGridItem, compact && styles.statGridItemFull]}
          >
            <DashboardStatCard {...card} />
          </View>
        ))}
        <View
          style={[styles.statGridItem, compact && styles.statGridItemFull]}
        >
          <DeliveryProgressCard {...progress} />
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
          <FontAwesome5 name={icon} size={25} color="#ffffff" />
        </View>
      </View>
      <View style={styles.quickCopy}>
        <Text style={[styles.quickTitle, { color }]}>{title}</Text>
        <Text style={styles.quickSubtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.quickArrow, { backgroundColor: color }]}>
        <FontAwesome5 name="chevron-right" size={18} color="#ffffff" />
      </View>
    </TouchableOpacity>
  );
}

export function QuickActions({ onLoad, onRoute, onOffload, onInfo }) {
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
        <View style={styles.quickRailItem}>
          <QuickActionCard
            title="LOAD TO VAN"
            subtitle="Load shipments to your van"
            icon="truck"
            color={SECTION.load.accent}
            softColor="#f4f8ff"
            onPress={onLoad}
          />
        </View>
        <View style={styles.quickRailItem}>
          <QuickActionCard
            title="MY ROUTE"
            subtitle="View your delivery route"
            icon="map-marker-alt"
            color={SECTION.route.accent}
            softColor="#f3fff7"
            onPress={onRoute}
          />
        </View>
        <View style={styles.quickRailItem}>
          <QuickActionCard
            title="OFFLOAD"
            subtitle="Deliver or return items"
            icon="box-open"
            color={SECTION.offload.accent}
            softColor="#fff7ed"
            onPress={onOffload}
          />
        </View>
        <View style={styles.quickRailItem}>
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
              <Text style={styles.historyTime}>
                {shipment.deliveredAtDate
                  ? format(shipment.deliveredAtDate, "hh:mm a")
                  : "--:--"}
              </Text>
              <Text style={styles.historyAddress} numberOfLines={1}>
                {getDeliveryAddress(shipment)}
              </Text>
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
    minHeight: 285,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 34,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  profileCluster: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
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
    fontSize: 18,
    fontWeight: "500",
  },
  heroName: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 4,
  },
  heroMessage: {
    color: "#eef5ff",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
    lineHeight: 19,
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
    marginTop: 34,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  dateCard: {
    minWidth: 214,
    maxWidth: "58%",
    minHeight: 72,
    borderRadius: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(2, 43, 143, 0.72)",
  },
  dateTextBlock: {
    flex: 1,
  },
  dateMain: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  dateSub: {
    color: "#e3edff",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 3,
  },
  heroArt: {
    flex: 1,
    minHeight: 110,
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
    paddingHorizontal: 18,
    paddingTop: 22,
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
    gap: 14,
  },
  statGridItem: {
    width: "48%",
    flexGrow: 1,
  },
  statGridItemFull: {
    width: "100%",
  },
  statCard: {
    minHeight: 186,
    borderRadius: 18,
    padding: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "space-between",
    ...cardShadow,
  },
  statTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  statIcon: {
    width: 58,
    height: 58,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  statCopy: {
    flex: 1,
  },
  statTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
  },
  statSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
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
    fontSize: 33,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    ...cardShadow,
  },
  progressCard: {
    minHeight: 186,
    borderRadius: 18,
    padding: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "space-between",
    ...cardShadow,
  },
  progressEmptyCard: {
    justifyContent: "space-between",
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
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  ringWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  ringBase: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 11,
    borderColor: "#d6e1f2",
  },
  ringArc: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 11,
    borderLeftColor: "#2c6ff3",
    borderTopColor: "#2c6ff3",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  },
  ringPercent: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  ringLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 96,
    paddingBottom: 4,
  },
  goalText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: "800",
    flexShrink: 1,
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
    marginTop: 24,
  },
  quickTitleInset: {
    paddingHorizontal: 18,
  },
  quickRail: {
    paddingHorizontal: 18,
    paddingRight: 24,
    flexDirection: "row",
    gap: 14,
  },
  quickRailItem: {
    width: 255,
  },
  quickCard: {
    width: "100%",
    minHeight: 116,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...cardShadow,
  },
  quickGraphic: {
    width: 68,
    alignItems: "center",
  },
  quickIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  quickCopy: {
    flex: 1,
  },
  quickTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  quickSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 8,
  },
  quickArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  historyCard: {
    marginHorizontal: 18,
    marginTop: 20,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: COLORS.border,
    ...cardShadow,
  },
  historyRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
  },
  historyDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#dce5f3",
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dff6e8",
  },
  historyIdentity: {
    flex: 1.1,
    minWidth: 86,
  },
  historyShipment: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
  },
  historyName: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  historyDetails: {
    flex: 1.5,
    borderLeftWidth: 1,
    borderLeftColor: "#dce5f3",
    paddingLeft: 18,
  },
  historyTime: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
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
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deliveredBadgeText: {
    color: COLORS.green,
    fontSize: 12,
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
