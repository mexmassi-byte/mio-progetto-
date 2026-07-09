/**
 * Placeholder "AI Race Engineer" insight generator.
 *
 * Turns the deterministic mock telemetry (from `./comparison`) into
 * structured, race-engineer-style analysis: pace, strategy, rival battle
 * and a strengths/weaknesses read. Nothing here talks to a model or an
 * API — it's rule-based text over fake-but-coherent numbers. Swapping in a
 * real model later means replacing `buildInsight` while keeping the
 * `Insight` shape the UI renders.
 */
import {
  DRIVERS,
  GRANDS_PRIX,
  generateDriverData,
  buildComparison,
  deriveGap,
  type DriverStats,
  type SessionType,
  type TyreCompound,
} from './comparison'
import { formatLapTime } from '@/lib/format'

export type InsightKind = 'briefing' | 'pace' | 'strategy' | 'rival' | 'swot'

export type MetricTone = 'accent' | 'cyan' | 'green' | 'amber' | 'purple' | 'neutral'

export interface Metric {
  label: string
  value: string
  tone?: MetricTone
}

export interface InsightSection {
  heading?: string
  bullets: string[]
}

export interface Insight {
  kind: InsightKind
  title: string
  summary: string
  metrics: Metric[]
  sections: InsightSection[]
}

// --- helpers ---------------------------------------------------------------

const fmtLap = formatLapTime

const COMPOUND_LIFE: Record<TyreCompound, number> = { Soft: 20, Medium: 30, Hard: 40 }
const NEXT_COMPOUND: Record<TyreCompound, TyreCompound> = {
  Soft: 'Medium',
  Medium: 'Hard',
  Hard: 'Soft',
}

/** Estimated degradation rate (s/lap) from tyre-management score. */
function degRate(d: DriverStats): number {
  return Number(((100 - d.tyreManagement) / 100 * 0.12 + 0.02).toFixed(3))
}

/** Lap-time trend across the stint: >0 means the pace is dropping off. */
function paceTrend(d: DriverStats): number {
  const n = d.lapSeries.length
  const third = Math.max(1, Math.floor(n / 3))
  const early = d.lapSeries.slice(0, third)
  const late = d.lapSeries.slice(n - third)
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  return Number((avg(late) - avg(early)).toFixed(3))
}

/**
 * The direct rival = the driver whose race pace is closest to ours in this
 * exact session (and not ourselves).
 */
export function pickRival(driverId: string, gpId: string, session: SessionType): DriverStats {
  const me = generateDriverData(driverId, gpId, session)
  let best: DriverStats | null = null
  let bestDelta = Infinity
  for (const d of DRIVERS) {
    if (d.id === driverId) continue
    const cand = generateDriverData(d.id, gpId, session)
    const delta = Math.abs(cand.racePace - me.racePace)
    if (delta < bestDelta) {
      bestDelta = delta
      best = cand
    }
  }
  return best ?? me
}

// --- generators ------------------------------------------------------------

function paceInsight(me: DriverStats): Insight {
  const trend = paceTrend(me)
  const deg = degRate(me)
  const dropping = trend > 0.15
  return {
    kind: 'pace',
    title: 'Analisi ritmo gara',
    summary: dropping
      ? 'Passo competitivo ma in calo nella parte finale dello stint.'
      : 'Passo gara solido e ripetibile, degrado sotto controllo.',
    metrics: [
      { label: 'Passo medio', value: fmtLap(me.racePace), tone: 'cyan' },
      { label: 'Best lap', value: fmtLap(me.lapTime), tone: 'accent' },
      { label: 'Consistenza', value: `${me.consistency.toFixed(1)}%`, tone: me.consistency >= 90 ? 'green' : 'amber' },
      { label: 'Degrado', value: `${deg.toFixed(2)}s/giro`, tone: deg <= 0.07 ? 'green' : 'amber' },
    ],
    sections: [
      {
        bullets: [
          trend >= 0
            ? `Deriva sul giro di +${trend.toFixed(2)}s tra inizio e fine stint: il calo è ${dropping ? 'marcato, gestire la trazione in uscita di curva' : 'contenuto e nella norma'}.`
            : `Il passo migliora di ${Math.abs(trend).toFixed(2)}s a fine stint: gomma ancora in finestra di temperatura.`,
          me.consistency >= 90
            ? `Consistenza ${me.consistency.toFixed(1)}%: giri molto ripetibili, dato pulito su cui costruire la strategia.`
            : `Consistenza ${me.consistency.toFixed(1)}%: qualche giro sporco, margine per limare i tempi.`,
          `Degrado stimato ${deg.toFixed(2)}s/giro con gomma ${me.tyreCompound}: incide sulla lunghezza ottimale dello stint.`,
        ],
      },
    ],
  }
}

