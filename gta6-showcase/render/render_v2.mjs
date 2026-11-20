// Deterministic renderer for "Vice City is open" (9:16): the fan page in record mode, captured at
// phone size (405 x 720 CSS px at 8/3 = 1080 x 1920), turned into a 3D object by scene/v2.
//
//   node render/render_v2.mjs --out <dir> [--stills 0.2,3,6] [--from 0 --to 1800] [--shutter 0.5] [--maxsub 6]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { startServer } from './server.mjs';
import * as TL from './v2_timeline.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const OUT = path.resolve(args.out || 'frames-v2');
const FPS = TL.FPS, TOTAL = Math.round(TL.DURATION * FPS);
const SHUTTER = Number(args.shutter ?? 0.5) / FPS;
const MAXSUB = Number(args.maxsub ?? 6);
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
async function openSite() {
  const p = await browser.newPage({ viewport: { width: TL.VW, height: TL.VH }, deviceScaleFactor: TL.DPR });
  p.on('pageerror', (e) => log('site error:', e.message));
  await p.goto(`${base}/site/index.html?rec`);
  await p.evaluate(() => window.__rec.ready);
  return p;
}
const site = await openSite();
const cdpSite = await site.context().newCDPSession(site);
const scene = await browser.newPage({ viewport: { width: TL.OUT_W, height: TL.OUT_H }, deviceScaleFactor: 1 });
scene.on('pageerror', (e) => log('scene error:', e.message));
scene.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('GPU stall')) log('scene console:', m.text().slice(0, 300)); });
await scene.goto(`${base}/scene/v2.html`);
await scene.evaluate(() => window.__v2.ready);
const cdpScene = await scene.context().newCDPSession(scene);

// the ribbon: the page at night, one viewport per tile, from the end of the hero downwards
{
  const rib = await openSite();
  const cdpRib = await rib.context().newCDPSession(rib);
  const tiles = [];
  for (let k = 0; k < TL.RIBBON_TILES; k++) {
    // walk the page down to the tile so every reveal on the way has fired and settled
    for (let y = k === 0 ? 0 : TL.tileScroll(k - 1); y <= TL.tileScroll(k); y += 120) {
      await rib.evaluate((s) => window.__rec.step(s), { t: 40 + k * 2 + y / 1e5, scroll: y, lights: 1, lightsAt: 0 });
    }
    const sy = await rib.evaluate((s) => window.__rec.step(s), { t: 41.5 + k * 2, scroll: TL.tileScroll(k), lights: 1, lightsAt: 0 });
    const r = await cdpRib.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, clip: { x: 0, y: sy, width: TL.VW, height: TL.VH, scale: 1.6 } });
    tiles.push(r.data);
  }
  await scene.evaluate((list) => window.__v2.setRibbon(list), tiles);
  if (args['tiles-out']) tiles.forEach((b, k) => fs.writeFileSync(path.join(OUT, `tile_${k}.jpg`), Buffer.from(b, 'base64')));
  await rib.close();
}
log(`ready: ${TL.OUT_W}x${TL.OUT_H}, ${TOTAL} frames, shutter ${(SHUTTER * FPS * 360).toFixed(0)}°`);

