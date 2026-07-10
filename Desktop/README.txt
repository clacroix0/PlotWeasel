Plot Weasel Desktop
Version: v2.0.0
Release date: June 4, 2026

Launch:
1. Unzip the folder.
2. Double-click "Launch Plot Weasel Desktop v2.0.0.cmd", "Launch Plot Weasel Desktop.cmd", or open "PlotWeasel_Desktop_v2.0.0.html".
3. Optional: double-click "Create Plot Weasel Desktop Shortcut.cmd" once if your computer allows it and you want a black-footed ferret paw shortcut in the app folder.
4. Upload a cruise CSV, choose the eco region, check the column matches, and click Run.
5. Use the Regen tab when you have a regeneration CSV that should be processed with the Tiny Weasel regen calculations.

Authors and Credits:
- Created by Casey Sigg, Steve Singleton, and Chris LaCroix with the USDI BIA Division of Forestry, Branch of Inventory and Planning.
- Casey Sigg created the Plot Weasel Desktop R script, which is the calculation engine and scientific foundation for Plot Weasel Desktop.
- Steve Singleton created the field and master workbook templates that guided the Plot Weasel Field Logger structure and exports.
- Chris LaCroix did the vibe coding that turned the script, templates, and workflow into the Plot Weasel Desktop and Plot Weasel Field Logger.

GFE / no-admin note:
- The app does not require admin rights, Python, R, or a software install.
- If Windows shows a Python firewall/admin popup, cancel it. That popup is from a local preview/testing server, not from the shareable app.
- If PowerShell script prompts are restricted, skip "Create Plot Weasel Desktop Shortcut.cmd" and use "Launch Plot Weasel Desktop.cmd" instead.
- The black-footed ferret paw icon will still appear in the browser tab.

Icon:
- The browser tab uses assets/weasel.svg, which contains the black-footed ferret paw artwork.
- The Windows shortcut uses assets/weasel.ico, which contains the black-footed ferret paw artwork.
- A plain .cmd file cannot display a custom icon by itself, so the shortcut creator builds "Plot Weasel Desktop v2.0.0.lnk" with the weasel icon for the current unzip location.

Expected CSV columns:
- plot
- spp, spcd, or species code
- dbh
- ht or height
- actualht, optional
- cull, optional
- DECAYCD, optional
- crown_ratio, optional
- status, with values live/dead or FIA-style 1/2 codes

Null plots:
- To include a null plot in the Desktop calculation, the uploaded CSV should contain one row with the plot number and the tree fields left blank. Plot Weasel Field Logger v1.0.14 and newer creates that placeholder row automatically for plots with no tree records.

Outputs:
- Combined stock table
- Species BA, TPA, and gross/sound volume
- Species crown ratio summary
- Species crown ratio averages tab with direct table download
- Dead tree DECAYCD sound-volume audit
- Stand totals
- Live/dead summaries
- Species x live/dead summaries
- DBH class stand tables
- Per-tree volume table
- Data audit text file
- Graph SVG files in the downloaded output zip

Graphs:
- The Plot Weasel Desktop HTML app draws the Graphs tab in the browser so it works offline without R.
- The downloaded output zip includes browser-generated SVG graph files so graph outputs can be saved without installing R or ggplot2.
- The original R ggplot graph code is preserved in source\PlotWeasel_ggplot_part_c.R.
- The current V8 R script that guides the Desktop calculation brain is preserved in source\PlotWeasel_V8_current.R.

Regen / Tiny Weasel:
- The Regen tab implements the Tiny Weasel regeneration workflow from source\TinyPlotWeasel_V1_current.R.
- Upload a regen CSV with plot, spp/species, Stem Count, Diameter Class, and Height Class columns.
- The regen audit reports how many null plots were included in the denominator.
- The regen output zip includes overall mean TPA, mean TPA by species, mean TPA by species x height, TPA by plot, audit text, and SVG graph files.

Notes:
- The app runs locally in a web browser. It does not upload data to a server.
- NSVB coefficient tables from https://github.com/mbrussell/NSVB are bundled in assets/nsvb-data.js.
- Eco Province selections are mapped to their Eco Division for the NSVB coefficient tables when the table is division-based.
