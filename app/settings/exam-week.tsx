import { View } from "react-native";

import { ExamWeekToggle } from "@/components/settings/ExamWeekToggle";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { useDailyLog } from "@/hooks/useDailyLog";
import { useStudent } from "@/hooks/useStudent";
import { useTimetable } from "@/hooks/useTimetable";
import { useToast } from "@/hooks/useToast";
import { buildODTemplateFromTimetable } from "@/lib/calculations";
import { triggerTapHaptic } from "@/lib/haptics";
import { generateId, getTodayKey, isValidDateKey } from "@/lib/utils";
import type { DailyLog } from "@/types";

const EXAM_WEEK_NOTE = "Exam week suspension";

export default function ExamWeekSettingsScreen() {
  const { examWeek, setExamWeek, workingDays, workingDateOverrides } = useStudent();
  const { timetable } = useTimetable();
  const { dailyLogs, setDailyLogs } = useDailyLog();
  const toast = useToast();

  return (
    <SettingsPage
      page="exam-week"
      title="Exam week"
      description="Turn this on to mark every timetable class in the date range as suspended, so exam days don't count as absences."
      toast={toast}
    >
      <View className="mt-6">
        <ExamWeekToggle
          value={examWeek}
          onChange={(nextValue) => {
            const switchToggled = nextValue.enabled !== examWeek.enabled;
            void setExamWeek(nextValue);

            // Date fields call this on every keystroke, so only act on a
            // complete, valid range. Upcoming exam-week suspensions are
            // rebuilt each time (and dropped when switched off); past ones
            // stay as a record.
            const today = getTodayKey();
            const isUpcomingExamLog = (log: DailyLog) =>
              log.note === EXAM_WEEK_NOTE &&
              log.status === "suspended" &&
              log.date >= today;
            const rangeIsValid =
              Boolean(nextValue.startDate && nextValue.endDate) &&
              isValidDateKey(nextValue.startDate ?? "") &&
              isValidDateKey(nextValue.endDate ?? "") &&
              (nextValue.endDate ?? "") >= (nextValue.startDate ?? "");

            if (!nextValue.enabled || rangeIsValid) {
              const keptLogs = dailyLogs.filter((log) => !isUpcomingExamLog(log));
              const suspendedLogs =
                nextValue.enabled && nextValue.startDate && nextValue.endDate
                  ? buildODTemplateFromTimetable({
                      timetable,
                      startDate: nextValue.startDate,
                      endDate: nextValue.endDate,
                      note: EXAM_WEEK_NOTE,
                      workingDays,
                      workingDateOverrides,
                    })
                      .logs.filter((log) => log.date >= today)
                      .map((log) => ({
                        ...log,
                        id: generateId("suspended"),
                        status: "suspended" as const,
                        odEventId: undefined,
                      }))
                  : [];

              if (suspendedLogs.length > 0 || keptLogs.length !== dailyLogs.length) {
                void setDailyLogs([...keptLogs, ...suspendedLogs]);
              }
            }

            if (switchToggled) {
              void triggerTapHaptic();
              void toast.success(nextValue.enabled ? "Exam week on" : "Exam week off");
            }
          }}
        />
      </View>
    </SettingsPage>
  );
}
