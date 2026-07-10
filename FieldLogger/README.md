# Plot Weasel Field Logger

Version: **v2.2.8**  
Release date: **June 16, 2026**  
Android APK documentation update: **July 10, 2026**

Plot Weasel Field Logger is an offline field data-entry app for plot, tree, and regeneration records. It stores data on the device until the user exports it, then creates files for the Master Workbook and Plot Weasel Desktop.

## Official Android APK

| Item | Value |
|---|---|
| APK filename | `PlotWeaselFieldLogger_Ver2.2.8.apk` |
| SHA-256 | `708b8ffe901ba65e97e595783a624da07ee97f652d5fe7b4ce63f9c3a1be75a5` |
| Release type | Android Studio-built APK for direct Android installation |
| Google Play account required | No, not for direct/internal APK installation |

## Recommended Android installation

1. Copy `PlotWeaselFieldLogger_Ver2.2.8.apk` to the Android tablet.
2. Open **Files** or **My Files** on the tablet.
3. Tap the APK.
4. If Android asks, allow installation from that source.
5. Install and open **Plot Weasel Field Logger**.
6. Allow **Location** permission while using the app.
7. Confirm the app header shows **Local only** before field use.
8. Create a test project, close the app, reopen it, and confirm the test project is still there.
9. Test **Backup JSON** and **Plot Weasel Desktop CSV** export before collecting real field data.

## Storage mode

The Android Studio APK should show **Local only** in the app header.

| Mode | Meaning | Use for real field data? |
|---|---|---|
| **Local only** | Data is stored locally on the device until exported or cleared. | Yes, after the storage/export tests pass. |
| **Memory only** | Data is only temporary and may disappear when the app closes, reloads, crashes, or Android clears it. | No. Export Backup JSON immediately if important data was entered. |

## Daily field workflow

1. Import Project Setup JSON, or build the project setup on the tablet.
2. Enter Crew Name and Crew ID.
3. Confirm **Local only**.
4. Collect site, tree, and regeneration data.
5. Run the Review tab.
6. Export **Crew Package** at the end of the day or exam.
7. Export **Backup JSON** at the end of each day.
8. Copy exported files off the tablet using an approved transfer method.

## Exports

- **Project Setup**: project settings only; does not include field records.
- **Crew Package**: one crew/tablet package for merging or moving work.
- **Backup JSON**: full device backup; export before updating, uninstalling, clearing data, or transferring work.
- **Plot Weasel Desktop CSV**: `PlotWeasel_upload.csv`; upload this file to Plot Weasel Desktop.
- **Save Site, Tree, Regen CSVs**: writes `Site.csv`, `Tree.csv`, `Regen.csv`, and `Review.txt` when the browser/device supports folder saving.

## Updating

Before installing an updated APK:

1. Export **Backup JSON**.
2. Confirm the backup file exists and can be copied off the tablet.
3. Install the updated APK over the old app when Android allows it.
4. Open the app and confirm project data is still present.
5. Confirm the app still shows **Local only**.

Do not uninstall the app unless the data has already been backed up. Uninstalling can remove local project data.

## Signing key safety

Future APK updates should be signed with the same signing key used for this release. Keep these private and backed up:

- `.jks` keystore file
- keystore password
- key alias
- key password

Do **not** commit signing keys or passwords to GitHub.

## Recommended repository rules

Do not commit these files to the source repository:

```gitignore
*.jks
*.keystore
keystore.properties
local.properties
.gradle/
build/
app/build/
*.apk
*.aab
```

Use GitHub Releases to attach official APK files instead of committing APKs to the main branch.

## Non-APK use

The offline HTML version can still be used on Windows and Microsoft Surface devices, usually in Microsoft Edge. For Android field tablets, the official Android Studio-built APK is recommended because it was tested to show **Local only** storage.

## Credits

Created by Casey Sigg, Steve Singleton, and Chris LaCroix with the USDI BIA Division of Forestry, Branch of Inventory and Planning.

- Casey Sigg created the Plot Weasel Desktop R script, which is the calculation engine and scientific foundation for Plot Weasel Desktop.
- Steve Singleton created the field and master workbook templates that guided the Plot Weasel Field Logger structure and exports.
- Chris LaCroix did the vibe coding that turned the script, templates, and workflow into the Plot Weasel Desktop and Plot Weasel Field Logger.
