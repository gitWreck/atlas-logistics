import React, { useMemo } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";

import StatusBadge from "../ui/StatusBadge";
import { getFormattedTime } from "../utilities/helpers";
import { useTheme } from "../../contexts/ThemeContext";

const courierMascot = require("../../assets/customer/courier-mascot.png");
const activeShipmentTruck = require("../../assets/customer/active-shipment-truck.png");
const emptyActiveShipment = require("../../assets/customer/empty-active-shipment.png");

const INACTIVE_SHIPMENT_STATUSES = new Set([
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "RECEIVED",
  "RECEIVED_AT_DIVISORIA",
]);

function getFirstName(name) {
  return String(name || "Customer").trim().split(/\s+/)[0] || "Customer";
}

function getActiveShipment(shipments = []) {
  return shipments.find((shipment) => {
    const status = String(shipment.status || "").toUpperCase();
    return !INACTIVE_SHIPMENT_STATUSES.has(status);
  });
}

function ShipmentTruckArt() {
  return (
    <View style={styles.truckScene}>
      <Image
        source={activeShipmentTruck}
        style={styles.truckImage}
        resizeMode="contain"
      />
    </View>
  );
}

export default function CustomerHomeDashboard({
  userName,
  shipments,
  unreadNotifications,
  onNotificationsPress,
  onProfilePress,
  onRequestPickup,
  onShipmentPress,
  unreadMessages,
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const activeShipment = useMemo(() => getActiveShipment(shipments), [shipments]);
  const name = getFirstName(userName);
  const notificationCount =
    unreadNotifications > 9 ? "9+" : String(unreadNotifications || 0);

  const trackingNumber =
    activeShipment?.trackingNumber || activeShipment?.shipmentId || activeShipment?.id || "No active shipment";
  const origin = activeShipment?.origin || activeShipment?.sender?.address?.city || "Origin";
  const destination =
    activeShipment?.destination || activeShipment?.recipient?.address?.city || "Destination";

  const pickupTime = getFormattedTime(
    activeShipment?.pickupSchedule ||
      activeShipment?.estimatedPickup ||
      activeShipment?.rawCreatedAt ||
      activeShipment?.createdAt,
  );
  const deliveryTime = getFormattedTime(
    activeShipment?.estimatedDelivery ||
      activeShipment?.deliverySchedule ||
      activeShipment?.rawUpdatedAt ||
      activeShipment?.updatedAt,
  );

  const quickActions = [
    {
      label: "Pickup",
      description: "Request pickup",
      icon: "truck",
      iconColor: colors.primary,
      iconBackground: colors.primarySoft,
      onPress: onRequestPickup,
    },
    {
      label: "Track Shipment",
      description: "Track any shipment",
      icon: "map-pin",
      iconColor: colors.primaryDeep,
      iconBackground: colors.primarySoft,
      onPress: () => router.push("/(customer)/shipments"),
    },
    {
      label: "Invoice",
      description: "View invoices",
      icon: "file-text",
      iconColor: colors.success,
      iconBackground: colors.successSoft,
      onPress: () => router.push("/(customer)/invoices"),
    },
    {
      label: "Schedule",
      description: "View trip schedules",
      icon: "calendar",
      iconColor: colors.warning,
      iconBackground: colors.warningSoft,
      onPress: () => router.push("/(customer)/schedules"),
    },
  ];

  const helpItems = [
    {
      title: "Frequently Asked Questions",
      subtitle: "Get answers to common questions",
      icon: "help-circle",
      color: colors.primary,
      onPress: () => Alert.alert("FAQ", "Frequently asked questions will be available soon."),
    },
    {
      title: "Contact Customer Support",
      subtitle: "We're here to help you",
      icon: "phone",
      color: colors.success,
      onPress: () => router.push("/(customer)/chat"),
    },
    {
      title: "Branch Locations",
      subtitle: "Find Atlas branches near you",
      icon: "map-pin",
      color: colors.warning,
      onPress: () => Alert.alert("Branch Locations", "Branch locator will be available soon."),
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.dashboardBg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.75} onPress={onProfilePress}>
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: colors.dashboardSurface,
                  borderColor: colors.dashboardBorder,
                },
              ]}
            >
              <Feather name="user" size={24} color={colors.text} />
            </View>
          </TouchableOpacity>

          <View style={styles.greetingWrap}>
            <Text style={[styles.greeting, { color: colors.text }]}>Good Morning,</Text>
            <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
          </View>

          <TouchableOpacity
            style={styles.bellButton}
            activeOpacity={0.75}
            onPress={onNotificationsPress}
          >
            <Feather name="bell" size={28} color={colors.text} />
            {unreadNotifications > 0 && (
              <View
                style={[
                  styles.notificationBadge,
                  { backgroundColor: colors.danger, borderColor: colors.dashboardBg },
                ]}
              >
                <Text style={[styles.notificationText, { color: colors.onDanger }]}>
                  {notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.activeCard,
            !activeShipment && styles.emptyActiveCard,
            {
              backgroundColor: colors.dashboardSurface,
              borderColor: colors.dashboardBorder,
              shadowColor: colors.dashboardShadow,
            },
          ]}
        >
          {activeShipment ? (
            <>
              <View style={styles.cardTopRow}>
                <View style={styles.activeTitleRow}>
                  <View style={[styles.activeIcon, { backgroundColor: colors.primary }]}>
                    <Feather name="package" size={18} color={colors.onPrimary} />
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Active Shipment</Text>
                </View>
                <TouchableOpacity
                  style={styles.detailsLink}
                  activeOpacity={0.75}
                  onPress={() => onShipmentPress(activeShipment)}
                >
                  <Text style={[styles.detailsText, { color: colors.primary }]}>View Details</Text>
                  <Feather name="chevron-right" size={22} color={colors.iconMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.shipmentSummaryBlock}>
                <View style={styles.shipmentBodyContent}>
                  <Text
                    style={[styles.trackingNumber, { color: colors.primary }]}
                    numberOfLines={1}
                  >
                    {trackingNumber}
                  </Text>
                  <Text
                    style={[styles.routeText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {origin} {"\u2192"} {destination}
                  </Text>
                  <View style={styles.statusRow}>
                    <StatusBadge status={activeShipment.status || "PENDING"} />
                  </View>
                </View>
                <ShipmentTruckArt />
              </View>

              <View style={styles.estimateRow}>
                <View style={styles.estimateItem}>
                  <Text style={[styles.estimateLabel, { color: colors.textMuted }]}>
                    Estimated Pickup
                  </Text>
                  <View style={styles.estimateValueRow}>
                    <Feather name="calendar" size={16} color={colors.primary} />
                    <Text style={[styles.estimateValue, { color: colors.text }]} numberOfLines={1}>
                      {pickupTime}
                    </Text>
                  </View>
                </View>
                <View style={[styles.estimateDivider, { backgroundColor: colors.dashboardBorder }]} />
                <View style={styles.estimateItem}>
                  <Text style={[styles.estimateLabel, { color: colors.textMuted }]}>
                    Est. Delivery
                  </Text>
                  <View style={styles.estimateValueRow}>
                    <Feather name="calendar" size={16} color={colors.primary} />
                    <Text style={[styles.estimateValue, { color: colors.text }]} numberOfLines={1}>
                      {deliveryTime}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => onShipmentPress(activeShipment)}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryDeep]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.trackButton}
                >
                  <Feather name="map-pin" size={20} color={colors.onPrimary} />
                  <Text style={[styles.trackButtonText, { color: colors.onPrimary }]}>
                    Track Shipment
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emptyShipmentContent}>
              <Text style={[styles.emptyCardTitle, { color: colors.text }]}>
                Active Shipment
              </Text>
              <Image
                source={emptyActiveShipment}
                style={styles.emptyIllustration}
                resizeMode="contain"
              />
              <Text style={[styles.emptyShipmentTitle, { color: colors.text }]}>
                You don't have any active shipments
              </Text>
              <Text style={[styles.emptyShipmentText, { color: colors.textMuted }]}>
                When you create a shipment, it will appear here{"\n"}
                so you can easily track its progress.
              </Text>
              <TouchableOpacity activeOpacity={0.88} onPress={onRequestPickup}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryDeep]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyCreateButton}
                >
                  <Feather name="plus-circle" size={16} color={colors.onPrimary} />
                  <Text style={[styles.emptyCreateButtonText, { color: colors.onPrimary }]}>
                    Create Shipment
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <TouchableOpacity onPress={() => router.push("/(customer)/shipments")}>
            <Text style={[styles.viewAll, { color: colors.primary }]}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[
                styles.quickCard,
                {
                  backgroundColor: colors.dashboardSurface,
                  borderColor: colors.dashboardBorder,
                  shadowColor: colors.dashboardShadow,
                },
              ]}
              activeOpacity={0.82}
              onPress={action.onPress}
              disabled={action.disabled}
              accessibilityRole="button"
              accessibilityLabel={`${action.label}. ${action.description}`}
              accessibilityState={{ disabled: Boolean(action.disabled) }}
            >
              <View
                style={[
                  styles.quickIcon,
                  { backgroundColor: action.iconBackground },
                ]}
              >
                <Feather name={action.icon} size={26} color={action.iconColor} />
              </View>
              <Text
                style={[styles.quickLabel, { color: colors.text }]}
                numberOfLines={2}
              >
                {action.label}
              </Text>
              <Text
                style={[styles.quickDescription, { color: colors.textMuted }]}
                numberOfLines={2}
              >
                {action.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.84}
          onPress={onRequestPickup}
          style={[
            styles.promoBanner,
            {
              backgroundColor: colors.dashboardSurface,
              borderColor: colors.dashboardBorder,
              shadowColor: colors.dashboardShadow,
            },
          ]}
        >
          <View style={styles.promoTextWrap}>
            <Text style={[styles.promoTitle, { color: colors.text }]}>Ship with Atlas</Text>
            <Text style={[styles.promoSubtitle, { color: colors.textMuted }]}>
              Fast, reliable and trusted{"\n"}delivery service.
            </Text>
          </View>
          <Image
            source={courierMascot}
            style={styles.courierArt}
            resizeMode="contain"
          />
          <Feather name="chevron-right" size={30} color={colors.iconMuted} />
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, styles.helpTitle, { color: colors.text }]}>
          Need Help?
        </Text>
        <View
          style={[
            styles.helpCard,
            {
              backgroundColor: colors.dashboardSurface,
              borderColor: colors.dashboardBorder,
              shadowColor: colors.dashboardShadow,
            },
          ]}
        >
          {helpItems.map((item, index) => (
            <TouchableOpacity
              key={item.title}
              style={[
                styles.helpRow,
                index < helpItems.length - 1 && {
                  borderBottomColor: colors.dashboardBorder,
                  borderBottomWidth: 1,
                },
              ]}
              activeOpacity={0.8}
              onPress={item.onPress}
            >
              <View style={[styles.helpIcon, { backgroundColor: item.color }]}>
                <Feather name={item.icon} size={22} color={colors.onPrimary} />
              </View>
              <View style={styles.helpTextWrap}>
                <Text style={[styles.helpItemTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.helpItemSubtitle, { color: colors.textMuted }]}>
                  {item.subtitle}
                </Text>
              </View>
              <Feather name="chevron-right" size={28} color={colors.iconMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  greetingWrap: {
    flex: 1,
    marginLeft: 14,
  },
  greeting: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "400",
  },
  name: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "700",
  },
  bellButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: 1,
    right: 0,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  notificationText: {
    fontSize: 12,
    fontWeight: "700",
  },
  activeCard: {
    position: "relative",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 24,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 2,
  },
  emptyActiveCard: {
    minHeight: 224,
  },
  emptyShipmentContent: {
    flex: 1,
    alignItems: "center",
  },
  emptyCardTitle: {
    alignSelf: "flex-start",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyIllustration: {
    width: 118,
    height: 108,
    marginTop: -2,
    marginBottom: 4,
  },
  emptyShipmentTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 3,
  },
  emptyShipmentText: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginBottom: 13,
  },
  emptyCreateButton: {
    width: 206,
    height: 38,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyCreateButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 12,
  },
  activeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  activeIcon: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  detailsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailsText: {
    fontSize: 14,
    fontWeight: "700",
  },
  trackingNumber: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 7,
  },
  routeText: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 11,
    fontWeight: "400",
  },
  statusRow: {
    minHeight: 34,
  },
  shipmentSummaryBlock: {
    position: "relative",
    minHeight: 112,
    marginBottom: 8,
  },
  shipmentBodyContent: {
    width: "58%",
  },
  truckScene: {
    position: "absolute",
    right: -2,
    top: 28,
    width: 184,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
  },
  truckImage: {
    width: "100%",
    height: "100%",
  },
  estimateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  estimateItem: {
    flex: 1,
  },
  estimateLabel: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 7,
  },
  estimateValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  estimateValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "400",
  },
  estimateDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  trackButton: {
    height: 48,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  trackButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 13,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  viewAll: {
    fontSize: 14,
    fontWeight: "700",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 28,
  },
  quickCard: {
    flex: 1,
    maxWidth: 180,
    minHeight: 132,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 1,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickLabel: {
    minHeight: 32,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  quickDescription: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "400",
    textAlign: "center",
  },
  promoBanner: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 104,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 1,
  },
  promoTextWrap: {
    flex: 1,
    paddingRight: 18,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  promoSubtitle: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "400",
  },
  courierArt: {
    width: 116,
    height: 128,
    marginRight: 6,
    marginTop: -22,
    marginBottom: -20,
  },
  helpTitle: {
    marginBottom: 13,
  },
  helpCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  helpRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  helpIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  helpTextWrap: {
    flex: 1,
  },
  helpItemTitle: {
    fontSize: 15,
    fontWeight: "400",
    marginBottom: 4,
  },
  helpItemSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
});
