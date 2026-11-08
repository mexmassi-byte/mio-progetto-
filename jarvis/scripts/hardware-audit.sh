#!/usr/bin/env bash
# JARVIS — Phase 0 hardware audit (macOS / Linux)
#
# READ-ONLY: installs nothing, downloads nothing, changes no setting.
# It only reads system information and writes the report to
# ~/jarvis-audit.txt (also printed on screen).
#
# On macOS without Apple's Command Line Tools, typing `python3` or `git`
# opens an installation dialog: this script checks first and never calls
# those placeholders.
#
# Usage:   bash hardware-audit.sh

set -u
OUT="$HOME/jarvis-audit.txt"
: > "$OUT"

log()     { printf '%s\n' "$*" | tee -a "$OUT"; }
section() { log ""; log "=== $* ==="; }
OS="$(uname -s)"

clt_ok() { [ "$OS" != "Darwin" ] || xcode-select -p >/dev/null 2>&1; }

tool() { # name -> version line, without triggering macOS install dialogs
  local name="$1" path
  path="$(command -v "$name" 2>/dev/null || true)"
  if [ -z "$path" ]; then log "$name: non trovato"; return; fi
  if [ "$OS" = "Darwin" ] && { [ "$path" = "/usr/bin/python3" ] || [ "$path" = "/usr/bin/git" ]; } && ! clt_ok; then
    log "$name: non installato (solo segnaposto Apple)"; return
  fi
  log "$name: $("$name" --version 2>&1 | head -n 1) ($path)"
}

log "JARVIS hardware audit — $(date '+%Y-%m-%d %H:%M:%S')"

section "SISTEMA OPERATIVO"
if [ "$OS" = "Darwin" ]; then
  log "macOS $(sw_vers -productVersion) (build $(sw_vers -buildVersion))"
else
  [ -r /etc/os-release ] && . /etc/os-release && log "${PRETTY_NAME:-Linux}"
fi
log "Kernel: $(uname -r)  Architettura: $(uname -m)"

section "CPU / CHIP"
if [ "$OS" = "Darwin" ]; then
  system_profiler SPHardwareDataType 2>/dev/null \
    | grep -E "Model Name|Model Identifier|Chip|Total Number of Cores|Memory" | sed 's/^ *//' | tee -a "$OUT"
  log "Core performance/efficienza: $(sysctl -n hw.perflevel0.physicalcpu 2>/dev/null)/$(sysctl -n hw.perflevel1.physicalcpu 2>/dev/null)"
else
  log "Modello: $(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2- | sed 's/^ //')"
  log "Core logici: $(nproc)"
fi

section "GPU"
if [ "$OS" = "Darwin" ]; then
  system_profiler SPDisplaysDataType 2>/dev/null \
    | grep -E "Chipset Model|Total Number of Cores|Metal" | sed 's/^ *//' | tee -a "$OUT"
else
  command -v lspci >/dev/null && lspci 2>/dev/null | grep -Ei 'vga|3d|display' | tee -a "$OUT"
  command -v nvidia-smi >/dev/null && nvidia-smi --query-gpu=name,memory.total --format=csv,noheader | tee -a "$OUT"
fi

section "MEMORIA"
if [ "$OS" = "Darwin" ]; then
  log "RAM totale: $(( $(sysctl -n hw.memsize) / 1073741824 )) GB (unificata CPU+GPU)"
  log "$(memory_pressure 2>/dev/null | tail -n 1)"
  log "Swap: $(sysctl -n vm.swapusage 2>/dev/null)"
  vm_stat 2>/dev/null | grep -E "Pages free|Pages active|Pages inactive|Pages wired|Pages occupied by compressor" | tee -a "$OUT"
else
  free -h | tee -a "$OUT"
fi

section "DISCO"
df -h / | tee -a "$OUT"
[ "$OS" = "Darwin" ] && df -h "$HOME" | tail -n 1 | tee -a "$OUT"

section "STRUMENTI DI SVILUPPO"
if [ "$OS" = "Darwin" ]; then
  if clt_ok; then log "Command Line Tools Apple: $(xcode-select -p)"; else log "Command Line Tools Apple: NON installati"; fi
fi
for t in python3 python3.10 python3.11 python3.12 python3.13 pip3 node npm git brew docker ffmpeg; do tool "$t"; done

section "OLLAMA"
if command -v ollama >/dev/null 2>&1; then
  tool ollama
  log "-- modelli installati:"; ollama list 2>&1 | tee -a "$OUT"
  log "-- modelli caricati ora:"; ollama ps 2>&1 | tee -a "$OUT"
else
  log "Ollama: non installato"
fi
[ -d /Applications/Ollama.app ] && log "App Ollama presente in /Applications"

log ""
log "Report salvato in: $OUT"
log "Incolla il contenuto di questo file nella chat con Claude."
