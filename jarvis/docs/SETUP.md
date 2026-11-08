# JARVIS — Installazione sul tuo PC

Tutto gira in locale. Nessun abbonamento, nessuna API AI a pagamento.
Gli unici download grandi sono i modelli AI, e li scegli tu.

## 1. Prerequisiti (gratuiti)

| Programma | Versione | Link |
| --- | --- | --- |
| Python | 3.10 o superiore | https://www.python.org/downloads/ (Windows: spunta "Add to PATH") |
| Node.js | 20 o superiore | https://nodejs.org/ |
| Git | qualsiasi recente | https://git-scm.com/ |
| Ollama | ultima | https://ollama.com/download |
| Docker Desktop | facoltativo, per la ricerca web | https://www.docker.com/products/docker-desktop/ |

## 2. Scarica il codice e installa

```bash
git clone https://github.com/mexmassi-byte/mio-progetto-.git
cd mio-progetto-
git checkout claude/upbeat-rubin-co25tq
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\jarvis\scripts\install.ps1
```

macOS / Linux:

```bash
bash jarvis/scripts/install.sh
```

L'installazione crea solo `jarvis/backend/.venv` e `jarvis/frontend/dist`.
Non modifica il sistema e non scarica modelli.

## 3. Scegli e scarica il modello AI

Prima esegui l'audit hardware (`jarvis/scripts/hardware-audit.*`) e incolla
il risultato in chat: ti dico quale modello usare. Indicativamente:

| Il tuo PC | Comando | Download |
| --- | --- | --- |
| 8 GB RAM, niente GPU | `ollama pull qwen3:4b` | ~2,5 GB |
| 16 GB RAM o GPU 6–8 GB | `ollama pull qwen3:8b` | ~5 GB |
| GPU 12–16 GB o Mac 24–32 GB | `ollama pull qwen3:14b` | ~9 GB |
| GPU 24 GB o Mac ≥ 36 GB | `ollama pull qwen3:30b-a3b` | ~19 GB |
| sempre (memoria semantica) | `ollama pull nomic-embed-text` | ~0,3 GB |

Poi misura cosa sa fare davvero sul tuo PC:

```bash
jarvis/scripts/start.sh eval qwen3:8b
```

(su Windows: `.\jarvis\scripts\start.ps1 eval qwen3:8b`). Il report dà un
punteggio su 10. Come riferimento: `qwen3:0.6b` (il più piccolo) ottiene 7/10,
ma sbaglia gli argomenti dei tool e cede alla prompt injection. Per far lavorare
il motore autonomo serve almeno 8/10.

Il modello si imposta in **Sistema → Modelli installati → Usa**, oppure con
la variabile `JARVIS_LLM_MODEL`.

## 4. Avvio

```bash
bash jarvis/scripts/start.sh
```

Windows: `powershell -File .\jarvis\scripts\start.ps1`

Apri **http://127.0.0.1:8765** e incolla il token mostrato nel terminale
(lo ritrovi con `start.sh token`). Il server ascolta solo sul tuo PC.

Controllo rapido di cosa funziona:

```bash
bash jarvis/scripts/start.sh doctor
```

## 5. Componenti facoltativi

### Ricerca web locale (SearXNG)

Serve per `web_search` (la ricerca di aziende usa OpenStreetMap e funziona
anche senza).

```bash
docker compose -f jarvis/deploy/docker-compose.yml --env-file jarvis/deploy/.env up -d
```

Resta raggiungibile solo da `127.0.0.1:8888`. I motori di ricerca sottostanti
possono limitare le richieste se ne fai molte.

### Audit con browser reale (Playwright)

Aggiunge il controllo del layout mobile a 390 px e lo screenshot del sito:

```bash
jarvis/backend/.venv/bin/pip install playwright
jarvis/backend/.venv/bin/playwright install chromium
```

### Voce di JARVIS: Brian (ElevenLabs) — consigliata

La voce principale è **Brian** di ElevenLabs: maschile, profonda, la stessa in
italiano, tedesco e inglese. In `jarvis/backend/.env`:

