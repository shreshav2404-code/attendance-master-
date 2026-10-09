import { CartesianChart, Line, type PointsArray } from "victory-native";
import { Platform, Text, View } from "react-native";

import { EmptyState } from "@/components/shared/EmptyState";
import { COLORS } from "@/lib/constants";
import type { TrendPoint } from "@/types";

interface TrendChartProps {
  data: TrendPoint[];
}

interface ChartDatum extends Record<string, number | string> {
  week: number;
  label: string;
  physical: number;
  official: number;
  projected: number;
}

export const TrendChart = ({ data }: TrendChartProps) => {
  if (data.length === 0) {
    return (
      <EmptyState
        title="Trend chart waiting for data"
        description="Start logging attendance to unlock weekly Physical, Official OD, and Projected trend lines."
      />
    );
  }

  // victory-native draws with Skia, which needs CanvasKit loaded first on web.
  // The web build is only used for previews, so show the latest values instead
  // of crashing the whole dashboard.
  if (Platform.OS === "web") {
    const latest = data[data.length - 1];

    return (
      <EmptyState
        title="Weekly trend (phone only)"
        description={`Latest week: physical ${latest?.physical ?? 0}%, with OD ${latest?.official ?? 0}%, projected ${latest?.projected ?? 0}%. The chart itself draws in the phone app.`}
      />
    );
  }

  const chartData: ChartDatum[] = data.map((item) => ({ ...item }));

  return (
    <View className="rounded-[28px] border border-white/10 bg-white/5 p-4">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-inter-bold text-lg text-white">Weekly trend</Text>
        <View className="flex-row gap-3">
          <Text className="font-inter text-xs text-amber-400">Physical</Text>
          <Text className="font-inter text-xs text-emerald-400">+OD</Text>
          <Text className="font-inter text-xs text-violet-400">Projected</Text>
        </View>
      </View>

      <View className="relative h-64 overflow-hidden rounded-3xl bg-black/15 p-2">
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            top: "27%",
            borderTopColor: `${COLORS.danger}88`,
            borderTopWidth: 1,
            borderStyle: "dashed",
            zIndex: 1,
          }}
        />
        <CartesianChart<ChartDatum, "week", "physical" | "official" | "projected">
          data={chartData}
          xKey="week"
          yKeys={["physical", "official", "projected"]}
          padding={{ left: 10, right: 10, top: 16, bottom: 16 }}
        >
          {({ points }) => {
            const linePoints = points as {
              physical: PointsArray;
              official: PointsArray;
              projected: PointsArray;
            };

            return (
              <>
              <Line
                points={linePoints.physical}
                color="#f59e0b"
                strokeWidth={3}
                animate={{ type: "timing", duration: 500 }}
              />
              <Line
                points={linePoints.official}
                color="#10b981"
                strokeWidth={3}
                animate={{ type: "timing", duration: 650 }}
              />
              <Line
                points={linePoints.projected}
                color="#8b5cf6"
                strokeWidth={3}
                animate={{ type: "timing", duration: 800 }}
              />
              </>
            );
          }}
        </CartesianChart>
      </View>
    </View>
  );
};
