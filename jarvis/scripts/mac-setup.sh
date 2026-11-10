#!/bin/bash
# JARVIS — installazione completa su Mac (Apple Silicon), con un solo comando:
#
#   curl -fsSL https://raw.githubusercontent.com/mexmassi-byte/mio-progetto-/claude/upbeat-rubin-co25tq/jarvis/scripts/mac-setup.sh | bash
#
# Installa (solo se mancano): Python 3.12 (python.org), Node.js 22 (nodejs.org),
# Ollama (ollama.com), il codice di JARVIS in ~/JARVIS, il modello qwen3:4b.
# Non usa Homebrew né gli strumenti di sviluppo Apple. Rilanciarlo aggiorna
# JARVIS senza toccare i dati (database, memoria, chiavi).
# Compatibile con il bash 3.2 di macOS.
set -euo pipefail

BRANCH="claude/upbeat-rubin-co25tq"
ZIP_URL="https://codeload.github.com/mexmassi-byte/mio-progetto-/zip/refs/heads/$BRANCH"
PY_URL="https://www.python.org/ftp/python/3.12.10/python-3.12.10-macos11.pkg"
NODE_DIR="https://nodejs.org/dist/latest-v22.x"
OLLAMA_URL="https://ollama.com/download/Ollama-darwin.zip"
# "qwen3:4b" on Ollama is now the *thinking* 2507 model (it always reasons out
# loud and ignores the think switch): JARVIS uses the instruct one, same size.
MODEL="qwen3:4b-instruct-2507-q4_K_M"
OLD_MODEL="qwen3:4b"
EMBED="nomic-embed-text"

HOME_DIR="$HOME/JARVIS"
PYBIN="/Library/Frameworks/Python.framework/Versions/3.12/bin"
OLLAMA_APP="/Applications/Ollama.app"
LOG="$HOME/JARVIS-install.log"
WORK="$(mktemp -d /tmp/jarvis-setup.XXXXXX)"

exec > >(tee -a "$LOG") 2>&1
trap 'echo; echo "✗ Qualcosa non è andato. Mandami il file $LOG"; rm -rf "$WORK"' ERR
trap 'rm -rf "$WORK"' EXIT

say() { printf "\n\033[1m→ %s\033[0m\n" "$*"; }
ok() { printf "  ✓ %s\n" "$*"; }

echo "JARVIS — installazione ($(date))"

# ------------------------------------------------------------------ controlli
[ "$(uname -s)" = "Darwin" ] || { echo "Questo script è per macOS."; exit 1; }
[ "$(uname -m)" = "arm64" ] || { echo "Serve un Mac con chip Apple (M1/M2/M3…)."; exit 1; }
FREE_GB=$(df -g "$HOME" | awk 'NR==2 {print $4}')
[ "$FREE_GB" -ge 8 ] || { echo "Spazio libero insufficiente: ${FREE_GB} GB (servono almeno 8 GB)."; exit 1; }
ok "macOS $(sw_vers -productVersion), chip Apple, ${FREE_GB} GB liberi"

echo
echo "Ti verrà chiesta la password del Mac per installare Python e Node.js"
echo "(sono gli installatori ufficiali, firmati e verificati da Apple)."

check_pkg() {  # firma Apple valida e notarizzata
  local out
  out=$(pkgutil --check-signature "$1")
  echo "$out" | grep -q "signed by a developer certificate issued by Apple" || { echo "Firma non valida: $1"; exit 1; }
  echo "$out" | grep -q "$2" || { echo "Firmatario inatteso per $1"; exit 1; }
}

# ------------------------------------------------------------------ Python
say "Python 3.12"
if [ -x "$PYBIN/python3.12" ]; then
  ok "già installato ($("$PYBIN/python3.12" --version))"
else
  curl -fL --progress-bar -o "$WORK/python.pkg" "$PY_URL"
  check_pkg "$WORK/python.pkg" "Python Software Foundation"
  sudo installer -pkg "$WORK/python.pkg" -target / >/dev/null
  ok "installato ($("$PYBIN/python3.12" --version))"
fi

# ------------------------------------------------------------------ Node.js
say "Node.js 22"
NODE_OK=0
if [ -x /usr/local/bin/node ]; then
  NODE_MAJOR=$(/usr/local/bin/node -p 'process.versions.node.split(".")[0]')
  [ "$NODE_MAJOR" -ge 20 ] && NODE_OK=1
fi
if [ "$NODE_OK" = 1 ]; then
  ok "già installato ($(/usr/local/bin/node --version))"
