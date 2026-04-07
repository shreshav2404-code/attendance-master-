export interface UserManualSection {
  id: string;
  title: string;
  description: string;
  steps: string[];
  note?: string;
}

export const USER_MANUAL_SECTIONS: UserManualSection[] = [
  {
    id: "setup",
    title: "1. First-Time Setup",
    description:
      "Complete onboarding once so your core profile, subjects, and timetable are saved.",
    steps: [
      "Open AttendX and tap Get Started.",
      "Enter your profile details and target attendance percentage.",
      "Configure hour slots and working days.",
      "Add all subjects and build weekly timetable grid.",
      "Tap Complete setup to enter Dashboard.",
    ],
    note: "If your college has mixed Saturdays, use Flexible Saturday in Settings.",
  },
  {
    id: "daily",
    title: "2. Daily Attendance Flow",
    description:
      "Use the Today tab every day so global TH/AH/DL and percentages stay accurate.",
    steps: [
      "Go to Today tab.",
      "Mark each class as Present, Absent, Suspended, or OD.",
      "Save day log if prompted.",
      "Check Dashboard cards to verify totals changed.",
    ],
    note: "Suspended keeps TH and AH unchanged by design.",
  },
  {
    id: "od",
    title: "3. On-Duty Tracking",
    description:
      "Track both pending OD and officially registered OD without mixing them.",
    steps: [
      "Create OD event from OD tab.",
      "Assign subject-wise hours and date range.",
      "Mark each subject as Pending or Registered as status changes.",
      "Review impact in subject cards: Before, +DL, and Projected.",
    ],
    note: "Pending OD improves projected view, registered OD moves into DL.",
  },
  {
    id: "sync",
    title: "4. Official Report Sync",
    description:
      "Use Settings sync to reconcile your app with official college consolidated data.",
    steps: [
      "Open Settings > Sync with official report.",
      "Import Excel or enter TH/AH/DL manually.",
      "Review detected differences.",
      "Apply sync and confirm updated subject totals.",
    ],
    note: "After one sync, continue using Today for daily maintenance.",
  },
  {
    id: "backup",
    title: "5. Safety and Recovery",
    description: "Back up regularly so your semester data is never lost.",
    steps: [
      "Use Export JSON backup from Settings.",
      "Store backup in cloud drive.",
      "Use Import JSON restore on new device or after reinstall.",
    ],
  },
  {
    id: "updates",
    title: "6. App Updates",
    description:
      "Check App updates in Settings to move to the latest build when released.",
    steps: [
      "Open Settings > App updates.",
      "Tap Check for updates.",
      "If available, tap Download update.",
      "Install the downloaded APK manually.",
    ],
    note: "Keep app updated to avoid mismatched logic or sync behavior.",
  },
];

