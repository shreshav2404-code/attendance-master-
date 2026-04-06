export type WorkingDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
export type WorkingDateOverrides = Record<string, boolean>;

export type AttendanceStatus = "present" | "absent" | "suspended" | "od";

export type ODEventType =
  | "hackathon"
  | "seminar"
  | "club"
  | "sports"
  | "cultural"
  | "other";

export interface Student {
  id: string;
  name: string;
  rollNo: string;
  batch: string;
  department: string;
  collegeName: string;
  term: string;
  targetPercentage: number;
  createdAt: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  shortName: string;
  isLab: boolean;
  color: string;
  icon?: string;
}

export interface HourSlot {
  hour: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  isLunch: boolean;
}

export interface TimetableSlot {
  id: string;
  day: WorkingDay;
  hour: number;
  subjectId: string;
  isDouble: boolean;
  isLab: boolean;
}

export interface DailyLog {
  id: string;
  date: string;
  subjectId: string;
  status: AttendanceStatus;
  hours: number;
  odEventId?: string;
  note?: string;
  createdAt: string;
}

export interface ODEvent {
  id: string;
  name: string;
  date: string;
  endDate?: string;
  reason: string;
  type: ODEventType;
  subjects: ODSubject[];
  createdAt: string;
}

export interface ODSubject {
  subjectId: string;
  hours: number;
  registered: boolean;
  registeredAt?: string;
}

export interface AttendanceSummary {
  subjectId: string;
  TH: number;
  AH: number;
  DL: number;
  pendingOD: number;
  AH_DL: number;
  AH_allOD: number;
  percentBefore: number;
  percentAfterDL: number;
  percentProjected: number;
  hoursNeeded: number;
  canRecover: boolean;
  isSafe: boolean;
  status: "danger" | "warning" | "exact" | "safe" | "excellent";
}

export interface SyncReport {
  subjectId: string;
  myTH: number;
  officialTH: number;
  myAH: number;
  officialAH: number;
  officialDL: number;
  thDiff: number;
  ahDiff: number;
  newlyRegisteredOD: number;
}

export interface NotificationSettings {
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  lowAttendanceAlertsEnabled: boolean;
  odReminderEnabled: boolean;
  lowAttendanceThreshold: number;
}

export interface ExamWeekSettings {
  enabled: boolean;
  startDate?: string;
  endDate?: string;
}

export interface StudentBundle {
  student: Student | null;
  notificationSettings: NotificationSettings;
  examWeek: ExamWeekSettings;
  lastSyncedAt?: string;
  officialSyncSnapshotBySubject?: OfficialSyncSnapshotBySubject;
}

export interface HourSlotBundle {
  hourSlots: HourSlot[];
  workingDays: WorkingDay[];
  workingDateOverrides: WorkingDateOverrides;
}

export interface OverallAttendanceMetrics {
  TH: number;
  AH: number;
  DL: number;
  pendingOD: number;
  percentBefore: number;
  percentAfterDL: number;
  percentProjected: number;
  targetPercentage: number;
}

export interface TrendPoint {
  week: number;
  label: string;
  physical: number;
  official: number;
  projected: number;
}

export interface SkipSimulationResult {
  subjectId: string;
  subjectName: string;
  currentProjected: number;
  projectedIfSkipped: number;
  diff: number;
  hoursToday: number;
}

export interface OfficialSubjectInput {
  subjectId: string;
  officialTH: number;
  officialAH: number;
  officialDL: number;
}

export interface OfficialSyncSnapshot {
  TH: number;
  AH: number;
  DL: number;
  syncedAt: string;
}

export type OfficialSyncSnapshotBySubject = Record<string, OfficialSyncSnapshot>;

export interface OfficialAttendanceStudentInfo {
  name?: string;
  rollNo?: string;
  registrationNo?: string;
  batch?: string;
  department?: string;
  term?: string;
  dateRange?: string;
}

export interface OfficialAttendanceSubjectRow {
  serialNo: string;
  courseName: string;
  subjectName: string;
  subjectCode: string;
  TH: number;
  AH: number;
  DL: number;
  AHDL: number;
  AHPercent: number;
  AHDLPercent: number;
}

export interface OfficialAttendanceReport {
  student: OfficialAttendanceStudentInfo;
  rows: OfficialAttendanceSubjectRow[];
}

export interface OfficialImportMatch {
  row: OfficialAttendanceSubjectRow;
  subjectId: string;
  matchType: "code" | "name" | "created";
}

export interface OfficialImportPlan {
  officialInputs: OfficialSubjectInput[];
  createdSubjects: Subject[];
  matches: OfficialImportMatch[];
  skippedRows: OfficialAttendanceSubjectRow[];
}

export interface PendingODUploadRow {
  rowNumber: number;
  date: string;
  subjectCode?: string;
  subjectName?: string;
  hours: number;
  reason: string;
}

export interface PendingODSkippedRow {
  rowNumber: number;
  reason: string;
}

export interface PendingODUploadParseResult {
  rows: PendingODUploadRow[];
  skippedRows: PendingODSkippedRow[];
}

export interface PendingODImportMatch {
  row: PendingODUploadRow;
  subjectId: string;
  matchType: "code" | "name" | "created";
}

export interface PendingODImportPlan {
  createdSubjects: Subject[];
  matches: PendingODImportMatch[];
  odEvents: ODEvent[];
  logs: DailyLog[];
  skippedRows: PendingODSkippedRow[];
}

export interface SyncApplicationResult {
  reports: SyncReport[];
  odEvents: ODEvent[];
  lastSyncedAt: string;
  officialSyncSnapshotBySubject: OfficialSyncSnapshotBySubject;
}

export interface ODTemplateResult {
  subjects: ODSubject[];
  logs: DailyLog[];
}

export interface AppBackupPayload {
  studentBundle: StudentBundle;
  hourSlotBundle: HourSlotBundle;
  subjects: Subject[];
  timetable: TimetableSlot[];
  dailyLogs: DailyLog[];
  odEvents: ODEvent[];
  onboarded: boolean;
}
