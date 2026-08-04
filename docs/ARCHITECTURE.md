# ThePaddockView — Architecture & Integration Guide

> Documento tecnico per preparare il progetto alla **versione 1.0** con dati,
> autenticazione e pagamenti reali. Nessun codice UI viene modificato: questa è
> la mappa di *dove* e *come* agganciare i sistemi reali.

Ultimo audit: beta feature-complete (12 sezioni), build pulita, 0 errori runtime.

---

## Indice

1. [Architettura attuale](#1-architettura-attuale)
2. [Flusso dei dati](#2-flusso-dei-dati)
3. [Audit — punti placeholder e servizi](#3-audit)
4. [Dove collegare i dati reali](#4-dove-collegare-i-dati-reali)
5. [Integrare autenticazione reale](#5-integrare-autenticazione-reale)
6. [Integrare i pagamenti](#6-integrare-i-pagamenti)
7. [Mantenere la coerenza dell'app](#7-mantenere-la-coerenza)
8. [Checklist pre-1.0](#8-checklist-pre-10)

---

## 1. Architettura attuale

Stack: **React 18 + TypeScript (strict) + Vite 5 + Tailwind 3 + React Router 6**.

Principio guida: **la UI non conosce la sorgente dei dati.** Ogni pagina parla
solo con due superfici — un **servizio** (dati) e i **modelli** di dominio (tipi).

```
┌──────────────────────────────────────────────────────────────┐
│  UI  — src/pages/* + src/components/*                          │
│  import: @/services/raceService · @/services (auth via hook)   │
│          @/domain/models (solo tipi)                           │
└───────────────┬───────────────────────────┬──────────────────┘
                │ dati F1                     │ account
                ▼                             ▼
   ┌─────────────────────────┐   ┌───────────────────────────┐
   │ raceService             │   │ AuthContext (useAuth)      │
   │  (services/raceService) │   │  → authService             │
   └───────────┬─────────────┘   └───────────┬───────────────┘
               │ delega a                     │ oggi: localStorage
               ▼                              ▼ domani: API + token
   ┌─────────────────────────┐   ┌───────────────────────────┐
   │ RaceDataSource (contratto)│  │ billingService            │
   │  • mockSource (ATTIVO)    │  │  (acquisto una tantum)     │
   │  • httpSource (scheletro) │  └───────────────────────────┘
   └───────────┬─────────────┘
               ▼
   src/data/*  (generatori placeholder deterministici)
```

### Mappa delle cartelle

| Cartella | Ruolo | Stato 1.0 |
|---|---|---|
| `src/domain/models.ts` | **Modelli** = contratto dei tipi che la UI renderizza | resta invariato |
| `src/services/raceService.ts` | **Punto di accesso unico** ai dati F1 | resta invariato |
| `src/services/sources/RaceDataSource.ts` | **Interfaccia / contratto API** (27 metodi) | resta invariato |
| `src/services/sources/mockSource.ts` | Implementazione placeholder (unica a toccare `@/data/*`) | sostituita da httpSource |
| `src/services/sources/httpSource.ts` | **Scheletro API** (inerte, endpoint map documentata) | da implementare |
| `src/services/authService.ts` | Auth placeholder (localStorage, async) | da collegare all'API |
| `src/services/billingService.ts` | Checkout placeholder — **acquisto una tantum** (no abbonamenti) | da collegare al provider |
| `src/context/AuthContext.tsx` | Stato auth globale (`useAuth`) | resta invariato |
| `src/data/*` | Generatori F1 fittizi (comparison, dna, predict, coach, replay, engineer) | rimossi/relegati a fixtures |
| `src/components/ui/*` | Design system riutilizzabile | resta invariato |
| `src/components/{comparison,dna,replay,predict}/*` | Grafici/controlli (props pure) | resta invariato |
| `src/lib/*` | Utilità: `format`, `tone`, `cn`, `useSimulatedFetch` | resta invariato |

---

## 2. Flusso dei dati

Esempio (Driver Comparison), rappresentativo di ogni pagina:

```
[selezione utente: driverA, driverB, gp, session]  ── useState
        │
        ▼  useMemo
raceService.getDriverStats(driverA, gp, session)   → DriverStats
raceService.getDriverStats(driverB, gp, session)   → DriverStats
raceService.compareDrivers(a, b)                   → ComparisonResult
        │  (tipi da @/domain/models)
        ▼
[render: colonne pilota, LapTimeChart, head-to-head, summary]
```

Caratteristiche attuali:

- **Sincrono e deterministico**: stessa selezione → stessi valori su *tutte* le
  pagine (Dashboard, Driver DNA, Predict, Race Replay, AI Coach, …).
- **Derivazioni nel data layer**, non nei componenti (KPI, leaderboard,
  campionato, insight, prediction, DNA, coach).
- **Loading seam già presente**: `useSimulatedFetch` (Dashboard, Driver
  Comparison) è il punto in cui diventerà lo stato "pending" di un fetch reale.

Auth flow:

```
authService.getCurrentUser() → AuthProvider(state) → useAuth() → pagine/sidebar
login/signup/logout/updateProfile → authService → setUser(...)
purchase() → billingService.createCheckout() → authService.grantFullAccess()
```

---

## 3. Audit

### 3.1 Punti in cui sono usati dati placeholder

| Dove | Cosa | Come sostituire |
|---|---|---|
| `src/data/comparison.ts` | Griglia F1 (`TEAMS`, `GRID`), calendario (`GRANDS_PRIX`), enum sessioni/gomme, generatore `generateDriverData`, `buildComparison`, `buildBattle` | API telemetria/entità |
| `src/data/dna.ts` | `DRIVER_SKILL`, `SIGNATURES`, `generateDriverDNA`, `analyzeDriverDNA`, `SEASONS` | API profili / modello |
| `src/data/predict.ts` | `SC_BASE`, `PIT_SEVERITY`, `WEATHER`, `generatePrediction` | Modello di previsione |
| `src/data/coach.ts` | `COACH_SESSIONS`, `COACH_PROMPTS`, `generateCoachInsights`, `askCoach` | Modello AI / analytics |
| `src/data/replay.ts` | `TRACKS` (geometria SVG), `sampleFrame` | Geometria circuiti + posizioni GPS |
| `src/data/engineer.ts` | `buildInsight`, `pickRival`, `QUICK_ACTIONS` | Modello AI |
| `src/services/sources/mockSource.ts` | `CURRENT_USER` (utente demo sidebar), aggregati (KPI/leaderboard/campionato) | Da httpSource |
| `src/services/authService.ts` | Sessione in **localStorage**, credenziali accettate senza verifica | API auth |
| `src/pages/Profile.tsx` | `RECENT` (attività recenti statiche), stats generate con `seededRandom` | API attività utente |
| `src/pages/GetAccess.tsx` | `ACCESS_MATRIX`, `HIGHLIGHTS`, `FAQ` | Config prodotto |
| `src/services/billingService.ts` | `PRODUCT` (prezzo), `createCheckout` simulato | Provider di pagamento |
| `src/pages/Home.tsx` | `MODULES` (etichette landing) | Copy statica (ok) |
| `src/pages/Dashboard.tsx` | `quickAccess` (copy + micro-stat) | Copy statica + dati via service |

### 3.2 Servizi da collegare a un'API

| Servizio | Metodi | Note |
|---|---|---|
| **`raceService`** (via `RaceDataSource`) | 27 metodi — `getDrivers`, `getGrandsPrix`, `getSessions`, `getSeasons`, `getWeatherConditions`, `getCoachSessions`, `getDriverStats`, `getRival`, `compareDrivers`, `battle`, `getInsight`, `detectInsightKind`, `getDriverDNA`, `analyzeDNA`, `getPrediction`, `getCoachInsights`, `askCoach`, `getTrack`, `sampleReplay`, `getSessionKpis`, `getSessionLeaderboard`, `getChampionship`, `getCurrentUser`, `getQuickActions`, `getCoachPrompts`, `getPlaybackSpeeds`, + `driverColors`/`sectorBounds` | Swap `mockSource → httpSource` (1 riga) |
| **`authService`** | `getCurrentUser`, `login`, `signup`, `logout`, `updateProfile`, `grantFullAccess` | Sostituire localStorage con API + token |
| **`billingService`** *(placeholder presente)* | `getProduct`, `createCheckout` (acquisto una tantum) | Vedi §6 |

### 3.3 Componenti già riutilizzabili (nessuna modifica)

- **Design system** `src/components/ui/*`: `Button`, `Card`(+Header/Body),
  `Badge`, `Select`, `SegmentedControl`, `Input`, `StatCard`, `PageHeader`,
  `EmptyState`, `Skeleton`. Tutti data-agnostici (solo props).
- **Grafici / controlli**: `LapTimeChart`, `RadarChart`, `CircuitMap`, `Gauge`,
  `ChartSkeleton`, `MatchControls`. Ricevono dati via **props pure** → funzionano
  identici con dati reali.
- **Utilità** `src/lib/*`: `format`, `tone`, `cn`, `useSimulatedFetch`.
- **Layout**: `Layout`, `Sidebar`, `Topbar` (leggono navigazione da config +
  auth via `useAuth`).

### 3.4 Componenti che richiederebbero modifiche minime

| Componente | Modifica minima |
|---|---|
| Pagine che usano `useSimulatedFetch` (Dashboard, Driver Comparison) | passare da delay simulato a `loading` reale del fetch |
| Pagine chat (AI Race Engineer, AI Coach) | l'`askCoach`/`getInsight` diventa `await`; aggiungere gestione errori |
| `Profile.tsx` | rimuovere `seededRandom` diretto; leggere stats/attività da service (vedi coupling §3.5) |
| `GetAccess.tsx` | `createCheckout()` → redirect all'hosted checkout; prodotto/prezzo da config |
| Tutte le pagine dati | se il service diventa async: `useMemo` → `useEffect + state`/react-query (vedi §4, strategia consigliata: cache sincrona per non toccare la UI) |

### 3.5 Dipendenze ancora troppo accoppiate

1. **`src/pages/Profile.tsx` importa `seededRandom` da `@/data/comparison`** —
   unico punto in cui la UI raggiunge direttamente il data layer. Spostare la
   generazione delle statistiche dietro il service (es. `authService`/`profileService`).
2. **`domain/models.ts` re-esporta i tipi da `@/data/*`** (es. `DriverStats`,
   `MetricRow`, `Insight`). Il dominio dipende dall'implementazione: prima della
   1.0 conviene **invertire** — definire i tipi in `domain` e farli importare a
   `data/*` — così i modelli restano stabili anche rimuovendo `data/*`.
3. **Contenuti statici inline nelle pagine** (`RECENT`, `FEATURES`, `FAQ`,
   `MODULES`): spostarli in un modulo `config/` o dietro il service, per non
   avere placeholder sparsi nel layer UI.
4. **`data/*` interdipendenti**: `dna`/`predict`/`coach` importano da
   `comparison`. Accettabile finché sono placeholder (un'unica sorgente da
   sostituire), ma da tenere presente nella migrazione.

---

## 4. Dove collegare i dati reali

Tutto passa da un unico seam: **`RaceDataSource`**.

**Passi:**

1. `.env.local` (da `.env.example`): `VITE_API_BASE_URL=https://api.…/v1`
   (già tipizzato in `src/vite-env.d.ts`, già letto da `httpSource`).
2. Implementare i metodi in `src/services/sources/httpSource.ts` con
   `RaceApiClient` (wrapper `fetch` già abbozzato).
3. In `src/services/raceService.ts`, **una riga**:
   ```ts
   import { httpSource } from './sources/httpSource'
   const source: RaceDataSource = httpSource
   ```
4. La UI **non cambia**.

### Ponte sincrono → asincrono (per non toccare la UI)

`RaceDataSource` è **sincrono** di proposito. Un'API è asincrona: strategia
consigliata **prefetch + cache**.

```
prefetch(gp, session)  →  fetch async  →  popola cache in memoria
        │                                       │
        └── gated da loading (useSimulatedFetch)─┘
getX(...)  →  legge dalla cache (sincrono)
```

In alternativa (refactor più ampio, tocca i call-site): introdurre
**React Query/SWR** con hook async — sconsigliato per la 1.0 iniziale perché
cambia ogni pagina. La cache sincrona mantiene i componenti invariati.

### Mappa endpoint suggerita (dal contratto)

| Metodo service | Endpoint |
|---|---|
| `getDrivers` / `getGrandsPrix` / `getSeasons` | `GET /drivers` · `/grands-prix` · `/seasons` |
| `getDriverStats` | `GET /sessions/{gp}/{session}/drivers/{id}/stats` |
| `getSessionLeaderboard` / `getSessionKpis` | `GET /sessions/{gp}/{session}/{leaderboard\|kpis}` |
| `getChampionship` | `GET /championship?upTo={gp}` |
| `getDriverDNA` | `GET /drivers/{id}/dna?season={season}` |
| `getPrediction` | `POST /predict {driver,gp,season,weather}` |
| `getCoachInsights` / `askCoach` | `GET /coach/insights` · `POST /coach/ask` |
| `getTrack` / `sampleReplay` | `GET /circuits/{gp}/path` · `/replay?t={t}` (o stream) |

> Le analisi **derivate** (`compareDrivers`, `battle`, `analyzeDNA`,
> `detectInsightKind`) possono restare **client-side** riusando le funzioni pure,
> oppure passare all'API. Scelta dell'implementatore, senza impatto UI.

---

## 5. Integrare autenticazione reale

Seam: **`src/services/authService.ts`** (l'unico modulo con `localStorage`).
`AuthContext`/`useAuth` e tutte le pagine **restano invariati**.

**Cosa cambia in `authService`:**

| Metodo | Oggi (placeholder) | 1.0 (reale) |
|---|---|---|
| `login(email,pw)` | crea account da email | `POST /auth/login` → `{ token, account }`; salva token |
| `signup(input)` | scrive in localStorage | `POST /auth/signup` |
| `getCurrentUser()` | legge localStorage | legge token e/o `GET /auth/me` (cache) |
| `logout()` | rimuove localStorage | invalida token/sessione |
| `updateProfile(patch)` | merge locale | `PATCH /auth/me` |
| `grantFullAccess()` | flip a `access: 'Full'` | rimosso: lo imposta il webhook (vedi §6) |

**Note:**

- Sostituire la sessione localStorage con **token** (idealmente cookie httpOnly
  gestito dal backend; in alternativa access+refresh token).
- Aggiungere un **interceptor** in `RaceApiClient` per allegare il token e
  gestire 401 (refresh / logout).
- Le **route protette** già esistono a livello UI (`Profile` fa
  `<Navigate to="/login">` se `!user`). Volendo, promuoverle a un
  `<ProtectedRoute>` riutilizzabile — nessun cambiamento di comportamento.

---

## 6. Integrare i pagamenti

> ThePaddockView si vende con un **acquisto una tantum**: nessun abbonamento,
> nessun rinnovo, nessun flusso di disdetta. Il modello è binario —
> `account.access: 'Preview' | 'Full'`.

Oggi il seam esiste già: **`src/services/billingService.ts`** (placeholder) con
`getProduct()` e `createCheckout()`; `AuthContext.purchase()` incatena checkout →
`authService.grantFullAccess()`.

**Architettura consigliata (Stripe / Paddle / Lemon Squeezy):**

1. **`billingService.createCheckout()`** → chiama il backend, che crea una
   sessione di **pagamento singolo** e restituisce l'URL dell'hosted checkout:
   ```ts
   const { redirectUrl } = await api.post('/billing/checkout', { productId })
   return { status: 'completed', redirectUrl }
   ```
   La pagina fa `window.location.assign(redirectUrl)`.
   Nessuna carta gestita dal frontend (hosted checkout → PCI fuori scope).
2. **`billingService.getProduct()`** → legge prodotto/prezzo dal backend (o
   resta config, con l'importo validato server-side al checkout).
3. **Webhook lato backend** (`payment_intent.succeeded` / `checkout.completed`)
   marca l'account come acquistato: imposta `access: 'Full'` e `purchasedAt`.
   Lato client `grantFullAccess()` sparisce — basta ri-leggere il profilo.
4. L'**accesso** arriva già da `authService.getCurrentUser()` →
   `account.access`: la UI (badge profilo, footer sidebar, pagina Get Access)
   **funziona già** senza modifiche.
5. **Entitlements / gating**: la matrice `ACCESS_MATRIX` in `GetAccess.tsx` è la
   fonte Anteprima-vs-Acquisto; per proteggere le feature a runtime introdurre
   un helper `can(feature)` basato su `account.access`.

Modelli già presenti in `domain/models.ts`: `Product` (importo in centesimi) e
`CheckoutResult { status, redirectUrl? }`.

---

## 7. Mantenere la coerenza

Regole che tengono l'app coerente durante e dopo la migrazione:

1. **Un solo punto di accesso ai dati**: le pagine importano *solo*
   `@/services/raceService` e `@/domain/models`. Verifica CI:
   `grep -r "from '@/data/" src/pages src/components` deve dare **0**
   (oggi: una sola eccezione documentata in §3.5).
2. **I modelli sono il contratto**: mantenere stabili `domain/models.ts`; le
   risposte API vanno mappate su questi tipi (DTO → model) dentro `httpSource`,
   così la UI non vede mai la forma grezza dell'API.
3. **ID stabili**: driver/gp/season usano `id` stringa (`ver`, `ita`, `2025`).
   Mantenere lo stesso schema di ID lato API per non rompere selezioni e default.
4. **Determinismo → realtà**: oggi stessa selezione = stessi valori ovunque.
   Con l'API, garantire la stessa coerenza usando **la stessa sorgente cache**
   per tutte le pagine (una `getDriverStats(gp,session)` condivisa, non
   ricalcoli per-pagina).
5. **Design system unico**: continuare a usare `components/ui/*`, `lib/format`,
   `lib/tone` — niente stili/colori inline nuovi.
6. **Config centralizzata**: sessioni, stagioni, meteo, velocità playback restano
   config esposte dal service (non hardcoded nelle pagine).
7. **Test**: aggiungere test di contratto su `RaceDataSource` (mock vs http
   devono rispettare la stessa interfaccia) e smoke E2E per pagina.

---

## 8. Checklist pre-1.0

- [ ] Implementare `httpSource` (27 metodi) + `RaceApiClient` con token interceptor.
- [ ] Definire lo schema API e il mapping DTO → `domain/models`.
- [ ] Strategia async: **prefetch + cache sincrona** (mantiene la UI invariata).
- [ ] Collegare `authService` all'API di autenticazione (token, refresh, 401).
- [ ] Collegare `billingService` al provider + webhook acquisto; `GetAccess` redirige all'hosted checkout.
- [ ] Decoupling: rimuovere `seededRandom` da `Profile.tsx` (→ service).
- [ ] Invertire la dipendenza tipi: definire i modelli in `domain`, importati da `data/*`.
- [ ] Spostare contenuti statici (`RECENT`, `FEATURES`, `FAQ`) in `config/` o service.
- [ ] Sostituire `data/*` con fixtures di test (o rimuoverli) una volta live.
- [ ] CI guard: nessun import diretto da `@/data/*` nella UI.

---

### Sintesi

L'app è **strutturalmente pronta**: un contratto dati unico (`RaceDataSource`),
un servizio auth isolato, modelli standardizzati, componenti data-agnostici e un
loading seam già in posizione. La migrazione a 1.0 è principalmente
**implementativa** (scrivere `httpSource`, collegare auth/billing) e non richiede
riscrivere il frontend. I punti di accoppiamento residui sono pochi, isolati e
qui documentati.
