import type { LucideIcon } from "lucide-react-native";
import { Inbox } from "lucide-react-native";
import { Text, View } from "react-native";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export const EmptyState = ({
  title,
  description,
  icon: Icon = Inbox,
}: EmptyStateProps) => (
  <View className="items-center rounded-[28px] border border-white/10 bg-white/5 px-6 py-10">
    <View className="rounded-full bg-white/10 p-4">
      <Icon color="#f8fafc" size={24} />
    </View>
    <Text className="mt-4 font-inter-bold text-lg text-white">{title}</Text>
    <Text className="mt-2 text-center font-inter text-sm leading-6 text-white/60">
      {description}
    </Text>
  </View>
);
