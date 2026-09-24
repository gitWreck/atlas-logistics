import React from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import ChatThread from "../../../components/chat/ChatThread";
import { useTheme } from "../../../contexts/ThemeContext";
import { navigateBackOrFallback } from "../../../components/utilities/navigationPersistence";

export default function CheckerChatThreadScreen() {
  const { conversationId } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ChatThread
        conversationId={conversationId ? String(conversationId) : null}
        onBack={() =>
          navigateBackOrFallback(router, "/(checker)/(tabs)/messages")
        }
        showSenderProfilePhotos
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
