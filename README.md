# Plot Weasel

Plot Weasel is an offline forestry field data collection and calculation workflow. It includes Plot Weasel Field Logger for collecting plot, tree, site, GPS, and regeneration records on field devices, and Plot Weasel Desktop for processing Field Logger exports into calculation outputs, audit files, tables, and graphs.

## Current versions

| Component | Current version | Notes |
|---|---:|---|
| Plot Weasel Field Logger | v2.2.8 | Android Studio-built APK recommended for Android tablets. |
| Plot Weasel Desktop | v2.0.0 | Browser-based desktop calculation and reporting app. |

## Normal workflow

1. Set up the project and species pick list in Plot Weasel Field Logger.
2. Export Project Setup JSON and copy it to crew tablets.
3. Collect plot, tree, site, GPS, and regeneration records on each field tablet.
4. Export Crew Package JSON and Backup JSON at the end of the day or exam.
5. Merge crew packages in Field Logger on a secured office device.
6. Export Site.csv, Tree.csv, Regen.csv, and PlotWeasel_upload.csv.
7. Open Plot Weasel Desktop and upload PlotWeasel_upload.csv.
8. Run calculations and review outputs, audit files, tables, and graphs.

## Android Field Logger APK

The official Android APK for Field Logger v2.2.8 is distributed through GitHub Releases, not committed directly to this source repository.

Expected APK filename:

```text
PlotWeaselFieldLogger_Ver2.2.8.apk
```

Expected SHA-256 checksum:

```text
708b8ffe901ba65e97e595783a624da07ee97f652d5fe7b4ce63f9c3a1be75a5
```

Before field use, install the APK on the actual Android tablet and confirm:

```text
Storage mode: Local only
```

Do not use a build that shows `Memory only` for real field data.

## Repository layout

```text
plot-weasel/
├── README.md
├── PlotWeasel_How_To_Guide_v2026-07-10.html
├── .gitignore
├── FieldLogger/
├── Desktop/
```

## Documentation

Key document is in `plotweasel/`.
- `docs/releases/PlotWeasel_How_To_Guide_v2026-07-10.html` is the dated guide snapshot for this release.

## Security and data handling

Plot Weasel is designed for local/offline use. Field data stays on the device until exported. Keep tablets and exported files secured. Do not store sensitive project data in cloud folders unless policy allows it.

## Do not commit secrets or built APKs

Do not commit Android signing keys, passwords, local build settings, build folders, APKs, or AABs to the source repository. Use GitHub Releases for official downloadable APKs.

## Credits

Created by Casey Sigg, Steve Singleton, and Chris LaCroix with the USDI BIA Division of Forestry, Branch of Inventory and Planning.

- Casey Sigg created the Plot Weasel Desktop R script, which is the calculation engine and scientific foundation for Plot Weasel Desktop.
- Steve Singleton created the field and master workbook templates that guided the Plot Weasel Field Logger structure and exports.
- Chris LaCroix did the vibe coding that turned the script, templates, and workflow into the Plot Weasel Desktop and Plot Weasel Field Logger.
