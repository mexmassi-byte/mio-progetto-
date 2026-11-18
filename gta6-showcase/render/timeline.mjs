// Shared timeline for the showcase video (used by the Node renderer AND the
// browser-side 3D scene). Everything is a pure function of video time t (s).

export const FPS = 60;
export const DURATION = 50.0;   // total video length (s)
export const T_ON = 1.7;        // display wakes up; website time starts here

// ---- MacBook Pro 14" geometry (meters) -----------------------------------
export const MBP = {
  W: 0.3126, D: 0.2212,
  baseT: 0.0098, feet: 0.0012, corner: 0.0112, bevel: 0.0021,
  lidT: 0.0058, tiltDeg: 19,
  screenW: 0.3025, screenH: 0.1964, bezelTop: 0.0052,
  hingeInset: 0.0034,
};
const baseTop = MBP.feet + MBP.baseT;
const tilt = (MBP.tiltDeg * Math.PI) / 180;
export const HINGE = [0, baseTop + 0.0032, -MBP.D / 2 + MBP.hingeInset];
const lidUp = [0, Math.cos(tilt), -Math.sin(tilt)];
export const SCREEN_NORMAL = [0, Math.sin(tilt), Math.cos(tilt)];
const screenCenterAlong = MBP.D - MBP.bezelTop - MBP.screenH / 2;
export const SCREEN_CENTER = [
  HINGE[0] + lidUp[0] * screenCenterAlong,
  HINGE[1] + lidUp[1] * screenCenterAlong,
  HINGE[2] + lidUp[2] * screenCenterAlong,
];

// ---- easing --------------------------------------------------------------
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, u) => a + (b - a) * u;
export const smoothstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
export const smootherstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };

// ---- display / lighting cues ---------------------------------------------
export function screenPower(t) {
  // Fast, smooth backlight ramp like a real display waking up.
  return smootherstep(T_ON, T_ON + 0.65, t);
}
export function backlight(t) {
  return 0.9 * smootherstep(T_ON + 0.35, T_ON + 1.8, t);
}
export function siteTime(t) { return t - T_ON; }

// ---- camera --------------------------------------------------------------
const deg = Math.PI / 180;
const PUSH_START = 0.0, PUSH_END = 16.5;     // wide -> close
const PULL_START = 44.6, PULL_END = 50.0;    // gentle pull-back at the end

export function camera(t) {
  const p = smootherstep(PUSH_START, PUSH_END, t);
  const q = smootherstep(PULL_START, PULL_END, t);
  const S = SCREEN_CENTER;
  const wideTarget = [0, 0.082, -0.035];
  // target moves from laptop centre to the screen centre
  let tx = lerp(wideTarget[0], S[0], p), ty = lerp(wideTarget[1], S[1], p), tz = lerp(wideTarget[2], S[2], p);
  // spherical offset (azimuth around Y, elevation above horizon)
  let az = lerp(31, 0, p), el = lerp(23.5, MBP.tiltDeg, p);
  // perceptually even zoom: interpolate log(distance)
  let dist = Math.exp(lerp(Math.log(0.97), Math.log(0.53), p));
  dist *= 1 - 0.03 * smoothstep(PUSH_END, PULL_START, t);    // slow creep while reading
  let fov = lerp(27, 24, p);
  // subtle organic drift (very low frequency, tiny amplitude)
  const drift = 1 - 0.6 * smoothstep(12, 18, t);
  az += (0.9 * Math.sin((t / 23) * 2 * Math.PI) + 0.35 * Math.sin((t / 9.7) * 2 * Math.PI + 1.3)) * drift + 0.32 * Math.sin((t / 29) * 2 * Math.PI + 0.4);
  el += 0.22 * Math.sin((t / 31) * 2 * Math.PI + 1.0) + 0.1 * Math.sin((t / 13) * 2 * Math.PI);
  // end: pull back and swing slightly left to reveal the MacBook again
  az = lerp(az, -11, q); el = lerp(el, 17.5, q); dist = lerp(dist, 0.74, q); fov = lerp(fov, 25.5, q);
  ty = lerp(ty, S[1] - 0.02, q); tz = lerp(tz, S[2] + 0.01, q);
  const ca = Math.cos(az * deg), sa = Math.sin(az * deg), ce = Math.cos(el * deg), se = Math.sin(el * deg);
  const pos = [tx + dist * sa * ce, ty + dist * se, tz + dist * ca * ce];
  return { pos, target: [tx, ty, tz], fov, focus: dist };
}

// ---- global fade (applied in ffmpeg too, but kept here for previews) ------
export function fade(t) {
  return smoothstep(0, 1.3, t) * (1 - smoothstep(DURATION - 1.7, DURATION - 0.05, t));
}
