Plot Weasel Field Logger
Version: v2.2.8
Release date: June 16, 2026

Purpose:
This is an offline field data-entry app for Samsung tablets, Microsoft Surface devices, and secured Windows computers. It collects plot, tree, and regeneration records, then exports files for the Master Workbook and Plot Weasel Desktop.

Authors and Credits:
- Created by Casey Sigg, Steve Singleton, and Chris LaCroix with the USDI BIA Division of Forestry, Branch of Inventory and Planning.
- Casey Sigg created the Plot Weasel Desktop R script, which is the calculation engine and scientific foundation for Plot Weasel Desktop.
- Steve Singleton created the field and master workbook templates that guided the Plot Weasel Field Logger structure and exports.
- Chris LaCroix did the vibe coding that turned the script, templates, and workflow into the Plot Weasel Desktop and Plot Weasel Field Logger.

Launch:
1. Unzip this folder.
2. On a Samsung tablet or Microsoft Surface, open "PlotWeasel_Field_Logger_v2.2.8.html" in Microsoft Edge.
3. On Windows, double-click "Launch Field Logger v2.2.8.cmd" or "Launch Field Logger.cmd" for a simple launcher.
4. Use "PlotWeasel_Field_Logger_SINGLE_FILE_v2.2.8.html" if the normal file opens but the buttons or dropdowns do not respond.

Browser/device notes:
- Microsoft Edge is the supported browser for this offline HTML version.
- Safari on iPhone/iPad may treat local HTML as a preview instead of a full app, so Species, Trees, Regen, Add Plot, Aspect, or Slope Position may not work there.
- Chrome may work on some devices, but Edge is the tested path to give crews the least friction.
- A loose .html file is treated as a document on Android. If the tablet asks which app to use, choose Edge or the normal approved browser.
- For a home-screen icon without an APK, open the HTML in Edge and use Add to Home screen. Android still controls how loose file icons appear in the file manager.

No-internet / no-cloud workflow:
1. On an office computer or any field tablet, set the Project name, project species pick list, saved species list, and damage agents.
2. Export Project Setup in Export / Merge.
3. Copy the Project Setup JSON to each receiving tablet by approved local transfer. Also copy the Field Logger folder if the tablet does not already have it.
4. On each receiving tablet, import the Project Setup JSON before field data entry. Crew Name and Crew ID stay tablet-specific and are not changed by the setup import.
5. Each crew enters data locally on its tablet.
6. Each crew exports a Crew Package JSON at the end of the day or exam.
7. Back at the office, open this same app on a secured computer.
8. Import all crew packages in Export / Merge.
9. Export Site / Tree / Regen CSVs for reference/master records and Plot Weasel Desktop CSV for the desktop upload.
10. Load or paste Site.csv, Tree.csv, and Regen.csv into the Master Workbook as needed. Upload only PlotWeasel_upload.csv into Plot Weasel Desktop.

Security notes:
- The app does not require internet, cloud storage, Python, R, or admin rights.
- GPS capture uses the device location service if the browser allows it. It does not upload coordinates or require cloud sync.
- Data is stored in the browser's local storage until exported or cleared.
- Browser local storage is not encrypted by this app. Keep the tablet secured and clear device data after confirmed transfer if policy requires it.
- Do not use cloud folders for crew packages if the data is sensitive.

Projects on one device:
- Field Logger now supports multiple saved projects in the same browser on the same tablet.
- Use the Projects panel to switch between saved projects. The dropdown shows project name and record counts.
- Use New Project to start a blank project while keeping old projects on the device.
- New Project keeps the current Crew Name and Crew ID for convenience, but starts with blank plots, trees, regen, and project species.
- Use Delete Project to remove only the active project from that device.
- The browser tab title includes the active project name after the app opens. The app address also includes the active project ID after a project opens.
- To make a project-specific shortcut, open Field Logger, switch to the project, then add/bookmark that page and name the shortcut after the project. A single shared HTML file or generic home-screen icon still cannot show which project will open before launch.
- Clear Device Data removes all saved projects from that browser on that device.

