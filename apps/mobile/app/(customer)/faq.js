import React, { memo, useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";

import { FAQ_CATEGORIES, FAQS } from "../../components/customer/faqData";
import { useTheme } from "../../contexts/ThemeContext";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CATEGORY_ICONS = {
  All: "grid",
  Account: "user",
  Shipments: "package",
  Tracking: "map-pin",
  Pickup: "truck",
  Invoices: "file-text",
  Schedules: "calendar",
  Messages: "message-circle",
  Support: "headphones",
};

function AnswerBlocks({ blocks, colors }) {
  return blocks.map((block, blockIndex) => {
    if (block.items) {
      return (
        <View key={`list-${blockIndex}`} style={styles.bulletList}>
          {block.items.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
              <Text selectable style={[styles.answerText, styles.bulletText, { color: colors.textMuted }]}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    return (
      <Text key={`text-${blockIndex}`} selectable style={[styles.answerText, { color: colors.textMuted }]}>
        {block.text}
      </Text>
    );
  });
}

const FAQItem = memo(function FAQItem({ item, expanded, onToggle, colors }) {
  return (
    <View
      style={[
        styles.faqCard,
        {
          backgroundColor: colors.dashboardSurface,
          borderColor: expanded ? colors.primary : colors.dashboardBorder,
          shadowColor: colors.dashboardShadow,
        },
      ]}
    >
      <Pressable
        onPress={() => onToggle(item.id)}
        android_ripple={{ color: colors.primarySoft }}
        accessibilityRole="button"
        accessibilityLabel={item.question}
        accessibilityHint={expanded ? "Collapses the answer" : "Expands the answer"}
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.questionButton, pressed && Platform.OS === "ios" && styles.pressed]}
      >
        <View style={[styles.categoryIcon, { backgroundColor: colors.primarySoft }]}>
          <Feather name={CATEGORY_ICONS[item.category] || "help-circle"} size={15} color={colors.primary} />
        </View>
        <Text style={[styles.questionText, { color: colors.text }]}>{item.question}</Text>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.iconMuted} />
      </Pressable>

      {expanded ? (
        <View style={[styles.answerWrap, { borderTopColor: colors.dashboardBorder }]}>
          <AnswerBlocks blocks={item.blocks} colors={colors} />
        </View>
      ) : null}
    </View>
  );
}, (prev, next) => (
  prev.item === next.item &&
  prev.expanded === next.expanded &&
  prev.colors === next.colors &&
  prev.onToggle === next.onToggle
));

function EmptyState({ hasSearch, onClear, colors }) {
  return (
    <View style={styles.emptyState} accessibilityRole="summary">
      <View style={[styles.emptyArt, { backgroundColor: colors.primarySoft, borderColor: colors.dashboardBorder }]}>
        <Feather name="file-text" size={54} color={colors.iconMuted} />
        <View style={[styles.emptyBadge, { backgroundColor: colors.primary }]}>
          <Feather name="search" size={24} color={colors.onPrimary} />
        </View>
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {hasSearch ? "No matching questions" : "No FAQs available"}
      </Text>
      <Text style={[styles.emptyDescription, { color: colors.textMuted }]}>
        {hasSearch
          ? "Try searching using different keywords."
          : "There are currently no questions in this category."}
      </Text>
      {hasSearch ? (
        <TouchableOpacity
          onPress={onClear}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Clear FAQ search"
          style={[styles.clearButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.clearButtonText, { color: colors.onPrimary }]}>Clear Search</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function CustomerFAQScreen() {
  const router = useRouter();
  const { colors, resolvedScheme } = useTheme();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [expandedId, setExpandedId] = useState(null);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredFaqs = useMemo(() => FAQS.filter((item) => {
    const categoryMatches = category === "All" || item.category === category;
    const searchMatches = !normalizedQuery || item.searchText.includes(normalizedQuery);
    return categoryMatches && searchMatches;
  }), [category, normalizedQuery]);

  const categoryCounts = useMemo(() => FAQS.reduce((counts, item) => {
    counts[item.category] = (counts[item.category] || 0) + 1;
    return counts;
  }, { All: FAQS.length }), []);

  const handleToggle = useCallback((id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((current) => current === id ? null : id);
  }, []);

  const selectCategory = useCallback((nextCategory) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCategory(nextCategory);
    setExpandedId(null);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery("");
    setExpandedId(null);
    Keyboard.dismiss();
  }, []);

  const renderItem = useCallback(({ item }) => (
    <FAQItem
      item={item}
      expanded={expandedId === item.id}
      onToggle={handleToggle}
      colors={colors}
    />
  ), [colors, expandedId, handleToggle]);

  const listHeader = useMemo(() => (
    <View>
      <View style={[styles.searchBox, { backgroundColor: colors.dashboardSurfaceMuted, borderColor: colors.dashboardBorder }]}>
        <Feather name="search" size={19} color={colors.iconMuted} />
        <TextInput
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setExpandedId(null);
          }}
          placeholder="Search questions..."
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search frequently asked questions"
          style={[styles.searchInput, { color: colors.text }]}
        />
        {query.length > 0 && Platform.OS !== "ios" ? (
          <TouchableOpacity onPress={clearSearch} hitSlop={10} accessibilityLabel="Clear search">
            <Feather name="x-circle" size={18} color={colors.iconMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Browse by Category</Text>
      <FlatList
        horizontal
        data={FAQ_CATEGORIES}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.categories}
        renderItem={({ item }) => {
          const selected = category === item;
          return (
            <TouchableOpacity
              onPress={() => selectCategory(item)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`${item}, ${categoryCounts[item] || 0} questions`}
              accessibilityState={{ selected }}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selected ? colors.primary : colors.dashboardSurface,
                  borderColor: selected ? colors.primary : colors.dashboardBorder,
                },
              ]}
            >
              <Feather name={CATEGORY_ICONS[item]} size={14} color={selected ? colors.onPrimary : colors.primary} />
              <Text style={[styles.categoryText, { color: selected ? colors.onPrimary : colors.text }]}>{item}</Text>
              <Text style={[styles.categoryCount, { color: selected ? colors.onPrimary : colors.textMuted }]}>
                {categoryCounts[item] || 0}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.resultsHeader}>
        <Text style={[styles.sectionTitle, styles.resultsTitle, { color: colors.text }]}>Questions</Text>
        <Text style={[styles.resultsCount, { color: colors.textMuted }]}>{filteredFaqs.length} results</Text>
      </View>
    </View>
  ), [category, categoryCounts, clearSearch, colors, filteredFaqs.length, query, selectCategory]);

  const listFooter = useMemo(() => (
    <View
      style={[
        styles.supportCard,
        {
          backgroundColor: colors.dashboardSurface,
          borderColor: colors.dashboardBorder,
          shadowColor: colors.dashboardShadow,
        },
      ]}
    >
      <View style={[styles.supportIcon, { backgroundColor: colors.primarySoft }]}>
        <Feather name="headphones" size={25} color={colors.primary} />
      </View>
      <View style={styles.supportCopy}>
        <Text style={[styles.supportTitle, { color: colors.text }]}>Still need help?</Text>
        <Text style={[styles.supportDescription, { color: colors.textMuted }]}>Message our support team.</Text>
      </View>
      <TouchableOpacity
        onPress={() => router.push("/(customer)/chat")}
        activeOpacity={0.86}
        accessibilityRole="button"
        accessibilityLabel="Contact Atlas customer support"
        style={[styles.supportButton, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.supportButtonText, { color: colors.onPrimary }]}>Contact Support</Text>
      </TouchableOpacity>
    </View>
  ), [colors, router]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.dashboardBg }]}>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} backgroundColor={colors.dashboardBg} />
      <View style={[styles.header, { borderBottomColor: colors.dashboardBorder }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.dashboardSurface, borderColor: colors.dashboardBorder }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Feather name="arrow-left" size={21} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Frequently Asked Questions</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Find answers to common questions about Atlas services.</Text>
        </View>
      </View>

      <FlatList
        data={filteredFaqs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        extraData={expandedId}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<EmptyState hasSearch={Boolean(normalizedQuery)} onClear={clearSearch} colors={colors} />}
        ListFooterComponent={listFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0 },
  header: { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1 },
  backButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: "800" },
  subtitle: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30, flexGrow: 1 },
  searchBox: { height: 48, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, height: "100%", fontSize: 14 },
  sectionTitle: { marginTop: 20, marginBottom: 11, fontSize: 15, fontWeight: "800" },
  categories: { gap: 8, paddingRight: 8 },
  categoryChip: { minHeight: 38, borderRadius: 19, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  categoryText: { fontSize: 12, fontWeight: "700" },
  categoryCount: { fontSize: 10, fontWeight: "700", opacity: 0.9 },
  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultsTitle: { marginBottom: 10 },
  resultsCount: { marginTop: 10, fontSize: 11, fontWeight: "600" },
  faqCard: { borderRadius: 14, borderWidth: 1, marginBottom: 9, overflow: "hidden", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 1 },
  questionButton: { minHeight: 62, paddingHorizontal: 13, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  pressed: { opacity: 0.72 },
  categoryIcon: { width: 31, height: 31, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  questionText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  answerWrap: { borderTopWidth: 1, marginHorizontal: 13, paddingTop: 13, paddingBottom: 15, gap: 9 },
  answerText: { fontSize: 13, lineHeight: 20 },
  bulletList: { gap: 7 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1 },
  emptyState: { alignItems: "center", paddingHorizontal: 20, paddingTop: 38, paddingBottom: 24 },
  emptyArt: { width: 126, height: 116, borderRadius: 28, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 21 },
  emptyBadge: { position: "absolute", right: 19, bottom: 17, width: 43, height: 43, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 19, fontWeight: "800", textAlign: "center" },
  emptyDescription: { maxWidth: 280, marginTop: 8, fontSize: 13, lineHeight: 20, textAlign: "center" },
  clearButton: { minWidth: 150, height: 44, borderRadius: 10, marginTop: 20, alignItems: "center", justifyContent: "center" },
  clearButtonText: { fontSize: 14, fontWeight: "800" },
  supportCard: { borderRadius: 16, borderWidth: 1, marginTop: 15, padding: 14, flexDirection: "row", alignItems: "center", gap: 11, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 1 },
  supportIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  supportCopy: { flex: 1, minWidth: 0 },
  supportTitle: { fontSize: 14, fontWeight: "800" },
  supportDescription: { marginTop: 3, fontSize: 11, lineHeight: 16 },
  supportButton: { minHeight: 40, borderRadius: 10, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  supportButtonText: { fontSize: 11, fontWeight: "800" },
});
