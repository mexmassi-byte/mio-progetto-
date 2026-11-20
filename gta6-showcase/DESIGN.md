---
name: Vice City After Dark
description: An unofficial fan page for Grand Theft Auto VI, built as the Art Deco facades of Ocean Drive, one light switch from pastel day to neon night.
colors:
  stucco: "#f4bcc8"
  mint: "#bfe5d6"
  night: "#082445"
  enamel: "#fff4f6"
  neon-azure: "#3d8bff"
  mint-night: "#0b3150"
  stucco-night: "#1a2a52"
  cabinet-night: "#061a33"
  tube-body: "#10284a"
typography:
  display:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "clamp(64px, 12.4vw, 184px)"
    fontWeight: 900
    lineHeight: 0.86
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "clamp(44px, 7vw, 104px)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "clamp(24px, 2.4vw, 36px)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Big Shoulders Text, Arial Narrow, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Big Shoulders Text, Arial Narrow, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  sign-letter:
    fontFamily: "Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "92px"
    fontWeight: 900
rounded:
  none: "0px"
spacing:
  margin: "clamp(16px, 2.2vw, 32px)"
  gutter: "clamp(16px, 2vw, 32px)"
  section: "clamp(120px, 14vw, 220px)"
components:
  button-primary:
    backgroundColor: "{colors.neon-azure}"
    textColor: "{colors.night}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "44px"
  button-paper:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.night}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "52px"
  film-play:
    backgroundColor: "{colors.neon-azure}"
    textColor: "{colors.night}"
    rounded: "{rounded.none}"
    size: "64px"
  sign-blade-day:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.night}"
    typography: "{typography.sign-letter}"
    rounded: "{rounded.none}"
  sign-blade-lit:
    backgroundColor: "{colors.cabinet-night}"
    textColor: "{colors.tube-body}"
    typography: "{typography.sign-letter}"
    rounded: "{rounded.none}"
  film-card-panel:
    backgroundColor: "{colors.stucco}"
    textColor: "{colors.night}"
    rounded: "{rounded.none}"
    padding: "24px 28px"
  film-card-date:
    backgroundColor: "{colors.cabinet-night}"
    textColor: "{colors.enamel}"
    typography: "{typography.headline}"
    rounded: "{rounded.none}"
---

# Design System: Vice City After Dark

## Overview

**Creative North Star: "The Facade That Lights Up"**

Every section is the front of an Ocean Drive Art Deco hotel: a flat field of painted stucco carrying a vertical name sign that says literally what the section holds (LEONIDA, PLACES, JASON, LUCIA, DATES, OUT NOW). One switch turns the whole street from pastel day to neon night. The page is built so that this is one move, not a theme swap: a single registered number, `--k`, runs from 0 (day) to 1 (night), and every colour on the page is an oklab mix keyed to it, so fields, ink, sign cabinets and the browser's theme colour all travel together over 1100ms.

The surfaces are flat, square and printed-looking: four inks, no shadows, no blur, no glass, no gradients. Light is never painted as a glow. A sign lights the way a real neon tube does: its letters keep a dark body and gain an azure stroke tube, and they catch with a flicker, letter by letter. Real glow lives only in the real photographs of Ocean Drive and Miami at night, which carry the atmosphere the flat fields refuse to fake.

Type is one condensed family in two cuts: Big Shoulders Display, set huge and tight for statements and stacked one letter per cell inside the signs, and Big Shoulders Text for reading. Layout is a window-bay grid of square photographs and fields, with pinned stages that hold a sign while the street passes behind it.

**Key Characteristics:**
- One registered custom property, `--k`, drives every colour: 0 is day (pastel stucco), 1 is night (Atlantic navy), mixed in oklab.
- Four inks: stucco, mint, night, enamel. Neon azure is the light, not a fifth field colour.
- A lit sign is a dark body with an azure stroke tube, never a blur.
- Square corners everywhere; no shadows; flat fields.
- Vertical blade signs name the sections; the films stage is the one horizontal sign.
- Real, credited photographs of Ocean Drive and Miami at night carry all photographic light.
- Deterministic record mode (`?rec`, driven through `window.__rec`) for the 9:16 video.

## Colors

A pastel street by day and an Atlantic-navy street by night, lit by a single neon azure.

### Primary
- **Neon Azure** ({colors.neon-azure}): the light. It appears only on the signs (the stroke tube of every lit letter and of the horizontal "The films" title) and on the single action, "Watch the fan film", whose play square on the fan-film card is the same action. Momentary interaction states borrow it too (focus ring 3px with 3px offset, text selection, the skip link), because they are states, not surfaces. Text on azure is always night.

