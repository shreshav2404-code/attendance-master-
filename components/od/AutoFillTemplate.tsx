import { useState } from "react";
import { View } from "react-native";
import { Button, TextInput } from "react-native-paper";

interface AutoFillTemplateProps {
  onApply: (startDate: string, endDate: string) => void;
}

export const AutoFillTemplate = ({ onApply }: AutoFillTemplateProps) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  return (
    <View className="rounded-[24px] border border-dashed border-white/15 bg-black/10 p-4">
      <TextInput
        mode="outlined"
        label="Start Date (YYYY-MM-DD)"
        value={startDate}
        onChangeText={setStartDate}
        className="mb-3 bg-transparent"
      />
      <TextInput
        mode="outlined"
        label="End Date (YYYY-MM-DD)"
        value={endDate}
        onChangeText={setEndDate}
        className="mb-4 bg-transparent"
      />
      <Button
        mode="contained-tonal"
        onPress={() => onApply(startDate, endDate || startDate)}
      >
        Auto-fill from timetable
      </Button>
    </View>
  );
};
