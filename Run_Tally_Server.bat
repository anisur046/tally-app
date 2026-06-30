@echo off
setlocal enabledelayedexpansion
title Tally Local Server

:: Cleanup any leftover temp folders from previous runs
if exist "%TEMP%\tally_server_temp" (
  rd /s /q "%TEMP%\tally_server_temp" >nul 2>&1
)

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

:: 2. Locate tally-app directory (Local, Network, or Archive)
set "TARGET_DIR="

:: Locate WinRAR or 7-Zip for extraction if needed
set "ARCHIVER="
set "EXTRACT_CMD="
if exist "C:\Program Files\WinRAR\UnRAR.exe" (
  set "ARCHIVER=C:\Program Files\WinRAR\UnRAR.exe"
  set "EXTRACT_CMD="!ARCHIVER!" x -y"
) else if exist "C:\Program Files\WinRAR\WinRAR.exe" (
  set "ARCHIVER=C:\Program Files\WinRAR\WinRAR.exe"
  set "EXTRACT_CMD="!ARCHIVER!" x -y"
) else if exist "C:\Program Files (x86)\WinRAR\WinRAR.exe" (
  set "ARCHIVER=C:\Program Files (x86)\WinRAR\WinRAR.exe"
  set "EXTRACT_CMD="!ARCHIVER!" x -y"
) else if exist "C:\Program Files\7-Zip\7z.exe" (
  set "ARCHIVER=C:\Program Files\7-Zip\7z.exe"
  set "EXTRACT_CMD="!ARCHIVER!" x -y"
) else if exist "C:\Program Files (x86)\7-Zip\7z.exe" (
  set "ARCHIVER=C:\Program Files (x86)\7-Zip\7z.exe"
  set "EXTRACT_CMD="!ARCHIVER!" x -y"
)

:: Check direct directories containing server.js
if exist "%~dp0server.js" (
  set "TARGET_DIR=%~dp0"
) else if exist "%USERPROFILE%\WebstormProjects\tally-app\server.js" (
  set "TARGET_DIR=%USERPROFILE%\WebstormProjects\tally-app"
) else if exist "%USERPROFILE%\WebstormProjects\tally-app.rar\server.js" (
  set "TARGET_DIR=%USERPROFILE%\WebstormProjects\tally-app.rar"
) else if exist "C:\Users\HP\WebstormProjects\tally-app\server.js" (
  set "TARGET_DIR=C:\Users\HP\WebstormProjects\tally-app"
) else if exist "C:\Users\HP\WebstormProjects\tally-app.rar\server.js" (
  set "TARGET_DIR=C:\Users\HP\WebstormProjects\tally-app.rar"
) else if exist "c:\Users\AnisurSk\WebstormProjects\tally-app\server.js" (
  set "TARGET_DIR=c:\Users\AnisurSk\WebstormProjects\tally-app"
) else if exist "c:\Users\AnisurSk\WebstormProjects\tally-app.rar\server.js" (
  set "TARGET_DIR=c:\Users\AnisurSk\WebstormProjects\tally-app.rar"
) else if exist "\\ANISUR-BISICSL\tally-app\server.js" (
  set "TARGET_DIR=\\ANISUR-BISICSL\tally-app"
) else if exist "\\ANISUR-BISICSL\tally-app.rar\server.js" (
  set "TARGET_DIR=\\ANISUR-BISICSL\tally-app.rar"
)

:: If not found, check if tally-app.rar file exists and extract it to temp folder
if not defined TARGET_DIR (
  set "RAR_FILE="
  
  if exist "%~dp0tally-app.rar" if not exist "%~dp0tally-app.rar\" (
    set "RAR_FILE=%~dp0tally-app.rar"
  ) else if exist "%USERPROFILE%\WebstormProjects\tally-app.rar" if not exist "%USERPROFILE%\WebstormProjects\tally-app.rar\" (
    set "RAR_FILE=%USERPROFILE%\WebstormProjects\tally-app.rar"
  ) else if exist "C:\Users\HP\WebstormProjects\tally-app.rar" if not exist "C:\Users\HP\WebstormProjects\tally-app.rar\" (
    set "RAR_FILE=C:\Users\HP\WebstormProjects\tally-app.rar"
  ) else if exist "c:\Users\AnisurSk\WebstormProjects\tally-app.rar" if not exist "c:\Users\AnisurSk\WebstormProjects\tally-app.rar\" (
    set "RAR_FILE=c:\Users\AnisurSk\WebstormProjects\tally-app.rar"
  ) else if exist "\\ANISUR-BISICSL\tally-app.rar" if not exist "\\ANISUR-BISICSL\tally-app.rar\" (
    set "RAR_FILE=\\ANISUR-BISICSL\tally-app.rar"
  )

  if defined RAR_FILE (
    echo Found tally-app.rar at: !RAR_FILE!
    if defined EXTRACT_CMD (
      set "TEMP_DIR_TO_CLEAN=%TEMP%\tally_server_temp"
      echo Creating temporary directory: !TEMP_DIR_TO_CLEAN!
      if exist "!TEMP_DIR_TO_CLEAN!" rd /s /q "!TEMP_DIR_TO_CLEAN!" >nul 2>&1
      mkdir "!TEMP_DIR_TO_CLEAN!"
      
      echo Extracting archive to temporary directory...
      !EXTRACT_CMD! "!RAR_FILE!" "!TEMP_DIR_TO_CLEAN!\"
      if !errorlevel! equ 0 (
        echo Extraction successful.
        if exist "!TEMP_DIR_TO_CLEAN!\tally-app\server.js" (
          set "TARGET_DIR=!TEMP_DIR_TO_CLEAN!\tally-app"
        ) else if exist "!TEMP_DIR_TO_CLEAN!\tally-app.rar\server.js" (
          set "TARGET_DIR=!TEMP_DIR_TO_CLEAN!\tally-app.rar"
        ) else if exist "!TEMP_DIR_TO_CLEAN!\server.js" (
          set "TARGET_DIR=!TEMP_DIR_TO_CLEAN!"
        )
      ) else (
        echo Error: Extraction failed with code !errorlevel!.
        rd /s /q "!TEMP_DIR_TO_CLEAN!" >nul 2>&1
        set "TEMP_DIR_TO_CLEAN="
      )
    ) else (
      echo ====================================================
      echo  EXTRACTION TOOL NOT FOUND
      echo ====================================================
      echo Found 'tally-app.rar' but no extraction tool WinRAR or 7-Zip was detected.
      echo Please install WinRAR or 7-Zip to extract it automatically,
      echo or manually extract !RAR_FILE!.
      echo.
    )
  )
)

