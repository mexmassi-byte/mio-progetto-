// Deterministic frame renderer: website (record mode) -> MacBook display texture -> PNG frames.
//
//   node render/render.mjs --out <dir> [--w 2560 --h 1440 --sw 3024]
//        [--stills 1.0,6.5,20]      render single frames at these video times
//        [--from 0 --to 3000]       render a frame range (default: whole video)
//        [--preview-fps 30]         site simulation rate for --stills
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './server.mjs';
import * as TL from './timeline.mjs';
import { buildPlan } from './plan.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const OUT = path.resolve(args.out || 'frames');
const W = Number(args.w || 1920), H = Number(args.h || 1080), SW = Number(args.sw || 3024);
const FPS = TL.FPS;
const TOTAL = Math.round(TL.DURATION * FPS);
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
await site.goto(`${base}/site/index.html?rec`);
await site.evaluate(() => window.__rec.ready);
const info = await site.evaluate(() => window.__rec.info());
const plan = buildPlan(info);
fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify({ info, keyframes: plan.keyframes, waypoints: plan.waypoints }, null, 1));

// 3D scene page
const scene = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
scene.on('pageerror', (e) => log('scene error:', e.message));
scene.on('console', (m) => { if (m.type() === 'error') log('scene console:', m.text()); });
await scene.goto(`${base}/scene/index.html?w=${W}&h=${H}&sw=${SW}`);
await scene.evaluate(() => window.__scene.ready);
const cdpSite = await site.context().newCDPSession(site);
const cdpScene = await scene.context().newCDPSession(scene);
log(`ready: ${W}x${H}, screen texture ${SW}px, doc ${info.docH}px, ${TOTAL} frames`);

async function stepSite(ts) {
  const c = plan.cursor(ts);
  await site.evaluate((s) => window.__rec.step(s), { t: ts, scroll: plan.scroll(ts), mx: c.x, my: c.y, cursor: c.a });
}
async function captureSite() {
  const r = await cdpSite.send('Page.captureScreenshot', { format: 'jpeg', quality: 96, optimizeForSpeed: true });
  return r.data;
}
async function renderScene(t, b64) {
  await scene.evaluate(({ t, b64 }) => window.__scene.frame(t, b64), { t, b64 });
  const r = await cdpScene.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  return Buffer.from(r.data, 'base64');
}

if (args.stills) {
  const times = String(args.stills).split(',').map(Number).sort((a, b) => a - b);
  const pfps = Number(args['preview-fps'] || 30);
  let next = 0;
  for (let i = 0; next < times.length; i++) {
    const t = i / pfps;
    const ts = TL.siteTime(t);
    if (ts >= 0) await stepSite(ts);
    if (t >= times[next] - 1e-6) {
      const b64 = ts >= 0 ? await captureSite() : null;
      if (b64 && args['site-shots']) fs.writeFileSync(path.join(OUT, `site_${times[next].toFixed(2)}.jpg`), Buffer.from(b64, 'base64'));
      const png = await renderScene(t, b64);
      const f = path.join(OUT, `still_${times[next].toFixed(2)}.png`);
      fs.writeFileSync(f, png);
      log('still', f);
      next++;
    }
  }
} else {
  const from = Number(args.from || 0), to = Math.min(TOTAL, Number(args.to || TOTAL));
  const firstSite = Math.ceil(TL.T_ON * FPS);
  // pre-roll the website state up to the first requested frame
  for (let i = firstSite; i < from; i++) await stepSite(TL.siteTime(i / FPS));
  const t0 = Date.now();
  let pendingSite = null;
  const prepSite = async (i) => {
    const ts = TL.siteTime(i / FPS);
    if (ts < 0) return null;
    await stepSite(ts);
    return captureSite();
  };
  pendingSite = prepSite(from);
  for (let i = from; i < to; i++) {
    const b64 = await pendingSite;
    // overlap: prepare the next website frame while the 3D frame renders
    const nextSite = i + 1 < to ? prepSite(i + 1) : Promise.resolve(null);
    const png = await renderScene(i / FPS, b64);
    fs.writeFileSync(path.join(OUT, `f_${String(i).padStart(5, '0')}.png`), png);
    pendingSite = nextSite;
    if ((i - from) % 30 === 29 || i === to - 1) {
      const done = i - from + 1, el = (Date.now() - t0) / 1000;
      log(`frame ${i + 1}/${to}  ${(el / done).toFixed(2)} s/frame  eta ${((to - i - 1) * el / done / 60).toFixed(1)} min`);
    }
  }
}
await browser.close();
server.close();
