# AttendX Update Workflow

This app checks updates from `release.json`.

## One-time setup

1. Keep this file public in GitHub root:
   - `https://raw.githubusercontent.com/shreshav2404-code/attendance-master-/master/release.json`
2. Keep a stable APK link in `release.json`:
   - `https://github.com/shreshav2404-code/attendance-master-/releases/latest/download/attendx-latest.apk`

## Every new release

1. Build new production APK with EAS.
2. Upload APK to GitHub Release asset named `attendx-latest.apk`.
3. Update `release.json` fields:
   - `latestVersion` to new version.
   - `minimumVersion` to force update floor (same as latest for hard force).
   - `notes` to release note summary.
4. Commit and push `release.json`.

## In-app behavior

- Settings > App updates:
  - `Check for updates` reads the remote `release.json`.
  - `Download update` opens latest APK link.
- If app version is below `minimumVersion`, UI marks it as mandatory update.