else
  NODE_PKG=$(curl -fsSL "$NODE_DIR/SHASUMS256.txt" | awk '/\.pkg$/ {print $2}')
  NODE_SUM=$(curl -fsSL "$NODE_DIR/SHASUMS256.txt" | awk '/\.pkg$/ {print $1}')
  curl -fL --progress-bar -o "$WORK/node.pkg" "$NODE_DIR/$NODE_PKG"
  echo "$NODE_SUM  $WORK/node.pkg" | shasum -a 256 -c - >/dev/null
  check_pkg "$WORK/node.pkg" "Developer ID Installer"
  sudo installer -pkg "$WORK/node.pkg" -target / >/dev/null
  ok "installato ($(/usr/local/bin/node --version))"
fi

export PATH="$PYBIN:/usr/local/bin:$PATH"

# ------------------------------------------------------------------ Ollama
say "Ollama (il cervello locale)"
if [ -d "$OLLAMA_APP" ]; then
  ok "già installato"
else
  curl -fL --progress-bar -o "$WORK/ollama.zip" "$OLLAMA_URL"
  ditto -x -k "$WORK/ollama.zip" "$WORK/ollama"
  codesign --verify --deep --strict "$WORK/ollama/Ollama.app"
  spctl --assess --type execute "$WORK/ollama/Ollama.app" || echo "  (avviso: Gatekeeper non ha confermato Ollama; la firma è comunque valida)"
  if [ -w /Applications ]; then mv "$WORK/ollama/Ollama.app" /Applications/; else sudo mv "$WORK/ollama/Ollama.app" /Applications/; fi
  ok "installato in /Applications"
fi
# Impostazioni misurate per 8 GB di memoria (docs/HARDWARE.md).
launchctl setenv OLLAMA_FLASH_ATTENTION 1
launchctl setenv OLLAMA_KV_CACHE_TYPE q8_0
launchctl setenv OLLAMA_NUM_PARALLEL 1
launchctl setenv OLLAMA_MAX_LOADED_MODELS 2
if ! curl -fs http://127.0.0.1:11434/api/version >/dev/null; then
  open -g -a "$OLLAMA_APP"
  for _ in $(seq 1 60); do curl -fs http://127.0.0.1:11434/api/version >/dev/null && break; sleep 1; done
fi
curl -fs http://127.0.0.1:11434/api/version >/dev/null || { echo "Ollama non risponde: aprilo da Applicazioni e rilancia."; exit 1; }
ok "Ollama attivo"

# ------------------------------------------------------------------ codice JARVIS
say "Codice di JARVIS (in $HOME_DIR)"
curl -fL --progress-bar -o "$WORK/jarvis.zip" "$ZIP_URL"
ditto -x -k "$WORK/jarvis.zip" "$WORK/src"
SRC=$(find "$WORK/src" -mindepth 1 -maxdepth 1 -type d | head -1)
mkdir -p "$HOME_DIR"
# Aggiorna il codice ma conserva dati, chiavi e ambienti già installati.
rsync -a --delete \
  --exclude "/jarvis/data/" --exclude "/jarvis/backend/.env" --exclude "/jarvis/backend/.venv/" \
  --exclude "/jarvis/frontend/node_modules/" --exclude "/jarvis/deploy/.env" \
  "$SRC/" "$HOME_DIR/"
ok "codice aggiornato"

# ------------------------------------------------------------------ installazione
say "Installazione di JARVIS (qualche minuto)"
cd "$HOME_DIR/jarvis"
# Se JARVIS è acceso, lo spengo per aggiornarlo (si riapre alla fine).
pkill -f "$HOME_DIR/jarvis/backend/.venv/bin/jarvis" 2>/dev/null && ok "JARVIS spento per l'aggiornamento" || true
bash scripts/install.sh
say "Voce e attivazione vocale (riconoscimento locale)"
backend/.venv/bin/pip install -q -e "backend[wake]"
# Scarica subito il riconoscimento locale (tiny ~75 MB + small ~460 MB), così
# "JARVIS, wake up" funziona dal primo avvio.
backend/.venv/bin/python -c "from faster_whisper import WhisperModel; WhisperModel('tiny', device='cpu', compute_type='int8'); WhisperModel('small', device='cpu', compute_type='int8')"
ok "pronto"

# ------------------------------------------------------------------ configurazione
ENV_FILE="$HOME_DIR/jarvis/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  say "Configurazione"
  cat > "$ENV_FILE" <<EOF
