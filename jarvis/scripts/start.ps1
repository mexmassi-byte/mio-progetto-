# Start JARVIS on http://127.0.0.1:8765 (local only).
$Root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $Root 'backend')
if (-not (Test-Path .venv\Scripts\jarvis.exe)) { throw 'Run scripts\install.ps1 first' }
& .venv\Scripts\jarvis.exe @args
