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
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import CustomerBottomNav from "../../components/customer/CustomerBottomNav";
import FloatingAddButton from "../../components/customer/FloatingAddButton";
import RequestPickupModal from "../../components/customer/RequestPickup/RequestPickupModal";
import TrackedShipmentList from "../../components/customer/TrackedShipmentList";
import useCustomerDashboardData from "../../components/customer/useCustomerDashboardData";
import { requestShipmentPickup } from "../../components/utilities/FirebaseFunctions";
import { useTheme } from "../../contexts/ThemeContext";

export default function CustomerShipmentsScreen() {
  const router = useRouter();
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
        <TouchableOpacity
          style={[
            styles.headerButton,
            {
              backgroundColor: colors.dashboardSurface,
              borderColor: colors.dashboardBorder,
            },
          ]}
          activeOpacity={0.75}
          onPress={() => router.push("/(customer)")}
        >
          <Feather name="chevron-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Shipments
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            Search, filter, and track your deliveries
          </Text>
        </View>
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
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "600",
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
});
