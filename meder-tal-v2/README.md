# Meder & Tal – Website (Version 2)

Statische Website mit 5 Seiten (Home, Über uns, Kompetenzen, Team, Kontakt) plus Impressum und
Datenschutz. Gebaut mit den vier Design-Skills (`.claude/skills/web-design-stack`):
Taste Skill (Richtung, Kit, Prüfungen), MotionSites (Signatur und Spezifikation),
Design Motion Principles (Bewegung) und Impeccable (Detektor und letzter Feinschliff).

## Ansehen

Die Seiten brauchen einen kleinen Webserver (wegen der Module und des Videos):

```bash
cd meder-tal-v2 && python3 -m http.server 8000
```

Dann http://localhost:8000 öffnen. Hosting: jeder statische Host (Netlify, Vercel, eigener Server),
den Ordner so hochladen, wie er ist.

## Ändern

Die Texte stehen in `src/build.mjs` (eine Vorlage für alle Seiten). Nach jeder Änderung:

```bash
node src/build.mjs
```

Eigene Gestaltung: `assets/site.css`, Film-Steuerung: `assets/site.js`. Alles andere unter `assets/`
ist das Taste-Skill-Kit (nicht von Hand ändern).

## Das cinematische Konzept (Stand: Version im Stil von MotionSites)

- **Home-Hero:** der Film der Kanzlei bildschirmfüllend, Navigation als Pille aus „Liquid Glass“, die
  Kinobalken öffnen sich beim Laden, die Überschrift erscheint Wort für Wort aus der Unschärfe.
- **„Drei Versprechen“:** ein zweiter Film (Licht fällt in tiefes Wasser, Fische; aus der freien
  MotionSites-Mediathek) hinter drei Glas-Karten.
- **Elemente:** Überschriften steigen Zeile für Zeile auf, Linien zeichnen sich, Porträts werden
  aufgedeckt, die sechs Phasen leuchten beim Lesen nacheinander auf, Buttons folgen leicht dem Zeiger,
  der Name im Footer setzt sich Buchstabe für Buchstabe zusammen (`assets/motion-wow.js`, GSAP lokal).
- **Seitenwechsel:** schwarze Kinobalken schließen sich, der Name der nächsten Seite erscheint, die
  Balken öffnen sich auf der neuen Seite.

### Erste Fassung

- **Hero:** der echte Film der alten Website (Brandung von oben) in einem großen Kinorahmen. Beim Laden
  öffnet sich der Rahmen wie ein Kameraverschluss, der Film setzt mit einer langsamen Fahrt ein.
  Pause-Taste; bei „Bewegung reduzieren“ bleibt das Standbild.
- **Momente:** ein Satz, der sich Wort für Wort beim Scrollen färbt; Fotos, die wie ein Abzug in der
  Dunkelkammer entstehen; auf „Über uns“ fünf Orte (Frankfurt, Mailand, Berkeley, Oxford, Genua),
  die sich beim Scrollen übereinander schieben.
- **Seitenwechsel:** die Seiten blenden ineinander über, die Navigation bleibt stehen.
- Schrift Hanken Grotesk lokal eingebunden (keine Anfrage an Google), Farben Papier, Tinte und Messing.

## Vor dem Livegang mit der Kanzlei klären

1. **Neue Texte prüfen:** die Kurztexte der fünf Orte, die sechs Phasen auf „Kompetenzen“, die
   Überschriften und Leads, der Team-Satz („Unsere Wege verlaufen seit dem Studium parallel …“).
   Die übrigen Texte stammen von der alten Website (Tippfehler korrigiert).
2. **Datenschutzerklärung aktualisieren:** der alte Text beschreibt Cookies und Analyse-Tools von Wix.
   Die neue Seite setzt weder Cookies noch Tracking.
3. **Fotos:** die Städtebilder sind Platzhalter von Wikimedia Commons (Autoren im Footer genannt,
   CC BY-SA 4.0 / CC0). Eigene Fotos der Kanzlei würden die Seite noch stärken. Stein- und Wellenbild
   stammen vermutlich aus Wix-Vorlagen: Lizenz prüfen.
4. **Impressum:** der Link zur Rechtsanwaltskammer war auf der alten Seite kaputt; hier steht er als
   Text. Die richtige Adresse der Kammer eintragen.
5. **Domain:** `canonical` und `og:image` (share.jpg) erst setzen, wenn die Seite unter der Domain läuft.

## Prüfungen

- Taste-Skill-Gate: 21 Befunde in Runde 1, danach 3. Bewusste Ausnahmen (`.taste-skill/waivers.json`):
  echte Adresse und Telefonnummern der Kanzlei, die originale Hero-Überschrift, die Buttonfarbe auf
  dunklem Grund.
- Impeccable-Detektor: nur Hinweise aus dem Kit selbst (nicht genutzte Stile), keine Fehler.
- Keine Konsolenfehler, kein horizontales Scrollen bei 1440 und 390 px.
