// Motion-graphic cut "VI — Launch Film" (9:16, 32 s @ 120 BPM = 16 bars of 2 s).
// Shared by the renderer (Node) and the scene page (browser). Pure functions of video time t.
//
//   0–4    HOOK    gold glow shapes morph on the beat (ring > hexagon > triangle > diamond > VI)
//   4–6    REVEAL  the VI becomes the display outline, the camera pulls back, the MacBook lights up
//   6–12.5 TOUR    the whole website: one scroll whip + one camera move per beat pair
//   12.5–16 CLICK  cursor clicks the Launch Trailer play button, the camera dives into the screen
//   16–28  FILM    real night-city footage inside morphing glow shapes, kinetic type
//   28–32  FINALE  VI monogram, caption, date; ends on black so the clip loops
import { MBP, HINGE, SCREEN_CENTER, SCREEN_NORMAL, clamp, lerp, smoothstep } from './timeline.mjs';
import { monotone } from './plan.mjs';

export { MBP, HINGE, SCREEN_CENTER, SCREEN_NORMAL, clamp, lerp, smoothstep };
export const FPS = 60;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const DURATION = 32.0;
export const T_ON = 3.6;            // website clock starts (hero intro plays while the screen wakes)
export const T_CLICK = 14.0;        // play button pressed
export const T_FILM = 16.0;         // film starts (after the dive)
export const T_FINALE = 28.0;
export function siteTime(t) { return t - T_ON; }
export function needsSite(t) { return t >= T_ON && t < T_FILM; }

const tilt = (MBP.tiltDeg * Math.PI) / 180;
const S = SCREEN_CENTER;
const UP = [0, Math.cos(tilt), -Math.sin(tilt)];
export const SCREEN_UP = UP;
// point on the display surface: u, v in [-0.5, 0.5] of the panel (right, up), `out` along the normal
export function screenPoint(u, v, out = 0) {
  return [
    S[0] + u * MBP.screenW,
    S[1] + UP[1] * v * MBP.screenH + SCREEN_NORMAL[1] * out,
    S[2] + UP[2] * v * MBP.screenH + SCREEN_NORMAL[2] * out,
  ];
}
// website viewport (1512 x 906 CSS px) sits below a 76 px menu strip + toolbar on the 982 px panel
export function sitePxToScreen(x, y) {
  return [x / 1512 - 0.5, 0.5 - (76 + y) / 982];
}

