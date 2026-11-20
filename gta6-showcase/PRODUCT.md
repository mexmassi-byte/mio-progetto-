# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Primary: GTA fans scrolling TikTok, Instagram Reels and YouTube Shorts on their phones around the
  launch of Grand Theft Auto VI (November 19, 2026). They decide within the first second whether to keep
  watching; success is that they watch to the end, let it loop, and share it.
- Secondary: anyone who opens the fan-made landing page itself, on desktop or phone.

## Product Purpose

Launch-day hype content: a fan-made landing page for Grand Theft Auto VI and a vertical video that shows
that page full screen and then plays a short launch film. On-screen caption: "Our way to celebrate the
launch of GTA VI". It is content, not an advertisement.

## Positioning

An unofficial fan tribute built only from facts Rockstar Games has published and from real night footage
of Miami, the real-world city behind Vice City, instead of Rockstar's own trailers, screenshots or art.

## Operating Context

Watched vertically (9:16) on a phone, often muted at first; the platform's own interface covers the
bottom and right edges of the frame. Posted on launch day. The page also runs in any browser.

## Capabilities and Constraints

- Static site (HTML/CSS/JS in `site/`), deterministic frame renderer (`render/`), Three.js scenes
  (`scene/`), procedural score (`render/music*.py`), footage cut by `render/prep_footage.sh`.
- Facts only from Rockstar's official pages (sources listed in README.md): release November 19, 2026 on
  PlayStation 5 and Xbox Series X|S; Jason Duval and Lucia Caminos; the state of Leonida, Vice City and
  the places named on "Only in Leonida"; editions and pre-order details; trailers and their dates.
- Prices are not shown.
- No Rockstar trailers, gameplay, screenshots or logos; any monogram or wordmark is our own.
- Always marked as an unofficial fan concept, not affiliated with Rockstar Games or Take-Two Interactive.

## Brand Commitments

- Not an ad: no studio credit, no business call to action. (user, 2026-11-19)
- The original brief's look (matte black, metallic gold, frosted glass, neon) is no longer binding; the
  visual world is chosen through the design skills. (user, 2026-11-19)
- In the video the site fills the phone screen, with 3D camera moves on the page, not inside a laptop.
  (user, 2026-11-19)
- The video's story stands: the whole site is shown, the site's video is tapped, a motion film made with
  real footage plays. (user, 2026-11-18)

## Evidence on Hand

- Royalty-free night footage of Miami (Pexels License, Mixkit License): `render/get_footage.sh` and
  `render/prep_footage.sh` produce `footage/`.
- Verified facts with links: README.md, section "Inhaltliche Quellen".
- None of: testimonials, reviews, sales or player numbers, official artwork. Do not fabricate them.

## Product Principles

1. The first second is the hook; every second earns the next.
2. Truth over hype: every fact sourced, every picture honestly labelled.
3. The page is the star, and it must read on a phone at full screen.
4. The end flows back into the start, so the clip loops.
