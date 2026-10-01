@echo off
echo Starting ClassGrid Timetable App...
cd /d "%~dp0"
start http://localhost:5173
npm run dev
pause
