/**
 * Placeholder "AI Coach" engine.
 *
 * A race-engineer-style analyst over the SAME data as the rest of the app:
 * pace/sectors (generateDriverData), driving style (generateDriverDNA) and
 * strategy risk (generatePrediction). It produces the insight panel and
 * answers free-text questions with explanations (why something happens), not
 * just numbers. Deterministic and rule-based — swap `askCoach` for a real
 * model later while keeping the CoachAnswer/CoachInsights shapes.
 */
import { DRIVERS, generateDriverData, seededRandom } from './comparison'
import { generateDriverDNA, analyzeDriverDNA } from './dna'
import { generatePrediction } from './predict'
import { formatLapTime, formatGap } from '@/lib/format'
import type { MetricTone } from './engineer'
import type {
  CoachAnswer,
  CoachInsights,
  CoachMetric,
  CoachTimelineEvent,
  SessionType,
} from '@/domain/models'

/** Coach sessions map onto the underlying data sessions. */
export const COACH_SESSIONS = ['FP1', 'FP2', 'FP3', 'Qualifica', 'Sprint', 'Gara']
const SESSION_MAP: Record<string, SessionType> = {
  FP1: 'Practice', FP2: 'Practice', FP3: 'Practice',
  Qualifica: 'Qualifying', Sprint: 'Sprint', Gara: 'Race',
}
const SESSION_CONFIDENCE: Record<string, number> = {
  FP1: 6, FP2: 9, FP3: 12, Qualifica: 16, Sprint: 12, Gara: 18,
}

export const COACH_PROMPTS = [
  'Perché è stato più veloce?',
  'Dove perde tempo?',
  'Come potrebbe migliorare?',
  'Qual è la strategia migliore?',
  'Perché il degrado gomme è aumentato?',
]

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const attrOf = (dna: ReturnType<typeof generateDriverDNA>, key: string) =>
  dna.attributes.find((a) => a.key === key)?.value ?? 70

function tierTone(v: number): MetricTone {
  if (v >= 85) return 'green'
  if (v >= 72) return 'cyan'
  if (v >= 60) return 'amber'
  return 'neutral'
}

// --- shared context ---------------------------------------------------------

function context(driverId: string, gpId: string, season: string, coachSession: string) {
  const ss = SESSION_MAP[coachSession] ?? 'Race'
  const me = generateDriverData(driverId, gpId, ss)
  const dna = generateDriverDNA(driverId, season)
  const analysis = analyzeDriverDNA(dna)
  const prediction = generatePrediction(driverId, gpId, season, 'Dry')
  const qualiLap = generateDriverData(driverId, gpId, 'Qualifying').lapTime

  // Reference car: fastest of the field in this session (2nd if that's us).
  const field = DRIVERS.map((d) => ({
    id: d.id,
    code: d.code,
    rp: generateDriverData(d.id, gpId, ss).racePace,
  })).sort((a, b) => a.rp - b.rp)
  const refEntry = field[0].id === driverId ? field[1] : field[0]
  const ref = generateDriverData(refEntry.id, gpId, ss)

  const confidence = clamp(
    Math.round(
      66 +
        me.consistency * 0.12 +
        (SESSION_CONFIDENCE[coachSession] ?? 10) +
        (seededRandom(`coach|conf|${driverId}|${gpId}|${season}|${coachSession}`)() * 2 - 1) * 3,
    ),
    60,
    96,
  )

  return { ss, me, dna, analysis, prediction, qualiLap, ref, refCode: refEntry.code, field, confidence }
}

type Ctx = ReturnType<typeof context>

function sectorAnalysis(ctx: Ctx) {
  const { me, ref } = ctx
  const sectors = [
    { label: 'Settore 1', delta: me.s1 - ref.s1 },
    { label: 'Settore 2', delta: me.s2 - ref.s2 },
    { label: 'Settore 3', delta: me.s3 - ref.s3 },
  ]
  const worst = [...sectors].sort((a, b) => b.delta - a.delta)[0]
  const best = [...sectors].sort((a, b) => a.delta - b.delta)[0]
  return { worst, best }
}

// --- insight panel ----------------------------------------------------------

