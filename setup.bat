@echo off
:: NYX Setup Launcher
:: Double-click this file to set up NYX on a new machine.
:: All it does is run setup.ps1 with the right permissions.

echo.
echo  Starting NYX Setup...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  Setup encountered an error. See messages above.
    pause
)
