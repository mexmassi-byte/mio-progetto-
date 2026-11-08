# Meder & Tal – Website

Cinematische Website für die Kanzlei **Meder & Tal** (Genua), gebaut aus dem
`WEBSITE_CONTENT_PACKAGE` von medertal.com. Deutsch (Standard) und Englisch per
Umschalter im Header.

## Seiten

| Menü (DE / EN)           | Pfad         | Inhalt |
| ------------------------ | ------------ | ------ |
| Home                     | `/`          | Lebendiges Meer im Letterbox-Format, Claim, Stärken, Partner, „Was uns auszeichnet“ |
| Über uns / About Us      | `/about`     | Geschichte, horizontale Kamerafahrt durch den Werdegang |
| Kompetenzen / Expertise  | `/expertise` | Drei Rechtsgebiete, „Von der Gründung bis zum Exit“, Kostenmodell |
| Team                     | `/team`      | Dr. Manuel Meder, Dr. Michael Tal mit Direktkontakt |
| Kontakt / Contact        | `/contact`   | Kontaktdaten, Formular (öffnet das E-Mail-Programm) |
| Footer                   | `/imprint`, `/privacy` | Impressum und Datenschutz (Originaltexte) |

## Das cinematische Konzept

- **Letterbox**: Schwarze Kinobalken rahmen den Hero, der Claim läuft als Untertitel im unteren Balken.
  Beim Scrollen zieht die Kamera zurück und der Bildausschnitt wird zum Breitbild.
- **Szenenwechsel**: Jeder Seitenwechsel schließt die Balken, zeigt eine Titelkarte und öffnet die neue Seite.
- **Lebendiges Meer**: Das Standbild des Hero-Videos wird per WebGL-Shader animiert (Wasser, Brandung,
  langsame Kamera). Ohne WebGL oder bei „Bewegung reduzieren“ bleibt das Standbild stehen.
- **Kamerafahrt** auf „Über uns“, gekoppelte Zähler auf „Kompetenzen“, Filmkorn als Overlay.
- Bei `prefers-reduced-motion` sind alle Animationen aus und alle Inhalte sofort sichtbar.

Farben: Hafenblau `#0B2131`, Nachtblau `#061624`, Gischt `#E6ECEA`, Genueser Ocker `#D6A04A`.
Schriften: Bodoni Moda (Titel) und Schibsted Grotesk (Text), **lokal eingebunden** (kein Google-Fonts-CDN, DSGVO).

## Technik

React 18, TypeScript, Vite 5, React Router 6, GSAP 3.13 (ScrollTrigger, SplitText), Lenis (Smooth Scroll).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Produktion nach dist/
npm run preview
```

Alle Texte stehen in `src/content/site.ts` (DE und EN), Impressum in `src/content/imprint.ts`,
Datenschutz in `src/content/legal.ts`. Bilder liegen optimiert in `public/img/`.

Hosting: Es ist eine Single-Page-App. Alle Pfade müssen auf `index.html` zeigen;
`public/_redirects` (Netlify) und `vercel.json` (Vercel) sind dafür schon dabei.

## Vor dem Livegang mit der Kanzlei klären

1. **Neue Texte prüfen lassen** (in `src/content/site.ts`): die Kurzbeschreibungen der Rechtsgebiete und
   die sechs Stationen „Von der Gründung bis zum Exit“ (markiert mit `NEW COPY`), die Kurzzeilen der
   Timeline auf „Über uns“, die Team-Texte, Partner-Überschrift und Formular-Themen. Alles andere ist
   Originaltext (offensichtliche Tippfehler korrigiert, z. B. „erteilen“, „Mandanten“, „Unternehmern“).
2. **Datenschutzerklärung aktualisieren.** Der Originaltext beschreibt Cookies und Analyse-Tools der
   alten Wix-Seite. Die neue Seite setzt keine Cookies und kein Tracking; nur die Sprachwahl liegt im
   `localStorage`.
3. **Bildrechte.** Stein (`stone.webp`) und Wellen (`waves.jpg`) stammen sehr wahrscheinlich aus
   Wix-Vorlagen. Lizenz prüfen oder durch eigene Motive ersetzen.
4. **Zustimmung** der Kanzlei zur Nutzung der Inhalte und Porträts (laut Impressum erforderlich).
5. Das Hero-Video der alten Seite ist bewusst nicht enthalten. Es kann als `<video>` den Shader ersetzen,
   wenn gewünscht.
