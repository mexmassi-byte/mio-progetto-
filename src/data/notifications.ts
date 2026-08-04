/**
 * Placeholder notification feed.
 *
 * Realistic product notifications (updates, new analyses, features, AI tips,
 * system status). Deterministic and derived from the current data where it
 * makes sense, so the centre stays coherent with the rest of the app.
 * A real backend would serve the same `AppNotification` shape.
 */
import { DRIVERS, GRANDS_PRIX } from './comparison'
import type { AppNotification } from '@/domain/models'

export function generateNotifications(): AppNotification[] {
  const leadDriver = DRIVERS[0]
  const gp = GRANDS_PRIX.find((g) => g.id === 'ita') ?? GRANDS_PRIX[0]

  return [
    {
      id: 'n1',
      kind: 'ai',
      title: 'Nuovo insight AI disponibile',
      body: `L'AI Coach ha completato l'analisi di ${leadDriver.name} sul ${gp.name}: degrado gomme sopra la media nello stint centrale.`,
      time: '12 min fa',
      to: '/ai-coach',
      read: false,
    },
    {
      id: 'n2',
      kind: 'analysis',
      title: 'Analisi pronta',
      body: `Il confronto ${DRIVERS[0].code} vs ${DRIVERS[1].code} per ${gp.circuit} è stato aggiornato con i tempi di sessione.`,
      time: '1 ora fa',
      to: '/confronto-piloti',
      read: false,
    },
    {
      id: 'n3',
      kind: 'feature',
      title: 'Nuova funzionalità: Driver DNA',
      body: 'Il profilo tecnico dello stile di guida è ora disponibile su 10 attributi, con confronto tra due piloti.',
      time: '3 ore fa',
      to: '/driver-dna',
      read: false,
    },
    {
      id: 'n4',
      kind: 'update',
      title: 'Aggiornamento piattaforma 0.9',
      body: 'Ricerca globale, centro notifiche e ripristino automatico della sessione sono stati introdotti in questa versione.',
      time: 'ieri',
      read: true,
    },
    {
      id: 'n5',
      kind: 'system',
      title: 'Stato sistema: operativo',
      body: 'Tutti i moduli di analisi rispondono regolarmente. Sorgente dati: segnaposto (nessun feed live collegato).',
      time: 'ieri',
      read: true,
    },
  ]
}