export function generateCoachInsights(
  driverId: string,
  gpId: string,
  season: string,
  coachSession: string,
): CoachInsights {
  const ctx = context(driverId, gpId, season, coachSession)
  const { me, dna, analysis, prediction, qualiLap, ref, refCode, field, confidence } = ctx

  const risk = clamp(
    Math.round(
      prediction.probabilities.safetyCar * 0.5 +
        (prediction.pitStops - 1) * 12 +
        (100 - me.tyreManagement) * 0.3,
    ),
    5,
    95,
  )
  const bestRp = field[0].rp
  const worstRp = field[field.length - 1].rp
  const headroom = clamp(
    Math.round(((me.racePace - bestRp) / (worstRp - bestRp || 1)) * 100),
    3,
    97,
  )
  const riskLevel = risk >= 65 ? 'Alto' : risk >= 35 ? 'Medio' : 'Basso'

  const qualiScore = attrOf(dna, 'qualifying')
  const raceScore = attrOf(dna, 'racePace')

  const metrics: CoachMetric[] = [
    { key: 'racePace', label: 'Ritmo gara', value: raceScore, display: formatLapTime(me.racePace), tone: tierTone(raceScore) },
    { key: 'tyres', label: 'Gestione gomme', value: Math.round(me.tyreManagement), display: `${Math.round(me.tyreManagement)}%`, tone: tierTone(me.tyreManagement) },
    { key: 'quali', label: 'Qualità qualifica', value: qualiScore, display: formatLapTime(qualiLap), tone: tierTone(qualiScore) },
    { key: 'consistency', label: 'Costanza', value: Math.round(me.consistency), display: `${Math.round(me.consistency)}%`, tone: tierTone(me.consistency) },
    { key: 'risk', label: 'Rischio strategico', value: risk, display: riskLevel, tone: risk >= 65 ? 'accent' : risk >= 35 ? 'amber' : 'green' },
    { key: 'improvement', label: 'Potenziale miglioramento', value: headroom, display: `${headroom}/100`, tone: 'cyan' },
  ]

  // Session timeline events from the lap-time trace.
  const n = me.lapSeries.length
  const bestIdx = me.lapSeries.indexOf(Math.min(...me.lapSeries))
  const pitIdx = Math.floor(n * 0.55)
  const timeline: CoachTimelineEvent[] = [
    { lap: 1, label: 'Via alla sessione', tone: 'neutral' },
    { lap: bestIdx + 1, label: 'Giro veloce', tone: 'green' },
    { lap: pitIdx + 1, label: 'Finestra pit stop', tone: 'amber' },
    { lap: Math.min(n, pitIdx + 4), label: 'Onset degrado gomme', tone: 'accent' },
    { lap: n, label: 'Fine sessione', tone: 'neutral' },
  ]
  timeline.sort((a, b) => a.lap - b.lap)

  return {
    driver: me.driver,
    season,
    sessionLabel: coachSession,
    strengths: analysis.strengths.map((s) => s.label),
    weaknesses: analysis.weaknesses.map((w) => w.label),
    metrics,
    confidence,
    code: me.driver.code,
    refCode,
    lapSeries: me.lapSeries,
    refLapSeries: ref.lapSeries,
    timeline,
  }
}

// --- chat -------------------------------------------------------------------

function detectIntent(text: string): string {
  const s = text.toLowerCase()
  if (/degrad|gomm|tyre|usura/.test(s)) return 'tyre'
  if (/strateg|pit|sosta|undercut|overcut/.test(s)) return 'strategy'
  if (/perde|perdi|losing|dove|tempo/.test(s)) return 'losing'
  if (/miglior|improve|meglio|crescere/.test(s)) return 'improve'
  if (/veloce|faster|forte|rapid/.test(s)) return 'faster'
  if (/qualif|quali|giro secco/.test(s)) return 'quali'
  if (/costan|consist|ripetib/.test(s)) return 'consistency'
  return 'overview'
}

