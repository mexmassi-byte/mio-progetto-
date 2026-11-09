# JARVIS

Sistema operativo AI locale e autonomo: il dipendente digitale di **VEYRO Web**.
Gira sul tuo PC con un modello locale (Ollama), memoria persistente, motore di
missioni, tool propri e un'interfaccia a particelle in tre modalità. Non dipende
da Claude Code né da API AI a pagamento.

- **Installazione:** [`docs/SETUP.md`](docs/SETUP.md)
- **Stato del lavoro, cosa è verificato e cosa no:** [`docs/PROGRESS.md`](docs/PROGRESS.md)
- **Analisi iniziale e architettura:** [`docs/00-phase0.md`](docs/00-phase0.md)

## Avvio rapido

```bash
bash jarvis/scripts/install.sh      # Windows: jarvis\scripts\install.ps1
ollama pull qwen3:8b && ollama pull nomic-embed-text
bash jarvis/scripts/start.sh        # → http://127.0.0.1:8765
```

## Cosa fa

| Sezione | Funzione |
| --- | --- |
| **Overview** (modalità A) | paesaggio 3D di particelle costruito sull'attività reale delle ultime 48 h, istogrammi, missioni, eventi |
| **Ricerca** (modalità B) | Terra di particelle: le città cercate e le aziende trovate si accendono, archi dalla base, avanzamento della ricerca |
| **Voce** (modalità C) | sfera organica che reagisce all'audio reale di microfono e voce di JARVIS |
| **Missioni** | obiettivi autonomi: piano, passi, retry, budget, approvazioni, verifica finale |
| **Vendite** | CRM: lead da OpenStreetMap, audit dei siti, punteggio trasparente, bozze email/telefonate/proposte, pagamenti verificati |
| **Sviluppo** | workspace isolati, file, comandi consentiti (git, npm, pytest), generazione codice |
| **Memoria** | memorie con affidabilità e revisioni, file Markdown di conoscenza |
| **Sistema** | modello, componenti, permessi dei tool, registro audit, backup |

Esempi da scrivere nella barra in basso:

- "JARVIS, trova cinque studi dentistici a Monaco con un sito da rifare e prepara le bozze."
- "Analizza https://www.esempio.de e dimmi cosa proporre."
- "Ricorda che il pacchetto sito vetrina costa 1.500 €."

## Regole che il codice impone (non il prompt)

- Ascolta solo su `127.0.0.1`, con token locale.
- Invii, telefonate, pubblicazioni e deploy aspettano la tua approvazione;
  spese e operazioni irreversibili richiedono di scrivere `CONFERMO`.
- Il contenuto web è dato non affidabile: dopo averlo letto, nello stesso turno
  non si possono avviare azioni.
- Un lead diventa "cliente" solo con un pagamento che confermi tu.
- Una missione è "completata" solo se la condizione finale è verificata dal codice.

## Struttura

```
jarvis/
├── backend/            Python · FastAPI · SQLite
│   ├── jarvis/         api, core (missioni, planner, engine), llm, memory,
│   │                   tools, departments/{sales,dev}, voice, security, db
│   ├── evals/          jarvis eval: misura il modello sul tuo PC
│   └── tests/          76 test automatici
├── frontend/           React · TypeScript · three.js (shader GLSL)
│   └── src/visuals/    dataLandscape, particleGlobe, voiceSphere
├── assets/references/  i 3 riferimenti visivi
├── deploy/             SearXNG (ricerca web locale, facoltativa)
├── scripts/            audit hardware, install, start
└── data/               (creata all'avvio, esclusa da git)
```

## Sviluppo

```bash
cd jarvis/backend && .venv/bin/pytest -q           # test backend
cd jarvis/frontend && npm run dev                  # UI con hot reload su :5173
```
