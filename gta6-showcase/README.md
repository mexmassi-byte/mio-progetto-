# GTA VI – Luxury Landing Page · MacBook Pro Showcase

Ein flüssiges 60‑fps‑Showcase‑Video (2560 × 1440): Ein MacBook Pro 14″ in Space Gray
steht auf einem dunklen Walnuss‑Designertisch, das Display wacht auf und zeigt eine
ultra‑edle Landingpage für **Grand Theft Auto VI** in Safari (Vollbild, Dark Mode).
Die Kamera fährt langsam auf den Bildschirm zu, während der Cursor über die Seite
gleitet, Hover‑Effekte auslöst und gleichmäßig nach unten scrollt.

> **Inoffizielles Fan‑Konzept** zu Designzwecken – nicht mit Rockstar Games oder
> Take‑Two Interactive verbunden. „Grand Theft Auto“ und „Grand Theft Auto VI“ sind
> Marken von Take‑Two Interactive Software, Inc. Es werden **keine** offiziellen Bilder,
> Logos oder Videos verwendet: Skyline, Palmen, Brücke, Motive und das MacBook sind
> vollständig prozedural (Code) erzeugt.

## Ergebnis

| Datei | Inhalt |
| --- | --- |
| `output/GTA-VI-MacBook-Showcase.mp4` | finales Video, H.264, 60 fps, ~50 s |
| `site/` | die Landingpage (läuft auch ganz normal im Browser) |
| `scene/` | Three.js‑Szene: MacBook Pro, Tisch, Licht, Kamera |
| `render/` | deterministischer Frame‑Renderer + ffmpeg‑Encoding |

## Die Landingpage

* **Stil:** mattschwarz, Champagner‑Gold, Frosted Glass (Backdrop‑Blur), Typografie
  aus *Inter* (Display‑Optik) und *Bodoni Moda* (Kursiv‑Akzente, Gold‑Verläufe).
* **Navigation:** Overview · Pre‑Order · Cinematic Media · Editions (+ Datum, CTA).
* **Hero:** animierte Vice‑City‑Nacht – spiegelnde Bucht mit Wellen, Neon‑Kronen,
  blinkende Flugwarnlichter, fließender Verkehr auf der Brücke, wiegende Palmen.
* **Sektionen:** Story (scroll‑gekoppelte Wort‑Hervorhebung), Key Features (Bento‑Grid
  mit Cursor‑Spotlight), Only in Leonida, Characters, Cinematic Media (Launch Trailer,
  Reel, Timeline), Editions (Standard / Ultimate), Finale mit Datum, Footer.
* **Animationen:** Masken‑Reveals Wort für Wort, Buchstaben‑Einblendung, Gold‑Shine,
  Hover‑Lift, Gold‑Rahmen, Play‑Ringe, Timeline‑Fill, Datum‑„Odometer“.

Die Seite ist responsiv (Desktop, Tablet, Smartphone); im Video wird die Desktop‑Ansicht
mit 1512 × 906 CSS‑px gezeigt, wie Safari im Vollbild auf einem MacBook Pro 14″.

Alle Animationen sind reine Funktionen von *(Zeit, Scrollposition, Zeiger)*.
Im normalen Browser laufen sie in Echtzeit; mit `?rec` wird die Seite vom Renderer
Frame für Frame gesteuert, deshalb gibt es im Video keinerlei Ruckler oder Drops.

### Inhaltliche Quellen (Stand 18. November 2026)

Alle Angaben stammen von Rockstar Games:

* Release **19. November 2026**, PlayStation 5 und Xbox Series X|S –
  [Newswire](https://www.rockstargames.com/newswire/article/ak3ak31a49a221/grand-theft-auto-vi-is-now-set-to-launch-november-19-2026)
* Editionen, Inhalte, Pre‑Order‑Bonus (Vintage Vice City Pack, 1 Monat GTA+ bis 20.11.2026),
  Pre‑Load ab 10.11., Cloud Gaming / Remote Play –
  [Support: Platforms, Editions, and Versions](https://support.rockstargames.com/articles/4QfG4FmZCf5W1gS8jy4UVT/grand-theft-auto-vi-platform-editions-and-versions),
  [Editions](https://www.rockstargames.com/VI/editions)
* *An Extended Look* (27.08.2026, komplett in‑game auf PS5 aufgenommen) –
  [Newswire](https://www.rockstargames.com/newswire/article/4k138k8okkk483/grand-theft-auto-vi-an-extended-look-now-playing)
* Launch Trailer (15.10.2026) mit „Flower in a Hurricane“ (Justice feat. Tame Impala, SZA,
  King Gizzard & The Lizard Wizard), Score von Justice –
  [Newswire](https://www.rockstargames.com/newswire/article/517572321a549a/watch-the-grand-theft-auto-vi-launch-trailer)
* Figuren und Orte – [Only in Leonida](https://www.rockstargames.com/VI/only-in-leonida),
  Timeline – [Newswire‑Archiv](https://www.rockstargames.com/newswire?tag=vi)

Preise werden bewusst nicht gezeigt, da sie je nach Region variieren und keine offizielle
Preisangabe von Rockstar vorlag.

## Selbst ausführen

```bash
cd gta6-showcase
npm install                     # three.js + Schriften
npm run serve                   # http://127.0.0.1:4173/site/  (Landingpage live)

# Video rendern (Playwright/Chromium nötig, CPU‑Rendering via SwiftShader)
node render/render.mjs --out /tmp/frames --w 2560 --h 1440        # alle 3000 Frames
node render/render.mjs --out /tmp/stills --stills 5,17,34,46      # einzelne Standbilder
render/encode.sh /tmp/frames output/GTA-VI-MacBook-Showcase.mp4 18
```

* `render/timeline.mjs` – Kamera (Weitwinkel → sanfter Zoom → Rückzug), Display‑Wake,
  Tastaturbeleuchtung; wird von Node *und* Browser genutzt.
* `render/plan.mjs` – Scroll‑Kurve (monotone kubische Interpolation, nie rückwärts)
  und Cursor‑Weg, aus dem gemessenen Layout der Seite berechnet.
* Die Webseite wird in voller Retina‑Auflösung (3024 × 1812) erfasst und scrollt in
  Geräte‑Pixel‑Schritten (0,5 CSS‑px) – exakt wie ein echtes Retina‑Display, ohne Ruckler.
* `scene/scene.js` – prozedurales MacBook Pro 14″ (Space Gray, Tastatur mit
  Hintergrundbeleuchtung, Trackpad, Lautsprechergitter, Notch, Glas), Walnuss‑Tisch mit
  eingebackener Tiefenunschärfe, Studio‑Licht, Display‑Licht in den Farben der Seite.

Schriften: Inter, Inter Tight, Bodoni Moda – SIL Open Font License (siehe `site/assets/fonts`).
