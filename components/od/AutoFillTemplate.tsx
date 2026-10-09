import { Text, View } from "react-native";
import { Button } from "react-native-paper";

interface AutoFillTemplateProps {
  onApply: () => void;
  message?: string;
}

export const AutoFillTemplate = ({ onApply, message }: AutoFillTemplateProps) => (
  <View className="rounded-[24px] border border-dashed border-white/15 bg-black/10 p-4">
    <Text className="mb-3 font-inter text-sm leading-6 text-white/60">
      Uses the Date and End date above to switch on every class in your timetable for that range.
    </Text>
    <Button mode="contained-tonal" onPress={onApply}>
      Auto-fill from timetable
    </Button>
    {message ? (
      <Text className="mt-3 font-inter text-sm text-amber-200">{message}</Text>
    ) : null}
  </View>
);
