import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { Button } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getSlotLogId,
  isPendingODAdjustment,
  resolveClassHours,
} from "@/lib/calculations";
import { triggerSuccessHaptic, triggerTapHaptic } from "@/lib/haptics";
import {
  formatDateLabel,
  getTodayKey,
  getWorkingDayForDate,
  isDateWorking,
} from "@/lib/utils";
import { useDailyLog } from "@/hooks/useDailyLog";
import { useODEvents } from "@/hooks/useODEvents";
import { useStudent } from "@/hooks/useStudent";
import { useSubjects } from "@/hooks/useSubjects";
import { useTimetable } from "@/hooks/useTimetable";
import { ClassCard } from "@/components/today/ClassCard";
import { DailySummaryBar } from "@/components/today/DailySummaryBar";
import { ODPicker } from "@/components/today/ODPicker";
import { Toast } from "@/components/shared/Toast";
import type { AttendanceStatus, ODEvent } from "@/types";

export default function TodayScreen() {
  const todayKey = getTodayKey();
  const { hourSlots, examWeek, workingDays, workingDateOverrides } = useStudent();
  const { subjects } = useSubjects();
  const { timetable } = useTimetable();
  const { logsForDate, setLogsForDate } = useDailyLog(todayKey);
  const { odEvents } = useODEvents();
  const [statusBySlot, setStatusBySlot] = useState<Record<string, AttendanceStatus>>({});
  const [eventBySlot, setEventBySlot] = useState<Record<string, string | undefined>>({});
  // Id of the stored log each card was filled from; saving replaces exactly these.
  const [loggedIdBySlot, setLoggedIdBySlot] = useState<Record<string, string>>({});
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isTodayWorkingDay = useMemo(
    () =>
      isDateWorking({
        date: todayKey,
        workingDays,
        workingDateOverrides,
      }),
    [todayKey, workingDateOverrides, workingDays],
  );
  const todayWorkingDay = useMemo(() => getWorkingDayForDate(todayKey), [todayKey]);
  const todaySlots = useMemo(
    () =>
      isTodayWorkingDay
        ? timetable
            .filter((slot) => slot.day === todayWorkingDay)
            .sort((left, right) => left.hour - right.hour)
            .filter((slot) => subjects.some((subject) => subject.id === slot.subjectId))
        : [],
    [isTodayWorkingDay, subjects, timetable, todayWorkingDay],
  );
  const hourSlotMap = useMemo(
    () => new Map(hourSlots.map((slot) => [slot.hour, slot])),
    [hourSlots],
  );
  // Pending-OD adjustments are extra hours, not classes: they never fill a card,
  // lock the day, or get overwritten by Save.
  const adjustmentEventIds = useMemo(
    () => new Set(odEvents.filter(isPendingODAdjustment).map((event) => event.id)),
    [odEvents],
  );
  const classLogsForDate = useMemo(
    () =>
      logsForDate.filter(
        (log) => !log.odEventId || !adjustmentEventIds.has(log.odEventId),
      ),
    [adjustmentEventIds, logsForDate],
  );
  const daySaved = todaySlots.some((slot) =>
    classLogsForDate.some(
      (log) =>
        log.id === getSlotLogId(todayKey, slot.id) && log.subjectId === slot.subjectId,
    ),
  );
  const readOnly = daySaved && !editMode;
  // Only class events that cover today can be linked; linking an unrelated event
  // would make deleting that event also delete today's attendance.
  const odEventsForToday = useMemo(
    () =>
      odEvents.filter(
        (event) =>
          !adjustmentEventIds.has(event.id) &&
          todayKey >= event.date &&
          todayKey <= (event.endDate ?? event.date),
      ),
    [adjustmentEventIds, odEvents, todayKey],
  );

  const setSlotStatus = (
    slotId: string,
    status: AttendanceStatus,
    odEventId?: string,
  ) => {
    setStatusBySlot((currentValue) => ({
      ...currentValue,
      [slotId]: status,
    }));
    setEventBySlot((currentValue) => ({
      ...currentValue,
      [slotId]: status === "od" ? odEventId : undefined,
    }));
  };

  useEffect(() => {
    const slotLogIds = new Set(todaySlots.map((slot) => getSlotLogId(todayKey, slot.id)));
    // Logs without a class-period id (older OD events, exam week) fill the
    // remaining cards of their subject in order.
    const queues = new Map(
      subjects.map((subject) => [
        subject.id,
        classLogsForDate.filter(
          (log) => log.subjectId === subject.id && !slotLogIds.has(log.id),
        ),
      ]),
    );
    const nextStatusBySlot: Record<string, AttendanceStatus> = {};
    const nextEventBySlot: Record<string, string | undefined> = {};
    const nextLoggedIdBySlot: Record<string, string> = {};

    todaySlots.forEach((slot) => {
      const log =
        // A cell keeps its id when its subject changes, so match the subject too.
        classLogsForDate.find(
          (item) =>
            item.id === getSlotLogId(todayKey, slot.id) &&
            item.subjectId === slot.subjectId,
        ) ??
        queues.get(slot.subjectId)?.shift();

      if (log) {
        nextStatusBySlot[slot.id] = log.status;
        nextEventBySlot[slot.id] = log.odEventId;
        nextLoggedIdBySlot[slot.id] = log.id;
      }
    });

    if (
      examWeek.enabled &&
      examWeek.startDate &&
      examWeek.endDate &&
      todayKey >= examWeek.startDate &&
      todayKey <= examWeek.endDate
    ) {
      todaySlots.forEach((slot) => {
        nextStatusBySlot[slot.id] = "suspended";
      });
    }

    setStatusBySlot(nextStatusBySlot);
    setEventBySlot(nextEventBySlot);
    setLoggedIdBySlot(nextLoggedIdBySlot);
  }, [classLogsForDate, examWeek, subjects, todayKey, todaySlots]);

  const handleODSelect = (event: ODEvent) => {
    if (!pickerSlotId) {
      return;
    }

    void triggerTapHaptic();
    setSlotStatus(pickerSlotId, "od", event.id);
  };

  const markedHours = todaySlots.reduce(
    (sum, slot) => sum + (statusBySlot[slot.id] ? resolveClassHours(slot) : 0),
    0,
  );
  const attendedHours = todaySlots.reduce((sum, slot) => {
    const status = statusBySlot[slot.id];

    return status === "present" || status === "od"
      ? sum + resolveClassHours(slot)
      : sum;
  }, 0);
  const trackedHours = todaySlots.reduce((sum, slot) => {
    const status = statusBySlot[slot.id];

    return status && status !== "suspended" ? sum + resolveClassHours(slot) : sum;
  }, 0);
  const contribution = trackedHours === 0 ? 0 : (attendedHours / trackedHours) * 100;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Toast visible={toastVisible} message="Today's attendance saved" />
      <ODPicker
        visible={pickerSlotId !== null}
        events={odEventsForToday}
        onClose={() => setPickerSlotId(null)}
        onSelect={handleODSelect}
        onSelectWithoutEvent={() => {
          if (!pickerSlotId) {
            return;
          }

          void triggerTapHaptic();
          setSlotStatus(pickerSlotId, "od");
        }}
      />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 600);
            }}
          />
        }
        contentContainerStyle={{ padding: 20, paddingBottom: 30 }}
      >
        <View className="mb-5 flex-row items-start justify-between">
          <View>
            <Text className="font-inter text-sm uppercase tracking-[1.2px] text-white/50">
              {formatDateLabel(todayKey, "EEEE")}
            </Text>
            <Text className="mt-2 font-inter-bold text-3xl text-white">
              {formatDateLabel(todayKey, "dd MMM yyyy")}
            </Text>
            <Text className="mt-2 font-inter text-base text-white/60">
              {todaySlots.length} class slot{todaySlots.length === 1 ? "" : "s"} today
            </Text>
          </View>
          {daySaved ? (
            <Button
              mode="outlined"
              onPress={() => {
                void triggerTapHaptic();
                setEditMode((currentValue) => !currentValue);
              }}
            >
              {editMode ? "Cancel edit" : "Edit"}
            </Button>
          ) : null}
        </View>

        <View className="gap-4">
          {todaySlots.map((slot) => {
            const subject = subjects.find((item) => item.id === slot.subjectId);

            if (!subject) {
              return null;
            }

            return (
              <ClassCard
                key={slot.id}
                slot={slot}
                subject={subject}
                hourSlot={hourSlotMap.get(slot.hour)}
                status={statusBySlot[slot.id]}
                linkedEventName={odEvents.find((event) => event.id === eventBySlot[slot.id])?.name}
                readOnly={readOnly}
                onStatusChange={(status) => {
                  void triggerTapHaptic();
                  setSlotStatus(slot.id, status);
                }}
                onPickOD={() => {
                  void triggerTapHaptic();

                  if (odEventsForToday.length === 0) {
                    setSlotStatus(slot.id, "od");
                    return;
                  }

                  setPickerSlotId(slot.id);
                }}
              />
            );
          })}
        </View>

        <View className="mt-6">
          <DailySummaryBar
            present={Object.values(statusBySlot).filter((status) => status === "present").length}
            absent={Object.values(statusBySlot).filter((status) => status === "absent").length}
            suspended={Object.values(statusBySlot).filter((status) => status === "suspended").length}
            od={Object.values(statusBySlot).filter((status) => status === "od").length}
            contribution={contribution}
            readOnly={readOnly}
            onSave={async () => {
              await triggerTapHaptic();
              const createdAt = new Date().toISOString();
              const savedLogs = todaySlots.flatMap((slot) => {
                const status = statusBySlot[slot.id];

                if (!status) {
                  return [];
                }

                return [
                  {
                    id: getSlotLogId(todayKey, slot.id),
                    date: todayKey,
                    subjectId: slot.subjectId,
                    status,
                    hours: resolveClassHours(slot),
                    odEventId: eventBySlot[slot.id],
                    createdAt,
                  },
                ];
              });
              // Replace only what the cards showed; keep everything else for
              // today (pending-OD adjustments, logs for subjects not on today).
              const replacedIds = new Set([
                ...Object.values(loggedIdBySlot),
                ...todaySlots.map((slot) => getSlotLogId(todayKey, slot.id)),
              ]);
              await setLogsForDate(todayKey, [
                ...logsForDate.filter((log) => !replacedIds.has(log.id)),
                ...savedLogs,
              ]);
              setEditMode(false);
              setToastVisible(true);
              await triggerSuccessHaptic();
              setTimeout(() => setToastVisible(false), 1800);
            }}
          />
          <Text className="mt-3 font-inter text-xs text-white/45">
            {markedHours} tracked hour{markedHours === 1 ? "" : "s"} selected for today
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
