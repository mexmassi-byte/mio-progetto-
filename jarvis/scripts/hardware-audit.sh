#!/usr/bin/env bash
# JARVIS — Phase 0 hardware audit (macOS / Linux)
#
# READ-ONLY: this script installs nothing, downloads nothing and changes
# no system settings. It only reads system information and writes a
# report to ./jarvis-hardware-report.txt in the current directory.
#
# Usage:   bash hardware-audit.sh

set -u
OUT="jarvis-hardware-report.txt"
: > "$OUT"

log()     { printf '%s\n' "$*" | tee -a "$OUT"; }
section() { log ""; log "=== $* ==="; }
have()    { command -v "$1" >/dev/null 2>&1; }
ver()     { # name, command...
  local name="$1"; shift
  if have "$1"; then
    log "$name: $("$@" 2>&1 | head -n 1)"
  else
    log "$name: NOT INSTALLED"
  fi
}

OS="$(uname -s)"
log "JARVIS hardware audit — $(date '+%Y-%m-%d %H:%M:%S')"

section "OPERATING SYSTEM"
if [ "$OS" = "Darwin" ]; then
  log "macOS $(sw_vers -productVersion) (build $(sw_vers -buildVersion))"
else
  if [ -r /etc/os-release ]; then . /etc/os-release; log "${PRETTY_NAME:-Linux}"; fi
fi
log "Kernel: $(uname -r)  Arch: $(uname -m)"

section "CPU"
if [ "$OS" = "Darwin" ]; then
  log "Model: $(sysctl -n machdep.cpu.brand_string 2>/dev/null)"
  log "Cores (physical/logical): $(sysctl -n hw.physicalcpu)/$(sysctl -n hw.logicalcpu)"
  P=$(sysctl -n hw.perflevel0.physicalcpu 2>/dev/null) && log "Performance cores: $P"
  E=$(sysctl -n hw.perflevel1.physicalcpu 2>/dev/null) && log "Efficiency cores: $E"
else
  log "Model: $(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2- | sed 's/^ //')"
  log "Logical cores: $(nproc)"
  have lscpu && log "$(lscpu | grep -E '^(Core\(s\) per socket|Socket\(s\))')"
  grep -qw avx2 /proc/cpuinfo && log "AVX2: yes" || log "AVX2: no"
  grep -qw avx512f /proc/cpuinfo && log "AVX-512: yes" || log "AVX-512: no"
fi

section "MEMORY (RAM)"
if [ "$OS" = "Darwin" ]; then
  BYTES=$(sysctl -n hw.memsize)
  log "Total RAM: $((BYTES / 1024 / 1024 / 1024)) GB"
  [ "$(uname -m)" = "arm64" ] && log "Apple Silicon: unified memory (shared by CPU and GPU)"
  log "Memory pressure: $(memory_pressure 2>/dev/null | grep -i 'free percentage' | head -n1)"
else
  have free && log "$(free -h | sed -n '1,2p')"
fi

section "GPU / VRAM"
if [ "$OS" = "Darwin" ]; then
  system_profiler SPDisplaysDataType 2>/dev/null \
    | grep -E 'Chipset Model|Total Number of Cores|VRAM|Metal' | sed 's/^ *//' | tee -a "$OUT"
else
  have lspci && lspci 2>/dev/null | grep -Ei 'vga|3d|display' | tee -a "$OUT"
fi
if have nvidia-smi; then
  log "NVIDIA:"
  nvidia-smi --query-gpu=name,memory.total,memory.free,driver_version --format=csv,noheader 2>&1 | tee -a "$OUT"
fi
have rocm-smi && { log "AMD ROCm:"; rocm-smi --showproductname --showmeminfo vram 2>&1 | tee -a "$OUT"; }

section "DISK (home directory volume)"
df -h "$HOME" | tee -a "$OUT"

section "DEVELOPMENT TOOLS"
ver "Python3"  python3 --version
ver "pip"      python3 -m pip --version
ver "Node.js"  node --version
ver "npm"      npm --version
ver "Git"      git --version
ver "Ollama"   ollama --version
ver "Docker"   docker --version
ver "ffmpeg"   ffmpeg -version
ver "Homebrew" brew --version

section "OLLAMA MODELS ALREADY INSTALLED"
if have ollama; then ollama list 2>&1 | tee -a "$OUT"; else log "Ollama not installed"; fi

section "AUDIO"
if [ "$OS" = "Darwin" ]; then
  system_profiler SPAudioDataType 2>/dev/null | grep -E '^ {8}[^ ].*:$' | sed 's/^ *//' | tee -a "$OUT"
else
  have arecord && arecord -l 2>&1 | grep -E '^card' | tee -a "$OUT"
fi

log ""
log "Report saved to: $(pwd)/$OUT"
log "Paste the contents of this file into the chat with Claude."
