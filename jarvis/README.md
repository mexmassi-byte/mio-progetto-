# JARVIS

Sistema operativo AI locale e autonomo: il dipendente digitale di **VEYRO Web**.
Gira sul PC dell'utente con un modello locale (Ollama), memoria persistente,
motore di task, tool propri e interfaccia a particelle in tre modalità
(Command Center, Global Research, Voice). Non dipende da Claude Code né da API
AI a pagamento.

## Stato

| Fase | Contenuto | Stato |
| --- | --- | --- |
| 0 | Audit hardware, analisi riferimenti, architettura | **in corso**: manca l'audit del PC |
| 1 | Core: backend, DB, Ollama, chat, memoria, UI base | da iniziare |
| 2 | Identità visiva: paesaggio, globo, sfera | — |
| 3 | Motore autonomo: planner, coda, scheduler, tool | — |
| 4 | Reparto vendite: ricerca, audit siti, scoring, CRM, outreach | — |
| 5 | Reparto sviluppo: workspace, codice, test, git | — |
| 6 | Voce e notifiche | — |
| 7 | Test e ottimizzazione | — |

Piano completo: [`docs/00-phase0.md`](docs/00-phase0.md).

## Audit hardware (Phase 0)

Script di sola lettura: non installano e non scaricano nulla.

Windows (PowerShell, dalla cartella `jarvis/scripts`):

```powershell
powershell -ExecutionPolicy Bypass -File .\hardware-audit.ps1
```

macOS / Linux:

```bash
bash jarvis/scripts/hardware-audit.sh
```

Generano `jarvis-hardware-report.txt`: incollane il contenuto in chat.

## Riferimenti visivi

`assets/references/01-dashboard-reference.jpg`,
`02-globe-reference.jpg`, `03-voice-reference.jpg`.