### Neutral (the four inks)
- **Flamingo Stucco** ({colors.stucco}): the day ground of the page and of the pink facade; a film-card panel colour; at night it survives as the ink of the "Out now" row and the footer place names, the warm note on navy.
- **Ocean Mint** ({colors.mint}): the second day field (the Ocean Drive walk and Jason's facade); a film-card panel colour.
- **Atlantic Night** ({colors.night}): the night ground, the day ink, and the text colour on every light field and on azure. The browser theme colour switches to it at night.
- **Sign Enamel** ({colors.enamel}): the day sign cabinet, the night ink, the paper button, and the light text on photographs and navy.

### Night shades of the mix
These are not extra inks; they are the night endpoints the day fields mix toward, all shades of Atlantic Night, so each field keeps its identity after dark.
- **Mint at Night** ({colors.mint-night}): where Ocean Mint fields land at `--k: 1`.
- **Stucco at Night** ({colors.stucco-night}): where the pink facade lands at `--k: 1`, a faint indigo.
- **Cabinet at Night** ({colors.cabinet-night}): the sign cabinet after dark and the date block of the film cards.
- **Tube Body** ({colors.tube-body}): the dark body of a lit letter and of lit plain-text signs, under the azure stroke.

### Named Rules
**The One Number Rule.** Every colour is derived from `--k` with `color-mix(in oklab, <day>, <night> calc(var(--k) * 100%))`. Never hard-code a day-only or night-only colour on a field; add a mix instead, so the switch keeps moving the whole page at once.

**The One Light Rule.** Neon Azure appears only on the signs and the single action. It is never a field, a border, a heading colour or a decoration.

**The Four Inks Rule.** Fields and text use stucco, mint, night and enamel and their night shades. Colour in the page comes from the real photographs, not from new swatches.

## Typography

**Display Font:** Big Shoulders Display 800 and 900 (with Arial Narrow, sans-serif)
**Body Font:** Big Shoulders Text 400, 600 and 700 (with Arial Narrow, sans-serif)

**Character:** One tall, condensed American sign-painter family in two optical cuts: the display cut shouts like a hotel name, the text cut reads like the small print on a plaque. Both are self-hosted woff2; the 900 display weight is preloaded.

### Hierarchy
- **Display** (900, clamp(64px, 12.4vw, 184px), 0.86): the hero sentence "Vice City / is open." split to opposite corners, and the footer wordmark. Phone: clamp(64px, 19vw, 92px).
- **Headline** (900, clamp(44px, 7vw, 104px), 0.95): section titles and the film-card dates. Phone: clamp(40px, 11vw, 52px).
- **Title / Statement** (800, clamp(24px, 2.4vw, 36px), 1.12, max 25ch, balanced): statements, quotes, facade names, film names, the road-to-launch table, footer places. Phone: 24px.
- **Body** (Text 400, 18px, 1.5): reading copy, max 44ch in two-column intros, 34ch elsewhere. The hero lede uses 600 at 1.35.
- **Label** (Text 600/700, 15px): navigation, captions, the Lights switch, buttons, footer columns and legal.
- **Sign letter** (Display 900, 92px in a 100-unit-wide sign, centred): one letter per cell inside a blade sign.

### Named Rules
**The Five Steps Rule.** There are five type sizes (15px, 18px, statement, head, display) and no more; new content picks one of them.

**The One Family Rule.** Big Shoulders only. Display cut for anything that names, Text cut for anything that explains.

## Layout

Full-bleed facades stacked vertically, each one a section with its own field colour. Edge margin clamp(16px, 2.2vw, 32px); gutter clamp(16px, 2vw, 32px); section padding clamp(120px, 14vw, 220px). Where a grid is needed it is one window-bay grid: an auto column for the sign plus 12 equal columns (places intro), or 12 columns in the footer.

Pinned stages carry the motion: the hero (210svh) holds the split sentence while a column of 16:9 frames, 42vw wide on the centre line, slides through it; the walk (215svh) holds the LEONIDA sign and its plaque while three photographs pass behind; the places curtain stacks three full-viewport photographs that slide over each other; the films stage (205svh) holds a darkened skyline photograph while a track of cards moves sideways. The header bar sits on the first facade and is not fixed.

Breakpoints: at 1024px the nav links hide, the duo becomes one column, and the films track becomes a vertical stack. At 700px the phone gets its own composition: smaller steps, the reel frames become 4:3 and fill the width, the walk and its photographs flow in sequence, the table becomes stacked rows, the closing photograph sits above its copy. Under reduced motion the films stack vertically as on tablet and the switch transition shortens to 300ms.

## Elevation & Depth

Flat. There are no box shadows and no blur anywhere. Depth comes from layering whole planes: sticky stages over scrolling photographs, photographs sliding over photographs, signs standing in front of fields. Photographs under text are dimmed with a plain brightness filter (0.55 on the films ground, 0.8 on the closing photograph) and captions over the curtain photographs sit on a flat dark band, never a gradient or frosted glass.

### Named Rules
**The Painted Wall Rule.** Surfaces are flat paint. If something needs to sit in front, it sits on a different plane in the scroll, not on a shadow.

## Shapes

Square corners everywhere (0px): buttons, switch, frames, photographs, cards, signs, dialog. The one silhouette is the blade sign cabinet: a tall rectangle with a stepped Art Deco crown (three stepped tiers at the top) and a small pointed drop at the bottom, drawn as one SVG path whose height grows with the number of letters (78 units per letter). Photograph crops are fixed ratios: 16:9 frames, 4:5, 16:10 and 1:1 passes, 4:3 on the phone.

## Components

### Buttons
Blunt, printed slabs.
- **Shape:** square (0px).
- **Primary (the single action):** neon azure with night text, Text 700 at 15px, 44px tall, 20px side padding. Only one action on the page uses it: "Watch the fan film", which opens the fan-film player.
- **Paper:** enamel with night text, 18px, 52px tall; the outbound link to Rockstar's own page at the close.
- **Hover (fine pointers only):** primary mixes 18% toward white; paper goes pure white. **Press:** scale 0.96 over 140ms. **Focus:** 3px azure outline, 3px offset.

### Navigation
Text labels at 15px with an underline that fades in on hover (transparent to currentColor over 180ms). The wordmark is Display 900 at 22px. On phone the bar wraps to two rows and the nav links hide from 1024px down.

### Lights switch (signature)
The page's one live control: a square 46 by 26px track with a 20px square knob that slides with `--k`, a "Lights" label and Vice City's local time. By default the lights follow the real hour in Miami (on after about 17:42, off after about 06:48). Press scales the track to 0.94.

### Blade sign (signature)
An inline SVG, aria-hidden, set beside the section title it names. **Day:** enamel cabinet, night letters, no stroke. **Lit:** the cabinet mixes to Cabinet at Night, each letter keeps a dark Tube Body and gains a 5.5-unit azure stroke tube with round joins; letters catch one by one with a 620ms flicker (off, on, off, on, held) staggered 70ms per letter after a 260ms delay. Plain-text signs (the films title, the footer wordmark) light the same way: Tube Body colour with a 0.045em azure text stroke.

### Film card
A 720 by 560px card (82vw and 64svh caps) split 68 / 32: a media block over a flat ink panel. The fan film's media block is a looping clip with a 64px square azure play button; the official films show their date in Display 900 on Cabinet at Night. Panels rotate stucco, mint, enamel with night text, the name at statement size left and the description right-aligned.

### Photographs
Real credited photographs and royalty-free footage of Miami and Miami Beach only, each with a 15px 600 caption naming the place. Loops play only while on screen.

### Player
A full-screen dialog on near-black (#05080f) with the clip contained and an enamel "Close" button top right.

## Do's and Don'ts

### Do:
- **Do** derive every new colour from `--k` with an oklab `color-mix`, so the Lights switch moves it with the rest of the page.
- **Do** keep Neon Azure on the signs and the single action only; text on azure is night.
- **Do** light a sign as a dark body with an azure stroke tube, and let it catch with the letter-by-letter flicker.
- **Do** name each new section with a vertical blade sign that says literally what the section holds; set a sign horizontally only where the section itself moves sideways, as the films stage does.
- **Do** keep corners square (0px) and fields flat.
- **Do** use only the five type steps and the Big Shoulders family.
- **Do** keep every moving thing a pure function of time, scroll and lights in record mode (`?rec`, `window.__rec.step()`), with CSS transitions and animations off.

### Don't:
- **Don't** render light as blur, glow, text-shadow or box-shadow; the real glow belongs to the photographs.
- **Don't** add gradients, frosted glass, shadows or rounded corners.
- **Don't** introduce a fifth field colour or a second accent.
- **Don't** use Rockstar artwork, screenshots, trailers or logos; any wordmark is our own.
- **Don't** make the header fixed; it sits on the first facade.
