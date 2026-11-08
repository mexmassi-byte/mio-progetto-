# JARVIS — Phase 0: audit, analisi e piano

Stato: **Phase 0 in corso.** Riferimenti visivi salvati e analizzati,
architettura proposta, script di audit pronti. **Manca l'audit reale del tuo
PC**: senza quello non scelgo il modello e non inizio il codice (regola della
Part 15).

---

## 0. Perché l'audit non è ancora fatto

Lo sviluppo gira su un server cloud, non sul tuo computer. Il computer
`192.168.1.53` è nella tua lista Remote Control, ma la cartella `BusinessML`
non è disponibile per le sessioni cloud (di solito perché è dentro una cartella
nascosta della home o perché l'app Claude su quel PC va aggiornata).

Due strade:

1. **Subito:** esegui lo script di audit sul PC e incolla il risultato in chat.
   - Windows: `jarvis/scripts/hardware-audit.ps1`
   - macOS / Linux: `jarvis/scripts/hardware-audit.sh`
   Sono solo lettura: non installano, non scaricano, non modificano nulla.
2. **Per le fasi successive:** aggiorna l'app Claude sul PC e condividi una
   cartella non nascosta (es. `~/Progetti/jarvis`) in Impostazioni → Claude
   Code → Remote Control. Così potrò lavorare e testare direttamente sul PC
   (Ollama, microfono, Playwright girano lì).

---

## 1. Analisi dei riferimenti visivi

File in `jarvis/assets/references/` (associati per contenuto):

| File | Modalità | Immagine |
| --- | --- | --- |
| `01-dashboard-reference.jpg` | A — Command Center | paesaggio di particelle + pannelli tecnici |
| `02-globe-reference.jpg` | B — Global Research | Terra di particelle |
| `03-voice-reference.jpg` | C — Voice | sfera organica di particelle |

### Linguaggio comune (vale per tutte e tre)

- Fondo **nero puro**. Nessun colore: solo bianco, grigi, argento.
- La luce è data dalla **densità dei punti**, non da gradienti: dove i punti
  si addensano l'immagine è chiara, dove si diradano è scura. → rendering a
  punti con **blending additivo**; la luminosità "nasce" dalla sovrapposizione.
- Punti minuscoli (1–2 px), con leggera variazione di dimensione e opacità.
- Tipografia tecnica **minuscola, monospazio**, grigia a bassa opacità; righe
  sottilissime (1 px, bianco al 20–30%). Nessun box arrotondato, nessuna ombra.
- Movimento lento, continuo, "scientifico". Niente glow blu, niente neon.

### A — Command Center (01)

- **Soggetto principale:** una "montagna di dati" volumetrica fatta di punti,
  con creste e pieghe. La cima è la zona più densa e luminosa; verso la base i
  punti si diradano in una nebbia granulosa.
- **Seconda fascia** (metà inferiore): una linea di creste più bassa, tipo
  ridgeline, più trasparente.
- **In basso:** due istogrammi a barre verticali puntinate, con assi sottili ed
  etichette delle tacche ruotate.
- **Pannelli:** barra superiore con micro-etichette; colonna destra con tabelle
  di testo minuscolo; un numero grande isolato (`-8/706`) come unico elemento
  tipografico "forte".
- **Implementazione:** griglia di ~30–60k punti come heightfield. L'altezza è
  la somma di gaussiane, **una per dato reale** (es. una cima per missione
  attiva, alta quanto il lavoro svolto), più rumore simplex per la texture del
  terreno. Luminosità ∝ altezza e pendenza. Camera bassa, prospettica, deriva
  lenta. Gli istogrammi sono gli stessi dati (lead per giorno, task completati)
  disegnati come colonne di punti.

### B — Global Research (02)

- **Soggetto:** Terra con **continenti riconoscibili** fatti di una griglia
  regolare e fitta di punti; oceani neri, quasi vuoti.
- **Luce di bordo** (fresnel): il contorno del disco è più chiaro, soprattutto
  in alto a sinistra; il lato destro è più scuro.
- **Alone:** particelle sparse fuori dalla sfera (raggio 1,02–1,3), più fitte
  vicino al bordo, più qualche puntino "stella" lontano.
- **Implementazione:** punti campionati su sfera e tenuti solo sulle terre
  emerse (maschera da **Natural Earth**, pubblico dominio), shader con fresnel,
  alone come secondo sistema di particelle. Le città vengono da **GeoNames**
  (CC BY 4.0). Gli eventi reali di ricerca (es. "analizzo studi dentistici a
  Monaco") accendono il punto della città, tracciano archi a cerchio massimo
  con un impulso che viaggia, e ruotano il globo verso la zona.

### C — Voice (03)

- **Soggetto:** sfera **organica e irregolare**, non liscia: si vedono
  "nastri" e pieghe ondulate, come più gusci sovrapposti che si deformano.
- Il **bordo è più denso** e luminoso del centro (vediamo attraverso la sfera),
  il silhouette è frastagliato.
- **Implementazione:** 3–5 gusci concentrici di punti, spostati lungo la
  normale da rumore simplex 3D che evolve nel tempo, ognuno con fase diversa:
  è questo che crea l'effetto a nastri. Uniform dello shader:
  - `uAmplitude` ← ampiezza **reale** dell'audio (Web Audio `AnalyserNode` sul
    microfono quando ascolta, sull'uscita della sintesi vocale quando parla);
  - `uState` ← idle / listening / thinking / speaking, che cambia frequenza e
    velocità del rumore.
  Se l'audio non è disponibile, l'interfaccia lo dice ("audio non attivo") e la
  sfera usa solo l'animazione di stato, senza fingere un'analisi audio.

---

## 2. Scelta del modello (da confermare con l'audit)

Dimensioni indicative di download in quantizzazione Q4 su Ollama. La libreria
Ollama cambia spesso: in Phase 1 verifico le versioni disponibili in quel
momento e **non scarico nulla senza il tuo ok**.

| Il tuo hardware | Modello proposto | Download | Cosa aspettarsi |
| --- | --- | --- | --- |
| 8 GB RAM, nessuna GPU dedicata | `qwen3:4b` | ~2,5 GB | chat e bozze ok; pianificazione debole |
| 16 GB RAM, oppure GPU 6–8 GB | `qwen3:8b` o `llama3.1:8b` | ~5 GB | buono per bozze, tool semplici, piani brevi |
| GPU 12–16 GB, oppure Mac 24–32 GB | `qwen3:14b` | ~9 GB | **minimo consigliato** per l'orchestratore |
| GPU 24 GB, oppure Mac ≥ 36 GB | `qwen3:30b-a3b` (MoE) o `qwen3:32b` | ~19–20 GB | il migliore in locale per piani multi-step |
| sempre | `nomic-embed-text` (memoria semantica) | ~0,3 GB | ricerca per significato nella memoria |

**Le capacità si testano, non si presumono.** Phase 1 include una suite di
valutazione (~20 compiti con tool: estrarre dati, scegliere il tool giusto,
rispettare uno schema JSON, rifiutare istruzioni iniettate da una pagina web).
Il modello si sceglie dal punteggio misurato sul tuo PC.

Il livello `llm/` è astratto: Ollama oggi, ma anche LM Studio o llama.cpp
(API compatibile OpenAI) senza riscrivere l'applicazione.

---

## 3. Architettura proposta

Un solo processo backend locale + un'interfaccia web locale. Niente
microservizi.

```
Browser (localhost)                    Backend Python (127.0.0.1)
┌─────────────────────────┐   REST    ┌──────────────────────────────────────┐
│ React + TS + Vite       │◄────────►│ FastAPI                              │
│ three.js / R3F + GLSL   │ WebSocket │  ├─ Orchestrator (piano → esecuzione)│
│  A paesaggio di dati    │◄─eventi──│  ├─ Task queue + scheduler (SQLite)  │
│  B globo                │           │  ├─ Tool registry + permessi + audit │
│  C sfera vocale         │           │  ├─ Memoria (SQLite + Markdown)      │
│ Missions·Sales·Dev·...  │           │  ├─ Sales · Development              │
└─────────────────────────┘           │  ├─ Browser (Playwright, isolato)    │
                                      │  └─ Voce (STT/TTS locali)            │
                                      └───────────┬──────────────────────────┘
                                                  │ HTTP locale
                                           ┌──────▼──────┐
                                           │   Ollama    │
                                           └─────────────┘
```

**Un unico flusso di eventi** collega intelligenza e visual: ogni azione
(task avviato, ricerca su una città, sito analizzato, audio in ingresso)
diventa un evento salvato in SQLite e inviato via WebSocket. Il paesaggio, il
globo e la sfera si muovono **solo** in risposta a questi eventi: così le
animazioni non possono mentire sullo stato del sistema.

### Struttura delle cartelle

```
jarvis/
├── backend/
│   ├── jarvis/
│   │   ├── api/            # rotte REST + WebSocket
│   │   ├── core/           # orchestrator, planner, executor, scheduler
│   │   ├── llm/            # provider astratti (Ollama, OpenAI-compatibili)
│   │   ├── memory/         # memorie, revisioni, file Markdown, ricerca
│   │   ├── tools/          # tool registrati (web, file, crm, ...)
│   │   ├── departments/
│   │   │   ├── sales/      # ricerca lead, audit siti, scoring, CRM, outreach
│   │   │   └── dev/        # workspace isolati, codice, test, git
│   │   ├── voice/          # STT, TTS, VAD
│   │   ├── security/       # auth locale, permessi, audit log
│   │   └── db/             # modelli, migrazioni (Alembic), backup
│   ├── evals/              # suite di valutazione dei modelli
│   └── tests/
├── frontend/
│   └── src/
│       ├── visuals/        # landscape/, globe/, sphere/ (shader + particelle)
│       ├── modes/          # command/, research/, voice/
│       └── pages/          # missions, sales, dev, memory, settings
├── data/                   # NON versionato: db, knowledge/*.md, backup, log, workspace
├── assets/references/
├── scripts/
└── docs/
```

### Scelte tecniche

| Area | Scelta | Perché |
| --- | --- | --- |
| Backend | Python, FastAPI, Pydantic, asyncio | ecosistema AI/automazione migliore, async per task lunghi |
| DB | SQLite (WAL) + SQLAlchemy + Alembic | zero server, un file, migrazioni, backup con l'API nativa |
| Memoria semantica | `sqlite-vec` + embedding Ollama | resta tutto in un file SQLite; opzionale se l'hardware è scarso |
| Coda task | tabella SQLite + loop asyncio proprio | sopravvive ai riavvii; checkpoint, retry, timeout, budget |
| Frontend | React + TypeScript + Vite | standard, veloce in sviluppo |
| Rendering | three.js con React Three Fiber, shader GLSL propri | particelle su GPU; R3F si integra con React |
| Browser | Playwright (profilo isolato) + Lighthouse | navigazione, screenshot, audit performance/mobile in locale |
| Ricerca web | SearXNG self-hosted (Docker) | gratis e locale; i motori sottostanti possono limitare le richieste |
| Dati aziende | OpenStreetMap / Overpass (ODbL) + sito dell'azienda (Impressum in DE) | fonti pubbliche e legittime, gratuite con uso moderato |
| Voce in ingresso | faster-whisper + Silero VAD | locale, buon italiano e tedesco |
| Voce in uscita | Piper (voci italiane) | locale e veloce; qualità buona ma non da "voce umana" |
| Font | IBM Plex Mono + IBM Plex Sans, ospitati in locale | look tecnico; nessuna dipendenza da Google Fonts |

### Sicurezza (dal primo commit)

- Server in ascolto **solo su 127.0.0.1**; token locale generato al primo
  avvio; CORS solo per l'origine locale.
- I permessi sono **applicati dal codice, non dal prompt**: un tool con effetti
  esterni (invio email, pubblicazione, deploy) passa sempre dalla coda
  approvazioni, qualunque cosa chieda il modello.
- Il contenuto web è sempre marcato come dato non affidabile; i testi trovati
  sulle pagine non possono cambiare permessi o obiettivi.
- Accesso ai file limitato a `data/` e ai workspace; subprocess con allowlist.
- Audit log di ogni operazione esterna; backup giornaliero del DB con rotazione.

---

## 4. Limiti

- **Un modello locale non è un dipendente umano.** Un 8–14B scrive bene e usa
  tool semplici, ma si perde nei piani lunghi. Lo compenso con piani
  strutturati (schema JSON), passi piccoli, budget per task e **verifiche fatte
  dal codice** (es. "il sito risponde?", "il lead ha un'email pubblica?"). Più
  è potente il PC, più autonomia reale avrà.
- **Il PC deve restare acceso.** Se va in sospensione i task si fermano e
  ripartono dall'ultimo checkpoint.
- **Costi non nascosti:** ricerca, analisi e bozze sono gratis. L'invio email
  usa la tua casella esistente (SMTP, gratis ma soggetto ad approvazione).
  Telefonia e WhatsApp API sono a pagamento: non li includo di default.
- **Legge sull'outreach (da far verificare a un legale):**
  - **Germania (UWG §7):** l'email pubblicitaria senza consenso preventivo
    esplicito è vietata, **anche verso aziende**. Le chiamate a un'azienda
    richiedono almeno un consenso presunto.
  - **Italia:** l'email promozionale richiede consenso preventivo (art. 130
    Codice Privacy); le chiamate sono soggette al Registro Pubblico delle
    Opposizioni.
  - Quindi JARVIS **prepara** audit e messaggi personalizzati e tiene traccia
    della base giuridica di ogni contatto, ma **non invia nulla da solo**.
- **Prestazioni grafiche:** 3 sistemi da decine di migliaia di particelle sono
  leggeri per una GPU recente, pesanti per una grafica integrata vecchia. Il
  numero di particelle si adatta al frame rate misurato.

---

## 5. Milestone 1 (= Phase 1, Core) — proposta

**Obiettivo:** un JARVIS che si avvia, parla con il modello locale e ricorda.

1. Backend FastAPI su `127.0.0.1`, avvio con un solo comando, token locale.
2. Integrazione Ollama: controllo di stato, lista modelli, chat in streaming.
3. Suite di valutazione dei modelli → report con punteggio per modello sul
   tuo PC.
4. Conversazioni salvate in SQLite: riavvio → la cronologia c'è ancora.
5. Memoria: categorie della Part 7, affidabilità (verificato / fornito
   dall'utente / stima / ipotesi / superato), revisioni (niente sovrascritture
   silenziose), file Markdown modificabili, UI per vedere / modificare /
   cancellare.
6. Shell dell'interfaccia nera con le 8 sezioni; quelle non ancora costruite
   lo dicono esplicitamente ("Phase 2", ecc.).
7. Test automatici (pytest) per API, memoria e provider.

**Criterio di "fatto":** ti mostro chat, memoria e riavvio funzionanti sul tuo
PC, con i test che passano e l'elenco di cosa non funziona ancora.

Poi **Phase 2**: i tre visual (paesaggio, globo, sfera) costruiti sui
riferimenti, già collegati al flusso eventi.

---

## 6. Cosa mi serve da te

1. **L'output dello script di audit** (o almeno: sistema operativo, RAM,
   modello della GPU).
2. Conferma che va bene sviluppare JARVIS nella cartella `jarvis/` di questo
   repository, oppure crea un repository dedicato (es. `jarvis`) e lo uso.
3. Lingua principale di JARVIS: italiano? (influisce su voci e prompt).
