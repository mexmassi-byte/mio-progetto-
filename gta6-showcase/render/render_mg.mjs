// Deterministic frame renderer for the 9:16 motion graphic "VI — Launch Film".
//
//   node render/render_mg.mjs --out <dir> [--w 1080 --h 1920 --sw 3024]
//        [--stills 1.0,6.5,20]      single frames at these video times
//        [--from 0 --to 1920]       a frame range (default: the whole film)
//        [--shutter 0.5]            motion-blur shutter as a fraction of the frame interval (180°)
//        [--maxsub 6]               max. subframes per frame (adaptive to on-screen motion)
//        [--tempo 2.2]              speed of the page's own reveal animations (record mode)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { startServer } from './server.mjs';
import * as TL from './mg_timeline.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const OUT = path.resolve(args.out || 'frames-mg');
const W = Number(args.w || 1080), H = Number(args.h || 1920), SW = Number(args.sw || 3024);
const FPS = TL.FPS;
const TOTAL = Math.round(TL.DURATION * FPS);
const SHUTTER = Number(args.shutter ?? 0.5) / FPS;
const MAXSUB = Number(args.maxsub ?? 6);
fs.mkdirSync(OUT, { recursive: true });

const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// website page (record mode, Retina)
const site = await browser.newPage({ viewport: { width: 1512, height: 906 }, deviceScaleFactor: 2 });
site.on('pageerror', (e) => log('site error:', e.message));
await site.goto(`${base}/site-v1/index.html?rec&tempo=${Number(args.tempo || 2.2)}`);
await site.evaluate(() => window.__rec.ready);
const info = await site.evaluate(() => window.__rec.info());
const plan = TL.buildPlan(info);
fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify({ info, keyframes: plan.keyframes, film: plan.film }, null, 1));

// film scene page
const scene = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
scene.on('pageerror', (e) => log('scene error:', e.message));
scene.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('GPU stall')) log('scene console:', m.text().slice(0, 300)); });
await scene.goto(`${base}/scene/mg.html?w=${W}&h=${H}&sw=${SW}`);
await scene.evaluate(() => window.__scene.ready);
await scene.evaluate((c) => window.__scene.configure(c), { film: plan.film });
const cdpSite = await site.context().newCDPSession(site);
const cdpScene = await scene.context().newCDPSession(scene);
log(`ready: ${W}x${H}, screen texture ${SW}px, doc ${info.docH}px, ${TOTAL} frames, shutter ${(SHUTTER * FPS * 360).toFixed(0)}°`);

// ---------------------------------------------------------------- adaptive motion blur
// Estimate how far key points move on screen during the shutter interval (three.js math only).
const cam3 = new THREE.PerspectiveCamera(38, W / H, 0.01, 30);
const SCREEN_PTS = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0, 0]].map(([u, v]) => new THREE.Vector3(...TL.screenPoint(u, v)));
const CARD_PTS = [[-0.26, -0.47], [0.26, -0.47], [-0.26, 0.47], [0.26, 0.47], [0, 0]].map(([x, y]) => new THREE.Vector3(x, y, 0));
function project(t) {
  const film = t >= TL.T_FILM;
  const c = film ? TL.filmCamera(t) : TL.camera(t);
  cam3.fov = c.fov; cam3.updateProjectionMatrix();
  cam3.position.set(...c.pos); cam3.up.set(0, 1, 0); cam3.lookAt(...c.target);
  cam3.rotateZ((c.roll * Math.PI) / 180); cam3.updateMatrixWorld();
  return (film ? CARD_PTS : SCREEN_PTS).map((p) => { const v = p.clone().project(cam3); return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H]; });
}
const CUTS = [TL.T_FILM, ...TL.SHOTS.map((s) => s.t0)].sort((a, b) => a - b);
function segment(t) {
  let a = 0, b = TL.DURATION;
  for (const c of CUTS) { if (c <= t) a = Math.max(a, c); else { b = Math.min(b, c); break; } }
  return [a, b];
}
function subTimes(t) {
  const [a, b] = segment(t);             // subframes never straddle a cut
  const t0 = Math.max(a, t - SHUTTER / 2), t1 = Math.min(b - 1e-4, t + SHUTTER / 2);
  if (t1 <= t0) return [t];
  const p0 = project(t0), p1 = project(t1);
  let disp = 0;
  for (let i = 0; i < p0.length; i++) disp = Math.max(disp, Math.hypot(p1[i][0] - p0[i][0], p1[i][1] - p0[i][1]));
  if (TL.needsSite(t)) {
    const pxPerCss = Math.hypot(p0[1][0] - p0[0][0], p0[1][1] - p0[0][1]) / 1512;
    disp = Math.max(disp, Math.abs(plan.scroll(TL.siteTime(t1)) - plan.scroll(TL.siteTime(t0))) * pxPerCss);
  }
  const n = Math.min(MAXSUB, Math.max(1, Math.ceil(disp / 3)));
  if (n === 1) return [t];
  return Array.from({ length: n }, (_, k) => t0 + ((t1 - t0) * (k + 0.5)) / n);
}

