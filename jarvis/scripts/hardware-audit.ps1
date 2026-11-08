# JARVIS — Phase 0 hardware audit (Windows)
#
# READ-ONLY: this script installs nothing, downloads nothing and changes
# no system settings. It only reads system information and writes a
# report to .\jarvis-hardware-report.txt in the current directory.
#
# Usage (PowerShell):
#   powershell -ExecutionPolicy Bypass -File .\hardware-audit.ps1

$ErrorActionPreference = 'SilentlyContinue'
$Out = Join-Path (Get-Location) 'jarvis-hardware-report.txt'
Set-Content -Path $Out -Value '' -Encoding UTF8

function Log($text)     { Write-Output $text; Add-Content -Path $Out -Value $text -Encoding UTF8 }
function Section($name) { Log ''; Log "=== $name ===" }
function Ver($name, $exe, $arg) {
  if (Get-Command $exe -ErrorAction SilentlyContinue) {
    $v = (& $exe $arg 2>&1 | Select-Object -First 1)
    Log "${name}: $v"
  } else { Log "${name}: NOT INSTALLED" }
}

Log "JARVIS hardware audit - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

Section 'OPERATING SYSTEM'
$os = Get-CimInstance Win32_OperatingSystem
Log "$($os.Caption) $($os.Version) (build $($os.BuildNumber)) $($os.OSArchitecture)"

Section 'CPU'
foreach ($c in Get-CimInstance Win32_Processor) {
  Log "Model: $($c.Name.Trim())"
  Log "Cores (physical/logical): $($c.NumberOfCores)/$($c.NumberOfLogicalProcessors)"
  Log "Max clock: $($c.MaxClockSpeed) MHz"
}

Section 'MEMORY (RAM)'
$cs = Get-CimInstance Win32_ComputerSystem
Log ("Total RAM: {0:N1} GB" -f ($cs.TotalPhysicalMemory / 1GB))
Log ("Free RAM:  {0:N1} GB" -f ($os.FreePhysicalMemory * 1KB / 1GB))

Section 'GPU / VRAM'
# Win32_VideoController.AdapterRAM caps at 4 GB, so the real VRAM is read
# from the display adapter registry keys (qwMemorySize) when available.
$regBase = 'HKLM:\SYSTEM\ControlSet001\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
$regVram = @{}
Get-ChildItem $regBase | ForEach-Object {
  $p = Get-ItemProperty $_.PSPath
  if ($p.'HardwareInformation.qwMemorySize' -and $p.DriverDesc) {
    $regVram[$p.DriverDesc] = [double]$p.'HardwareInformation.qwMemorySize'
  }
}
foreach ($g in Get-CimInstance Win32_VideoController) {
  $bytes = if ($regVram.ContainsKey($g.Name)) { $regVram[$g.Name] } else { [double]$g.AdapterRAM }
  Log ("GPU: {0} | VRAM: {1:N1} GB | driver {2}" -f $g.Name, ($bytes / 1GB), $g.DriverVersion)
}
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
  Log 'NVIDIA:'
  nvidia-smi --query-gpu=name,memory.total,memory.free,driver_version --format=csv,noheader 2>&1 | ForEach-Object { Log $_ }
}

Section 'DISK'
Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
  Log ("{0} {1:N0} GB free of {2:N0} GB" -f $_.DeviceID, ($_.FreeSpace / 1GB), ($_.Size / 1GB))
}

Section 'DEVELOPMENT TOOLS'
Ver 'Python'   'python' '--version'
Ver 'py launcher' 'py' '--version'
Ver 'Node.js'  'node'   '--version'
Ver 'npm'      'npm'    '--version'
Ver 'Git'      'git'    '--version'
Ver 'Ollama'   'ollama' '--version'
Ver 'Docker'   'docker' '--version'
Ver 'ffmpeg'   'ffmpeg' '-version'
Ver 'WSL'      'wsl'    '--version'

Section 'OLLAMA MODELS ALREADY INSTALLED'
if (Get-Command ollama -ErrorAction SilentlyContinue) { ollama list 2>&1 | ForEach-Object { Log $_ } }
else { Log 'Ollama not installed' }

Section 'AUDIO'
Get-CimInstance Win32_SoundDevice | ForEach-Object { Log "Audio: $($_.Name)" }

Log ''
Log "Report saved to: $Out"
Log 'Paste the contents of this file into the chat with Claude.'
