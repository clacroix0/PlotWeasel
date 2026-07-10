# Plot Weasel Field Logger v2.2.8 Android APK Release Notes

Release date: June 16, 2026  
Android APK documentation update: July 10, 2026

## Official APK

- Filename: `PlotWeaselFieldLogger_Ver2.2.8.apk`
- SHA-256: `708b8ffe901ba65e97e595783a624da07ee97f652d5fe7b4ce63f9c3a1be75a5`
- Release type: Android Studio-built APK for direct Android installation

## Deployment note

This APK can be installed directly on Android tablets without publishing through Google Play. A Google Play Developer account is not required for direct/internal APK installation. Managed government, school, or agency tablets may still require IT approval or MDM deployment.

## Key verification items

Before field deployment, verify the APK on the target Android tablet:

- App installs successfully.
- App opens from its own icon.
- Location permission can be allowed.
- App header shows **Local only**.
- New Project opens inside the app.
- Weasel icon displays inside the app.
- Test project survives closing and reopening the app.
- Test project survives restarting the tablet.
- Backup JSON exports successfully.
- Plot Weasel Desktop CSV exports successfully.
- GPS capture works outdoors after permission is allowed.

## Storage warning

Do not use any build that shows **Memory only** for real field collection. Memory only means data may disappear when the app closes, reloads, crashes, or Android clears it.

## MIT App Inventor note

The MIT App Inventor WebViewer wrapper can open the Field Logger, but the simple WebViewer version may show **Memory only**. The Android Studio-built APK is the recommended Android route for v2.2.8 field testing.

## Update safety

Before installing an updated APK:

1. Export Backup JSON.
2. Confirm the backup file is saved and accessible.
3. Install the update over the old app if Android allows it.
4. If Android refuses because of a signing mismatch, uninstall only after data has been backed up.

Future updates should be signed with the same `.jks` signing key used for this release.
