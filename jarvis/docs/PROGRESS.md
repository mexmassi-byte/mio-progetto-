# JARVIS — Stato del lavoro

Ultimo aggiornamento: 8 novembre 2026. Branch: `claude/upbeat-rubin-co25tq`.

## Riepilogo

| Fase | Contenuto | Stato |
| --- | --- | --- |
| 0 | Audit, riferimenti, architettura | fatto, **manca l'audit del tuo PC** |
| 1 | Core: backend, DB, Ollama, chat, memoria | fatto e testato |
| 2 | Identità visiva: 3 modalità a particelle | fatto, da rifinire con il tuo feedback |
| 3 | Motore autonomo | fatto e testato |
| 4 | Reparto vendite | fatto e testato (dati di prova + 1 sito reale) |
| 5 | Reparto sviluppo | fatto e testato (base) |
| 6 | Voce e notifiche | fatto e provato nel browser con microfono simulato |
| 7 | Test e ottimizzazione | in parte: 46 test automatici, eval sul modello reale |

## Cosa è stato verificato davvero

- **46 test automatici** passano (`pytest`): database e migrazioni, backup,
  memoria con revisioni, permessi, timeout, URL privati rifiutati, prompt
  injection (blocco in codice), pianificazione, missioni end-to-end, retry,
  budget, ripresa dopo riavvio, annullamento, audit siti, punteggio, CRM,
  pagamenti verificati, isolamento workspace, comandi consentiti, API, chat in
  streaming, WebSocket.
- **Modello reale** (Ollama 0.40 + `qwen3:0.6b`, su CPU cloud):
  - suite `jarvis eval`: **7/10**;
  - missione reale "Analizza il sito https://example.com": pianificata,
    eseguita (audit HTTP vero), report scritto dal modello, **verificata dal
    codice** → `completed`;
  - chat con salvataggio in memoria tramite tool.
- **Voce locale:** Piper (voce italiana Paola) ha sintetizzato una frase in 2 s,
  faster-whisper `small` l'ha ritrascritta in 4 s su CPU, con piccoli errori
  ("Massimilano", "identistici"). Trovata e corretta un'incompatibilità di
  versioni (PyAV ≥ 17 rompe faster-whisper 1.2).
- **Conversazione vocale completa nel browser** (Chromium con microfono
  simulato da file audio): ascolto → rilevamento della pausa → trascrizione →
  risposta del modello → voce Piper → di nuovo in attesa, in 10 s totali; la
  sfera si espande con l'ampiezza misurata della voce.
- **Installazione pulita** con `install.sh` → avvio → interfaccia servita con
  CSP → `jarvis doctor`.
- **Interfaccia** renderizzata in Chromium headless (WebGL software): le tre
  modalità funzionano. Le schermate di confronto con i riferimenti sono state
  fatte con dati di prova, mai inclusi nel codice.

## Problemi trovati con il modello reale (e già corretti in codice)

1. Il planner riceveva un catalogo ambiguo: il modello copiava "[autonomous]"
   nel nome del tool. Catalogo riscritto, nomi tollerati → pianificazione da
   "fallita in 155 s" a "valida in 25 s".
2. Il modello piccolo obbedisce a istruzioni nascoste nelle pagine web. Ora,
   dopo aver letto contenuto web nello stesso turno, avviare missioni o
   chiedere azioni è **bloccato dal codice** e registrato nell'audit.
3. Il modello marcava come "verificato" ciò che gli dicevi. Ora solo tu puoi
   marcare un'informazione come verificata; i duplicati vengono ignorati.

4. Qwen3 "pensa" in modo nascosto prima di rispondere: 7 volte più lento.
   Ora il pensiero nascosto è disattivato di default (`JARVIS_LLM_THINK`),
   con ripiego automatico per i modelli che non lo supportano.
5. Un modello piccolo può entrare in un ciclo e generare senza fine. Ora c'è
   un tetto di 1500 token per risposta (`JARVIS_LLM_MAX_TOKENS`).
6. Senza GPU il browser disegna le particelle con la CPU e toglie potenza al
   modello (53 token in 162 s). Ora JARVIS riconosce il rendering software e
   passa a qualità bassa a 20 fotogrammi al secondo.

## Cosa NON è ancora verificato

- **Il tuo PC:** nessun test sul tuo hardware. Serve l'output di
  `scripts/hardware-audit.*`.
- **Ricerca aziende su OpenStreetMap:** il server Overpass non era
  raggiungibile dall'ambiente cloud; il codice è testato con dati simulati.
  Sarà la prima cosa da provare sul tuo PC.
- **Microfono fisico:** il flusso è stato provato con un microfono simulato;
  con un microfono vero contano rumore di fondo e soglia della pausa
  (`SPEECH_RMS` in `Voice.tsx`).
- **Invio email:** implementato ma non provato con un server SMTP reale.
- **Modelli più grandi** (8B–14B): da misurare con `jarvis eval` sul tuo PC.
- **Ricerca web SearXNG:** configurazione pronta, non avviata qui.

## Limiti noti

- La qualità dell'autonomia dipende dal modello: con un modello < 8/10 nella
  eval, usa JARVIS soprattutto per ricerca, audit e bozze, e controlla i piani.
- Le missioni di acquisizione clienti usano un playbook fisso e testato
  (cerca → analizza → punteggio → seleziona → bozze → report); le missioni
  libere sono "completate, non verificate" perché non esiste un controllo
  automatico del risultato.
- Nessun invio automatico: è una scelta legale (UWG §7, art. 130 Codice
  Privacy), non un limite tecnico.
- Il globo usa dati Natural Earth 1:50M: coste riconoscibili, non dettagliate.

## Prossimi passi consigliati

1. Mandami l'audit hardware → scelgo il modello → `jarvis eval`.
2. Installa e avvia JARVIS (docs/SETUP.md), compila `data/knowledge/veyro-web.md`
   con servizi e prezzi reali.
3. Prima missione reale: "Trova 5 studi dentistici a Monaco con un sito da
   rifare" → controlla lead, audit e bozze.
4. Feedback sui tre visual rispetto ai riferimenti.
5. Poi: voce reale, Playwright, SearXNG, eventuale connessione Remote Control
   per lavorare direttamente sul tuo PC.