export const E = {
  lin: (u) => u,
  io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  ioq: (u) => (u < 0.5 ? 8 * u ** 4 : 1 - Math.pow(-2 * u + 2, 4) / 2),
  expo: (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2),
  out: (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
  out3: (u) => 1 - Math.pow(1 - u, 3),
  in: (u) => u * u * u,
  in4: (u) => u ** 4,
};

// play button of the Launch Trailer card, in viewport px, when the card is parked for the click
export const PLAY_SITE = { x: 1028.4, y: 470 };
const PLAY = screenPoint(...sitePxToScreen(PLAY_SITE.x, PLAY_SITE.y));
const sp = (u, v) => screenPoint(u, v);
const LHI = [0, 0.1, -0.06];
const MID = [0, 0.088, -0.045];

// ------------------------------------------------------------------ camera (MacBook acts)
// Each key is reached at time t by a move of duration mv (ease e) that starts from the previous
// key plus its drift (slow continuous motion while holding). Whips land exactly on the beat.
const K = [
  { t: 0.0, az: -16, el: 19, d: 0.31, tg: S, fov: 38, roll: -7 },
  { t: 2.0, az: 0, el: 19, d: 0.28, tg: S, fov: 38, roll: 0, mv: 2.0, e: 'io' },
  { t: 3.75, az: 10, el: 21, d: 0.29, tg: S, fov: 38, roll: 4, mv: 1.75, e: 'io' },
  { t: 5.0, az: 0, el: 17, d: 0.86, tg: MID, fov: 40, roll: 0, mv: 1.25, e: 'ioq', drift: { az: 3, d: 0.02 } },
  { t: 6.0, az: 27, el: 8, d: 0.74, tg: LHI, fov: 40, roll: -3, mv: 0.62, e: 'ioq', drift: { az: -2 } },
  { t: 6.5, az: -22, el: 14, d: 0.56, tg: sp(-0.12, 0.04), fov: 38, roll: 4, mv: 0.5, e: 'ioq', drift: { az: 3, d: -0.04 } },
  { t: 7.5, az: 24, el: 22, d: 0.6, tg: sp(0.06, 0), fov: 38, roll: -5, mv: 0.55, e: 'ioq', drift: { az: -3, d: -0.04 } },
  { t: 8.5, az: -8, el: 46, d: 0.66, tg: [0, 0.07, -0.05], fov: 40, roll: -8, mv: 0.55, e: 'ioq', drift: { az: 3, d: -0.03 } },
  { t: 9.5, az: 16, el: 16, d: 0.5, tg: sp(0.1, 0.03), fov: 38, roll: 3, mv: 0.55, e: 'ioq', drift: { az: -3, d: -0.04 } },
  { t: 10.5, az: -34, el: 20, d: 0.92, tg: LHI, fov: 40, roll: -4, mv: 0.55, e: 'ioq', drift: { az: 4, d: -0.03 } },
  { t: 11.5, az: 4, el: 18, d: 0.5, tg: sp(0, 0.06), fov: 38, roll: 0, mv: 0.55, e: 'ioq', drift: { az: -2, d: -0.05 } },
  { t: 12.5, az: 6, el: 19, d: 0.44, tg: PLAY, fov: 38, roll: 1, mv: 0.55, e: 'ioq' },
  { t: 14.0, az: 3, el: 19, d: 0.36, tg: PLAY, fov: 37, roll: 0, mv: 1.5, e: 'io' },
  { t: 15.8, az: 0, el: 19, d: 0.04, tg: PLAY, fov: 30, roll: -6, mv: 1.8, e: 'in4' },    // dive
  { t: 16.0, az: 0, el: 19, d: 0.03, tg: PLAY, fov: 28, roll: -8, mv: 0.2, e: 'lin' },
];
const deg = Math.PI / 180;
function drifted(k, dt) {
  const dr = k.drift || {};
  return {
    az: k.az + (dr.az || 0) * dt, el: k.el + (dr.el || 0) * dt,
    d: k.d * Math.exp((dr.d || 0) * dt), tg: k.tg, fov: k.fov, roll: k.roll + (dr.roll || 0) * dt,
  };
}
export function cameraPose(t) {
  let i = 0;
  while (i < K.length - 2 && t > K[i + 1].t) i++;
  const a = K[i], b = K[i + 1];
  const mv = Math.min(b.mv || b.t - a.t, b.t - a.t);
  const ms = b.t - mv;                        // move start
  const A = drifted(a, clamp(t, a.t, ms) - a.t);
  const u = (E[b.e] || E.io)(clamp((t - ms) / mv, 0, 1));
  return {
    az: lerp(A.az, b.az, u), el: lerp(A.el, b.el, u),
    d: Math.exp(lerp(Math.log(A.d), Math.log(b.d), u)),
    tg: [0, 1, 2].map((k) => lerp(A.tg[k], b.tg[k], u)),
    fov: lerp(A.fov, b.fov, u), roll: lerp(A.roll, b.roll, u),
  };
}
export function camera(t) {
  const P = cameraPose(t);
  // faint hand-held float, calmed for the click and the dive
  const calm = 1 - smoothstep(13.2, 14.2, t);
  const fz = (0.25 * Math.sin(t * 1.3) + 0.15 * Math.sin(t * 2.1 + 1)) * calm;
  const fe = (0.12 * Math.sin(t * 0.9 + 2)) * calm;
  const ca = Math.cos((P.az + fz) * deg), sa = Math.sin((P.az + fz) * deg);
  const ce = Math.cos((P.el + fe) * deg), se = Math.sin((P.el + fe) * deg);
  const pos = [P.tg[0] + P.d * sa * ce, P.tg[1] + P.d * se, P.tg[2] + P.d * ca * ce];
  return { pos, target: P.tg, fov: P.fov, roll: P.roll + 0.4 * Math.sin(t * 0.9) * calm, focus: P.d };
}

// ------------------------------------------------------------------ cues
export function screenPower(t) { return smoothstep(4.25, 4.85, t); }
export function backlight(t) { return 0.9 * smoothstep(4.9, 6.0, t); }
export function beatPulse(t, decay = 0.16) {
  const p = ((t % BEAT) + BEAT) % BEAT;
  return Math.exp(-p / decay);
}

// ------------------------------------------------------------------ website choreography
// scroll whips: [leave, land, y]; every landing is on a beat, together with the camera
export function buildPlan(info) {
  const A = info.anchors, vh = info.vh, maxY = info.docH - vh;
  const st = (t) => t - T_ON;
  const K2 = [];
  const add = (ts, y) => K2.push([ts, clamp(Math.round(y * 2) / 2, 0, maxY)]);
  // the play button parks at PLAY_SITE.y in the viewport
  const filmPark = A.filmPlay.y + A.filmPlay.h / 2 - PLAY_SITE.y;
  const stops = [
    [6.0, 6.5, A.statement.y + A.statement.h / 2 - vh * 0.47],
    [7.0, 7.5, A.features.y + 30],
    [8.0, 8.5, A.places.y - 290],
    [9.0, 9.5, A.duo.y - 140],
    [10.0, 10.5, A.editionCards.y - 70],
    [11.0, 11.5, A.finale.y + A.finale.h / 2 - vh / 2],
    [11.93, 12.5, filmPark],
  ];
  add(0, 0);
  let prev = 0;
  for (const [leave, land, y] of stops) {
    add(st(leave), prev);
    add(st(land), y);
    prev = y;
  }
  add(60, prev);
  const scroll = monotone(K2.map((k) => k[0]), K2.map((k) => k[1]));
  // cursor: appears for the click only
  const start = { x: 1330, y: 800 }, end = PLAY_SITE;
  function cursor(ts) {
    const t = ts + T_ON;
    const a = smoothstep(12.55, 12.8, t) * (1 - smoothstep(15.0, 15.3, t));
    const u = E.io(clamp((t - 12.65) / (13.6 - 12.65), 0, 1));
    const arc = Math.sin(Math.PI * u) * 46;
    const x = lerp(start.x, end.x, u) + arc * 0.4;
    const y = lerp(start.y, end.y, u) + arc;
    const press = clamp(1 - Math.abs(t - (T_CLICK + 0.05)) / 0.1, 0, 1);
    return { x, y, a, press };
  }
  const film = { x: A.film.x, y: A.film.y, w: A.film.w, h: A.film.h };
  return { scroll, cursor, keyframes: K2, waypoints: [], maxY, film };
}

// ------------------------------------------------------------------ film (16–32 s)
// Footage lives on a 9:16 card (0.5625 x 1 units) inside a morphing shape; the camera orbits it.
export const SH = { CIRCLE: 0, HEX: 1, TRI: 2, DIAMOND: 3, VI: 4, BOX: 5 };
// shape params in card units: CIRCLE r | HEX circumradius | TRI half side | DIAMOND half w,h | VI height | BOX half w,h,radius
export const FILM_SHAPES = {
  pill: { id: SH.BOX, p: [0.262, 0.47, 0.05, 0] },
  circle: { id: SH.CIRCLE, p: [0.255, 0, 0, 0] },
  hex: { id: SH.HEX, p: [0.288, 0, 0, 0] },
  tri: { id: SH.TRI, p: [0.272, 0, 0, 0] },
  diamond: { id: SH.DIAMOND, p: [0.255, 0.44, 0, 0] },
  vi: { id: SH.VI, p: [0.36, 0, 0, 0] },
};
// cam: [az0, az1, el0, el1, d0, d1, roll0, roll1]
export const SHOTS = [
  { t0: 16.0, t1: 18.0, clip: 'city', off: 1.85, shape: 'pill', cam: [-6, 9, 3, -2, 1.55, 2.3, -3, 1] },
  { t0: 18.0, t1: 20.0, clip: 'drone', off: 0.3, shape: 'circle', cam: [24, 7, -5, 3, 2.55, 2.05, 5, -1] },
  { t0: 20.0, t1: 22.0, clip: 'port', off: 0.0, shape: 'hex', cam: [-22, -7, 7, 0, 2.4, 2.0, -4, 1] },
  { t0: 22.0, t1: 24.0, clip: 'boule', off: 0.2, shape: 'diamond', cam: [14, -5, -6, 2, 2.6, 2.05, 4, -2] },
  { t0: 24.0, t1: 24.5, clip: 'bridge', off: 0.4, shape: 'tri', cam: [-18, -8, 4, 0, 2.5, 2.15, -5, 0] },
  { t0: 24.5, t1: 25.0, clip: 'drive', off: 1.6, shape: 'circle', cam: [18, 8, -3, 0, 2.5, 2.15, 4, 0] },
  { t0: 25.0, t1: 25.5, clip: 'tower', off: 0.6, shape: 'hex', cam: [-16, -6, 5, 1, 2.5, 2.15, -4, 0] },
  { t0: 25.5, t1: 26.0, clip: 'lights', off: 0.6, shape: 'pill', cam: [16, 6, -4, 0, 2.6, 2.2, 4, 0] },
  { t0: 26.0, t1: 26.25, clip: 'city', off: 0.4, shape: 'diamond', cam: [-12, -6, 3, 0, 2.4, 2.2, -3, 0] },
  { t0: 26.25, t1: 26.5, clip: 'drone', off: 2.2, shape: 'tri', cam: [12, 6, -3, 0, 2.4, 2.2, 3, 0] },
  { t0: 26.5, t1: 26.75, clip: 'port', off: 2.0, shape: 'circle', cam: [-12, -6, 3, 0, 2.4, 2.2, -3, 0] },
  { t0: 26.75, t1: 27.0, clip: 'boule', off: 1.8, shape: 'hex', cam: [12, 6, -3, 0, 2.4, 2.2, 3, 0] },
  { t0: 27.0, t1: 27.25, clip: 'bridge', off: 1.6, shape: 'pill', cam: [-10, -5, 2, 0, 2.4, 2.2, -2, 0] },
  { t0: 27.25, t1: 27.5, clip: 'tower', off: 1.6, shape: 'diamond', cam: [10, 5, -2, 0, 2.4, 2.2, 2, 0] },
  { t0: 27.5, t1: 28.0, clip: 'lights', off: 1.7, shape: 'circle', cam: [0, 0, 0, 0, 2.3, 2.3, 0, 0], collapse: true },
  { t0: 28.0, t1: 32.0, clip: 'lights', off: 0.0, shape: 'vi', cam: [-9, 7, 4, -1, 2.0, 2.45, -2, 1], finale: true },
];
export function filmShot(t) {
  let i = 0;
  while (i < SHOTS.length - 1 && t >= SHOTS[i + 1].t0) i++;
  return { shot: SHOTS[i], index: i, prev: i > 0 ? SHOTS[i - 1] : null };
}
export function filmCamera(t) {
  const { shot } = filmShot(t);
  const c = shot.cam;
  const v = clamp((t - shot.t0) / (shot.t1 - shot.t0), 0, 1);
  const u = shot.finale ? E.io(v) * 0.4 + E.out3(v) * 0.6 : E.out3(v) * 0.65 + v * 0.35;   // fast start, keeps drifting into the cut
  const az = lerp(c[0], c[1], u), el = lerp(c[2], c[3], u), roll = lerp(c[6], c[7], u);
  const punch = t < T_FINALE ? 1 - 0.028 * beatPulse(t, 0.12) : 1;
  const d = Math.exp(lerp(Math.log(c[4]), Math.log(c[5]), u)) * punch;
  const ca = Math.cos(az * deg), sa = Math.sin(az * deg), ce = Math.cos(el * deg), se = Math.sin(el * deg);
  return { pos: [d * sa * ce, d * se, d * ca * ce], target: [0, 0, 0], fov: 30, roll };
}
