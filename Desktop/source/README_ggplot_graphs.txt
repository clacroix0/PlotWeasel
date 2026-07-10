Plot Weasel Desktop ggplot graph source
Version: v2.0.0
Release date: June 4, 2026

The Plot Weasel Desktop HTML app runs offline in the browser and does not require R.
Its Graphs tab is drawn with bundled browser code so it can work on GFE
machines without installing R packages.

The R graphing code is preserved here for reference and future R use:
- PlotWeasel_V8_current.R contains the current V8 script used as the Desktop calculation reference.
- PlotWeasel_ggplot_part_c.R contains only the ggplot Part C graph section.
- TinyPlotWeasel_V1_current.R contains the current Tiny Weasel regen script used as the Regen tab calculation reference.

Required R package for the extracted Part C graph source:
- ggplot2

The current full script loads tidyverse, which includes ggplot2 and the
other data-wrangling packages used earlier in the script.

The HTML app exports graph equivalents as SVG files in its downloaded zip files.
Those SVGs are browser generated so the app can stay offline and no-install.