// ---------------------------------------------------------------- adaptive motion blur
const cam = new THREE.PerspectiveCamera(30, TL.OUT_W / TL.OUT_H, 0.01, 60);
cam.position.set(0, 0, 0.5 / Math.tan((15 * Math.PI) / 180)); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
const PW = TL.VW / TL.VH;
const obj = new THREE.Object3D();
function corners(t) {
  const p = TL.pose(t);
  if (p.mode === 'film') return [];
  obj.position.set(p.tx, p.ty, 0); obj.rotation.set((p.rx * Math.PI) / 180, (p.ry * Math.PI) / 180, (p.rz * Math.PI) / 180, 'YXZ'); obj.scale.setScalar(p.s); obj.updateMatrixWorld();
  const off = p.mode === 'ribbon' ? p.travel : 0;
  return [[-PW / 2, -0.5], [PW / 2, -0.5], [-PW / 2, 0.5], [PW / 2, 0.5], [0, 0]].map(([x, y]) => {
    const v = new THREE.Vector3(x, y + 0 * off, 0).applyMatrix4(obj.matrixWorld).project(cam);
    return [((v.x + 1) / 2) * TL.OUT_W, ((1 - v.y) / 2) * TL.OUT_H];
  });
}
const CUTS = [TL.T_RIBBON, TL.T_LAND, TL.T_FILM, TL.T_BACK, ...TL.SHOTS.map((s) => s.t0)].sort((a, b) => a - b);
function segment(t) {
  let a = 0, b = TL.DURATION;
  for (const c of CUTS) { if (c <= t) a = Math.max(a, c); else { b = Math.min(b, c); break; } }
  return [a, b];
}
function subTimes(t) {
  const [a, b] = segment(t);
  const t0 = Math.max(a, t - SHUTTER / 2), t1 = Math.min(b - 1e-4, t + SHUTTER / 2);
  if (t1 <= t0) return [t];
  let disp = 0;
  const c0 = corners(t0), c1 = corners(t1);
  for (let i = 0; i < Math.min(c0.length, c1.length); i++) disp = Math.max(disp, Math.hypot(c1[i][0] - c0[i][0], c1[i][1] - c0[i][1]));
  const p0 = TL.pose(t0), p1 = TL.pose(t1);
  if (p0.mode === 'ribbon') disp = Math.max(disp, Math.abs(p1.travel - p0.travel) * TL.OUT_H * p0.s);
  if (TL.needsSite(t)) disp = Math.max(disp, Math.abs(TL.scroll(t1) - TL.scroll(t0)) * TL.DPR * p0.s);
  const r0 = TL.flipRect(t0), r1 = TL.flipRect(t1);
  if (r0 && r1) disp = Math.max(disp, Math.abs(r1.y - r0.y) * TL.DPR, Math.abs(r1.h - r0.h) * TL.DPR, Math.abs(r1.w - r0.w) * TL.DPR);
  const n = Math.min(MAXSUB, Math.max(1, Math.ceil(disp / 3)));
  if (n === 1) return [t];
  return Array.from({ length: n }, (_, k) => t0 + ((t1 - t0) * (k + 0.5)) / n);
}

// ---------------------------------------------------------------- site + scene
let siteScrollY = 0;
async function stepSite(ts) {
  siteScrollY = await site.evaluate((s) => window.__rec.step(s), {
    t: ts, scroll: TL.scroll(ts), lights: TL.lights(ts), lightsAt: TL.lightsAt(ts), lightsOffAt: TL.lightsOffAt(ts), press: TL.pressTarget(ts),
  });
}
async function captureSite() {
  const r = await cdpSite.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, optimizeForSpeed: true, clip: { x: 0, y: siteScrollY, width: TL.VW, height: TL.VH, scale: TL.DPR } });
  return r.data;
}
async function prep(t) {
  const subs = [];
  for (const ts of subTimes(t)) {
    if (TL.needsSite(ts)) { await stepSite(ts); subs.push({ t: ts, b64: await captureSite() }); }
    else subs.push({ t: ts, b64: null });
  }
  return { t, subs };
}
async function renderFrame({ t, subs }) {
  await scene.evaluate(({ subs, t }) => window.__v2.frame(subs, t), { subs, t });
  const r = await cdpScene.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  return Buffer.from(r.data, 'base64');
}

if (args.stills) {
  const times = String(args.stills).split(',').map(Number).sort((a, b) => a - b);
  let tSim = 0;
  for (const T of times) {
    for (; tSim < T - SHUTTER; tSim += 1 / 30) if (TL.needsSite(tSim)) await stepSite(tSim);
    const job = await prep(T);
    fs.writeFileSync(path.join(OUT, `still_${T.toFixed(2)}.png`), await renderFrame(job));
    log('still', T, `(${job.subs.length} sub)`);
    tSim = Math.max(tSim, T + SHUTTER);
  }
} else {
  const from = Number(args.from || 0), to = Math.min(TOTAL, Number(args.to || TOTAL));
  for (let i = 0; i < from; i++) if (TL.needsSite(i / FPS)) await stepSite(i / FPS);
  const t0 = Date.now();
  let subsTotal = 0;
  let pending = prep(from / FPS);
  for (let i = from; i < to; i++) {
    const job = await pending;
    subsTotal += job.subs.length;
    const rendering = renderFrame(job);
    pending = i + 1 < to ? prep((i + 1) / FPS) : null;
    fs.writeFileSync(path.join(OUT, `f_${String(i).padStart(5, '0')}.png`), await rendering); // taste-skill-ignore: file names
    if ((i - from) % 30 === 29 || i === to - 1) {
      const done = i - from + 1, el = (Date.now() - t0) / 1000;
      log(`frame ${i + 1}/${to}  ${(el / done).toFixed(2)} s/frame  ${(subsTotal / done).toFixed(2)} sub/frame  eta ${((to - i - 1) * el / done / 60).toFixed(1)} min`);
    }
  }
}
await browser.close();
server.close();
