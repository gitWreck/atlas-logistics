import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  ImageBackground,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import {
  BOOKING_CONTACTS,
  getBranch,
  TRUCK_SCHEDULE,
} from "../../../components/customer/branches/branchData";
import {
  callBranch,
  callPhone,
  getDirections,
  openInGoogleMaps,
  shareBranch,
} from "../../../components/customer/branches/branchActions";
import { useTheme } from "../../../contexts/ThemeContext";

function ActionButton({ icon, label, color, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.actionButton, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: `${color}18` }]}>
        <Feather name={icon} size={23} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function InformationRow({ icon, label, children, colors, last = false }) {
  return (
    <View style={[styles.infoRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.dashboardBorder }]}>
      <Feather name={icon} size={21} color={colors.iconMuted} />
      <View style={styles.infoCopy}>
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text selectable style={[styles.infoValue, { color: colors.text }]}>{children}</Text>
      </View>
    </View>
  );
}

export default function CustomerBranchDetailsScreen() {
  const { branchId } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  const branch = getBranch(Array.isArray(branchId) ? branchId[0] : branchId);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [opacity]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.dashboardBg }]}>
      <StatusBar style="light" backgroundColor="transparent" translucent />
      <Animated.ScrollView style={{ opacity }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ImageBackground source={branch.image} style={styles.hero} imageStyle={styles.heroImage} resizeMode="cover">
          <LinearGradient colors={["rgba(2,11,24,0.2)", "rgba(2,11,24,0.1)", "rgba(2,11,24,0.94)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroTopActions}>
            <TouchableOpacity onPress={() => router.replace("/(customer)/branch-locations")} accessibilityRole="button" accessibilityLabel="Back to branch locations" style={styles.heroCircleButton}>
              <Feather name="arrow-left" size={22} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => shareBranch(branch)} accessibilityRole="button" accessibilityLabel="Share branch location" style={styles.heroCircleButton}>
              <Feather name="share-2" size={21} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <View style={styles.heroTitleRow}>
            <View style={[styles.heroPin, { backgroundColor: colors.primary }]}>
              <Feather name="map-pin" size={28} color={colors.onPrimary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{branch.name}</Text>
              <Text style={styles.heroSubtitle}>{branch.location}</Text>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.actionGrid}>
          <ActionButton icon="navigation" label="Get Directions" color={colors.primary} onPress={() => getDirections(branch)} colors={colors} />
          <ActionButton icon="phone" label="Call Branch" color={colors.success} onPress={() => callBranch(branch)} colors={colors} />
          <ActionButton icon="map" label="Open in Google Maps" color={colors.warning} onPress={() => openInGoogleMaps(branch)} colors={colors} />
          <ActionButton icon="share-2" label="Share Location" color={colors.iconMuted} onPress={() => shareBranch(branch)} colors={colors} />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder, shadowColor: colors.dashboardShadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Branch Information</Text>
          <View style={[styles.innerCard, { backgroundColor: colors.dashboardSurfaceMuted, borderColor: colors.dashboardBorder }]}>
            <InformationRow icon="map-pin" label="Address" colors={colors}>{branch.location}</InformationRow>
            <InformationRow icon="clock" label="Business Hours" colors={colors}>{branch.days}{"\n"}{branch.hours}</InformationRow>
            <InformationRow icon="phone" label="Contact Number" colors={colors} last>{branch.phone}</InformationRow>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder, shadowColor: colors.dashboardShadow }]}>
          <View style={styles.scheduleHeading}>
            <View style={[styles.scheduleIcon, { backgroundColor: colors.primarySoft }]}>
              <Feather name="truck" size={21} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, styles.flushTitle, { color: colors.text }]}>Truck Schedule</Text>
              <Text style={[styles.scheduleRoute, { color: colors.textMuted }]}>Divisoria ↔ Tablas</Text>
            </View>
          </View>
          <View style={[styles.innerCard, styles.scheduleCard, { backgroundColor: colors.dashboardSurfaceMuted, borderColor: colors.dashboardBorder }]}>
            <View style={styles.scheduleColumns}>
              <View style={[styles.scheduleColumn, { borderRightWidth: 1, borderRightColor: colors.dashboardBorder }]}>
                <Text style={[styles.scheduleKicker, { color: colors.primary }]}>{TRUCK_SCHEDULE.departureTitle}</Text>
                <Text style={[styles.schedulePlace, { color: colors.primary }]}>{TRUCK_SCHEDULE.departurePlace}</Text>
                {TRUCK_SCHEDULE.departureDays.map((day) => <Text key={day} style={[styles.scheduleDay, { color: colors.text }]}>•  {day}</Text>)}
              </View>
              <View style={styles.scheduleColumn}>
                <Text style={[styles.scheduleKicker, { color: colors.primary }]}>Arrival</Text>
                <Text style={[styles.schedulePlace, { color: colors.primary }]}>in Tablas</Text>
                {TRUCK_SCHEDULE.arrivalDays.map((day) => <Text key={day} style={[styles.scheduleDay, { color: colors.text }]}>•  {day}</Text>)}
              </View>
            </View>
            <View style={[styles.scheduleNote, { borderTopColor: colors.dashboardBorder }]}>
              <Feather name="calendar" size={18} color={colors.iconMuted} />
              <Text style={[styles.scheduleNoteText, { color: colors.textMuted }]}>Schedules may change without prior notice.{"\n"}Please contact us for the latest updates.</Text>
            </View>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder, shadowColor: colors.dashboardShadow }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>For Bookings & Updates</Text>
          <View style={[styles.innerCard, { backgroundColor: colors.dashboardSurfaceMuted, borderColor: colors.dashboardBorder }]}>
            {BOOKING_CONTACTS.map((contact, index) => (
              <TouchableOpacity
                key={contact.id}
                onPress={() => callPhone(contact.phoneUri)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Call ${contact.place}, ${contact.person}`}
                style={[styles.contactRow, index < BOOKING_CONTACTS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.dashboardBorder }]}
              >
                <View style={[styles.contactIcon, { backgroundColor: index === 0 ? colors.primary : colors.success }]}>
                  <Feather name={contact.icon} size={20} color="#ffffff" />
                </View>
                <View style={styles.contactCopy}>
                  <Text style={[styles.contactPlace, { color: colors.text }]}>{contact.place}</Text>
                  <Text style={[styles.contactPerson, { color: colors.text }]}>({contact.person})</Text>
                  <Text selectable style={[styles.contactPhone, { color: colors.primary }]}>{contact.phone}</Text>
                </View>
                <View style={[styles.callCircle, { backgroundColor: colors.neutralSoft }]}>
                  <Feather name="phone" size={19} color={colors.text} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.importantCard, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}>
          <View style={[styles.importantIcon, { backgroundColor: colors.primarySoft }]}>
            <Feather name="info" size={21} color={colors.primary} />
          </View>
          <View style={styles.importantCopy}>
            <Text style={[styles.importantTitle, { color: colors.text }]}>Important Note</Text>
            <Text style={[styles.importantText, { color: colors.textMuted }]}>Truck schedules may change due to weather conditions, road situations, holidays, or operational requirements.{"\n\n"}Please contact our branch before your scheduled shipment or pickup for the latest updates.</Text>
          </View>
        </View>

        <View style={[styles.footerCard, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}>
          <Image source={require("../../../assets/atlas-login.png")} style={styles.footerLogo} resizeMode="contain" />
          <Text style={[styles.footerText, { color: colors.text }]}>THANK YOU FOR TRUSTING{"\n"}ATLAS TRANSPORT (OPC)</Text>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0 },
  content: { paddingBottom: 28 },
  hero: { height: 330, justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 22 },
  heroImage: { borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  heroTopActions: { flexDirection: "row", justifyContent: "space-between" },
  heroCircleButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(2,11,24,0.65)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  heroTitleRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroPin: { width: 58, height: 58, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1 },
  heroTitle: { color: "#ffffff", fontSize: 24, lineHeight: 31, fontWeight: "900" },
  heroSubtitle: { color: "#e2e8f0", marginTop: 3, fontSize: 14, fontWeight: "600" },
  actionGrid: { paddingHorizontal: 14, marginTop: 14, marginBottom: 14, flexDirection: "row", gap: 6 },
  actionButton: { flex: 1, minHeight: 112, borderRadius: 14, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 12, alignItems: "center", justifyContent: "center", gap: 9 },
  actionIcon: { width: 43, height: 43, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 10, lineHeight: 14, fontWeight: "700", textAlign: "center" },
  sectionCard: { borderRadius: 17, borderWidth: 1, marginHorizontal: 14, marginBottom: 14, padding: 12, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 1 },
  sectionTitle: { marginBottom: 12, fontSize: 17, fontWeight: "900" },
  flushTitle: { marginBottom: 2 },
  innerCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  infoRow: { minHeight: 82, flexDirection: "row", alignItems: "flex-start", gap: 13, paddingHorizontal: 13, paddingVertical: 14 },
  infoCopy: { flex: 1 },
  infoLabel: { fontSize: 12, lineHeight: 17 },
  infoValue: { marginTop: 3, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  scheduleHeading: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  scheduleIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  scheduleRoute: { fontSize: 12 },
  scheduleCard: { paddingTop: 14 },
  scheduleColumns: { flexDirection: "row" },
  scheduleColumn: { flex: 1, paddingHorizontal: 14, paddingBottom: 13 },
  scheduleKicker: { fontSize: 12, lineHeight: 17, fontWeight: "900", textTransform: "uppercase" },
  schedulePlace: { marginBottom: 12, fontSize: 14, lineHeight: 19, fontWeight: "900", textTransform: "uppercase" },
  scheduleDay: { marginBottom: 8, fontSize: 13, lineHeight: 18 },
  scheduleNote: { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  scheduleNoteText: { flex: 1, fontSize: 11, lineHeight: 17 },
  contactRow: { minHeight: 100, paddingHorizontal: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  contactIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  contactCopy: { flex: 1 },
  contactPlace: { fontSize: 14, lineHeight: 19, fontWeight: "800" },
  contactPerson: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  contactPhone: { marginTop: 4, fontSize: 14, fontWeight: "800" },
  callCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  importantCard: { borderRadius: 17, borderWidth: 1, marginHorizontal: 14, marginBottom: 14, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  importantIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  importantCopy: { flex: 1 },
  importantTitle: { fontSize: 15, fontWeight: "900" },
  importantText: { marginTop: 6, fontSize: 12, lineHeight: 18 },
  footerCard: { minHeight: 100, borderRadius: 17, borderWidth: 1, marginHorizontal: 14, padding: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 15 },
  footerLogo: { width: 72, height: 72 },
  footerText: { fontSize: 14, lineHeight: 21, fontWeight: "900" },
});
