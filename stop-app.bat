@echo off
echo Stopping ClassGrid Timetable App...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /F /PID %%a 2>nul
)
echo App stopped.
pause
