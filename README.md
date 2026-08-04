# ThePaddockView

Piattaforma di analisi telemetrica in stile SaaS per la Formula 1 — tema dark
"cockpit / data platform". Il frontend è completo e interattivo e legge **dati
reali di Formula 1** attraverso un layer dati che isola completamente la UI
dalla loro provenienza.

**Fonti dati (pubbliche, senza chiave API):**

| Fonte | Cosa fornisce |
| --- | --- |
| [Jolpica-F1](https://github.com/jolpica/jolpica-f1) (successore di Ergast) | stagioni, calendario, piloti + scuderie, classifica piloti |
| [OpenF1](https://openf1.org) | giri di sessione (tempi, settori, trappola velocità), stint gomme, distanza di gara |

> ℹ️ Se le API non sono raggiungibili — offline, rete bloccata, endpoint in
> errore — ogni singola porzione di dati ricade su un **segnaposto
> deterministico**: la UI non si rompe mai e l'indicatore in alto a sinistra
> dichiara sempre quale delle due sorgenti è attiva.
>
> Le analisi derivate (Driver DNA, Predict, AI Coach, AI Race Engineer) sono
> **elaborazioni interne** calcolate su questi dati, non output di un modello
> esterno: nell'interfaccia sono etichettate come `stima`.

📐 **Preparazione alla 1.0** — audit architetturale e guida all'integrazione di
dati, autenticazione e pagamenti reali: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Indice

- [Stack](#stack)
- [Avvio rapido](#avvio-rapido)
- [Struttura del progetto](#struttura-del-progetto)
- [Architettura a layer](#architettura-a-layer)
- [Data flow](#data-flow)
- [Aggiungere una nuova pagina](#aggiungere-una-nuova-pagina)
- [Configurazione dati e API](#configurazione-dati-e-api)
- [Deploy](#deploy)
- [Design system & convenzioni](#design-system--convenzioni)

---

## Stack

- **React 18** + **TypeScript** (strict)
- **Vite 5** — dev server e build
- **Tailwind CSS 3** — tema dark personalizzato (`tailwind.config.js`)
- **React Router 6** — routing completo
- **lucide-react** — icone

## Avvio rapido

```bash
npm install       # dipendenze
npm run dev       # http://localhost:5173
npm run build     # type-check (tsc -b) + build di produzione in dist/
npm run preview   # anteprima della build
npm run lint      # type-check senza emit
```

Variabili d'ambiente: copia `.env.example` in `.env.local` (vedi
[Collegare API reali](#collegare-api-reali)).

---

## Struttura del progetto

```
src/
├── main.tsx                 # entry: monta il RouterProvider
├── index.css                # Tailwind + stili base (reduced-motion, scrollbar…)
│
├── domain/
│   └── models.ts            # ⬛ MODELLI — l'unica sorgente di verità dei tipi
│
├── services/                # ⬛ DATA LAYER — accesso ai dati
│   ├── raceService.ts       #   punto di accesso UNICO usato dalla UI
│   ├── api/                 #   client + adattatori delle API pubbliche
│   │   ├── jolpica.ts       #     Jolpica-F1 (calendario, piloti, classifica)
│   │   ├── openf1.ts        #     OpenF1 (giri, settori, stint gomme)
│   │   └── mappers.ts       #     payload esterni → modelli di dominio
│   └── sources/
│       ├── RaceDataSource.ts#   contratto (interfaccia) = "API contract"
│       ├── apiSource.ts     #   dati reali + fallback per-slice (ATTIVA)
│       ├── mockSource.ts    #   implementazione segnaposto deterministica
│       └── httpSource.ts    #   scheletro per un'API privata (inerte, guida)
│
├── data/                    # interni del mockSource (generatori deterministici)
│   ├── comparison.ts        #   piloti, GP, sessioni, stats, comparison, battle
│   ├── engineer.ts          #   generazione insight "AI Race Engineer"
│   └── replay.ts            #   geometria tracciato + campionamento replay
│
├── router/
│   └── index.tsx            # definizione delle rotte
├── config/
│   └── navigation.ts        # voci di navigazione (sidebar/topbar)
│
├── components/
│   ├── layout/              # Layout (shell), Sidebar, Topbar
│   ├── ui/                  # design system riutilizzabile (Button, Card, …)
│   ├── comparison/          # componenti specifici (LapTimeChart, MatchControls…)
│   └── replay/              # CircuitMap
│
├── pages/                   # una pagina per rotta
│   ├── Home.tsx             # landing standalone (fuori dallo shell)
│   ├── Dashboard.tsx        # hub centrale
│   ├── DriverComparison.tsx
│   ├── RaceReplay.tsx
│   ├── BattleMode.tsx
│   ├── AIRaceEngineer.tsx
│   └── NotFound.tsx
│
└── lib/
    ├── cn.ts                # combinatore di className
    └── useSimulatedFetch.ts # loading state simulato (seam per il fetch reale)
```

I riquadri ⬛ segnano i due layer chiave dell'architettura dati.

---

## Architettura a layer

Il principio guida: **la UI non sa da dove arrivano i dati.** Ogni pagina parla
solo con `raceService`; dietro il servizio, una sorgente intercambiabile
(`RaceDataSource`) fornisce i dati. Oggi è `apiSource` (dati reali con fallback
segnaposto), domani può essere un'API privata senza toccare una riga di UI.

```
┌─────────────────────────────────────────────┐
│  UI  — pages/ + components/                  │
│  importa: @/services/raceService             │
│           @/domain/models  (solo tipi)       │
└───────────────────────┬─────────────────────┘
                        │  chiama metodi sincroni
                        ▼
┌─────────────────────────────────────────────┐
│  raceService  (services/raceService.ts)      │  ← punto di accesso UNICO
│  sorgente scelta da VITE_DATA_SOURCE         │
└───────────────────────┬─────────────────────┘
                        │  delega a
                        ▼
┌─────────────────────────────────────────────┐
│  RaceDataSource  (interfaccia / contratto)   │
│    implementato da:                          │
│    • apiSource   →  api/*  (ATTIVA)          │
│         └─ fallback per-slice ↓              │
│    • mockSource  →  data/*                   │
│    • httpSource  →  API privata (scheletro)  │
└─────────────────────────────────────────────┘
```

### Contratto sincrono su dati asincroni

`RaceDataSource` è sincrono di proposito: nessun componente ha dovuto cambiare
per ricevere dati reali. `apiSource` regge questo contratto con una cache in
memoria e due funzioni di riempimento:

- `bootstrap()` — chiamata una volta in `main.tsx`, carica stagione, calendario,
  griglia e classifica;
- `loadSession(gpId, session)` — innescata dal primo getter che richiede una
  sessione non ancora in cache.

Finché una porzione non è arrivata (o se la richiesta fallisce) il getter
restituisce il segnaposto corrispondente. Le pagine si aggiornano da sole:
`useDataVersion()` sottoscrive le variazioni della cache e rientra nelle
dipendenze dei `useMemo` che leggono il servizio.

Poiché la griglia reale sostituisce quella segnaposto **dopo il primo render**,
le selezioni persistite passano da `@/lib/selection`, che le rivalida a ogni
cambio di dati: un id che non esiste più ricade sul default della pagina e, se
manca anche quello, sulla prima voce disponibile.

Regole:

1. **I componenti importano solo** `@/services/raceService` (per i dati) e
   `@/domain/models` (per i tipi). Mai da `@/data/*` o `@/services/api/*`.
2. **`mockSource` è l'unico** modulo che importa `@/data/*`; **`apiSource` è
   l'unico** che importa `@/services/api/*`.
3. **Nessun dato/derivazione hardcoded nei componenti**: KPI, classifiche,
   snapshot campionato, utente, ecc. sono calcolati nel data layer.
4. Cambiare sorgente dati = variabile d'ambiente `VITE_DATA_SOURCE`
   (`api` predefinita · `mock` · `http`).

### I modelli (`domain/models.ts`)

Superficie unica e standardizzata dei tipi:

| Entità              | Tipo                    |
| ------------------- | ----------------------- |
| Pilota              | `Driver`                |
| Gran Premio         | `GrandPrix`             |
| Sessione            | `SessionType`           |
| Statistiche gara    | `DriverStats`           |
| Risultato confronto | `ComparisonResult`      |
| Risultato battle    | `BattleResult`          |
| Frame replay        | `ReplayFrame` / `ReplaySample` |
| Insight AI          | `Insight`               |
| Aggregati Dashboard | `SessionKpis`, `LeaderboardRow`, `ChampionshipEntry` |
| Utente              | `CurrentUser`           |

---

## Data flow

Esempio: la pagina **Driver Comparison** confronta due piloti.

```
[selezione utente: driverA, driverB, gp, session]
        │  useState
        ▼
raceService.getDriverStats(driverA, gp, session)   ─┐
raceService.getDriverStats(driverB, gp, session)   ─┤  useMemo
raceService.compareDrivers(dataA, dataB)           ─┘
        │  ritorna DriverStats / ComparisonResult (da @/domain/models)
        ▼
[render: colonne pilota, grafico, head-to-head, summary]
```

Punti chiave:

- I calcoli derivati (`compareDrivers`, `battle`, `getInsight`,
  `sampleReplay`, KPI…) vivono nel data layer, **non** nella pagina.
- I risultati sono **deterministici**: stessa selezione → stessi valori, così
  la UI reagisce in modo credibile.
- Il loading elegante dei grafici usa `useSimulatedFetch`, che è anche il
  **seam** dove aggancerai lo stato "pending" del fetch reale.

---

## Aggiungere una nuova pagina

Esempio: aggiungere una pagina **"Tyre Strategy"** in `/tyre-strategy`.

1. **Crea la pagina** in `src/pages/TyreStrategy.tsx`:

   ```tsx
   import { PageHeader, Card } from '@/components/ui'
   import { raceService } from '@/services/raceService'
   import type { SessionType } from '@/domain/models'

   export function TyreStrategy() {
     // leggi i dati SOLO dal servizio
     const drivers = raceService.getDrivers()
     // ...
     return (
       <div className="space-y-6">
         <PageHeader title="Tyre Strategy" /* icon, badge… */ />
         {/* usa i componenti del design system: Card, Select, StatCard… */}
       </div>
     )
   }
   ```

2. **Registra la rotta** in `src/router/index.tsx` come figlia del `Layout`
   (per avere sidebar + topbar):

   ```tsx
   { path: 'tyre-strategy', element: <TyreStrategy /> },
   ```

3. **Aggiungi la voce di menu** in `src/config/navigation.ts`:

   ```ts
   { label: 'Tyre Strategy', to: '/tyre-strategy', icon: CircleDot, group: 'analysis' },
   ```

   Sidebar e topbar si aggiornano da soli (leggono da qui).

4. **Serve un nuovo dato?** Non calcolarlo nella pagina:
   - aggiungi il metodo all'interfaccia `RaceDataSource`,
   - implementalo in `mockSource` (e nello scheletro `httpSource`),
   - i modelli nuovi vanno in `domain/models.ts`.

> Regola d'oro: se stai per scrivere logica sui dati dentro un componente,
> spostala nel data layer ed esponila come metodo del servizio.

---

## Configurazione dati e API

### Variabili d'ambiente

Copia `.env.example` in `.env.local`. Nessuna è obbligatoria: senza file
l'applicazione parte già sui dati reali pubblici.

| Variabile | Default | A cosa serve |
| --- | --- | --- |
| `VITE_DATA_SOURCE` | `api` | Sorgente attiva: `api` (reale + fallback), `mock`, `http` |
| `VITE_JOLPICA_BASE_URL` | `https://api.jolpi.ca/ergast/f1` | Mirror o proxy di Jolpica-F1 |
| `VITE_OPENF1_BASE_URL` | `https://api.openf1.org/v1` | Mirror o proxy di OpenF1 |
| `VITE_API_BASE_URL` | `/api/v1` | Base URL dell'eventuale API privata (`httpSource`) |

### Collegare un'API privata o a pagamento

Le fonti pubbliche non espongono tutto (posizione in gara live, dati
proprietari). Per collegare un feed privato **non serve toccare la UI**:

1. Metti la chiave in `.env.local` — è l'**unico punto** che la conosce:

   ```bash
   VITE_API_BASE_URL=https://api.fornitore.com/v1
   VITE_API_KEY=...
   ```

   Aggiungi la variabile ai tipi in `src/vite-env.d.ts`.

2. Implementa i metodi in `src/services/sources/httpSource.ts` usando
   `RaceApiClient` (wrapper `fetch` già abbozzato, mappa endpoint nei commenti).

3. Attiva la sorgente: `VITE_DATA_SOURCE=http`.

4. **La UI non cambia.** Legge già tutto tramite `raceService`.

> ⚠️ Una chiave in una variabile `VITE_*` finisce nel bundle ed è visibile a
> chiunque apra i DevTools. Per un fornitore a pagamento la chiave va tenuta su
> un proxy server-side, e `VITE_API_BASE_URL` deve puntare a quel proxy.

### Il ponte sincrono → asincrono

È lo stesso schema già implementato in `apiSource` (prefetch + cache):

```
bootstrap() / loadSession()  →  fetch async  →  cache in memoria
        │                                             │
        └── stato pubblicato da getApiStatus() ───────┘
getX(...)  →  legge dalla cache (sincrono, con fallback al mock)
```

> Nota: comparison, battle, insight, DNA, predict e replay sono **derivati**.
> Possono restare lato client (riusando le funzioni pure) o essere serviti
> dall'API — la scelta è dell'implementatore.

---

## Deploy

Le configurazioni sono già nel repository; il build è una SPA, quindi tutte
richiedono il rewrite delle rotte su `index.html`.

| Piattaforma | File | Note |
| --- | --- | --- |
| Vercel | `vercel.json` | rewrite SPA + header di sicurezza |
| Netlify | `netlify.toml`, `public/_redirects` | rewrite SPA + header |
| GitHub Pages | `.github/workflows/deploy.yml` | build, type-check e copia di `index.html` in `404.html` |

```bash
npm run build     # output in dist/
npm run preview   # verifica locale del build di produzione
```

---

## Design system & convenzioni

- **Componenti UI riutilizzabili** in `src/components/ui` (barrel export in
  `index.ts`): `Button`, `Card`, `Badge`, `Select`, `StatCard`, `PageHeader`,
  `EmptyState`, `Skeleton`. Preferiscili sempre a markup ad-hoc.
- **Tema** in `tailwind.config.js`: palette `base-*` (superfici), `line` /
  `line-strong` (bordi), `accent` (rosso F1), `signal` (ciano/verde/ambra/viola).
  Colori-serie validati per contrasto/daltonismo (rosso `A`, ciano `B`).
- **Animazioni** leggere via classi Tailwind (`animate-page-in`, `animate-fade-up`,
  `animate-shimmer`…), con rispetto di `prefers-reduced-motion`.
- **Alias di import**: `@/*` → `src/*`.
- **Percorsi consentiti**:
  - pagine/componenti → `@/services/raceService`, `@/domain/models`, `@/components/*`, `@/lib/*`
  - solo `mockSource` → `@/data/*`
- **TypeScript strict** con `noUnusedLocals` / `noUnusedParameters`: i parametri
  inutilizzati vanno prefissati con `_`.

---

## Stato attuale

Frontend completo e interattivo (Home, Dashboard, Driver Comparison, Driver
DNA, Race Replay, Battle Mode, Predict, AI Race Engineer, AI Coach, account e
acquisto una tantum), collegato a dati reali di Formula 1 tramite fonti
pubbliche senza chiave API.

**Cosa manca per una 1.0 pienamente operativa** — tutto ciò che richiede un
server, e che nessuna quantità di codice client può risolvere:

- autenticazione reale (oggi la sessione vive in `localStorage`);
- pagamento reale e verifica dell'accesso lato server (il diritto d'accesso è
  oggi un campo del browser: la firma locale rende evidente la manomissione, ma
  non può impedirla);
- persistenza dell'account e dei preferiti su database;
- proxy server-side se in futuro si aggiunge un feed a pagamento con chiave.

Dettagli e piano in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
