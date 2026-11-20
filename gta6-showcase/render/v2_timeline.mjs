// "Vice City is open" — the 9:16 film of the fan page (30 s, 120 BPM, loops).
// Shared by the renderer (Node) and the scene page (browser). Pure functions of video time t (s).
//
//   0–2      hook: the page by day, a thumb flips Lights, the street turns to neon on the beat
//   2–4      the page lifts off the screen into 3D while its reel turns
//   4–9      the whole site as one ribbon, the camera flies down it
//   9–13.5   lands on Jason & Lucia, scrolls to the films, the thumb presses play
//   13.5–14  the film card opens to the whole screen
//   14–26    the fan film: real Miami at night, blade signs light on every cut, OPEN builds
//   26–30    the film closes back into the page, the caption, lights off: the first frame again
import { monotone } from './plan.mjs';

export const FPS = 60;
export const DURATION = 30.0;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const VW = 405, VH = 720;            // the phone viewport of the page, CSS px
export const OUT_W = 1080, OUT_H = 1920;    // output frame, px
export const DPR = OUT_W / VW;              // 8/3

export const T_ON = 0.5;          // lights on (the hook hit)
export const T_TILT = 2.0;
export const T_RIBBON = 4.0;
export const T_LAND = 9.0;
export const T_TAP = 13.46;       // play pressed
export const T_FLIP = 13.55;      // the card starts opening
export const T_FILM = 14.0;
export const T_BACK = 26.0;       // the film closes into the page
export const T_HERO = 26.6;
export const T_OFF_TAP = 29.39;   // lights off pressed
export const T_OFF = 29.45;

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
export const E = {
  lin: (u) => u,
  io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  ioq: (u) => (u < 0.5 ? 8 * u ** 4 : 1 - Math.pow(-2 * u + 2, 4) / 2),
  out: (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
  out3: (u) => 1 - Math.pow(1 - u, 3),
  in3: (u) => u * u * u,
};
const seg = (t, a, b, e = E.ioq) => e(clamp((t - a) / (b - a), 0, 1));

// ------------------------------------------------------------------ the page
export const RIBBON_TILES = 8;                       // captures at scroll 720, 1440, ... 5760
export const RIBBON_LAND = 6;                        // the camera lands on tile 6 = scroll 5040
export const tileScroll = (k) => VH * (k + 1);
export function needsSite(t) { return t < T_RIBBON || (t >= T_LAND && t < T_FILM) || t >= T_BACK; }

const SCROLL = [
  [0, 0], [T_TILT, 0], [3.8, 720], [T_RIBBON, 720],
  [T_LAND, tileScroll(RIBBON_LAND)], [9.5, 5040], [10.0, 5330], [10.8, 5330], [11.3, 5690], [12.0, 5690], [12.6, 6202], [T_FILM, 6202],
];
const scrollA = monotone(SCROLL.map((k) => k[0]), SCROLL.map((k) => k[1]));
export function scroll(t) { return t >= T_BACK ? 0 : scrollA(Math.min(t, T_FILM)); }

export function lights(t) {
  if (t < T_ON) return 0;
  if (t < T_OFF) return E.io(clamp((t - T_ON) / 0.9, 0, 1));
  return 1 - E.io(clamp((t - T_OFF) / 0.45, 0, 1));
}
export const lightsAt = (t) => (t >= T_ON ? T_ON : null);
export const lightsOffAt = (t) => (t >= T_OFF ? T_OFF : null);

// the thumb: viewport CSS px, alpha, press 0..1
const SWITCH = { x: 39, y: 72 }, REST = { x: 58, y: 104 }, PLAY = { x: 76, y: 484 };
function press(t, at) { return clamp(1 - Math.abs(t - at) / 0.07, 0, 1); }
export function finger(t) {
  if (t < 0.9) {
    const u = E.out3(clamp(t / 0.34, 0, 1));
    return { x: lerp(REST.x, SWITCH.x, u), y: lerp(REST.y, SWITCH.y, u), a: 1 - smooth(0.56, 0.86, t), press: press(t, 0.44) };
  }
  if (t > 12.6 && t < 13.9) {
    const u = E.io(clamp((t - 12.7) / 0.62, 0, 1));
    const arc = Math.sin(Math.PI * u) * 30;
    return { x: lerp(300, PLAY.x, u) + arc, y: lerp(640, PLAY.y, u) - arc * 0.5, a: smooth(12.62, 12.8, t) * (1 - smooth(13.62, 13.8, t)), press: press(t, T_TAP) };
  }
  if (t > 28.95) {
    const u = E.out3(clamp((t - 29.0) / 0.32, 0, 1));
    const back = E.io(clamp((t - 29.5) / 0.45, 0, 1));
    const x = lerp(lerp(300, SWITCH.x, u), REST.x, back), y = lerp(lerp(560, SWITCH.y, u), REST.y, back);
    return { x, y, a: smooth(28.95, 29.1, t), press: press(t, T_OFF_TAP) };
  }
  return { x: 0, y: 0, a: 0, press: 0 };
}
export function pressTarget(t) {
  if (Math.abs(t - 0.44) < 0.08 || Math.abs(t - T_OFF_TAP) < 0.08) return '[data-lights-toggle]';
  if (Math.abs(t - T_TAP) < 0.08) return '.film--ours .film__media';
  return null;
}

// ------------------------------------------------------------------ the 3D page
// pose of the page plane (screen) or of the ribbon group: rotations in degrees, scale, offset in
// page heights; `travel` = how many viewport tiles the ribbon has slid up (ribbon phase only)
export function pose(t) {
  if (t < T_TILT) {
    const s = 1 + 0.018 * smooth(0.6, 2.0, t);
    return { mode: 'screen', rx: 0, ry: 0, rz: 0, s, tx: 0, ty: 0 };
  }
  if (t < T_RIBBON) {
    const u = seg(t, T_TILT, 3.4), d = clamp((t - 3.4) / 0.6, 0, 1);
    return { mode: 'screen', rx: 12 * u, ry: -22 * u - 4 * d, rz: 2 * u, s: lerp(1.018, 0.62, u), tx: 0, ty: 0.02 * u };
  }
  if (t < T_LAND) {
    // into the road pose, the long glide, back to flat on the landing tile
    const a = seg(t, T_RIBBON, 5.0, E.io);
    const glide = seg(t, 4.6, 8.35, E.ioq);
    const back = seg(t, 8.3, T_LAND, E.ioq);
    const rx = lerp(lerp(12, 56, a), 0, back);
    const ry = lerp(lerp(-26, -7, a) + 3 * Math.sin((t - 4) * 1.3) * (1 - back), 0, back);
    const rz = lerp(lerp(2, 0, a), 0, back);
    const s = lerp(lerp(0.62, 0.86, a), 1, back);
    return { mode: 'ribbon', rx, ry, rz, s, tx: 0, ty: lerp(lerp(0.02, -0.06, a), 0, back), travel: RIBBON_LAND * glide };
  }
  if (t < T_FILM) {
    // flat, with a small turn on every scroll whip
    let ry = 0, s = 1;
    for (const [a, b, dir] of [[9.5, 10.0, 1], [10.8, 11.3, -1], [12.0, 12.6, 1]]) {
      const u = clamp((t - a) / (b - a), 0, 1);
      ry += dir * 5 * Math.sin(Math.PI * u);
      s -= 0.035 * Math.sin(Math.PI * u);
    }
    return { mode: 'screen', rx: 0, ry, rz: 0, s, tx: 0, ty: 0 };
  }
  if (t < T_BACK) return { mode: 'film', rx: 0, ry: 0, rz: 0, s: 1, tx: 0, ty: 0 };
  // the end card: the page steps back so the caption can sit above it, then returns full screen
  const u = seg(t, T_HERO, 27.4), back = seg(t, 28.65, 29.15);
  const k = u * (1 - back);
  return { mode: 'screen', rx: 7 * k, ry: 12 * k + 2 * Math.sin((t - 26.6) * 0.9) * k, rz: -1.5 * k, s: lerp(1, 0.6, k), tx: 0, ty: -0.085 * k };
}

// ------------------------------------------------------------------ the card opening and closing
// rects in viewport CSS px of the page (x, y, w, h)
export const CARD = { x: 16, y: 260, w: 373, h: 279.75 };          // the fan film card at scroll 6202
export const REEL = { x: 16, y: 220.1, w: 373, h: 279.75 };        // the hero's first reel frame at scroll 0
export function flipRect(t) {
  if (t >= T_FLIP && t < T_FILM) {
    const u = seg(t, T_FLIP, T_FILM, E.ioq);
    return { ...mixRect(CARD, { x: 0, y: 0, w: VW, h: VH }, u), u, dir: 1 };
  }
  if (t >= T_BACK && t < T_HERO) {
    const u = seg(t, T_BACK, T_HERO, E.ioq);
    return { ...mixRect({ x: 0, y: 0, w: VW, h: VH }, REEL, u), u, dir: -1 };
  }
  return null;
}
function mixRect(a, b, u) { return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), w: lerp(a.w, b.w, u), h: lerp(a.h, b.h, u) }; }

