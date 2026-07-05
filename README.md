# ThePaddockView

Piattaforma di analisi telemetrica in stile SaaS per la Formula 1 — tema dark
"cockpit / data platform". Questa è la **base strutturale**: UI, componenti
riutilizzabili e navigazione completa, **senza dati reali né logica di business**.

> ⚠️ Nessun dato ufficiale di Formula 1 è integrato. I valori mostrati sono
> segnaposto puramente dimostrativi.

## Stack

- **React 18** + **TypeScript**
- **Vite 5** (dev server e build)
- **Tailwind CSS 3** (tema dark personalizzato)
- **React Router 6** (routing completo)
- **lucide-react** (icone)

## Pagine

| Rotta                | Pagina             | Stato                          |
| -------------------- | ------------------ | ------------------------------ |
| `/`                  | Home               | Landing / hero + moduli        |
| `/dashboard`         | Dashboard          | KPI + pannelli segnaposto      |
| `/confronto-piloti`  | Confronto Piloti   | Slot piloti + metriche demo    |
| `/race-replay`       | Race Replay        | Timeline + mappa (placeholder) |
| `/battle-mode`       | Battle Mode        | Duello testa a testa           |
| `/ai-race-engineer`  | AI Race Engineer   | Solo UI, **non funzionale**    |
| `*`                  | 404                | Pagina "fuori pista"           |

## Architettura

```
src/
├── main.tsx                 # entry + RouterProvider
├── index.css                # Tailwind + stili base (scrollbar, utilities)
├── config/
│   └── navigation.ts        # sorgente unica di verità per la navigazione
├── router/
│   └── index.tsx            # definizione delle rotte
├── components/
│   ├── layout/              # Layout (shell), Sidebar, Topbar
│   └── ui/                  # componenti riutilizzabili
│       ├── Button.tsx       # varianti + dimensioni
│       ├── Card.tsx         # Card / CardHeader / CardBody
│       ├── Badge.tsx        # badge colorati per stato
│       ├── StatCard.tsx     # KPI con trend
│       ├── PageHeader.tsx   # intestazione pagina
│       ├── EmptyState.tsx   # segnaposto "in arrivo"
│       └── index.ts         # barrel export
└── pages/                   # una pagina per rotta
```

Il **layout** (`components/layout/Layout.tsx`) fornisce lo shell dell'app:
sidebar fissa a sinistra, topbar sticky in alto e area contenuti scrollabile
in cui viene montata la pagina corrente tramite `<Outlet />`. Su mobile la
sidebar diventa un drawer.

Sidebar, topbar e router leggono le voci di menu da `config/navigation.ts`:
aggiungere una pagina significa crearne il componente, registrarla nel router e
aggiungere una voce alla configurazione.

## Sviluppo

```bash
npm install     # installa le dipendenze
npm run dev     # dev server su http://localhost:5173
npm run build   # type-check + build di produzione in dist/
npm run preview # anteprima della build
npm run lint    # type-check (tsc --noEmit)
```

## Prossimi passi

Base pronta per aggiungere: integrazione dati reali (es. FastF1 / Ergast),
grafici di telemetria, animazione del tracciato in Race Replay e collegamento
del modulo AI Race Engineer a un modello.
