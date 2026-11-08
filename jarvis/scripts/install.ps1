# JARVIS installer (Windows PowerShell). Installs only inside the jarvis\ folder:
# a Python virtual environment and the interface build. Downloads NO AI model.
#   powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$py = Get-Command py -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command python -ErrorAction SilentlyContinue }
if (-not $py) { throw 'Python 3.10+ is required (https://www.python.org/downloads/)' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'Node.js 20+ is required (https://nodejs.org/)' }

Write-Host '-> Python environment (backend\.venv)'
& $py.Source -m venv backend\.venv
& backend\.venv\Scripts\python.exe -m pip install --upgrade pip | Out-Null
& backend\.venv\Scripts\python.exe -m pip install -e "backend[dev]"

Write-Host '-> Interface build'
Push-Location frontend
npm ci
npm run build
Pop-Location

if (-not (Test-Path deploy\.env)) {
  $secret = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  Set-Content -Path deploy\.env -Value "SEARXNG_SECRET=$secret" -Encoding ASCII
}

Write-Host ''
Write-Host 'Done. Next steps:'
Write-Host '  1. Install Ollama: https://ollama.com/download'
Write-Host '  2. Download the model chosen for your PC (see docs\SETUP.md), e.g.:'
Write-Host '       ollama pull qwen3:8b'
Write-Host '       ollama pull nomic-embed-text'
Write-Host '  3. Start JARVIS:  powershell -File .\scripts\start.ps1'
