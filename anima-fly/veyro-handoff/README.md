# ANIMA FLY nel sito VEYRO, al posto di Vela

Questa cartella è una copia di sicurezza della modifica al sito VEYRO (`mexmassi-byte/pixel-perfect-render-0453`). La modifica è pronta nel clone locale, sul ramo `claude/loving-wozniak-lycww5` (commit `59f9315`), ma non è ancora stata caricata: manca il permesso di scrittura su quel repository.

- `veyro-anima-fly.patch`: le modifiche al codice e ai testi.
  - Il concept ANIMA FLY va al posto di Vela nella sezione "Selected work", nel nastro 3D, nell'anteprima dell'hero e nella finestra che si apre.
  - I testi sono in EN, IT, ES e DE.
  - CLAUDE.md e AGENTS.md sono aggiornati.
- `anima-concept.mp4` e `anima-concept.webm`: il film della scheda, 40 s, 1280×800. Va in `public/media/`.
- `anima-poster.webp`: la locandina. Va in `src/assets/work/`.
- I sorgenti del concept vanno in `docs/concepts/anima-fly/`: sono il contenuto di `anima-fly/` più `rec.mjs`, che è nella patch.

I file di Vela restano nel repository: si può tornare indietro in qualsiasi momento.
