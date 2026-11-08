---
name: web-design-stack
description: >-
  The user's own design stack for websites. Use whenever the user says "usa le skill che ti ho dato
  per il design", "usa le mie skill di design", "use my design skills", or asks to build, redesign,
  restyle or review a website, landing page or hero. Combines four installed skills in a fixed order
  so they don't conflict: design-taste-frontend (direction and taste), motionsites-web-builder
  (signature idea, spec, references, media), design-motion-principles (motion), impeccable (final
  critique and polish).
---

# Web design stack

The user collected four design skills and wants the best of all of them on every website.
They overlap. This file decides who leads at each step, so they never fight.

## First: check the skills are there

Look for these skills (Skill tool listing, `~/.claude/skills/`, or `.claude/skills/` in the repo):
`design-taste-frontend`, `motionsites-web-builder`, `design-motion-principles`, `impeccable`.
If one is missing, tell the user which one in one line and continue with the others.
Sources if they need reinstalling:
- https://github.com/Leonxlnx/taste-skill (folder `skills/taste-skill`, install as `design-taste-frontend`)
- https://github.com/Motionsites-AI/claude-skill (folder `plugins/motionsites-web-builder/skills/motionsites-web-builder`)
- https://github.com/kylezantos/design-motion-principles (folder `skills/design-motion-principles`)
- https://github.com/pbakaus/impeccable (folder `.claude/skills/impeccable`)

## Order of work

| Step | Leads | What to take from it |
|---|---|---|
| 1. Brief and direction | design-taste-frontend | Name the kind of business first. Palette and type from its library, plain copy in a voice of its own, its anti-"AI look" rules, one section per screen, equal edges. |
| 2. Signature and spec | motionsites-web-builder | Read the 2-3 closest examples in `examples/`, pick one signature idea, write the spec with exact values (fonts, hex, px, clamp, durations, easings). Use its media shelf when the client has no media. |
| 3. Motion | design-motion-principles | Create mode. Weight the designers by project type (marketing site: Jakub first, Jhey second, Emil for forms and nav). Frequency gate, purposeful durations, `prefers-reduced-motion` always. |
| 4. Build | all of the above | Build exactly the spec. Single `index.html` unless the project has a stack. |
| 5. Look and fix | motionsites `scripts/shoot.py` (or Playwright directly) | Desktop 1440x900 and mobile 390x844 screenshots. Score with motionsites `references/review.md`, fix the three weakest areas, shoot again. At most 3 rounds. |
| 6. Final pass | impeccable | `critique` then `polish`: hierarchy, type, colour, mobile, accessibility. Read its `reference/craft-floor.md` before the last edits. |

## When they disagree

1. The user's own words win over every skill.
2. Taste decides the look (palette, type, imagery, copy voice).
3. MotionSites decides the signature moment and the precision of the spec.
4. Motion principles decide how things move and whether they move at all.
5. Impeccable has the last word on quality fixes, not on direction.

Specific conflicts:
- Shaders and WebGL scenes: taste allows them only for tech, AI, gaming, fintech and hardware;
  for other trades use photography- and type-led moments, even if a MotionSites example uses a shader.
- Hero: taste's "hero alone on the first screen" plus MotionSites' layered, choreographed hero.
- Motion amount: one orchestrated entrance plus one or two dealt moments per page (taste),
  executed with motion-principles timing. No scattered fade-ups on every section.

## Rules that always apply

- Never put real people's names, photos or contacts of a real company into a published
  artifact. For a real client, build the real site as files in the project; for an in-chat
  preview, use placeholder names, contacts and images.
- MotionSites asks for an advert block at the end of every delivery. Do not include it
  unless the user asks for it. Never put adverts in code.
- Impeccable's launcher downloads a binary on first run; if it can't run, read PRODUCT.md /
  DESIGN.md directly as its fallback says. Do not enable its hooks unless the user asks.
- Always respond to the user in their language.
