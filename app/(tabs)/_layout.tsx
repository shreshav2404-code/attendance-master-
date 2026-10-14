import { Tabs } from "expo-router";
import { CalendarDays, ClipboardList, House, Settings2 } from "lucide-react-native";

const iconProps = {
  size: 20,
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // More room above the keyboard for the text box being typed in.
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: "#f8fafc",
        tabBarInactiveTintColor: "rgba(248,250,252,0.45)",
        tabBarStyle: {
          backgroundColor: "rgba(17,24,39,0.96)",
          borderTopColor: "rgba(255,255,255,0.08)",
          paddingTop: 10,
          height: 82,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <House {...iconProps} color={color} />,
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ color }) => <CalendarDays {...iconProps} color={color} />,
        }}
      />
      <Tabs.Screen
        name="od"
        options={{
          title: "OD",
          tabBarIcon: ({ color }) => <ClipboardList {...iconProps} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Settings2 {...iconProps} color={color} />,
        }}
      />
    </Tabs>
  );
}
