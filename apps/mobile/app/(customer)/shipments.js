import React, { useState } from "react";
import {
  Alert,
  Platform,
  SafeAreaView,
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

export default function CustomerShipmentsScreen() {
  const { colors, resolvedScheme } = useTheme();
  const [pickupModalVisible, setPickupModalVisible] = useState(false);
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
          onPress={() => {}}
        >
          <Feather name="filter" size={22} color={colors.iconMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <TrackedShipmentList
          shipments={shipments}
          onShipmentPress={handleShipmentPress}
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
});
