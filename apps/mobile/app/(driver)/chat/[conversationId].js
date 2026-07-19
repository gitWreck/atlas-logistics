import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import ChatThread from "../../../components/chat/ChatThread";
import { useTheme } from "../../../contexts/ThemeContext";

export default function DriverChatThreadPage() {
  const { conversationId } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();

  const handleBack = () => {
    if (router.canGoBack?.()) router.back();
    else router.replace("/(driver)/(tabs)/messages");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.dashboardBg }]}>
      <ChatThread
        conversationId={String(conversationId || "")}
        onBack={handleBack}
        showSenderProfilePhotos
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
