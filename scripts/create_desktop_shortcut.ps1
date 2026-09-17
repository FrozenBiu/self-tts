param (
    [switch]$Silent
)

$WshShell = New-Object -ComObject WScript.Shell

$desktopDir = [Environment]::GetFolderPath('Desktop')
$projectDir = (Get-Item $PSScriptRoot).Parent.FullName
$electronExe = Join-Path $projectDir "node_modules\electron\dist\electron.exe"
$customExe = Join-Path $projectDir "node_modules\electron\dist\OmniVoice Studio.exe"
$targetExe = if (Test-Path $customExe) { $customExe } else { $electronExe }
$iconPath = Join-Path $projectDir "assets\app.ico"
$shortcutPath = Join-Path $desktopDir "OmniVoice TTS.lnk"

# Xóa shortcut cũ nếu có
if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath -Force
}
$oldShortcut = Join-Path $desktopDir "start.bat - Shortcut.lnk"
if (Test-Path $oldShortcut) {
    Remove-Item $oldShortcut -Force
}

# Tạo shortcut trỏ trực tiếp vào OmniVoice Studio.exe (Native Windows GUI App, hoàn toàn không có terminal)
$shortcut = $WshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetExe
$shortcut.Arguments = "."
$shortcut.WorkingDirectory = $projectDir
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "OmniVoice TTS Studio (24kHz Pro)"
$shortcut.Save()

if (-not $Silent) {
    Write-Host "Da tao thanh cong Shortcut app tren Desktop: $shortcutPath" -ForegroundColor Green
    Write-Host "Target: $targetExe ." -ForegroundColor Gray
}
