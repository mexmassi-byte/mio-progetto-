# ANIMA FLY: concept di sito per voli privati

Un sito one-page per un marchio di jet privati (concept, non un operatore reale). È costruito sul reel di riferimento che ci hai mandato, con le skill di design del progetto (impeccable, design-taste-frontend, design-motion-principles).

## Cosa c'è

1. **Il volo (hero).** Il tuo video del jet al tramonto scorre insieme allo scroll, fotogramma per fotogramma, disegnato su un canvas. Ci sono sette capitoli: tappeto rosso, scaletta, cabina, menu, decollo, sopra le nuvole, isola. In basso, gli strumenti di volo (velocità, rotta, tempo stimato) e l'altitudine, che sale fino a 45.000 ft e torna a 0.
2. **Prenota.** Il modulo ha andata, andata e ritorno o più tratte; da/a con lo scambio; data; passeggeri con i pulsanti più e meno; validazione e stati. Non invia nulla, perché è un concept.
3. **Tempo risparmiato.** Due barre a confronto tra il volo di linea e il volo privato (minuti indicativi).
4. **Flotta.** Un carosello orizzontale bloccato durante lo scroll, con le classi light, midsize, super-midsize e heavy (valori tipici di classe). Su telefono si sfoglia con il dito.
5. **Dettagli.** Una sala chiara con tre foto incorniciate appese ai fili, che oscillano.
6. **Aeroporti.** Una mappa in scala reale con i tempi di volo indicativi da Milano Linate verso Engadina, Nizza, Olbia, Ibiza e Mykonos.
7. **Jet Card.** Una carta in metallo che si inclina al passaggio del mouse, seguita da una striscia di testo che scorre.
8. **Ultima chiamata.** Le nuvole di notte (un fotogramma del tuo video ricolorato) e il pulsante finale.

Una linea dorata, la rotta, attraversa la pagina e si disegna con lo scroll fino al pulsante finale.

## Migliorie rispetto al reel

- Non ci sono le scritte piccole sopra i titoli: le skill le vietano, e il titolo funziona da solo.
- Il testo sul video è sempre leggibile, grazie a una velatura scura dietro le parole.
- Il modulo è vero, con stati di errore e di invio.
- La versione per telefono è pensata apposta.
- Se il dispositivo chiede animazioni ridotte, il video lascia il posto a un'immagine ferma per capitolo.
- Usa due font invece di tre.
- Il video del jet è stato ingrandito di 2× (FSRCNN) per restare nitido a schermo intero.

## Licenze e note

- **Video del jet:** l'hai fornito tu.
- **Foto:** Pexels (Pexels License); i link sono nel footer.
- **Font:** Archivo e Instrument Serif (SIL OFL).
- **Copia dal reel:** nome, marchio e testi sono nostri, perché il reel è il lavoro di un altro studio. Sono stati ripresi solo la struttura, il ritmo e lo stile.

## Avvio

```bash
cd anima-fly && python3 -m http.server 4321    # http://127.0.0.1:4321
```

Con `?rec` la pagina si comanda fotogramma per fotogramma: `window.__af.step({ scroll })`. Serve per registrare il video di anteprima.