```
JARVIS_TTS_PROVIDER=elevenlabs
JARVIS_ELEVENLABS_API_KEY=la-tua-chiave
JARVIS_ELEVENLABS_MONTHLY_CHARS=10000
```

- La chiave si crea su elevenlabs.io → profilo → API Keys, con il permesso
  "Text to Speech" su Access. Il file `.env` è escluso da git.
- Viene inviato a ElevenLabs solo il testo da leggere; modello e memoria restano
  sul Mac. Il registro audit annota solo il numero di caratteri, mai il testo.
- Il piano gratuito dà 10.000 caratteri al mese e **non include l'uso
  commerciale**: per parlare con i clienti di VEYRO Web serve il piano Starter.
  Le voci aggiunte dalla libreria richiedono comunque un piano a pagamento.
- Se ElevenLabs non risponde, finisce il credito o si supera il budget mensile,
  JARVIS usa la voce locale (Piper, sotto) senza interrompersi.

### Voce locale (riserva)

```bash
jarvis/backend/.venv/bin/pip install -e "jarvis/backend[voice]"
```

(Windows: `jarvis\backend\.venv\Scripts\pip install -e "jarvis\backend[voice]"`)

Installa faster-whisper (voce → testo) e Piper (testo → voce). Poi scarica una
voce italiana, per esempio Paola (~64 MB, due file nella stessa cartella):

- https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/paola/medium/it_IT-paola-medium.onnx
- https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/paola/medium/it_IT-paola-medium.onnx.json

e in `jarvis/backend/.env`:

```
JARVIS_PIPER_VOICE=C:/percorso/it_IT-paola-medium.onnx
JARVIS_WHISPER_MODEL=small
```

Il modello di riconoscimento si scarica al primo utilizzo (`small` ~460 MB;
`medium` ~1,5 GB, più preciso in italiano, consigliato se il PC è potente).
Provato: frase italiana sintetizzata in 2 s e ritrascritta in 4 s su CPU.

Senza Piper, JARVIS usa la voce del sistema operativo: la sfera mostra lo
stato "risposta" ma dichiara che l'ampiezza non è misurabile.

### Email (invio solo con approvazione)

Usa la tua casella esistente. Crea `jarvis/backend/.env`:

```
JARVIS_SMTP_HOST=smtp.tuoprovider.it
JARVIS_SMTP_PORT=587
JARVIS_SMTP_USER=info@veyroweb.com
JARVIS_SMTP_PASSWORD=...
JARVIS_SMTP_FROM=VEYRO Web <info@veyroweb.com>
```

Il file `.env` è escluso da git. Ogni invio passa dalla coda approvazioni e
finisce nel registro audit.

## 6. Configurazione

Tutte le opzioni sono variabili `JARVIS_*` (o righe in `jarvis/backend/.env`):

| Variabile | Default | Significato |
| --- | --- | --- |
| `JARVIS_LLM_PROVIDER` | `ollama` | `ollama`, `openai` (LM Studio / llama.cpp), `fake` |
| `JARVIS_LLM_BASE_URL` | `http://127.0.0.1:11434` | indirizzo del runtime AI |
| `JARVIS_LLM_MODEL` | `qwen3:8b` | modello principale |
| `JARVIS_USER_NAME` | `Massimiliano` | come JARVIS ti chiama |
| `JARVIS_LANGUAGE` | `it` | lingua delle risposte |
| `JARVIS_DATA_DIR` | `jarvis/data` | database, memoria, backup, log, workspace |
| `JARVIS_ENGINE_MAX_PARALLEL_MISSIONS` | `1` | missioni in parallelo |
| `JARVIS_DEFAULT_MISSION_MAX_STEPS` | `40` | budget passi per missione |

## 7. Dati e backup

Tutto è in `jarvis/data/` (escluso da git):

- `jarvis.db`: database (backup automatico giornaliero in `backups/`, 14 copie)
- `knowledge/*.md`: conoscenza modificabile (storico in `.history/`)
- `workspaces/`: progetti di sviluppo
- `logs/jarvis.log`: log

Per tenere JARVIS sempre attivo il PC deve restare acceso e non andare in
sospensione. Se si spegne, al riavvio le missioni ripartono dall'ultimo
passo salvato.
