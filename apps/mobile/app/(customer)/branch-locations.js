import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Keyboard,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";

import BranchMap from "../../components/customer/branches/BranchMap";
import { BRANCHES } from "../../components/customer/branches/branchData";
import {
  callBranch,
  getDirections,
  openInGoogleMaps,
} from "../../components/customer/branches/branchActions";
import { useTheme } from "../../contexts/ThemeContext";

function BranchAction({ icon, label, color, onPress, borderRight, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.cardAction, borderRight && { borderRightWidth: 1, borderRightColor: colors.dashboardBorder }]}
    >
      <View style={[styles.cardActionIcon, { backgroundColor: colors.dashboardSurfaceMuted, borderColor: colors.dashboardBorder }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.cardActionText, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const BranchCard = memo(function BranchCard({ branch, selected, onSelect, onDetails, colors, onLayout }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = useCallback((toValue) => {
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 28, bounciness: 3 }).start();
  }, [scale]);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.branchCard,
        {
          backgroundColor: colors.dashboardSurface,
          borderColor: selected ? colors.primary : colors.dashboardBorder,
          shadowColor: colors.dashboardShadow,
          transform: [{ scale }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => onSelect(branch.id)}
        onPressIn={() => animate(0.985)}
        onPressOut={() => animate(1)}
        accessibilityRole="button"
        accessibilityLabel={`${branch.name}, ${branch.location}`}
        accessibilityState={{ selected }}
        style={styles.branchMain}
      >
        <Image source={branch.image} style={styles.branchImage} resizeMode="cover" />
        <View style={styles.branchCopy}>
          <View style={styles.branchNameRow}>
            <View style={[styles.pinBadge, { backgroundColor: colors.primary }]}>
              <Feather name="map-pin" size={13} color={colors.onPrimary} />
            </View>
            <View style={styles.branchNameCopy}>
              <Text style={[styles.branchName, { color: colors.text }]} numberOfLines={1}>{branch.name}</Text>
              {branch.badge ? (
                <View style={[styles.mainBadge, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.mainBadgeText, { color: colors.primary }]}>{branch.badge}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.detailRow}>
            <Feather name="map-pin" size={11} color={colors.iconMuted} />
            <Text style={[styles.detailText, { color: colors.textMuted }]} numberOfLines={1}>{branch.location}</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="clock" size={11} color={colors.iconMuted} />
            <Text style={[styles.detailText, { color: colors.textMuted }]} numberOfLines={1}>Mon – Sat · {branch.hours}</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="phone" size={11} color={colors.iconMuted} />
            <Text selectable style={[styles.detailText, { color: colors.textMuted }]}>{branch.phone}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <View style={[styles.cardActions, { borderTopColor: colors.dashboardBorder }]}>
        <BranchAction icon="navigation" label="Get Directions" color={colors.primary} onPress={() => getDirections(branch)} borderRight colors={colors} />
        <BranchAction icon="phone" label="Call Branch" color={colors.success} onPress={() => callBranch(branch)} borderRight colors={colors} />
        <BranchAction icon="info" label="View Details" color={colors.primary} onPress={() => onDetails(branch.id)} colors={colors} />
      </View>
    </Animated.View>
  );
});

export default function CustomerBranchLocationsScreen() {
  const router = useRouter();
  const { colors, resolvedScheme } = useTheme();
  const scrollRef = useRef(null);
  const cardPositions = useRef({});
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(BRANCHES[0].id);

  const filteredBranches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return BRANCHES;
    return BRANCHES.filter((branch) => `${branch.name} ${branch.location} ${branch.phone}`.toLowerCase().includes(term));
  }, [query]);

  const handleSelect = useCallback((branchId, scroll = false) => {
    setSelectedId(branchId);
    if (scroll && cardPositions.current[branchId] != null) {
      scrollRef.current?.scrollTo({ y: Math.max(0, cardPositions.current[branchId] - 90), animated: true });
    }
  }, []);

  const openDetails = useCallback((branchId) => {
    router.push({ pathname: "/(customer)/branch/[branchId]", params: { branchId } });
  }, [router]);

  const selectedBranch = BRANCHES.find((branch) => branch.id === selectedId) || BRANCHES[0];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.dashboardBg }]}>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} backgroundColor={colors.dashboardBg} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.replace("/(customer)")}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[styles.backButton, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: colors.text }]}>Branch Locations</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Find the nearest Atlas branch and get directions.</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.dashboardSurfaceMuted, borderColor: colors.dashboardBorder }]}>
            <Feather name="search" size={21} color={colors.iconMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search branches..."
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel="Search branches"
              style={[styles.searchInput, { color: colors.text }]}
            />
            {query && Platform.OS !== "ios" ? (
              <TouchableOpacity onPress={() => { setQuery(""); Keyboard.dismiss(); }} hitSlop={10} accessibilityLabel="Clear branch search">
                <Feather name="x-circle" size={18} color={colors.iconMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <BranchMap
          branches={BRANCHES}
          selectedId={selectedId}
          onSelect={(branchId) => handleSelect(branchId, true)}
          onOpenFullMap={() => openInGoogleMaps(selectedBranch)}
        />

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Our Branches</Text>
        {filteredBranches.length ? filteredBranches.map((branch) => (
          <BranchCard
            key={branch.id}
            branch={branch}
            selected={selectedId === branch.id}
            onSelect={handleSelect}
            onDetails={openDetails}
            colors={colors}
            onLayout={(event) => { cardPositions.current[branch.id] = event.nativeEvent.layout.y; }}
          />
        )) : (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
              <Feather name="map-pin" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No matching branches</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Try searching using a different branch name or location.</Text>
            <TouchableOpacity onPress={() => setQuery("")} style={[styles.clearButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.clearButtonText, { color: colors.onPrimary }]}>Clear Search</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.supportCard, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder, shadowColor: colors.dashboardShadow }]}>
          <View style={[styles.supportIcon, { backgroundColor: colors.primarySoft }]}>
            <Feather name="headphones" size={28} color={colors.primary} />
          </View>
          <View style={styles.supportCopy}>
            <Text style={[styles.supportTitle, { color: colors.text }]}>Need help?</Text>
            <Text style={[styles.supportText, { color: colors.textMuted }]}>Our support team is here to assist you.</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(customer)/chat")} style={[styles.supportButton, { backgroundColor: colors.primary }]}>
            <Text style={[styles.supportButtonText, { color: colors.onPrimary }]}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },
  header: { minHeight: 90, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  backButton: { position: "absolute", left: 0, top: 8, zIndex: 2, width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerCopy: { alignItems: "center", paddingHorizontal: 58 },
  title: { fontSize: 24, lineHeight: 31, fontWeight: "900", textAlign: "center" },
  subtitle: { marginTop: 8, fontSize: 14, lineHeight: 20, textAlign: "center" },
  searchRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  searchBox: { flex: 1, height: 56, borderRadius: 17, borderWidth: 1, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12 },
  searchInput: { flex: 1, height: "100%", fontSize: 15 },
  sectionTitle: { marginTop: 32, marginBottom: 16, fontSize: 19, fontWeight: "900" },
  branchCard: { borderRadius: 18, borderWidth: 1, marginBottom: 16, padding: 12, overflow: "hidden", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 3 },
  branchMain: { height: 112, flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden" },
  branchImage: { width: 92, minWidth: 92, height: 96, borderRadius: 11, flexShrink: 0 },
  branchCopy: { flex: 1, justifyContent: "center", gap: 7 },
  branchNameRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  pinBadge: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  branchNameCopy: { flex: 1, minWidth: 0 },
  branchName: { fontSize: 13, lineHeight: 17, fontWeight: "900" },
  mainBadge: { alignSelf: "flex-start", marginTop: 3, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  mainBadgeText: { fontSize: 8, fontWeight: "800" },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  detailText: { flex: 1, fontSize: 9, lineHeight: 13 },
  cardActions: { height: 56, marginTop: 12, borderTopWidth: 1, flexDirection: "row" },
  cardAction: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 4 },
  cardActionIcon: { width: 27, height: 27, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cardActionText: { fontSize: 9, fontWeight: "700", textAlign: "center" },
  emptyState: { alignItems: "center", paddingVertical: 35, paddingHorizontal: 24 },
  emptyIcon: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 15, fontSize: 17, fontWeight: "800" },
  emptyText: { marginTop: 7, fontSize: 12, lineHeight: 18, textAlign: "center" },
  clearButton: { marginTop: 16, height: 42, borderRadius: 10, paddingHorizontal: 20, justifyContent: "center" },
  clearButtonText: { fontSize: 13, fontWeight: "800" },
  supportCard: { minHeight: 118, borderRadius: 20, borderWidth: 1, marginTop: 8, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 2 },
  supportIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  supportCopy: { flex: 1 },
  supportTitle: { fontSize: 18, fontWeight: "900" },
  supportText: { marginTop: 5, fontSize: 12, lineHeight: 18 },
  supportButton: { minHeight: 50, borderRadius: 13, paddingHorizontal: 18, justifyContent: "center" },
  supportButtonText: { fontSize: 13, fontWeight: "800" },
});
