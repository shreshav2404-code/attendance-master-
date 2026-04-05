import { Pressable, Text, View } from "react-native";

import { SubjectBadge } from "@/components/shared/SubjectBadge";
import { getHourSlotLabel } from "@/lib/utils";
import type {
  AttendanceStatus,
  HourSlot,
  Subject,
  TimetableSlot,
} from "@/types";

interface ClassCardProps {
  slot: TimetableSlot;
  subject: Subject;
  hourSlot?: HourSlot;
  status?: AttendanceStatus;
  linkedEventName?: string;
  readOnly?: boolean;
  onStatusChange: (status: AttendanceStatus) => void;
  onPickOD: () => void;
}

const statusStyles: Record<
  AttendanceStatus,
  { backgroundColor: string; borderColor: string }
> = {
  present: {
    backgroundColor: "rgba(16,185,129,0.16)",
    borderColor: "rgba(16,185,129,0.45)",
  },
  absent: {
    backgroundColor: "rgba(220,38,38,0.16)",
    borderColor: "rgba(220,38,38,0.45)",
  },
  suspended: {
    backgroundColor: "rgba(148,163,184,0.12)",
    borderColor: "rgba(148,163,184,0.35)",
  },
  od: {
    backgroundColor: "rgba(124,58,237,0.16)",
    borderColor: "rgba(124,58,237,0.45)",
  },
};

const actionButtons: {
  label: string;
  status: AttendanceStatus;
}[] = [
  { label: "PRESENT", status: "present" },
  { label: "ABSENT", status: "absent" },
  { label: "SUSPENDED", status: "suspended" },
  { label: "OD", status: "od" },
];

export const ClassCard = ({
  slot,
  subject,
  hourSlot,
  status,
  linkedEventName,
  readOnly,
  onStatusChange,
  onPickOD,
}: ClassCardProps) => (
  <View
    className="rounded-[28px] border p-4"
    style={
      status
        ? statusStyles[status]
        : {
            backgroundColor: "rgba(255,255,255,0.04)",
            borderColor: "rgba(255,255,255,0.08)",
          }
    }
  >
    <View className="flex-row items-start justify-between">
      <View className="flex-1 pr-4">
        <Text className="font-inter-bold text-lg text-white">{subject.name}</Text>
        <Text className="mt-1 font-inter text-sm text-white/60">
          Hour {slot.hour}
          {slot.isDouble || slot.isLab ? ` · ${slot.isLab ? "Lab" : "Double"} · 2h` : ""}
        </Text>
        {hourSlot ? (
          <Text className="mt-1 font-inter text-xs uppercase tracking-[0.9px] text-white/45">
            {getHourSlotLabel(hourSlot)}
          </Text>
        ) : null}
      </View>
      <SubjectBadge code={subject.shortName} color={subject.color} />
    </View>

    {linkedEventName ? (
      <Text className="mt-3 font-inter text-sm text-violet-300">
        Linked to {linkedEventName}
      </Text>
    ) : null}

    <View className="mt-4 flex-row flex-wrap gap-2">
      {actionButtons.map((button) => {
        const active = status === button.status;

        return (
          <Pressable
            key={button.status}
            disabled={readOnly}
            className="rounded-full border px-4 py-3"
            style={{
              backgroundColor: active
                ? statusStyles[button.status].backgroundColor
                : "rgba(255,255,255,0.03)",
              borderColor: active
                ? statusStyles[button.status].borderColor
                : "rgba(255,255,255,0.08)",
              opacity: readOnly ? 0.7 : 1,
            }}
            onPress={() => {
              if (button.status === "od") {
                onPickOD();
              } else {
                onStatusChange(button.status);
              }
            }}
          >
            <Text className="font-inter-semibold text-xs text-white">
              {button.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);