export function askCoach(
  question: string,
  driverId: string,
  gpId: string,
  season: string,
  coachSession: string,
): CoachAnswer {
  const ctx = context(driverId, gpId, season, coachSession)
  const { me, dna, analysis, prediction, qualiLap, ref, refCode, confidence } = ctx
  const name = me.driver.name
  const { worst, best } = sectorAnalysis(ctx)
  const gap = me.racePace - ref.racePace // <0 = me faster
  const tyres = Math.round(me.tyreManagement)
  const cons = Math.round(me.consistency)
  const intent = detectIntent(question)

  const m = (label: string, value: string, tone: MetricTone): CoachMetric => ({
    key: label, label, value: 0, display: value, tone,
  })

  switch (intent) {
    case 'faster':
      return {
        title: 'Perché è più veloce',
        confidence,
        focus: best.label,
        metrics: [
          m('Δ passo', formatGap(gap), gap <= 0 ? 'green' : 'amber'),
          m('Top speed', `${me.topSpeed} km/h`, 'accent'),
          m('Gomme', `${tyres}%`, tierTone(tyres)),
        ],
        text:
          gap <= 0
            ? `${name} gira ${formatGap(Math.abs(gap))} più veloce di ${refCode} soprattutto nel ${best.label}: migliore trazione in uscita dalle curve lente e minor scivolamento all'anteriore. La gestione gomme (${tyres}%) tiene il passo negli ultimi giri, quando gli altri calano.`
            : `${refCode} è più rapido in questa sessione, ma ${name} recupera nel ${best.label} grazie alla trazione. Il gap viene dal ${worst.label}, dove la vettura fatica a ruotare in ingresso.`,
      }
    case 'losing':
      return {
        title: 'Dove perde tempo',
        confidence,
        focus: worst.label,
        metrics: [
          m('Perdita', formatGap(Math.max(0, worst.delta)), 'amber'),
          m('vs', refCode, 'cyan'),
        ],
        text:
          `Il grosso del tempo se ne va nel ${worst.label}: circa ${formatGap(Math.abs(worst.delta))} rispetto a ${refCode}. ` +
          `Causa probabile: trazione in uscita dalle curve lente e un lift-and-coast troppo conservativo in frenata. ` +
          `Migliorando il rotation in ingresso curva si recupera gran parte del distacco senza toccare l'assetto.`,
      }
    case 'improve': {
      const w = analysis.weaknesses
      return {
        title: 'Come può migliorare',
        confidence,
        focus: w[0]?.label,
        metrics: w.map((x) => m(x.label, `${x.value}`, 'amber')),
        text:
          `Il margine più ampio è su ${w[0]?.label.toLowerCase()} (${w[0]?.value}/100)${w[1] ? ` e ${w[1].label.toLowerCase()}` : ''}. ` +
          `In pista significa allineare meglio i primi giri di stint alla finestra di temperatura gomma e limare il ${worst.label}. ` +
          `Con un approccio più aggressivo in ingresso curva il passo medio migliora senza aumentare il degrado.`,
      }
    }
    case 'strategy':
      return {
        title: 'Strategia migliore',
        confidence,
        metrics: [
          m('Piano', prediction.tyreStrategy, 'cyan'),
          m('Pit stop', `${prediction.pitStops}`, 'accent'),
          m('Safety Car', `${prediction.probabilities.safetyCar}%`, 'amber'),
        ],
        text:
          `La strategia ottimale è ${prediction.tyreStrategy} su ${prediction.pitStops} sosta${prediction.pitStops === 1 ? '' : 'e'}. ` +
          `Con un rischio Safety Car del ${prediction.probabilities.safetyCar}% conviene tenere aperta l'opzione undercut: anticipare la sosta se il rivale davanti rallenta. ` +
          `La finestra pit diventa critica quando il degrado supera ~0.1s/giro.`,
      }
    case 'tyre':
      return {
        title: 'Perché il degrado aumenta',
        confidence,
        focus: 'Gestione gomme',
        metrics: [m('Tyre mgmt', `${tyres}%`, tierTone(tyres)), m('Costanza', `${cons}%`, tierTone(cons))],
        text:
          `Il degrado sale perché la gestione gomme è ${tyres}%: la temperatura supera la finestra ideale e lo sliding in trazione accelera l'usura del posteriore. ` +
          `Un lift-and-coast nelle frenate più dure e un passo più conservativo nei primi 3 giri di stint riducono il picco termico e allungano la vita gomma.`,
      }
    case 'quali': {
      const q = attrOf(dna, 'qualifying')
      return {
        title: 'Qualità della qualifica',
        confidence,
        metrics: [m('Giro secco', formatLapTime(qualiLap), 'accent'), m('Quali', `${q}/100`, tierTone(q))],
        text:
          q >= 82
            ? `In qualifica (${formatLapTime(qualiLap)}) ${name} è un riferimento: sfrutta bene il grip da gomma nuova e mette insieme il giro sotto pressione.`
            : `In qualifica (${formatLapTime(qualiLap)}) ${name} lascia qualcosa: fatica a completare il giro perfetto, spesso perdendo proprio nel ${worst.label}. Margine da recuperare sul giro secco.`,
      }
    }
    case 'consistency':
      return {
        title: 'Costanza',
        confidence,
        metrics: [m('Costanza', `${cons}%`, tierTone(cons))],
        text:
          cons >= 90
            ? `Costanza ${cons}%: giri molto ripetibili, una base solida su cui costruire la strategia e leggere il degrado in tempo reale.`
            : `Costanza ${cons}%: c'è variabilità di troppo tra i giri. Qualche giro sporco costa nel passo medio dello stint; pulizia e ripetibilità sono la priorità.`,
      }
    default:
      return {
        title: `Analisi sessione · ${coachSession}`,
        confidence,
        metrics: [
          m('Ritmo', formatLapTime(me.racePace), 'cyan'),
          m('Costanza', `${cons}%`, tierTone(cons)),
        ],
        text:
          `${name} ha ${analysis.strengths[0]?.label.toLowerCase()} come arma principale, mentre ${analysis.weaknesses[0]?.label.toLowerCase()} resta l'area debole. ` +
          `Passo gara ${formatLapTime(me.racePace)}, costanza ${cons}%, riferimento ${refCode}. ` +
          `Chiedimi dove perde tempo, come migliorare, la strategia o perché aumenta il degrado.`,
      }
  }
}
