import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { GradientCard } from "@/components/shared/GradientCard";
import { triggerTapHaptic } from "@/lib/haptics";
import type {
  OverallAttendanceMetrics,
  SkipSimulationResult,
} from "@/types";

interface SkipCalculatorProps {
  simulations: SkipSimulationResult[];
  overall: OverallAttendanceMetrics;
}

export const SkipCalculator = ({
  simulations,
  overall,
}: SkipCalculatorProps) => {
  const [selection, setSelection] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSelection(
      Object.fromEntries(
        simulations.map((simulation) => [simulation.subjectId, true]),
      ),
    );
  }, [simulations]);

  if (simulations.length === 0) {
    return null;
  }

  const skippedHours = simulations.reduce((sum, simulation) => {
    const shouldAttend = selection[simulation.subjectId] ?? true;
    return shouldAttend ? sum : sum + simulation.hoursToday;
  }, 0);
  const numerator = overall.AH + overall.DL + overall.pendingOD;
  const projectedIfSkipped =
    overall.TH + skippedHours === 0
      ? 0
      : (numerator / (overall.TH + skippedHours)) * 100;

  return (
    <GradientCard
      className="mt-5"
      colors={["#172554", "#1e3a8a", "#581c87"]}
      contentClassName="gap-4"
    >
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="font-inter-bold text-lg text-white">
            What if I skip today?
          </Text>
          <Text className="mt-1 font-inter text-sm text-white/60">
            Toggle subjects off to simulate skipping them.
          </Text>
        </View>
        <View className="rounded-full bg-black/20 px-3 py-2">
          <Text className="font-inter-bold text-sm text-white">
            {projectedIfSkipped.toFixed(2)}%
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {simulations.map((simulation) => {
          const shouldAttend = selection[simulation.subjectId] ?? true;

          return (
            <Pressable
              key={simulation.subjectId}
              className="rounded-full border px-4 py-3"
              style={{
                backgroundColor: shouldAttend
                  ? "rgba(16,185,129,0.18)"
                  : "rgba(220,38,38,0.18)",
                borderColor: shouldAttend
                  ? "rgba(16,185,129,0.45)"
                  : "rgba(220,38,38,0.45)",
              }}
              onPress={() => {
                void triggerTapHaptic();
                setSelection((currentSelection) => ({
                  ...currentSelection,
                  [simulation.subjectId]: !shouldAttend,
                }));
              }}
            >
              <Text className="font-inter-semibold text-sm text-white">
                {simulation.subjectName}
              </Text>
              <Text className="mt-1 font-inter text-xs text-white/70">
                {shouldAttend
                  ? `Attend ${simulation.hoursToday}h`
                  : `Skip → ${simulation.projectedIfSkipped.toFixed(2)}%`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </GradientCard>
  );
};
