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
    note: "If your college has mixed Saturdays, use Settings ☰ › Flexible Saturdays.",
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
      "Use Official sync to reconcile your app with official college consolidated data.",
    steps: [
      "Open Settings, tap the ☰ menu at the top right and choose Official sync.",
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
      "Open Settings ☰ › Data management and tap Export JSON backup.",
      "Store backup in cloud drive.",
      "Use Import JSON restore on new device or after reinstall.",
    ],
  },
  {
    id: "updates",
    title: "6. App Updates",
    description:
      "Check for updates in Settings to move to the latest build when released.",
    steps: [
      "Open Settings ☰ › Updates & about.",
      "Tap Check for updates.",
      "If available, tap Download update.",
      "Install the downloaded APK manually.",
    ],
    note: "Keep app updated to avoid mismatched logic or sync behavior.",
  },
  {
    id: "timetable-scan",
    title: "7. Timetable From PDF or Photo",
    description:
      "Let AttendX fill in the whole week from your college timetable. It's read on the phone, offline.",
    steps: [
      "Open Settings ☰ › Timetable and tap Scan PDF or photo (or use the button on the setup timetable step).",
      "Choose PDF and type your section exactly as printed on top of your page, e.g. 1CHE01.",
      "If your timetable is split by batch (B1/B2, Bat1–Bat4), pick your batch.",
      "Check each day, tap any period to fix it, then tap Apply to timetable.",
    ],
    note: "No PDF? Take a photo or pick a screenshot instead: hold the phone straight and fill the photo with the table so the day names show.",
  },
  {
    id: "settings-menu",
    title: "8. Finding Settings",
    description:
      "The Settings tab shows your profile. Everything else has its own page in the ☰ menu at the top right.",
    steps: [
      "Open the Settings tab to edit your profile and target %. Tap your photo circle to add a profile photo.",
      "Tap ☰ at the top right of any Settings page.",
      "Pick a page: OD, Official sync, Timetable, Exam week, Flexible Saturdays, Notifications, Permissions, Data management, Updates & about, or this manual.",
      "Use the back arrow to return to your profile.",
    ],
  },
];