Exports:
- Project Setup: local JSON setup file for sharing the project name, project species dropdown, one saved species list, and damage agents with multiple crew tablets. It can be created from an office computer or a field tablet. It does not include plots, tree records, regen records, Crew Name, or Crew ID.
- Crew Package: local JSON backup/merge package for one tablet or crew. It includes the tablet's plots, site data, tree records, regen records, settings, Project Name, Crew Name, and Crew ID. When one Crew Package is imported into another tablet, the receiving tablet can use the package's Project Name, Crew Name, and Crew ID. When multiple Crew Packages are imported at once for office merging, the receiving device's Project Name, Crew Name, and Crew ID are not changed.
- Plot Weasel Desktop CSV: one separate PlotWeasel_upload.csv file formatted for the Plot Weasel Desktop calculator. Tree records export normally, and plots with no tree records export as one plot-only blank row so null plots stay in the calculator denominator.
- Save Site, Tree, Regen CSVs: recommended on Windows Edge when available. It writes Site.csv, Tree.csv, Regen.csv, and Review.txt directly to a selected local folder, avoiding browser download warnings.
- Site.csv is reference data for the forester. It includes site notes and any UTM/GPS fields captured on the Site tab. Plot Weasel Desktop does not use Site.csv, and the R script will not run from the site-level file.
- Tree.csv also includes one plot-only null row for plots with no tree records.
- Tree.csv and PlotWeasel_upload.csv write Decay Class to the field "DECAYCD" using codes 1 through 5.

Key v2.2.8 entry rules:
- Site slope controls Aspect. Slope 5% or less uses only Level. Slope greater than 5% does not allow Level.
- The Site tab can capture plot-center GPS for 30 seconds, average the fixes, convert the average to whole-meter UTM Easting/Northing/Zone, and write those values to Site.csv. If the device returns altitude, the same capture also fills Elevation as whole feet. Location services and browser permission must be allowed. UTM and Elevation can also be typed manually. GPS Fix Count is the number of readings collected during the 30-second capture.
- Live trees require DBH and height. DBH must be 5.0 inches or greater, and height must be 8 ft or greater.
- DBH is stored and exported with one decimal place when entered. Typing 10 becomes 10.0, typing 10.3 stays 10.3, and typing 103 becomes 10.3 when leaving the field.
- Broken Top on live trees requires Actual Height, and Actual Height must be greater than measured Height. For normal live trees, leave Actual Height blank; the app exports Height as Actual Height. For Broken Top, Height is the measured height to the broken top and Actual Height is the estimated full height. Dead trees do not use Actual Height.
- Dead trees require Decay Class 1 through 5. DBH and height are optional for dead trees; if entered, they must still be valid. Actual Height, Cull, Crown Ratio, and Age are disabled for dead trees.
- Decay Class 1 = recently dead; bark and fine branches intact; wood hard.
- Decay Class 2 = some bark loss; fine branches gone; wood firm.
- Decay Class 3 = bark mostly gone; top often broken; wood starting to soften.
- Decay Class 4 = no bark; wood soft; form degrading.
- Decay Class 5 = very soft, crumbling; snag collapsing or stump-like.
- Cull and Crown Ratio must be 0 to 100 when entered.
- Age must be 0 to 1000 when entered.
- Regeneration includes a 0-inch seedling diameter class. Regen with 2-inch or 4-inch diameter class must use the >5 ft height class.

Species and damage agent lists:
- The app includes a FIA master species list.
- Each project starts with an empty project species pick list for the Tree and Regen dropdowns.
- Use the Species tab to search the FIA master list and add or remove project species.
- Save Species List stores one editable species list locally on that device. Saving again overwrites the previous saved copy.
- Restore Saved List loads the one saved species list back into the current project dropdown. It is disabled until a saved list exists.
- Clear Species List empties the current project dropdown without deleting saved tree or regen records.
- Project Damage Agents can be edited on the Species tab. None and Broken Top stay available because they drive app rules.
- Export Project Setup in Export / Merge creates a settings-only JSON that can be imported on other tablets so crews do not have to rebuild the project species pick list by hand. The setup can be created on an office computer or on a field tablet.

Review tab:
- Review items are labeled ERROR or WARNING.
- Selecting a tree, regen, or plot review item opens the related record or plot for editing when possible.
- Review messages use labels like Plot 1 Tree 2 so crews can find the record that needs attention.

Null plot note:
To record a null plot, add the plot and fill whatever site fields are available, then leave Tree and Regen empty. The Plot Weasel Desktop CSV will include one row with the plot number and blank tree fields. The Site / Tree / Regen CSVs export will include the plot in Site.csv and one plot-only null row in Tree.csv.

MIT App Inventor wrapper note:
The Field Logger can be wrapped in MIT App Inventor as an installed Android APK. The simplest wrapper loads the HTML in a WebViewer with location enabled. This can let the Field Logger GPS button work without Chrome blocking local-file GPS. A more advanced wrapper can enable the Field Logger's native App Inventor GPS bridge and feed LocationSensor readings into the page.



