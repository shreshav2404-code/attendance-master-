# AttendX

AttendX is a cross-platform Expo + React Native app for college attendance and On-Duty (OD) tracking.

## Stack

- Expo SDK 52 (managed + prebuild workflow)
- TypeScript (strict)
- Expo Router
- NativeWind + React Native Paper
- Reanimated + Moti
- Victory Native
- Zustand + AsyncStorage + MMKV

## Prerequisites

- Node.js 20+
- npm 10+
- Android Studio (latest stable)
- Android SDK + Emulator (API 35 recommended)
- Java 17
- For iOS: Xcode 15+ and CocoaPods

## Install

```bash
npm install
```

## Run on Android Emulator

1. Open Android Studio.
2. Open `Device Manager` and start an emulator (example: Pixel 8 API 35).
3. Verify device:
```bash
adb devices
```
4. Reverse Metro port (important):
```bash
adb reverse tcp:8081 tcp:8081
```
5. Start Metro:
```bash
npx expo start --dev-client --clear
```
6. Build/install dev app (first time or after native changes):
```bash
npx expo run:android
```
7. Open AttendX in emulator and select the available development server.

## Run on iOS Simulator

```bash
npx expo run:ios
```

## Quality Checks

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
```

## Build Artifacts

```bash
eas build --platform android
eas build --platform ios
```

## Notes

- iOS deployment target is `15.1` (configured via `expo-build-properties` for SDK 52 compatibility).
- If `expo-doctor` shows a warning about native folders + app config fields, that is expected in prebuild/native workflow unless you move fully to CNG (no committed `android/ios` folders).
