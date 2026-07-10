@echo off
title Plot Weasel Desktop v2.0.0
set "APP=%~dp0PlotWeasel_Desktop_v2.0.0.html"
if exist "%~dp0Plot Weasel Desktop v2.0.0.lnk" (
  start "" "%~dp0Plot Weasel Desktop v2.0.0.lnk"
  exit /b
)
if exist "%~dp0Plot Weasel Desktop.lnk" (
  start "" "%~dp0Plot Weasel Desktop.lnk"
  exit /b
)
start "Plot Weasel Desktop v2.0.0" "%APP%"
