# tray/install_shortcut.ps1
# Creates Start Menu and Desktop shortcuts for the NYX tray app, so it
# launches like any other installed app - no terminal required.
#
# Run once from anywhere:
#   powershell -ExecutionPolicy Bypass -File tray\install_shortcut.ps1

$RootDir = Split-Path -Parent $PSScriptRoot
$TrayScript = Join-Path $RootDir "tray\tray_app.py"
$IconPath = Join-Path $RootDir "tray\nyx_icon.ico"

# Prefer pythonw.exe so launching NYX never pops up a console window
$PythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $PythonCmd) {
    Write-Error "Python not found on PATH. Install Python first, then re-run this script."
    exit 1
}
$PythonDir = Split-Path $PythonCmd.Source
$PythonwPath = Join-Path $PythonDir "pythonw.exe"
if (-not (Test-Path $PythonwPath)) {
    $PythonwPath = $PythonCmd.Source  # fall back to python.exe if pythonw isn't present
}

function New-NyxShortcut {
    param([string]$Path)

    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($Path)
    $Shortcut.TargetPath = $PythonwPath
    $Shortcut.Arguments = "`"$TrayScript`""
    $Shortcut.WorkingDirectory = $RootDir
    $Shortcut.IconLocation = $IconPath
    $Shortcut.Description = "NYX - Local AI Desktop Assistant"
    $Shortcut.Save()
    Write-Output "Created: $Path"
}

$StartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
New-NyxShortcut -Path "$StartMenuDir\NYX.lnk"

$DesktopDir = [Environment]::GetFolderPath('Desktop')
New-NyxShortcut -Path "$DesktopDir\NYX.lnk"

Write-Output ""
Write-Output "Done. NYX now appears in your Start Menu and on your Desktop."
Write-Output "Right-click either shortcut to 'Pin to Start' or 'Pin to taskbar' if you want it there too."
