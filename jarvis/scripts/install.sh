#!/usr/bin/env bash
# JARVIS installer (macOS / Linux). Installs only inside the jarvis/ folder:
# a Python virtual environment and the interface build. Downloads NO AI model.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

command -v python3 >/dev/null || { echo "Python 3.10+ is required"; exit 1; }
command -v npm >/dev/null || { echo "Node.js 20+ is required"; exit 1; }

echo "→ Python environment (backend/.venv)"
python3 -m venv backend/.venv
backend/.venv/bin/pip install --upgrade pip >/dev/null
backend/.venv/bin/pip install -e "backend[dev]"

echo "→ Interface build"
(cd frontend && npm ci && npm run build)

if [ ! -f deploy/.env ]; then
  echo "SEARXNG_SECRET=$(python3 -c 'import secrets; print(secrets.token_hex(32))')" > deploy/.env
  chmod 600 deploy/.env
fi

echo
echo "Done. Next steps:"
echo "  1. Install Ollama: https://ollama.com/download"
echo "  2. Download the model chosen for your PC (see docs/SETUP.md), e.g.:"
echo "       ollama pull qwen3:4b-instruct-2507-q4_K_M  # ~2.5 GB (Mac 8 GB)"
echo "       ollama pull nomic-embed-text # ~0.3 GB (memory search)"
echo "  3. Start JARVIS:  bash scripts/start.sh"
