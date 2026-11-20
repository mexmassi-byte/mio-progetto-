// Quick visual check of the landing page in record mode.
// Usage: node render/preview.mjs <outDir> [dpr]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const out = path.resolve(process.argv[2] || 'preview');
const dpr = Number(process.argv[3] || 1);
fs.mkdirSync(out, { recursive: true });

const server = await startServer(0);
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1512, height: 906 }, deviceScaleFactor: dpr });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text()); });
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/site-v1/index.html?rec`);
await page.evaluate(() => window.__rec.ready);
console.log('ready in', Date.now() - t0, 'ms');
const info = await page.evaluate(() => window.__rec.info());
console.log('docH', info.docH, 'vh', info.vh);
for (const [k, v] of Object.entries(info.anchors)) console.log(k.padEnd(14), v && `${Math.round(v.x)},${Math.round(v.y)} ${Math.round(v.w)}x${Math.round(v.h)}`);

const fps = 30;
let t = 0;
const step = async (scroll, mx = -9999, my = -9999, cur = 0) => page.evaluate((s) => window.__rec.step(s), { t, scroll, mx, my, cursor: cur });
const shot = async (name) => { await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name, 't=' + t.toFixed(2)); };

// intro
const shotsAt = { 0.6: 'a_intro_0.6', 1.6: 'a_intro_1.6', 2.6: 'a_intro_2.6', 5: 'a_hero_5.0' };
for (let f = 0; f <= 5 * fps; f++) {
  t = f / fps;
  const hover = t > 4 ? { mx: info.anchors.heroCta.x + 60, my: info.anchors.heroCta.y + 25, c: 1 } : { mx: -9999, my: -9999, c: 0 };
  await step(0, hover.mx, hover.my, hover.c);
  for (const [ts, name] of Object.entries(shotsAt)) if (Math.abs(t - Number(ts)) < 0.5 / fps) await shot(name);
}
// scroll through the page, pausing to let reveals finish, with cursor parked mid-right
if (process.argv[4] === 'hero') { await browser.close(); server.close(); process.exit(0); }
const maxScroll = info.docH - info.vh;
const stops = [];
for (let y = 300; y < maxScroll; y += 620) stops.push(y);
stops.push(maxScroll);
let cur = 0;
for (const [i, target] of stops.entries()) {
  const from = cur;
  const dur = 1.0;
  for (let f = 1; f <= dur * fps; f++) {
    t += 1 / fps;
    const u = f / (dur * fps);
    cur = from + (target - from) * (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
    await step(cur, 1010, 470, 1);
  }
  for (let f = 0; f < 1.6 * fps; f++) { t += 1 / fps; await step(cur, 1010, 470, 1); }
  await shot(`b_${String(i).padStart(2, '0')}_y${Math.round(cur)}`);
}
await browser.close();
server.close();
