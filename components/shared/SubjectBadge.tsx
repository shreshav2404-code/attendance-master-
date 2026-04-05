import { Text, View } from "react-native";

interface SubjectBadgeProps {
  code: string;
  label?: string;
  color: string;
}

export const SubjectBadge = ({ code, label, color }: SubjectBadgeProps) => (
  <View
    className="rounded-full px-3 py-2"
    style={{ backgroundColor: `${color}25`, borderColor: `${color}55`, borderWidth: 1 }}
  >
    <Text className="font-inter-semibold text-xs" style={{ color }}>
      {code}
    </Text>
    {label ? <Text className="font-inter text-[11px] text-white/75">{label}</Text> : null}
  </View>
);
