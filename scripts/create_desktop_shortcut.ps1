param (
    [switch]$Silent
)

$WshShell = New-Object -ComObject WScript.Shell

$desktopDir = [Environment]::GetFolderPath('Desktop')
$projectDir = (Get-Item $PSScriptRoot).Parent.FullName
$batPath = Join-Path $projectDir "start.bat"
$iconPath = Join-Path $projectDir "assets\app.ico"
$shortcutPath = Join-Path $desktopDir "OmniVoice TTS.lnk"

# Nếu chạy chế độ Silent và shortcut đã tồn tại đúng thì bỏ qua
if ($Silent -and (Test-Path $shortcutPath)) {
    exit 0
}

# Xóa shortcut cũ start.bat - Shortcut nếu có
$oldShortcut = Join-Path $desktopDir "start.bat - Shortcut.lnk"
if (Test-Path $oldShortcut) {
    Remove-Item $oldShortcut -Force
}

# Tạo hoặc cập nhật shortcut mới: OmniVoice TTS.lnk
$shortcut = $WshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $batPath
$shortcut.WorkingDirectory = $projectDir
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "OmniVoice TTS Studio (24kHz)"
$shortcut.Save()

if (-not $Silent) {
    Write-Host "Da tao thanh cong Shortcut app tren Desktop: $shortcutPath" -ForegroundColor Green
}

