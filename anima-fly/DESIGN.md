---
name: ANIMA FLY
description: Dusk over the apron. A private-jet concept page where the scroll is one flight.
colors:
  champagne-gold: "#e8d6a2"
  gold-deep: "#c8ae6e"
  gold-highlight: "#fbf3da"
  gold-ink: "#1d1708"
  night-ground: "#0b0d18"
  violet-night: "#13122a"
  blue-night: "#0e1530"
  booking-surface: "#1b1a35"
  warm-white: "#f3f2ef"
  warm-white-soft: "rgba(243, 242, 239, 0.74)"
  warm-white-faint: "rgba(243, 242, 239, 0.56)"
  hairline: "rgba(244, 239, 230, 0.14)"
  light-hall: "#e7e7e4"
  hall-ink: "#17161d"
  hall-grey: "#5b5866"
  error-coral: "#e98a7a"
typography:
  display:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(44px, 6.4vw, 96px)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 125"
  display-answer:
    fontFamily: "Instrument Serif, Times New Roman, serif"
    fontSize: "calc(clamp(44px, 6.4vw, 96px) * 0.86)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(34px, 4.6vw, 68px)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 125"
  headline-answer:
    fontFamily: "Instrument Serif, Times New Roman, serif"
    fontSize: "calc(clamp(34px, 4.6vw, 68px) * 0.9)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.1
    fontVariation: "'wdth' 125"
  figure:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(30px, 3.6vw, 52px)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 125"
  body:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  small:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.14em"
    fontVariation: "'wdth' 112"
rounded:
  print: "10px"
  field: "14px"
  photo: "16px"
  panel: "22px"
  pill: "999px"
spacing:
  margin: "clamp(20px, 4.4vw, 64px)"
  stack: "22px"
  group: "26px"
  action: "30px"
  section: "clamp(110px, 14vh, 170px)"
components:
  button-primary:
    backgroundColor: "{colors.champagne-gold}"
    textColor: "{colors.gold-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 26px"
    height: "48px"
  button-primary-small:
    backgroundColor: "{colors.champagne-gold}"
    textColor: "{colors.gold-ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "40px"
  button-primary-wide:
    backgroundColor: "{colors.champagne-gold}"
    textColor: "{colors.gold-ink}"
    rounded: "{rounded.pill}"
    width: "100%"
    height: "56px"
  button-ghost:
    backgroundColor: "rgba(11, 13, 24, 0.55)"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.pill}"
    padding: "0 26px"
    height: "48px"
  booking-card:
    backgroundColor: "{colors.booking-surface}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.panel}"
    padding: "clamp(20px, 2.4vw, 30px)"
  field:
    backgroundColor: "rgba(0, 0, 0, 0.24)"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.field}"
    padding: "14px 16px"
  segment-selected:
    backgroundColor: "{colors.warm-white}"
    textColor: "{colors.night-ground}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
---

# Design System: ANIMA FLY

## Overview

**Creative North Star: "The Flight Deck at Dusk"**

The page is one flight, and the system is built from what a flight at dusk is made of: a night sky going from violet to blue, champagne light catching metal, warm white instrument type, and one gold course line that lands on its targets. The owner's film carries the persuasion; type sits where the picture is calm, on neutral scrims, and steps aside.

Density is low and cinematic. Each section is one statement and one supporting block, set wide on a single night ground that changes tone by chapter (violet for planning, blue for the runways), with one daylight interruption: the light hall where three framed prints hang on wires. Everything that moves is a pure function of scroll position, so the same scroll always draws the same frame.

The world follows the owner's comp (a reference reel) closely by request. Its gold metal pills, outlined fleet words, hanging gallery, route lines and jet card are the comp's devices, kept on purpose. The comp's small labels above the titles were removed and stay removed.

**Key Characteristics:**
- Statements in a heavy expanded caps grotesque, answered by one italic serif line.
- Champagne gold as lit metal, reserved for actions, the flight's progress and the route.
- Night grounds in three tones, plus one light hall.
- Numbers are instruments: tabular, live, and always meaningful.
- Scroll-scrubbed film, scroll-drawn lines, reveals that arrive once from a visible default.

## Colors

A dusk palette: three night grounds, one warm white, and a champagne gold that is always treated as metal.

