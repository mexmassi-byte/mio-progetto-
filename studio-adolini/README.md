# Studio Adolini — sito monografico (one page)

Pagina unica in `index.html` (HTML semantico, CSS e un solo modulo JavaScript).
Three.js e Lenis sono caricati dalla CDN tramite import map (versioni fissate);
nessun framework, bundler o build step.

## File

| Percorso | Contenuto |
| --- | --- |
| `index.html` | Tutta la pagina: token di design, layout, ticker condiviso, molle, stack a fogli, linework, scena Three.js |
| `studio-adolini-portrait.png` | Il ritratto fornito, usato così com'è (370 × 370 px) |
| `assets/img/` | Copia locale delle immagini ufficiali, con gli stessi nomi di file pubblicati su studioadolini.com |

## Avvio

Basta aprire `index.html` nel browser (doppio clic). Serve una connessione a
Internet per i font Google e per Three.js/Lenis dalla CDN. In alternativa:

```bash
cd studio-adolini
python3 -m http.server 8000
# http://localhost:8000
```

Aggiungendo `?dev` all'URL (da server locale) si attivano i log di sviluppo
(tempi del caricamento, immagini non trovate, fallback WebGL).

## Contenuti e fonti

Tutti i testi, i titoli, i luoghi, le date, i contatti e le immagini provengono da
studioadolini.com (pagine di categoria, schede progetto, Profilo, Contatti) e sono
raccolti nelle strutture `DISCIPLINES`, `PROJECTS`, `BRANDS` all'inizio del modulo.
Nessun progetto, dato o riconoscimento è stato aggiunto.

- Ogni immagine viene caricata dalla copia locale; se manca, la pagina prova l'URL
  ufficiale (`data-origin`) e infine mostra un segnaposto neutro.
- Le due foto ad alta risoluzione (Globo, Torii) sono slide della home ufficiale,
  verificate confrontandole con le foto delle rispettive schede progetto.
- La scena 3D e le linee di contorno sono puramente decorative.
- La pagina è solo in italiano; il footer rimanda alla versione inglese ufficiale.

## Note

- Il ritratto originale misura 370 × 370 px: nell'hero viene ingrandito fino a
  ~37rem. Una versione a risoluzione maggiore dello stesso file migliorerebbe la nitidezza.
- Con `prefers-reduced-motion` la pagina rinuncia a smooth scroll, stack, parallax e
  rivelazioni animate e mostra un layout statico completo.
