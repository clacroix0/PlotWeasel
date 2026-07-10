$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$app = Join-Path $root 'PlotWeasel_Desktop_v2.0.0.html'
$icon = Join-Path $root 'assets\weasel.ico'
$shortcutPath = Join-Path $root 'Plot Weasel Desktop v2.0.0.lnk'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $app
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = "$icon,0"
$shortcut.Description = 'Plot Weasel Desktop v2.0.0'
$shortcut.Save()

Start-Process -FilePath $shortcutPath