### Primary
- **Champagne Gold** (#e8d6a2): The accent. As a flat colour it draws the route, the map arcs, the home pin, the brand mark, focus outlines, the caret and the selection. On actions it is never flat: it is the centre stop of the metal gradient.
- **Gold Deep** (#c8ae6e) and **Gold Highlight** (#fbf3da): the shadow and the lit edge of the metal gradient. The highlight is a reflection on the gold, not a cream ground.
- **Gold Ink** (#1d1708): text on gold, and the selection text.

### Neutral
- **Night Ground** (#0b0d18): the page ground, the hero's base, the card section.
- **Violet Night** (#13122a): planning sections (the booking form, the time race).
- **Blue Night** (#0e1530): the fleet and the runways.
- **Booking Surface** (#1b1a35): the one raised panel, the booking card on violet night.
- **Warm White** (#f3f2ef): all type on night, at full strength for statements and values, at 74% for body and nav, at 56% for labels and notes.
- **Hairline** (rgba 244/239/230 at 8-20%): field borders, control rings, the HUD track's rail. Never a section divider.
- **Light Hall** (#e7e7e4), **Hall Ink** (#17161d), **Hall Grey** (#5b5866): the daylight section, its statement and its body text. Selection inverts to ink on hall.
- **Error Coral** (#e98a7a): the field border on a validation error, and nothing else.

### Named Rules
**The Metal Gold Rule.** Gold on an action is lit metal: `linear-gradient(100deg, #fbf3da 0%, #e8d6a2 38%, #c8ae6e 72%, #f2e4b6 100%)` with an inset top light and a soft glow. This gradient is a deliberate, comp-driven exception (recorded in `.taste-skill/direction.json`), and it appears only on actions and on things that show the flight's progress (the HUD track, the private row of the time race). A flat yellow action is wrong.

**The Night Has Three Tones Rule.** Sections change ground by chapter, never by decoration: night, violet night, blue night, and the one light hall. No gradients between grounds, no tinted cards beyond the booking panel.

## Typography

**Display Font:** Archivo (variable, width 62-125%), with Helvetica Neue and Arial
**Answer Font:** Instrument Serif Italic, with Times New Roman
**Label/Figure Font:** Archivo at width 112-125%

**Character:** A heavy expanded caps grotesque says the claim in a few words, and a single italic serif line answers it in a human voice. Archivo also runs the cockpit: labels, figures and body, so the page has two families and no more.

### Hierarchy
- **Display** (Archivo 800, width 125%, uppercase, clamp(44px, 6.4vw, 96px), 0.9): the hero's first statement, "Anywhere by tonight" and the last call. Answered by Instrument Serif italic at 0.86 of its size.
- **Headline** (Archivo 800, width 125%, uppercase, clamp(34px, 4.6vw, 68px), 0.9): every section statement and the hero's later chapters. Answer at 0.9 of its size. Phones: clamp(30px, 9vw, 44px), display clamp(38px, 11.2vw, 56px).
- **Figure** (Archivo 700, width 125%, tabular, clamp(30px, 3.6vw, 52px)): the altitude readout; the same voice at 52px for the fleet position and 22px for the race totals.
- **Title** (Archivo 700, width 125%, uppercase, 22px, 1.1): aircraft names.
- **Body** (Archivo 400, width 100%, 17px, 1.55, max 40-46ch): one supporting paragraph per statement.
- **Small** (14px): notes, captions, legal.
- **Label** (Archivo 600, width 112%, 13px, uppercase, 0.1-0.16em tracking): nav, HUD labels (GS, HDG, ETE, ALTITUDE), field labels, spec terms, pill text, the scroll cue, the ticker.

### Named Rules
**The Statement and Answer Rule.** A section speaks once: one caps statement of two to four words over at most two lines, then one italic serif answer ending in a full stop. No third line, no subtitle stacked above it.

**The Instrument Rule.** Every figure is set tabular in Archivo and means something: altitude, heading, ground speed, time en route, minutes, range, seats. No decorative numbers.

## Layout

Full-bleed sections with a fluid side margin (clamp(20px, 4.4vw, 64px)) and generous section padding (about clamp(110px, 14vh, 170px) top). Content sections are two-column grids (5:7, 6:5, or copy plus a 560px booking card) that collapse to one column at 1024px. The flight is pinned for 900svh (820svh on phones) with chapters placed where the frame is calm: left over sky, low over tarmac, right of the subject, centred for the finale; on phones every chapter sits above the instruments at the bottom. The fleet pins for 340svh and slides its track sideways, cutting the next aircraft at the screen edge; on phones it becomes a native swipe row with snap points. The bar is fixed and goes solid (night at 86%) once the flight ends. Spacing rhythm: 22px from statement to body, 26px within groups, 30px before an action.

## Elevation & Depth

Flat by default: depth comes from the ground changing tone, from scrims over film and from photographs. Two shadows exist, both materials of the world rather than UI elevation.

### Shadow Vocabulary
- **Metal pill** (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), 0 0 24px rgba(232,214,162,0.28)`): the top light and glow of the gold action.
- **Hung print** (`box-shadow: 0 30px 50px -24px rgba(23,22,29,0.45), 0 4px 10px rgba(23,22,29,0.08)`): a framed print hanging off the light hall's wall, only there.

### Named Rules
**The Scrim Rule.** Text over film or photograph sits on a neutral night scrim (rgba 8/9/16, gradients from the top, bottom and the text's side). The scrim follows the active chapter; it is never coloured.

## Shapes

Soft geometry around a hard type voice. Actions, segment tabs and the swap control are full pills or circles (999px). Containers round gently: the booking panel 22px, aircraft photos 16px, fields 14px, prints 10px inside an 8px off-white mat (#f8f6f1), race segments 8px. Lines are hairlines: 1.2-1.6px for the route and map arcs, 1px for the fleet's outlined words and the print wires. The brand mark is a single stroked chevron with a crossbar.

## Components

### Buttons
Lit metal, tactile and calm.
- **Shape:** full pill (999px), 48px tall; 40px in the bar; 56px full width in the booking card.
- **Primary:** the metal gradient with gold ink, label type (600, 13px, width 112%, 0.1em, uppercase), 26px side padding.
- **Hover / Active:** brightness 1.07 and a 1px lift over 220ms, ease-out `cubic-bezier(0.22, 1, 0.36, 1)`; press scales to 0.98. Busy state dims to 80% and blocks input.
- **Ghost:** night at 55% with a 1px warm-white ring at 40%; on hover it turns into the metal pill. Used over the film's finale.
- **Cue:** a text link in label type with a 1px line that draws and retracts below the text on a loop; stopped under reduced motion.

### Segment Tabs
- **Style:** a pill track on black at 25%; each option is a pill in label type at 74% warm white.
- **State:** the checked option fills warm white with night text; keyboard focus draws the gold outline.

### Cards / Containers
- **Booking card:** booking surface, 22px corners, 1px hairline at 10%, padding clamp(20px, 2.4vw, 30px), 14px gaps. Flat.
- **Aircraft:** no container. A 16:9 photo with 16px corners, the class word in giant outlined caps behind it (800, width 125%, 1px warm-white stroke at 32%, sliding with the scroll), then name, use line and a spec list.

### Inputs / Fields
- **Style:** black at 24% with a 1px hairline at 8%, 14px corners, a label on top in label type at 56%, value in Archivo 500 16px, gold caret.
- **Focus:** the border turns gold at 70%.
- **Error:** the border turns coral and a plain-language note under the form names what is missing.
- **Stepper:** 30px circular controls with a hairline ring that turns gold on hover; disabled at 35%.

### Navigation
Brand (gold mark, name in Archivo 700 width 125% with 0.22em tracking) at the left, four anchors in label type at 74% that brighten on hover, the small metal pill at the right. Transparent over the film, solid night once the flight ends. Below 1024px only the brand and the pill remain.

### Flight HUD (signature)
An instrument line along the bottom of the pinned film: GS, HDG and ETE as label-plus-value pairs, ALTITUDE as a large tabular figure at the right that climbs to 45,000 ft and returns to 0, and a 2px track whose metal-gold fill is the flight's progress. ETE hides on phones.

### Route (signature)
Gold legs that draw with the scroll: a dashed faint track (gold at 16%, 2/7 dash) under a solid 1.6px gold line that advances to the point 62% down the viewport, each leg ending in a gold arrowhead that lands on its target (the quote button, the minutes saved, the home airport, the card's action, the last pill). Under reduced motion every leg is fully drawn.

### Hall of Prints (signature)
On the light hall, three photographs in off-white mats hang on 1px wires of different lengths and sway by up to about 2 degrees as they pass through the viewport.

### Motion
Everything is scroll-linked and deterministic. The hero canvas scrubs 289 frames of the owner's film in legs, with two cabin stills crossfaded in between. Chapters fade in with a 26px rise and a short blur. Reveals start from a visible default (30% opacity, 24px offset), ease to rest and happen once: scrolling back up never hides them. Under reduced motion the film holds one still per leg, reveals, arcs and route render complete, and loops and tilt stop. Record mode (`?rec`) disables transitions and animations and exposes `window.__af.step({scroll, t})` so a capture is the same frame every time.

## Do's and Don'ts

### Do:
- **Do** pair every caps statement with one Instrument Serif italic answer, at 0.86 (display) or 0.9 (headline) of its size.
- **Do** use the metal gradient with its top light and glow for gold actions, and flat champagne gold (#e8d6a2) only for lines, pins, the mark and focus.
- **Do** set every figure tabular in Archivo and make it mean something.
- **Do** put text over film or photographs on a neutral night scrim.
- **Do** change ground by chapter between night (#0b0d18), violet night (#13122a), blue night (#0e1530) and the light hall (#e7e7e4).
- **Do** start reveals from a visible default and play them once.
- **Do** give reduced motion a complete, still version: one still per leg, lines drawn, loops stopped.

### Don't:
- **Don't** put small labels or kickers above statements; the comp had them and they were removed.
- **Don't** add a third type family or set display type in a system face.
- **Don't** use the gold as a flat yellow fill on an action, or the gold highlight (#fbf3da) as a cream ground.
- **Don't** use shadows for UI elevation; the only shadows are the metal pill's light and the hung prints.
- **Don't** draw gold or hairline rules between sections; the route and the HUD track are the only long lines.
- **Don't** let a revealed block disappear again on scroll-up.
