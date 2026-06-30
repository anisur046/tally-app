@echo off
setlocal enabledelayedexpansion
title Tally Local Server

:: 1. Check if Node.js is installed
node -v >nul 2>nul
if %errorlevel% neq 0 (
  echo ====================================================
  echo  NODE.JS IS REQUIRED TO RUN TALLY SERVER
  echo ====================================================
  echo Node.js was not detected on this system.
  echo Installing Node.js automatically - requires Administrator
  echo.
  winget install --id OpenJS.NodeJS -e --silent --accept-source-agreements --accept-package-agreements
  if !errorlevel! neq 0 (
    echo.
    echo winget not found or failed. Downloading Node.js MSI using PowerShell...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%temp%\node_install.msi'"
    echo Installing Node.js silently...
    start /wait msiexec /i "%temp%\node_install.msi" /qn /norestart
  )
  echo.
  echo Node.js installation finished.
  echo Please close this window and run Run_Tally_Server.bat again to start.
  echo ====================================================
  pause
  exit /b
)

:: 2. Locate tally-app directory (Local or Network Share)
set "TARGET_DIR="
if exist "%~dp0server.js" (
  set "TARGET_DIR=%~dp0"
) else if exist "%USERPROFILE%\WebstormProjects\tally-app\server.js" (
  set "TARGET_DIR=%USERPROFILE%\WebstormProjects\tally-app"
) else if exist "C:\Users\HP\WebstormProjects\tally-app\server.js" (
  set "TARGET_DIR=C:\Users\HP\WebstormProjects\tally-app"
) else if exist "c:\Users\AnisurSk\WebstormProjects\tally-app\server.js" (
  set "TARGET_DIR=c:\Users\AnisurSk\WebstormProjects\tally-app"
) else if exist "\\ANISUR-BISICSL\tally-app\server.js" (
  set "TARGET_DIR=\\ANISUR-BISICSL\tally-app"
) else (
  echo ====================================================
  echo  TALLY SERVER FOLDER NOT FOUND
  echo ====================================================
  echo The folder 'tally-app' was not found locally.
  set /p "INPUT_DIR=Please enter the shared network path - e.g. \\ANISUR-BISICSL\tally-app: "
  
  :: Clean quotes and trailing slashes/spaces from input
  set "INPUT_DIR=!INPUT_DIR:"=!"
  if "!INPUT_DIR:~-1!"==" " set "INPUT_DIR=!INPUT_DIR:~0,-1!"
  if "!INPUT_DIR:~-1!"=="\" set "INPUT_DIR=!INPUT_DIR:~0,-1!"
  set "TARGET_DIR=!INPUT_DIR!"
)

if not exist "!TARGET_DIR!\server.js" (
  echo Error: The folder "!TARGET_DIR!" does not contain the Tally Server project files.
  pause
  exit /b
)

echo Connecting to target directory: !TARGET_DIR!
pushd "!TARGET_DIR!"

echo.
echo 1. Checking dependencies...
if not exist node_modules (
  echo node_modules folder not found, running npm install...
  call npm install
)

echo.
echo 2. Building React Application...
call npm run build

echo.
echo 3. Launching Licensing Server...

set "LOCAL_IP=127.0.0.1"
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i /c:"IPv4 Address"') do (
    set "val=%%a"
    set "val=!val:~1!"
    if not "!val!"=="" (
        set "LOCAL_IP=!val!"
        goto :ip_found
    )
)
:ip_found

echo Access the application locally at: http://localhost/
echo Access from other computers at:  http://!LOCAL_IP!/
echo.
call npm run server
if %errorlevel% neq 0 (
  echo.
  echo Server failed to start! This is likely because Port 80 is in use
  echo or requires administrator permissions.
  echo Try right-clicking this file and selecting "Run as administrator".
  echo.
  popd
  pause
  exit /b
)

popd
