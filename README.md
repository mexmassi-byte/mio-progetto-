# ThePaddockView

Piattaforma di analisi telemetrica in stile SaaS per la Formula 1 — tema dark
"cockpit / data platform". Il frontend è completo e interattivo; i dati sono
**segnaposto deterministici** dietro un layer dati progettato per essere
sostituito con API reali **senza toccare la UI**.

> ⚠️ Nessun dato ufficiale di Formula 1 è integrato. I valori mostrati sono
> segnaposto coerenti, generati in modo deterministico.

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
- [Collegare API reali](#collegare-api-reali)
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
│   └── sources/
│       ├── RaceDataSource.ts#   contratto (interfaccia) = "API contract"
│       ├── mockSource.ts    #   implementazione placeholder (attiva)
│       └── httpSource.ts    #   scheletro per API reale (inerte, guida)
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
(`RaceDataSource`) fornisce i dati. Oggi è il mock, domani sarà un'API.

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
│  const source: RaceDataSource = mockSource   │
└───────────────────────┬─────────────────────┘
                        │  delega a
                        ▼
┌─────────────────────────────────────────────┐
│  RaceDataSource  (interfaccia / contratto)   │
│    implementato da:                          │
│    • mockSource  →  data/*  (ATTIVO)         │
│    • httpSource  →  API reale (scheletro)    │
└─────────────────────────────────────────────┘
```

Regole:

1. **I componenti importano solo** `@/services/raceService` (per i dati) e
   `@/domain/models` (per i tipi). Mai da `@/data/*`.
2. **`mockSource` è l'unico** modulo che importa `@/data/*`.
3. **Nessun dato/derivazione hardcoded nei componenti**: KPI, classifiche,
   snapshot campionato, utente, ecc. sono calcolati nel data layer.
4. Cambiare sorgente dati = cambiare **una riga** in `raceService.ts`.

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

## Collegare API reali

Tutto è già predisposto: la UI è sincrona e disaccoppiata, il contratto è
definito, lo scheletro HTTP esiste.

**Passi:**

1. Configura il base URL — copia `.env.example` in `.env.local`:

   ```bash
   VITE_API_BASE_URL=https://api.thepaddockview.com/v1
   ```

   (tipizzato in `src/vite-env.d.ts`; fallback same-origin `/api/v1`.)

2. Implementa i metodi in `src/services/sources/httpSource.ts` usando
   `RaceApiClient` (il wrapper `fetch` con la richiesta già abbozzata). Mappa
   suggerita degli endpoint documentata nel file stesso.

3. Attiva la sorgente in `src/services/raceService.ts` — **una riga**:

   ```ts
   import { httpSource } from './sources/httpSource'
   const source: RaceDataSource = httpSource
   ```

4. **La UI non cambia.** Legge già tutto tramite `raceService`.

### Il ponte sincrono → asincrono

`RaceDataSource` è volutamente **sincrono** per non toccare i componenti. Un'API
reale è asincrona: il ponte consigliato è **prefetch + cache**.

```
prefetch(gp, session)  →  fetch async  →  popola una cache in memoria
        │                                        │
        └── gated da un loading state ───────────┘
getX(...)  →  legge dalla cache (sincrono)
```

Il loading è già modellato da `useSimulatedFetch`: diventerà lo stato "pending"
reale del prefetch, quindi **il component layer resta invariato**. Dettagli e
mappa endpoint nei commenti di `httpSource.ts`.

> Nota: comparison, battle, insight e replay sono **derivati**. Possono restare
> lato client (riusando le funzioni pure) o essere serviti dall'API — la scelta
> è dell'implementatore.

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

Frontend completo e interattivo (Home, Dashboard, Driver Comparison, Race
Replay, Battle Mode, AI Race Engineer), design premium coerente, architettura
dati pronta per l'integrazione reale. Prossimo grande passo: implementare
`httpSource` contro un'API di Formula 1.
