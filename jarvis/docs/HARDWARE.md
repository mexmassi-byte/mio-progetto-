# Audit hardware — PC dell'utente

Data: 8 novembre 2026. Rilevato con comandi in sola lettura sul Mac.

| Voce | Valore |
| --- | --- |
| Computer | MacBook Air |
| Sistema | macOS 14.5 Sonoma |
| Chip | Apple M2 (GPU Metal) |
| Memoria | 8 GB unificata (CPU + GPU) — 34% libera al momento dell'audit |
| Disco | 25 GB liberi secondo `df` (61 GB nel Finder, incluso spazio liberabile) |
| Strumenti Apple (git) | non installati |
| Python | non installato |
| Node.js | non installato |
| Homebrew | non installato |
| Ollama | non installato |

## Configurazione scelta

- Modello: **`qwen3:4b`** (Q4_K_M, ~2,5 GB) + `nomic-embed-text` (~0,3 GB).
  `qwen3:8b` è escluso: con 8 GB di memoria condivisa andrebbe in swap.
- Contesto: **8.192 token** con cache a 8 bit (~0,6 GB) → totale ~3,3–3,6 GB.
  Se la pressione di memoria diventa gialla: 6.144.
- Una richiesta alla volta, pensiero nascosto disattivato.
- Interfaccia in qualità media (GPU e memoria condivise con il modello).

Variabili Ollama (da impostare all'installazione):

```
OLLAMA_FLASH_ATTENTION=1
OLLAMA_KV_CACHE_TYPE=q8_0
OLLAMA_NUM_PARALLEL=1
OLLAMA_MAX_LOADED_MODELS=2
```

`jarvis/backend/.env`:

```
JARVIS_LLM_MODEL=qwen3:4b-instruct-2507-q4_K_M
JARVIS_LLM_CONTEXT_TOKENS=8192
JARVIS_LLM_THINK=false
JARVIS_LLM_MAX_TOKENS=1200
JARVIS_ENGINE_MAX_PARALLEL_MISSIONS=1
JARVIS_WHISPER_MODEL=small
JARVIS_TTS_PROVIDER=elevenlabs
JARVIS_ELEVENLABS_API_KEY=...   # voce Brian; riserva locale: Piper
```

## Installazione

Un solo comando: `jarvis/scripts/mac-setup.sh` (vedi docs/SETUP.md).

Python 3.12 (python.org), Node.js 22 LTS (nodejs.org), app Ollama, codice
JARVIS come ZIP da GitHub (evita gli strumenti Apple), poi i modelli.
Totale su disco: ~5 GB.

## Da misurare dopo l'installazione

- `jarvis eval qwen3:4b`: punteggio (soglia per l'autonomia: 8/10).
- Tempo della prima risposta e token al secondo.
- Pressione di memoria con JARVIS + interfaccia aperti.

## Nota (10 novembre 2026): quale qwen3:4b

Su Ollama il nome `qwen3:4b` oggi indica **Qwen3-4B-Thinking-2507**: ragiona
sempre ad alta voce e ignora l'interruttore `think`. Sul Mac il ragionamento
finiva nella risposta e veniva letto dalla voce. JARVIS usa
**`qwen3:4b-instruct-2507-q4_K_M`** (stessa dimensione, 2,5 GB, nessun
ragionamento, risposte più rapide). In più JARVIS toglie sempre dalla risposta
qualsiasi ragionamento del modello, anche se arriva senza il tag di apertura.
