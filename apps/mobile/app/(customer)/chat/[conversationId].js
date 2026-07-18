import React from "react";
import {
  Platform,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";

import ChatThread from "../../../components/chat/ChatThread";
import { useTheme } from "../../../contexts/ThemeContext";

export default function CustomerChatThreadScreen() {
  const { conversationId } = useLocalSearchParams();
  const router = useRouter();
  const { colors, resolvedScheme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />
      <ChatThread
        conversationId={conversationId ? String(conversationId) : null}
        onBack={() => router.replace("/(customer)/chat")}
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
