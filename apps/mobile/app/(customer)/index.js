import React, { useState } from "react";
import { Alert, Platform, SafeAreaView, StatusBar as RNStatusBar, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import CustomerHomeDashboard from "../../components/customer/CustomerHomeDashboard";
import CustomerBottomNav from "../../components/customer/CustomerBottomNav";
import RequestPickupModal from "../../components/customer/RequestPickup/RequestPickupModal";
import useCustomerDashboardData from "../../components/customer/useCustomerDashboardData";
import { requestShipmentPickup } from "../../components/utilities/FirebaseFunctions";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";

export default function CustomerDashboard() {
  const router = useRouter();
  const { colors, resolvedScheme } = useTheme();
  const { profile } = useAuth();
  const [pickupModalVisible, setPickupModalVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const {
    shipments,
    userData,
    userName,
    unreadNotifications,
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

      <CustomerHomeDashboard
        userName={userName}
        photoURL={profile?.photoURL || userData?.photoURL}
        shipments={shipments}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
        onNotificationsPress={() => router.push("/(customer)/notifications")}
        onProfilePress={() => router.push("/(customer)/profile")}
        onRequestPickup={() => setPickupModalVisible(true)}
        onShipmentPress={handleShipmentPress}
      />

      <CustomerBottomNav active="home" unreadMessages={unreadMessages} />

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
});
