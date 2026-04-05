import { View } from "react-native";
import { Switch, TextInput } from "react-native-paper";

import type { ExamWeekSettings } from "@/types";

interface ExamWeekToggleProps {
  value: ExamWeekSettings;
  onChange: (nextValue: ExamWeekSettings) => void;
}

export const ExamWeekToggle = ({ value, onChange }: ExamWeekToggleProps) => (
  <View className="rounded-[28px] border border-white/10 bg-white/5 p-4">
    <View className="flex-row items-center justify-end">
      <Switch
        value={value.enabled}
        onValueChange={(enabled) => onChange({ ...value, enabled })}
      />
    </View>
    <TextInput
      mode="outlined"
      label="Start date"
      value={value.startDate ?? ""}
      onChangeText={(startDate) => onChange({ ...value, startDate })}
      className="mt-3 bg-transparent"
    />
    <TextInput
      mode="outlined"
      label="End date"
      value={value.endDate ?? ""}
      onChangeText={(endDate) => onChange({ ...value, endDate })}
      className="mt-3 bg-transparent"
    />
  </View>
);
