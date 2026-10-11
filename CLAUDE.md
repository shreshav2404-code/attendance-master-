# AttendX

Expo SDK 52 + React Native 0.76.9 + TypeScript app for college attendance / On-Duty tracking.
Expo Router, NativeWind + Paper, Zustand + AsyncStorage/MMKV (`lib/storage.ts`). All user data stays on the
device; the only network call is the update-manifest check in `lib/appUpdate.ts`.

## Architecture

- `app/` — Expo Router screens. `_layout.tsx` hydrates all stores, gates onboarding, runs notifications and the
  force-update check. Tabs: `index` (dashboard), `today` (mark today's classes), `od` (OD manager), `settings`
  (1,300+ lines: profile, timetable share/QR, exam week, Saturday overrides, notifications, imports, backup, updates).
  `onboarding/` is welcome → student-info → subjects → schedule → timetable → complete.
- `store/` — four Zustand stores (student, subject+timetable, attendance logs, OD events). Each action updates
  memory, then persists the whole array via `lib/storage.ts` (MMKV cache in front of AsyncStorage, 7 JSON keys).
- `lib/calculations.ts` — all attendance math. TH = hours held (non-suspended), AH = present, DL = registered OD,
  pendingOD = tracked but unregistered OD. Percent before / after DL / projected. An official sync snapshot
  (`officialSyncSnapshotBySubject`) replaces history up to `syncedAt`; logs created later are added on top.
- `lib/` imports: `officialReportImport.ts` (college Excel report via `xlsx`), `pendingODImport.ts`,
  `timetableShare.ts` (QR/code share: lz-string + zod-validated), `sync.ts`, `pdf.ts`, `share.ts`, `notifications.ts`,
  `appUpdate.ts` (release manifest on jsonblob.com).
- Tests in `__tests__/` cover calculations, imports, sync, storage and timetable share (42 tests).

## Commands

- `npm run preflight` — typecheck + lint + jest; run before every build
- `npm run typecheck` / `npm run lint` / `npm test -- --runInBand`

## Gotchas

- `android/` is committed (prebuild workflow) and `android/app/build.gradle` has custom release signing
  (EAS keystore from `EAS_BUILD_ANDROID_KEYSTORE_*` env vars, else `debug.keystore`).
  Never run `npx expo prebuild --clean` — it wipes that. JS/TS-only changes need no prebuild.
- Version lives in several places: `app.json` (`version` and `name: "Attendex X.Y.Z"`), `package.json`,
  `android/app/build.gradle` (`versionName`), and `release.json` for the in-app updater (see README).
  EAS manages `versionCode` remotely (`appVersionSource: remote` + `autoIncrement`); the `versionCode` in
  `build.gradle` only applies to local builds.
- Don't change `reactNativeArchitectures` in `android/gradle.properties`: EAS builds read it, so it would
  make published APKs arm64-only. Use the `-P` flag below for local builds instead.
- Attendance log ids: an entry for one class period uses `getSlotLogId(date, slotId)` (Today screen and
  timetable-based OD logs share it, so an OD replaces that class's entry instead of double-counting). Write
  OD logs with `upsertLogs`, not `addLogs`. Today's Save replaces only the logs its cards were filled from.
- Pending-OD adjustments (Settings manual add / file import) are `ODEvent`s with `source` set (older ones are
  named "Manual Pending OD · …" / "Pending OD · …"; see `isPendingODAdjustment`). They never fill, lock or get
  overwritten by the Today screen and aren't offered in its OD picker.
- Official sync rules (`lib/calculations.ts`, `lib/sync.ts`, covered by `__tests__/syncScenarios.test.ts`):
  the snapshot's TH/AH/DL stand for everything up to `syncedAt`; only entries created after the sync **and**
  dated on/after the sync day add to TH/AH. Pending OD is always "all tracked OD hours − registered hours"
  (event flags, plus `registeredHours` that sync sets on OD entries without an event), never "since the sync".
  When re-saving or replacing an existing entry, keep its `createdAt`.
- expo-notifications 0.29 needs an explicit trigger `type` (e.g. `SchedulableTriggerInputTypes.DAILY`); a
  typeless `{ hour, minute }` trigger fires immediately on Android. `runProactiveAlerts` is queued so
  overlapping calls can't send the same reminder twice.
- Settings toasts: error paths call `warnFeedback()` (warning icon + haptic), successes `successFeedback()`.
- Destructive actions go through `confirmAction` (`lib/confirm.ts`); `Alert.alert` is a no-op on web.
- Web build is preview-only: `TrendChart` shows a text fallback there (Skia needs CanvasKit on web).

## Local release APK

Needs JDK 17, Android SDK Platform 35, Build-Tools 35.0.0, NDK 26.1.10909125 (pinned in
`android/build.gradle`, must match exactly), CMake 3.22.1. Gradle 8.10.2 comes from the wrapper.

```powershell
npm install
cd android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
adb install -r app\build\outputs\apk\release\app-release.apk
.\gradlew.bat --stop   # free the RAM afterwards
```

- Output: `android\app\build\outputs\apk\release\app-release.apk`
- `-PreactNativeArchitectures=arm64-v8a` compiles the C++ once instead of four times and fits nearly every
  modern phone. Drop it for a universal APK (armeabi-v7a, arm64-v8a, x86, x86_64: much slower build, roughly 80-100 MB).
- Local release builds are signed with the debug key. They can't install over the official EAS-signed app
  (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`), and uninstalling the official app wipes its attendance data.