JARVIS_LLM_MODEL=$MODEL
JARVIS_LLM_EMBED_MODEL=$EMBED
JARVIS_LLM_CONTEXT_TOKENS=8192
JARVIS_LLM_THINK=false
JARVIS_LLM_MAX_TOKENS=1200
JARVIS_ENGINE_MAX_PARALLEL_MISSIONS=1
JARVIS_WHISPER_MODEL=small
JARVIS_LANGUAGE=it
EOF
  chmod 600 "$ENV_FILE"
  echo
  echo "Voce di JARVIS (Brian, ElevenLabs): incolla la tua chiave API e premi Invio."
  echo "Non si vede mentre la incolli. Premi solo Invio per saltare."
  printf "Chiave ElevenLabs: "
  KEY=""
  read -rs KEY < /dev/tty || true
  echo
  if [ -n "$KEY" ]; then
    printf "JARVIS_TTS_PROVIDER=elevenlabs\nJARVIS_ELEVENLABS_API_KEY=%s\n" "$KEY" >> "$ENV_FILE"
    ok "chiave salvata in backend/.env (solo sul tuo Mac)"
  else
    ok "voce ElevenLabs saltata: puoi aggiungerla dopo in $ENV_FILE"
  fi
  unset KEY
else
  ok "configurazione esistente conservata"
fi
# Modello: dalla versione "thinking" alla "instruct" (installazioni precedenti).
if grep -q "^JARVIS_LLM_MODEL=$OLD_MODEL\$" "$ENV_FILE"; then
  sed -i '' "s/^JARVIS_LLM_MODEL=$OLD_MODEL\$/JARVIS_LLM_MODEL=$MODEL/" "$ENV_FILE"
  ok "modello aggiornato a $MODEL"
fi
# Attivazione vocale accesa di default (si spegne o si silenzia dalla dashboard).
grep -q "^JARVIS_WAKE_ENABLED=" "$ENV_FILE" || echo "JARVIS_WAKE_ENABLED=true" >> "$ENV_FILE"

# ------------------------------------------------------------------ modelli
say "Modello AI $MODEL (~2,5 GB, solo la prima volta)"
OLLAMA_CLI="$OLLAMA_APP/Contents/Resources/ollama"
"$OLLAMA_CLI" pull "$MODEL"
"$OLLAMA_CLI" pull "$EMBED"
if "$OLLAMA_CLI" list | awk '{print $1}' | grep -qx "$OLD_MODEL"; then
  "$OLLAMA_CLI" rm "$OLD_MODEL" >/dev/null && ok "rimossa la versione \"thinking\" del modello (2,5 GB liberati)"
fi
ok "modelli pronti"

# ------------------------------------------------------------------ avvio rapido
LAUNCHER="$HOME/Desktop/JARVIS.command"
cat > "$LAUNCHER" <<'EOF'
#!/bin/bash
# Doppio clic: avvia Ollama e JARVIS e apre la dashboard.
export PATH="/Library/Frameworks/Python.framework/Versions/3.12/bin:/usr/local/bin:$PATH"
cd "$HOME/JARVIS/jarvis/backend" || exit 1
if ! curl -fs http://127.0.0.1:11434/api/version >/dev/null; then
  open -g -a /Applications/Ollama.app
  for _ in $(seq 1 60); do curl -fs http://127.0.0.1:11434/api/version >/dev/null && break; sleep 1; done
fi
open_dashboard() {
  for _ in $(seq 1 90); do curl -fs http://127.0.0.1:8765/api/health >/dev/null && break; sleep 1; done
  open "http://127.0.0.1:8765/#token=$(.venv/bin/jarvis token)"
}
if curl -fs http://127.0.0.1:8765/api/health >/dev/null; then
  open_dashboard
  exit 0
fi
echo "JARVIS si sta avviando… (chiudi questa finestra per spegnerlo)"
open_dashboard &
exec .venv/bin/jarvis
EOF
chmod +x "$LAUNCHER"
ok "icona JARVIS creata sulla Scrivania"
# Avvio automatico all'accesso al Mac: un LaunchAgent che apre l'icona JARVIS
# (si toglie da Impostazioni di Sistema → Generali → Elementi login).
AGENT="$HOME/Library/LaunchAgents/com.veyroweb.jarvis.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.veyroweb.jarvis</string>
  <key>ProgramArguments</key><array><string>/usr/bin/open</string><string>$LAUNCHER</string></array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
PLIST
plutil -lint "$AGENT" >/dev/null && ok "JARVIS partirà da solo quando accendi il Mac"

say "Fatto"
echo "  JARVIS è installato in $HOME_DIR"
echo "  Per avviarlo: doppio clic su «JARVIS» sulla Scrivania."
echo "  Al primo avvio macOS chiede il microfono per il Terminale: premi «Consenti»."
echo "  Poi di': «JARVIS, wake up.»"
echo "  Avvio ora la prima volta…"
open "$LAUNCHER"
