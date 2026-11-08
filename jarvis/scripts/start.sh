#!/usr/bin/env bash
# Start JARVIS on http://127.0.0.1:8765 (local only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
[ -x .venv/bin/jarvis ] || { echo "Run scripts/install.sh first"; exit 1; }
exec .venv/bin/jarvis "$@"
