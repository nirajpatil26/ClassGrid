Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projectDir = "d:\PROJECTS\college-timetable-app"
WshShell.CurrentDirectory = projectDir

' Check if port 5173 is already listening
Function IsPortListening()
    Set objExec = WshShell.Exec("netstat -ano")
    strOut = objExec.StdOut.ReadAll()
    If InStr(strOut, ":5173 ") > 0 Then
        IsPortListening = True
    Else
        IsPortListening = False
    End If
End Function

If Not IsPortListening() Then
    ' Start Vite dev server in completely hidden window
    npmCmd = """C:\Program Files\nodejs\npm.cmd"" run dev"
    WshShell.Run "cmd /c " & npmCmd & " > """ & projectDir & "\server.log"" 2>&1", 0, False
    
    ' Wait until server responds (up to 12 seconds)
    For i = 1 To 12
        WScript.Sleep 1000
        If IsPortListening() Then
            Exit For
        End If
    Next
End If

' Open the web browser to the local app
WshShell.Run "http://localhost:5173"
