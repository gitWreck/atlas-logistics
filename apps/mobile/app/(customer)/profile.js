import React from "react";
import { View, StyleSheet } from "react-native";
import ProfileViewer from "../../components/profile/ProfileViewer";
import CustomerBottomNav from "../../components/customer/CustomerBottomNav";

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <ProfileViewer showBackButton />
      <CustomerBottomNav active="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
