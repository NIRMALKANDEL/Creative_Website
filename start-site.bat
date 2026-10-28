@echo off
rem Double-click this file to preview the website on your computer.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download the LTS version from https://nodejs.org, install it, then double-click this file again.
  pause
  exit /b 1
)
echo Starting the Brightloop preview at http://localhost:5173  (close this window to stop it)
start "" http://localhost:5173
node dev.mjs
pause