// ---------------------------------------------------------------- site + scene
let siteScrollY = 0;
let siteT = -1;
async function stepSite(ts) {
  const c = plan.cursor(ts);
  siteScrollY = await site.evaluate((s) => window.__rec.step(s), { t: ts, scroll: plan.scroll(ts), mx: c.x, my: c.y, cursor: c.a, press: c.press });
  siteT = ts;
}
async function captureSite() {
  const r = await cdpSite.send('Page.captureScreenshot', {
    format: 'jpeg', quality: 96, optimizeForSpeed: true,
    clip: { x: 0, y: siteScrollY, width: 1512, height: 906, scale: 2 },
  });
  return r.data;
}
async function prep(t) {
  const subs = [];
  for (const ts of subTimes(t)) {
    if (TL.needsSite(ts)) {
      await stepSite(TL.siteTime(ts));
      subs.push({ t: ts, b64: await captureSite(), scrollY: siteScrollY });
    } else subs.push({ t: ts, b64: null, scrollY: 0 });
  }
  return { t, subs };
}
async function renderFrame({ t, subs }) {
  await scene.evaluate(({ subs, t }) => window.__scene.frame(subs, t), { subs, t });
  const r = await cdpScene.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  return Buffer.from(r.data, 'base64');
}

if (args.stills) {
  const times = String(args.stills).split(',').map(Number).sort((a, b) => a - b);
  const pfps = Number(args['preview-fps'] || 30);
  let tSim = TL.T_ON;
  for (const T of times) {
    // advance the website at preview rate up to just before the still
    for (; tSim < T - SHUTTER; tSim += 1 / pfps) if (TL.needsSite(tSim)) await stepSite(TL.siteTime(tSim));
    const job = await prep(T);
    const png = await renderFrame(job);
    const f = path.join(OUT, `still_${T.toFixed(2)}.png`);
    fs.writeFileSync(f, png);
    log('still', f, `(${job.subs.length} sub)`);
    tSim = Math.max(tSim, T + SHUTTER);
  }
} else {
  const from = Number(args.from || 0), to = Math.min(TOTAL, Number(args.to || TOTAL));
  // pre-roll the website state up to the first requested frame
  for (let i = Math.ceil(TL.T_ON * FPS); i < from; i++) if (TL.needsSite(i / FPS)) await stepSite(TL.siteTime(i / FPS));
  const t0 = Date.now();
  let subsTotal = 0;
  let pending = prep(from / FPS);
  for (let i = from; i < to; i++) {
    const job = await pending;
    subsTotal += job.subs.length;
    // overlap: prepare the next frame's website captures while this frame renders
    const rendering = renderFrame(job);
    pending = i + 1 < to ? prep((i + 1) / FPS) : null;
    const png = await rendering;
    fs.writeFileSync(path.join(OUT, `f_${String(i).padStart(5, '0')}.png`), png);
    if ((i - from) % 30 === 29 || i === to - 1) {
      const done = i - from + 1, el = (Date.now() - t0) / 1000;
      log(`frame ${i + 1}/${to}  ${(el / done).toFixed(2)} s/frame  ${(subsTotal / done).toFixed(2)} sub/frame  eta ${((to - i - 1) * el / done / 60).toFixed(1)} min`);
    }
  }
}
await browser.close();
server.close();
