Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Lấy đường dẫn thư mục gốc của dự án
currentScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(currentScriptDir)
WshShell.CurrentDirectory = projectDir

' 0 = vbHide (Chạy ngầm hoàn toàn, tuyệt đối không xuất hiện cửa sổ command prompt hay terminal)
WshShell.Run "cmd.exe /c pnpm desktop:start", 0, False
