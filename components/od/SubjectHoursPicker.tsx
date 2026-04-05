import { Minus, Plus } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { Switch } from "react-native-paper";

import type { Subject } from "@/types";

export interface SelectedODSubjectState {
  enabled: boolean;
  hours: number;
}

interface SubjectHoursPickerProps {
  subjects: Subject[];
  value: Record<string, SelectedODSubjectState>;
  onChange: (value: Record<string, SelectedODSubjectState>) => void;
}

export const SubjectHoursPicker = ({
  subjects,
  value,
  onChange,
}: SubjectHoursPickerProps) => (
  <View className="gap-3">
    {subjects.map((subject) => {
      const subjectValue = value[subject.id] ?? {
        enabled: false,
        hours: subject.isLab ? 2 : 1,
      };

      return (
        <View
          key={subject.id}
          className="rounded-[22px] border border-white/10 bg-white/5 p-4"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="font-inter-semibold text-base text-white">
                {subject.name}
              </Text>
              <Text className="mt-1 font-inter text-sm text-white/55">
                {subject.code}
              </Text>
            </View>
            <Switch
              value={subjectValue.enabled}
              onValueChange={(enabled) =>
                onChange({
                  ...value,
                  [subject.id]: {
                    ...subjectValue,
                    enabled,
                  },
                })
              }
            />
          </View>

          {subjectValue.enabled ? (
            <View className="mt-4 flex-row items-center justify-between">
              <Text className="font-inter text-sm text-white/60">Hours</Text>
              <View className="flex-row items-center gap-3">
                <Pressable
                  className="rounded-full border border-white/10 bg-black/20 p-2"
                  onPress={() =>
                    onChange({
                      ...value,
                      [subject.id]: {
                        ...subjectValue,
                        hours: Math.max(1, subjectValue.hours - 1),
                      },
                    })
                  }
                >
                  <Minus color="#f8fafc" size={16} />
                </Pressable>
                <Text className="font-inter-bold text-lg text-white">
                  {subjectValue.hours}
                </Text>
                <Pressable
                  className="rounded-full border border-white/10 bg-black/20 p-2"
                  onPress={() =>
                    onChange({
                      ...value,
                      [subject.id]: {
                        ...subjectValue,
                        hours: subjectValue.hours + 1,
                      },
                    })
                  }
                >
                  <Plus color="#f8fafc" size={16} />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      );
    })}
  </View>
);
