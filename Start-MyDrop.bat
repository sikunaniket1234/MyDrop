@echo off
title MyDrop Desktop
cd /d "%~dp0"

echo Starting MyDrop Desktop...
echo.

REM Check node
where node >nul 2>&1 || (
    echo ERROR: Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

REM Start API server and Vite UI dev server
cd packages\mydrop-desktop
npx concurrently -k -n api,ui "npx tsx src/server/alpha-server.ts" "npx vite --host 127.0.0.1 --port 1420"

pause
