import React, { useState } from "react";
import {
  Alert,
  Modal,
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

import CustomerBottomNav from "../../components/customer/CustomerBottomNav";
import FloatingAddButton from "../../components/customer/FloatingAddButton";
import RequestPickupModal from "../../components/customer/RequestPickup/RequestPickupModal";
import TrackedShipmentList from "../../components/customer/TrackedShipmentList";
import useCustomerDashboardData from "../../components/customer/useCustomerDashboardData";
import { requestShipmentPickup } from "../../components/utilities/FirebaseFunctions";
import { useTheme } from "../../contexts/ThemeContext";

const STATUS_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Pending", value: "PENDING" },
  { label: "In Transit", value: "IN_TRANSIT" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const SORT_OPTIONS = [
  { label: "Latest First", value: "LATEST" },
  { label: "Oldest First", value: "OLDEST" },
];

export default function CustomerShipmentsScreen() {
  const { colors, resolvedScheme } = useTheme();
  const [pickupModalVisible, setPickupModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("LATEST");
  const [draftFilter, setDraftFilter] = useState("ALL");
  const [draftSort, setDraftSort] = useState("LATEST");
  const [requesting, setRequesting] = useState(false);
  const {
    shipments,
    userData,
    unreadMessages,
    handleShipmentPress,
  } = useCustomerDashboardData();

  const handleRequestPickup = async (pickupData) => {
    try {
      setRequesting(true);
      await requestShipmentPickup(pickupData);
      setPickupModalVisible(false);
      Alert.alert("Success", "Pickup request submitted successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to submit request. Please try again.");
    } finally {
      setRequesting(false);
    }
  };

  const openFilterModal = () => {
    setDraftFilter(activeFilter);
    setDraftSort(sortOrder);
    setFilterModalVisible(true);
  };

  const applyFilters = () => {
    setActiveFilter(draftFilter);
    setSortOrder(draftSort);
    setFilterModalVisible(false);
  };

  const resetFilters = () => {
    setDraftFilter("ALL");
    setDraftSort("LATEST");
    setActiveFilter("ALL");
    setSortOrder("LATEST");
    setFilterModalVisible(false);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.dashboardBg }]}
    >
      <StatusBar
        style={resolvedScheme === "dark" ? "light" : "dark"}
        backgroundColor={colors.dashboardBg}
      />

      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            My Shipments
          </Text>
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          activeOpacity={0.75}
          onPress={openFilterModal}
        >
          <Feather name="filter" size={22} color={colors.iconMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <TrackedShipmentList
          shipments={shipments}
          onShipmentPress={handleShipmentPress}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          sortOrder={sortOrder}
        />
      </View>

      <FloatingAddButton
        onPress={() => setPickupModalVisible(true)}
        bottom={92}
        right={22}
      />
      <CustomerBottomNav active="shipments" unreadMessages={unreadMessages} />

      <RequestPickupModal
        visible={pickupModalVisible}
        onClose={() => setPickupModalVisible(false)}
        onSubmit={handleRequestPickup}
        isSubmitting={requesting}
        userData={userData}
      />

      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.filterSheet,
              {
                backgroundColor: colors.dashboardSurface,
                borderColor: colors.dashboardBorder,
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                Filter & Sort
              </Text>
              <TouchableOpacity
                style={styles.sheetClose}
                onPress={() => setFilterModalVisible(false)}
              >
                <Feather name="x" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sheetSectionTitle, { color: colors.text }]}>
                Filter by Status
              </Text>
              <View
                style={[
                  styles.optionGroup,
                  {
                    backgroundColor: colors.dashboardSurfaceMuted,
                    borderColor: colors.dashboardBorder,
                  },
                ]}
              >
                {STATUS_OPTIONS.map((option, index) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionRow,
                      index < STATUS_OPTIONS.length - 1 && {
                        borderBottomColor: colors.dashboardBorder,
                        borderBottomWidth: 1,
                      },
                    ]}
                    onPress={() => setDraftFilter(option.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.optionText, { color: colors.text }]}>
                      {option.label}
                    </Text>
                    {draftFilter === option.value && (
                      <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                        <Feather name="check" size={14} color={colors.onPrimary} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.sheetSectionTitle, { color: colors.text }]}>
                Sort by
              </Text>
              <View
                style={[
                  styles.optionGroup,
                  {
                    backgroundColor: colors.dashboardSurfaceMuted,
                    borderColor: colors.dashboardBorder,
                  },
                ]}
              >
                {SORT_OPTIONS.map((option, index) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionRow,
                      index < SORT_OPTIONS.length - 1 && {
                        borderBottomColor: colors.dashboardBorder,
                        borderBottomWidth: 1,
                      },
                    ]}
                    onPress={() => setDraftSort(option.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.optionText, { color: colors.text }]}>
                      {option.label}
                    </Text>
                    {draftSort === option.value && (
                      <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                        <Feather name="check" size={14} color={colors.onPrimary} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.applyButton, { backgroundColor: colors.primary }]}
                onPress={applyFilters}
                activeOpacity={0.88}
              >
                <Text style={[styles.applyButtonText, { color: colors.onPrimary }]}>
                  Apply
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resetButton}
                onPress={resetFilters}
                activeOpacity={0.8}
              >
                <Text style={[styles.resetButtonText, { color: colors.primary }]}>
                  Reset
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 16,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  filterButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 11, 24, 0.72)",
    justifyContent: "flex-end",
  },
  filterSheet: {
    maxHeight: "82%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sheetClose: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  optionGroup: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 22,
  },
  optionRow: {
    minHeight: 42,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButton: {
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  resetButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
