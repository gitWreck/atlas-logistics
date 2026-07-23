import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets as useSAInsets } from "react-native-safe-area-context";
import { Tabs } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { useTheme } from "../../../contexts/ThemeContext";

export default function StaffTabsLayout() {
  const { colors } = useTheme();
  const insets = useSAInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.inner, { backgroundColor: colors.surface }]}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              borderTopWidth: StyleSheet.hairlineWidth,
              minHeight: 66,
              height: "auto",
              paddingHorizontal: 10,
              paddingBottom: Math.max(insets.bottom, 10),
            },
            tabBarActiveTintColor: "#0f766e",
            tabBarInactiveTintColor: colors.textMuted,
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: "700",
              lineHeight: 14,
              marginTop: 4,
            },
            tabBarItemStyle: {
              paddingVertical: 4,
              paddingHorizontal: 4,
              minHeight: 58,
            },
            tabBarIconStyle: {
              marginBottom: 4,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="messages"
            options={{
              title: "Messages",
              tabBarIcon: ({ color }) => (
                <FontAwesome5 name="envelope" size={20} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: "Profile",
              tabBarIcon: ({ color }) => (
                <FontAwesome5 name="user" size={20} color={color} />
              ),
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
});
