import { Text, View } from "react-native";
import { Button } from "react-native-paper";

interface DailySummaryBarProps {
  present: number;
  absent: number;
  suspended: number;
  od: number;
  contribution: number;
  readOnly?: boolean;
  onSave: () => void;
}

export const DailySummaryBar = ({
  present,
  absent,
  suspended,
  od,
  contribution,
  readOnly,
  onSave,
}: DailySummaryBarProps) => (
  <View className="rounded-[28px] border border-white/10 bg-surface p-4">
    <Text className="font-inter-medium text-sm text-white/70">
      {present} present · {absent} absent · {suspended} suspended · {od} OD
    </Text>
    <View className="mt-3 flex-row items-center justify-between gap-4">
      <Text className="flex-1 font-inter-bold text-lg text-white">
        Today adds {contribution.toFixed(2)}% to tracked hours
      </Text>
      <Button mode="contained-tonal" disabled={readOnly} onPress={onSave}>
        {readOnly ? "Saved" : "Save day"}
      </Button>
    </View>
  </View>
);