:: Prompt the user if still not found
if not defined TARGET_DIR (
  echo ====================================================
  echo  TALLY SERVER FOLDER NOT FOUND
  echo ====================================================
  echo The folder 'tally-app' was not found locally.
  set /p "INPUT_DIR=Please enter the path to the tally-app folder or tally-app.rar archive: "
  
  :: Clean quotes and trailing slashes/spaces from input
  set "INPUT_DIR=!INPUT_DIR:"=!"
  if "!INPUT_DIR:~-1!"==" " set "INPUT_DIR=!INPUT_DIR:~0,-1!"
  if "!INPUT_DIR:~-1!"=="\" set "INPUT_DIR=!INPUT_DIR:~0,-1!"
  
  :: Check if user input is a RAR file
  if exist "!INPUT_DIR!" if not exist "!INPUT_DIR!\" (
    set "IS_RAR=0"
    if "!INPUT_DIR:~-4!"==".rar" set "IS_RAR=1"
    if "!INPUT_DIR:~-4!"==".RAR" set "IS_RAR=1"
    
    if "!IS_RAR!"=="1" (
      if defined EXTRACT_CMD (
        set "TEMP_DIR_TO_CLEAN=%TEMP%\tally_server_temp"
        echo Creating temporary directory: !TEMP_DIR_TO_CLEAN!
        if exist "!TEMP_DIR_TO_CLEAN!" rd /s /q "!TEMP_DIR_TO_CLEAN!" >nul 2>&1
        mkdir "!TEMP_DIR_TO_CLEAN!"
        
        echo Extracting !INPUT_DIR! to temporary directory...
        !EXTRACT_CMD! "!INPUT_DIR!" "!TEMP_DIR_TO_CLEAN!\"
        if !errorlevel! equ 0 (
          if exist "!TEMP_DIR_TO_CLEAN!\tally-app\server.js" (
            set "TARGET_DIR=!TEMP_DIR_TO_CLEAN!\tally-app"
          ) else if exist "!TEMP_DIR_TO_CLEAN!\tally-app.rar\server.js" (
            set "TARGET_DIR=!TEMP_DIR_TO_CLEAN!\tally-app.rar"
          ) else if exist "!TEMP_DIR_TO_CLEAN!\server.js" (
            set "TARGET_DIR=!TEMP_DIR_TO_CLEAN!"
          )
        ) else (
          echo Error: Extraction failed.
          rd /s /q "!TEMP_DIR_TO_CLEAN!" >nul 2>&1
          set "TEMP_DIR_TO_CLEAN="
        )
      ) else (
        echo Error: WinRAR or 7-Zip is required to extract this RAR archive automatically.
      )
    )
  ) else (
    set "TARGET_DIR=!INPUT_DIR!"
  )
)

if not exist "!TARGET_DIR!\server.js" (
  echo Error: The folder "!TARGET_DIR!" does not contain the Tally Server project files.
  if defined TEMP_DIR_TO_CLEAN (
    rd /s /q "!TEMP_DIR_TO_CLEAN!" >nul 2>&1
  )
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
  if defined TEMP_DIR_TO_CLEAN (
    echo Cleaning up temporary files...
    rd /s /q "!TEMP_DIR_TO_CLEAN!" >nul 2>&1
  )
  pause
  exit /b
)

popd
if defined TEMP_DIR_TO_CLEAN (
  echo Cleaning up temporary files...
  rd /s /q "!TEMP_DIR_TO_CLEAN!" >nul 2>&1
)
