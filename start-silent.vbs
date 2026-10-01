Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "d:\PROJECTS\college-timetable-app"
WshShell.Run "cmd /c npm run dev", 0, False