function strategyInsight(me: DriverStats): Insight {
  const life = COMPOUND_LIFE[me.tyreCompound]
  const lifeLeft = Math.max(0, life - me.tyreAge)
  const boxNow = lifeLeft <= 2
  const from = Math.max(1, lifeLeft - 2)
  const to = lifeLeft + 2
  const next = NEXT_COMPOUND[me.tyreCompound]
  const deg = degRate(me)
  return {
    kind: 'strategy',
    title: 'Strategia & pit stop',
    summary: boxNow
      ? 'Gomma a fine vita: pit stop consigliato immediatamente.'
      : `Finestra pit ottimale tra ${from} e ${to} giri da adesso.`,
    metrics: [
      { label: 'Gomma', value: `${me.tyreCompound} · ${me.tyreAge}L`, tone: 'purple' },
      { label: 'Vita residua', value: `~${lifeLeft} giri`, tone: lifeLeft <= 4 ? 'amber' : 'green' },
      { label: 'Finestra pit', value: boxNow ? 'ORA' : `+${from}–${to} giri`, tone: 'accent' },
      { label: 'Prossima mescola', value: next, tone: 'cyan' },
    ],
    sections: [
      {
        heading: 'Raccomandazione',
        bullets: [
          boxNow
            ? `Box this lap: la ${me.tyreCompound} è oltre la finestra utile (${me.tyreAge}L su ~${life}L), il degrado sta erodendo il vantaggio.`
            : `Restare fuori ancora ${from}–${to} giri, poi montare ${next} per chiudere lo stint con margine di degrado.`,
          deg > 0.08
            ? `Degrado elevato (${deg.toFixed(2)}s/giro): valutare undercut sul rivale, la sosta anticipata renderebbe.`
            : `Degrado basso (${deg.toFixed(2)}s/giro): overcut possibile, la gomma tiene per estendere lo stint.`,
          `Gestione: lift-and-coast nelle zone di frenata più dure per allungare la vita gomma e proteggere la finestra.`,
        ],
      },
    ],
  }
}

function rivalInsight(me: DriverStats, rival: DriverStats): Insight {
  const cmp = buildComparison(me, rival)
  const gap = deriveGap(me, rival) // >0: me più lento
  const paceDelta = Number((me.racePace - rival.racePace).toFixed(3))
  const ahead = gap < 0
  const sectorRows = cmp.rows.filter((r) => r.key === 's1' || r.key === 's2' || r.key === 's3')
  const gains = sectorRows.filter((r) => r.winner === 'A').map((r) => r.label)
  const losses = sectorRows.filter((r) => r.winner === 'B').map((r) => r.label)
  return {
    kind: 'rival',
    title: 'Confronto rivale diretto',
    summary: `${ahead ? 'In vantaggio' : 'Sotto pressione'} su ${rival.driver.name}: ${Math.abs(gap).toFixed(2)}s ${ahead ? 'di margine' : 'da recuperare'}.`,
    metrics: [
      { label: 'Rivale', value: rival.driver.code, tone: 'cyan' },
      { label: 'Gap', value: `${gap > 0 ? '+' : ''}${gap.toFixed(2)}s`, tone: ahead ? 'green' : 'amber' },
      { label: 'Δ passo', value: `${paceDelta > 0 ? '+' : ''}${paceDelta.toFixed(2)}s`, tone: paceDelta <= 0 ? 'green' : 'amber' },
      { label: 'Top speed', value: `${me.topSpeed}/${rival.topSpeed}`, tone: 'accent' },
    ],
    sections: [
      {
        heading: 'Dove si decide',
        bullets: [
          gains.length
            ? `Guadagni terreno in ${gains.join(', ')}: sfruttare la trazione lì per costruire il gap.`
            : `Nessun settore nettamente a favore: serve un giro pulito completo per fare la differenza.`,
          losses.length
            ? `Perdi in ${losses.join(', ')}: rivedere le linee e la gestione gomma in quelle zone.`
            : `Difesa solida su tutti i settori, nessuna debolezza evidente per il rivale.`,
          me.topSpeed >= rival.topSpeed
            ? `Vantaggio di velocità di punta (+${me.topSpeed - rival.topSpeed} km/h): DRS e difesa in staccata a favore.`
            : `Deficit di velocità di punta (${me.topSpeed - rival.topSpeed} km/h): vulnerabile in staccata, coprire la traiettoria interna.`,
        ],
      },
    ],
  }
}

