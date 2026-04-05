import type {
  ExamWeekSettings,
  HourSlot,
  NotificationSettings,
  WorkingDay,
} from "@/types";

export const APP_NAME = "AttendX";

export const COLORS = {
  primary: "#0f2d55",
  secondary: "#1a5fa8",
  success: "#059669",
  warning: "#f59e0b",
  danger: "#dc2626",
  exact: "#0369a1",
  projected: "#7c3aed",
  background: "#0a0f1e",
  surface: "#111827",
  border: "#1f2937",
  surfaceAlt: "#172033",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  white: "#ffffff",
} as const;

export const STORAGE_KEYS = {
  student: "attendx.student",
  subjects: "attendx.subjects",
  hourSlots: "attendx.hourslots",
  timetable: "attendx.timetable",
  dailyLogs: "attendx.daily_logs",
  odEvents: "attendx.od_events",
  onboarded: "attendx.onboarded",
} as const;

export const WORKING_DAYS: WorkingDay[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

export const DEFAULT_WORKING_DAYS: WorkingDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export const SUBJECT_COLOR_PALETTE = [
  "#1a5fa8",
  "#7c3aed",
  "#059669",
  "#f59e0b",
  "#dc2626",
  "#0891b2",
  "#d97706",
  "#9333ea",
];

export const DEFAULT_HOUR_SLOTS: HourSlot[] = [
  { hour: 1, startTime: "08:50", endTime: "09:45", isBreak: false, isLunch: false },
  { hour: 2, startTime: "09:45", endTime: "10:40", isBreak: false, isLunch: false },
  { hour: 3, startTime: "10:55", endTime: "11:50", isBreak: false, isLunch: false },
  { hour: 4, startTime: "11:50", endTime: "12:45", isBreak: false, isLunch: false },
  { hour: 5, startTime: "13:30", endTime: "14:25", isBreak: false, isLunch: false },
  { hour: 6, startTime: "14:25", endTime: "15:20", isBreak: false, isLunch: false },
  { hour: 7, startTime: "15:35", endTime: "16:30", isBreak: false, isLunch: false },
  { hour: 8, startTime: "16:30", endTime: "17:25", isBreak: false, isLunch: false },
];

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailyReminderEnabled: true,
  dailyReminderTime: "20:30",
  lowAttendanceAlertsEnabled: true,
  odReminderEnabled: true,
  lowAttendanceThreshold: 75,
};

export const DEFAULT_EXAM_WEEK_SETTINGS: ExamWeekSettings = {
  enabled: false,
};

export const APP_COPY = {
  tagline: "Track smarter, attend better",
  emptySubjects: "Add your first subject to start seeing live attendance math.",
  emptyODEvents: "Track seminars, hackathons, sports days, and every OD request here.",
  emptyLogs: "Mark today's classes to unlock summaries, trends, and skip predictions.",
} as const;