// ------------------------------------------------------------------ the fan film
// clip local time = off + (t - t0); sign: blade signs (left/right) or plaques; the OPEN sign builds
export const SHOTS = [
  { t0: 14.0, t1: 16.0, clip: 'flip', off: 0.5, signs: [{ kind: 'blade', text: 'VICE', side: 'left', at: 0.2 }, { kind: 'blade', text: 'CITY', side: 'left2', at: 0.5 }], note: 'Real footage of Miami, Florida' },
  { t0: 16.0, t1: 18.0, clip: 'city', off: 0.2, signs: [{ kind: 'blade', text: 'LEONIDA', side: 'right', at: 0.15 }] },
  { t0: 18.0, t1: 19.0, clip: 'drone', off: 0.6, signs: [{ kind: 'blade', text: 'JASON', side: 'left', at: 0.08 }] },
  { t0: 19.0, t1: 20.0, clip: 'port', off: 0.4, signs: [{ kind: 'blade', text: 'LUCIA', side: 'right', at: 0.08 }] },
  { t0: 20.0, t1: 22.0, clip: 'lights', off: 0.3, signs: [{ kind: 'plaque', lines: ['11·19'], small: 'Out now', at: 0.15 }] },
  { t0: 22.0, t1: 24.0, clip: 'tower', off: 0.2, signs: [{ kind: 'plaque', lines: ['PS5', 'XBOX SERIES X|S'], at: 0.15 }] },
  { t0: 24.0, t1: 24.5, clip: 'drive', off: 1.1, signs: [{ kind: 'open', n: 1, at: 0.02 }] },
  { t0: 24.5, t1: 25.0, clip: 'bridge', off: 0.6, signs: [{ kind: 'open', n: 2, at: 0.02 }] },
  { t0: 25.0, t1: 25.5, clip: 'boule', off: 1.2, signs: [{ kind: 'open', n: 3, at: 0.02 }] },
  { t0: 25.5, t1: 26.6, clip: 'city', off: 2.6, signs: [{ kind: 'open', n: 4, at: 0.02 }] },
];
export function shotAt(t) {
  for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i].t0) return { shot: SHOTS[i], index: i };
  return { shot: SHOTS[0], index: 0 };
}
// the card video on the page loops boulevard-night (source 0.5 s + t mod 5 s); the flip sequence starts
// at source 4.0 s, so when the card opens it shows source 0.5 + (T_FLIP mod 5) and runs on in real time
export function flipLocal(t) { return 0.5 + (T_FLIP % 5) - 4.0 + (t - T_FLIP); }

// a tube catching: off, on, off, on, held (the page's own flicker)
const FL = [[0, 0], [0.12, 1], [0.18, 0.15], [0.34, 1], [0.4, 0.35], [0.56, 1], [1, 1]];
export function flicker(u) {
  if (u <= 0) return 0; if (u >= 1) return 1;
  for (let i = 0; i < FL.length - 1; i++) if (u <= FL[i + 1][0]) {
    const [a, va] = FL[i], [b, vb] = FL[i + 1]; return va + (vb - va) * ((u - a) / (b - a));
  }
  return 1;
}

// ------------------------------------------------------------------ the caption (end card)
export function caption(t) {
  const a = seg(t, 26.75, 27.35, E.out3) * (1 - seg(t, 28.6, 28.95, E.in3));
  return { a, rise: (1 - seg(t, 26.75, 27.5, E.out)) * 40 };
}