function swotInsight(me: DriverStats, rival: DriverStats): Insight {
  const cmp = buildComparison(me, rival)
  const strengths: string[] = []
  const weaknesses: string[] = []

  const wins = cmp.rows.filter((r) => r.winner === 'A')
  const losses = cmp.rows.filter((r) => r.winner === 'B')

  if (me.consistency >= 90) strengths.push(`Consistenza elevata (${me.consistency.toFixed(1)}%): esecuzione ripetibile giro dopo giro.`)
  else weaknesses.push(`Consistenza migliorabile (${me.consistency.toFixed(1)}%): troppa variabilità tra i giri.`)

  if (me.tyreManagement >= 85) strengths.push(`Ottima gestione gomme (${me.tyreManagement.toFixed(0)}%): stint lunghi sostenibili.`)
  else weaknesses.push(`Gestione gomme sotto la media (${me.tyreManagement.toFixed(0)}%): degrado da tenere d'occhio.`)

  const sWins = wins.filter((r) => r.key.startsWith('s')).map((r) => r.label)
  if (sWins.length) strengths.push(`Forte nei settori ${sWins.join(', ')} rispetto al rivale.`)
  const sLoss = losses.filter((r) => r.key.startsWith('s')).map((r) => r.label)
  if (sLoss.length) weaknesses.push(`Da recuperare nei settori ${sLoss.join(', ')}.`)

  if (me.topSpeed >= rival.topSpeed) strengths.push(`Velocità di punta competitiva (${me.topSpeed} km/h).`)
  else weaknesses.push(`Velocità di punta inferiore al rivale (${me.topSpeed} vs ${rival.topSpeed} km/h).`)

  return {
    kind: 'swot',
    title: 'Punti di forza e debolezza',
    summary: `${strengths.length} punti di forza, ${weaknesses.length} aree di lavoro nella sessione.`,
    metrics: [
      { label: 'Consistenza', value: `${me.consistency.toFixed(1)}%`, tone: me.consistency >= 90 ? 'green' : 'amber' },
      { label: 'Tyre mgmt', value: `${me.tyreManagement.toFixed(0)}%`, tone: me.tyreManagement >= 85 ? 'green' : 'amber' },
      { label: 'Best lap', value: fmtLap(me.lapTime), tone: 'accent' },
    ],
    sections: [
      { heading: 'Punti di forza', bullets: strengths.length ? strengths : ['Profilo equilibrato, nessun picco marcato.'] },
      { heading: 'Aree di lavoro', bullets: weaknesses.length ? weaknesses : ['Nessuna debolezza rilevante in questa sessione.'] },
    ],
  }
}

function briefingInsight(me: DriverStats, rival: DriverStats, gpName: string, session: SessionType): Insight {
  const gap = deriveGap(me, rival)
  const deg = degRate(me)
  const ahead = gap < 0
  return {
    kind: 'briefing',
    title: `Briefing sessione · ${session}`,
    summary: `${me.driver.name} a ${gpName}: quadro pronto, rivale diretto ${rival.driver.code}.`,
    metrics: [
      { label: 'Passo medio', value: fmtLap(me.racePace), tone: 'cyan' },
      { label: 'Gap rivale', value: `${gap > 0 ? '+' : ''}${gap.toFixed(2)}s`, tone: ahead ? 'green' : 'amber' },
      { label: 'Degrado', value: `${deg.toFixed(2)}s/giro`, tone: deg <= 0.07 ? 'green' : 'amber' },
      { label: 'Gomma', value: `${me.tyreCompound} · ${me.tyreAge}L`, tone: 'purple' },
    ],
    sections: [
      {
        bullets: [
          `Passo di riferimento ${fmtLap(me.racePace)}, best lap ${fmtLap(me.lapTime)}. Consistenza ${me.consistency.toFixed(1)}%.`,
          `Rivale diretto ${rival.driver.name} (${rival.driver.team}) a ${Math.abs(gap).toFixed(2)}s: battaglia ${ahead ? 'da gestire in controllo' : 'in rimonta'}.`,
          `Chiedimi: ritmo gara, strategia & pit, rivale diretto o punti di forza/debolezza.`,
        ],
      },
    ],
  }
}

// --- public entry ----------------------------------------------------------

export function buildInsight(
  kind: InsightKind,
  driverId: string,
  gpId: string,
  session: SessionType,
): Insight {
  const me = generateDriverData(driverId, gpId, session)
  const rival = pickRival(driverId, gpId, session)
  const gp = GRANDS_PRIX.find((g) => g.id === gpId)
  switch (kind) {
    case 'pace':
      return paceInsight(me)
    case 'strategy':
      return strategyInsight(me)
    case 'rival':
      return rivalInsight(me, rival)
    case 'swot':
      return swotInsight(me, rival)
    default:
      return briefingInsight(me, rival, gp?.name ?? '', session)
  }
}

/** Very small intent matcher so the free-text input feels responsive. */
export function detectKind(text: string): InsightKind {
  const s = text.toLowerCase()
  if (/pit|gomm|tyre|pneumatic|strateg|undercut|overcut|box|mescol/.test(s)) return 'strategy'
  if (/rival|confront|avversar|gap|batt/.test(s)) return 'rival'
  if (/forza|debol|punti|swot|miglior|peggior|area/.test(s)) return 'swot'
  if (/pace|ritmo|passo|lap|giro|degrad|tempo/.test(s)) return 'pace'
  return 'briefing'
}

export const QUICK_ACTIONS: { kind: InsightKind; label: string }[] = [
  { kind: 'pace', label: 'Ritmo gara' },
  { kind: 'strategy', label: 'Strategia & pit' },
  { kind: 'rival', label: 'Rivale diretto' },
  { kind: 'swot', label: 'Forza / debolezza' },
]
