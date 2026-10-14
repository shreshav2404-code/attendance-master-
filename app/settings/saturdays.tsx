import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Button, Switch, TextInput } from "react-native-paper";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { useStudent } from "@/hooks/useStudent";
import { useToast } from "@/hooks/useToast";
import { triggerTapHaptic } from "@/lib/haptics";
import { formatDateLabel, getTodayKey } from "@/lib/utils";

export default function SaturdaySettingsScreen() {
  const {
    workingDays,
    workingDateOverrides,
    setWorkingDateOverride,
    removeWorkingDateOverride,
  } = useStudent();
  const toast = useToast();
  const [saturdayDate, setSaturdayDate] = useState(getTodayKey());
  const [saturdayWorking, setSaturdayWorking] = useState(true);
  const saturdayOverrides = useMemo(
    () =>
      Object.entries(workingDateOverrides)
        .filter(([date]) => {
          try {
            return formatDateLabel(date, "EEE") === "Sat";
          } catch {
            return false;
          }
        })
        .sort(([left], [right]) => left.localeCompare(right)),
    [workingDateOverrides],
  );

  useEffect(() => {
    const override = workingDateOverrides[saturdayDate];

    if (override !== undefined) {
      setSaturdayWorking(override);
      return;
    }

    setSaturdayWorking(workingDays.includes("Sat"));
  }, [saturdayDate, workingDateOverrides, workingDays]);

  return (
    <SettingsPage
      page="saturdays"
      title="Flexible Saturdays"
      description="Mark individual Saturdays as a working day or a holiday without changing the weekly timetable."
      toast={toast}
    >
      <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
        <Text className="font-inter-bold text-lg text-white">Set a Saturday</Text>
        <TextInput
          mode="outlined"
          label="Saturday date (YYYY-MM-DD)"
          value={saturdayDate}
          onChangeText={setSaturdayDate}
          style={{ marginTop: 14, backgroundColor: "transparent" }}
        />
        <View className="mt-4 flex-row items-center justify-between">
          <Text className="font-inter text-sm text-white/70">Mark as working day</Text>
          <Switch
            value={saturdayWorking}
            onValueChange={(value) => {
              void triggerTapHaptic();
              setSaturdayWorking(value);
            }}
          />
        </View>
        <View className="mt-4 flex-row flex-wrap gap-3">
          <Button
            mode="contained-tonal"
            onPress={async () => {
              await triggerTapHaptic();

              if (!/^\d{4}-\d{2}-\d{2}$/.test(saturdayDate)) {
                await toast.warn("Enter date as YYYY-MM-DD", 1800);
                return;
              }

              let dayLabel = "";
              try {
                dayLabel = formatDateLabel(saturdayDate, "EEE");
              } catch {
                await toast.warn("Invalid date", 1800);
                return;
              }

              if (dayLabel !== "Sat") {
                await toast.warn("Pick a Saturday date", 1800);
                return;
              }

              await setWorkingDateOverride(saturdayDate, saturdayWorking);
              await toast.success(
                saturdayWorking ? "Saturday marked as working" : "Saturday marked as holiday",
              );
            }}
          >
            Save Saturday override
          </Button>
          <Button
            mode="outlined"
            disabled={workingDateOverrides[saturdayDate] === undefined}
            onPress={async () => {
              await triggerTapHaptic();
              await removeWorkingDateOverride(saturdayDate);
              await toast.success("Saturday override removed");
            }}
          >
            Reset date
          </Button>
        </View>
      </View>

      <View className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
        <Text className="font-inter-bold text-lg text-white">Saved Saturdays</Text>
        {saturdayOverrides.length === 0 ? (
          <Text className="mt-3 font-inter text-sm text-white/45">
            No Saturday overrides yet.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {saturdayOverrides.map(([date, isWorking]) => (
              <View
                key={date}
                className="flex-row items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              >
                <Text className="font-inter text-sm text-white/80">
                  {date} · {isWorking ? "Working" : "Holiday"}
                </Text>
                <Button
                  compact
                  mode="text"
                  onPress={async () => {
                    await triggerTapHaptic();
                    await removeWorkingDateOverride(date);
                  }}
                >
                  Remove
                </Button>
              </View>
            ))}
          </View>
        )}
      </View>
    </SettingsPage>
  );
}
