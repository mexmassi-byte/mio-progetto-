// "Vice City is open" (9:16): the fan page as a 3D object, the ribbon fly-over, the card opening
// into the fan film, the film's blade signs, the thumb and the caption. One deterministic frame at a time.
import * as THREE from 'three';
import * as TL from '../render/v2_timeline.mjs';

const { clamp, lerp, smooth, E } = TL;
const W = TL.OUT_W, H = TL.OUT_H, K = TL.DPR;
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- colours (the page's own inks)
const INK = { stucco: '#f4bcc8', night: '#082445', neon: '#3d8bff', enamel: '#fff4f6', cabinet: '#061a33', tubeBody: '#10284a' };
function srgbToOklab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklabToSrgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const enc = (v) => Math.round(255 * clamp(v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055, 0, 1));
  return [enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}
function mixInk(a, b, u) { const A = srgbToOklab(a), B = srgbToOklab(b); return oklabToSrgb([0, 1, 2].map((i) => lerp(A[i], B[i], u))); }
const css = (rgb, al = 1) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${al})`;

// ---------------------------------------------------------------- renderer, camera, output
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.01, 60);
const D0 = 0.5 / Math.tan(15 * DEG);
camera.position.set(0, 0, D0);
camera.lookAt(0, 0, 0);
const out = document.createElement('canvas'); out.width = W; out.height = H;
document.body.appendChild(out);
const ctx = out.getContext('2d');

const PW = TL.VW / TL.VH, PH = 1;   // the page plane: 405:720
function tex() {
  const t = new THREE.Texture();
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
// soft shadow under a floating page (it truly floats, so it may cast one)
function shadowTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 400;
  const x = c.getContext('2d');
  x.filter = 'blur(26px)'; x.fillStyle = 'rgba(0,0,0,0.85)'; x.fillRect(48, 52, 160, 296);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });

const pageGroup = new THREE.Group();
scene.add(pageGroup);
const screenTex = tex();
const screen = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
const pageShadow = new THREE.Mesh(new THREE.PlaneGeometry(PW * 1.6, PH * 1.36), shadowMat);
pageShadow.position.set(0.02, -0.035, -0.03);
pageGroup.add(pageShadow, screen);

const ribbonGroup = new THREE.Group();
const ribbonInner = new THREE.Group();
ribbonGroup.add(ribbonInner);
scene.add(ribbonGroup);
const ribbonTiles = [];

function applyPose(obj, p) {
  obj.position.set(p.tx * PH, p.ty * PH, 0);
  obj.rotation.set(p.rx * DEG, p.ry * DEG, p.rz * DEG, 'YXZ');
  obj.scale.setScalar(p.s);
}

// ---------------------------------------------------------------- footage
const meta = {};
const cache = new Map();
async function loadMeta() {
  for (const c of ['flip', 'city', 'bridge', 'boule', 'port', 'drone', 'drive', 'lights', 'tower']) meta[c] = await (await fetch(`/footage/${c}/meta.json`)).json();
}
async function frameOf(clip, local) {
  const m = meta[clip];
  const i = clamp(Math.floor(local * m.fps + 1e-6) + 1, 1, m.frames);
  const key = `${clip}/${i}`;
  if (cache.has(key)) return cache.get(key);
  const blob = await (await fetch(`/footage/${clip}/f_${String(i).padStart(4, '0')}.jpg`)).blob(); // taste-skill-ignore: file names
  const bmp = await createImageBitmap(blob);
  cache.set(key, bmp);
  if (cache.size > 24) { const k0 = cache.keys().next().value; cache.get(k0).close(); cache.delete(k0); }
  return bmp;
}
let colonyNight = null;
async function loadImage(src) { const b = await (await fetch(src)).blob(); return createImageBitmap(b); }

function drawCover(img, x, y, w, h, zoom = 1, ox = 0.5, oy = 0.5) {
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) * ox, y + (h - dh) * oy, dw, dh);
}

// ---------------------------------------------------------------- blade signs (the page's own device)
const FONT = (px, w = 900) => `${w} ${px}px 'Big Shoulders Display'`;
function cabinetPath(x, y, w, h) {
  // stepped Deco cap, the cabinet, a pointed fin (same proportions as the page's SVG signs)
  const k = w / 100, cap = 30 * k, fin = 26 * k, bodyEnd = y + h - fin;
  ctx.beginPath();
  ctx.moveTo(x + 8 * k, y + cap); ctx.lineTo(x + 8 * k, bodyEnd); ctx.lineTo(x + 38 * k, bodyEnd); ctx.lineTo(x + 50 * k, y + h);
  ctx.lineTo(x + 62 * k, bodyEnd); ctx.lineTo(x + 92 * k, bodyEnd); ctx.lineTo(x + 92 * k, y + cap); ctx.lineTo(x + 78 * k, y + cap);
  ctx.lineTo(x + 78 * k, y + 14 * k); ctx.lineTo(x + 64 * k, y + 14 * k); ctx.lineTo(x + 64 * k, y); ctx.lineTo(x + 36 * k, y);
  ctx.lineTo(x + 36 * k, y + 14 * k); ctx.lineTo(x + 22 * k, y + 14 * k); ctx.lineTo(x + 22 * k, y + cap); ctx.closePath();
}
function tubeLetter(ch, x, y, size, on) {
  ctx.font = FONT(size);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK.tubeBody;
  ctx.fillText(ch, x, y);
  if (on > 0.001) {
    ctx.save();
    ctx.globalAlpha = on;
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.06;
    ctx.strokeStyle = INK.neon;
    ctx.strokeText(ch, x, y);
    ctx.lineWidth = size * 0.018;
    ctx.strokeStyle = '#cfe2ff';
    ctx.strokeText(ch, x, y);
    ctx.restore();
  }
}
// vertical blade: letters stacked; on(i) gives each letter's light
function blade(text, x, y, w, on) {
  const letters = [...text];
  const step = w * 0.78, size = w * 0.92;
  const h = w * (0.3 + 0.14) + step * letters.length + w * (0.1 + 0.26);
  cabinetPath(x, y, w, h);
  ctx.fillStyle = INK.cabinet; ctx.fill();
  let yy = y + w * 0.44;
  letters.forEach((ch, i) => { yy += step; tubeLetter(ch, x + w / 2, yy - w * 0.09, size, on(i)); });
  return h;
}
// horizontal plaque: lines of tube letters on an enamel-edged cabinet
function plaque(lines, small, cx, cy, size, on) {
  ctx.font = FONT(size);
  const widths = lines.map((l) => ctx.measureText(l).width);
  const lineSizes = lines.map((l, i) => (i === 0 ? size : size * 0.62));
  const w = Math.max(...lines.map((l, i) => { ctx.font = FONT(lineSizes[i]); return ctx.measureText(l).width; })) + size * 0.7;
  const h = lineSizes.reduce((a, b) => a + b * 0.98, 0) + size * 0.55 + (small ? size * 0.42 : 0);
  const x = cx - w / 2, y = cy - h / 2;
  ctx.fillStyle = INK.cabinet;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = INK.enamel;
  ctx.fillRect(x, y, w, size * 0.06); ctx.fillRect(x, y + h - size * 0.06, w, size * 0.06);
  let yy = y + size * 0.28;
  let n = 0;
  lines.forEach((l, i) => {
    yy += lineSizes[i] * 0.98;
    ctx.font = FONT(lineSizes[i]);
    const lw = ctx.measureText(l).width;
    let xx = cx - lw / 2;
    for (const ch of l) { const cw = ctx.measureText(ch).width; tubeLetter(ch, xx + cw / 2, yy - lineSizes[i] * 0.1, lineSizes[i], on(n++)); xx += cw; }
  });
  if (small) {
    ctx.font = `600 ${size * 0.3}px 'Big Shoulders Text'`;
    ctx.fillStyle = INK.enamel; ctx.textAlign = 'center';
    ctx.fillText(small, cx, y + h - size * 0.24);
  }
  return { w, h, widths };
}

// ---------------------------------------------------------------- film
function letterOn(t, at, i, rate = 0.07) { return TL.flicker((t - at - i * rate) / 0.62); }
async function drawFilm(t) {
  const { shot } = TL.shotAt(t);
  const local = shot.clip === 'flip' ? TL.flipLocal(t) : shot.off + (t - shot.t0);
  const img = await frameOf(shot.clip, local);
  const u = clamp((t - shot.t0) / (shot.t1 - shot.t0), 0, 1);
  const push = 1 + 0.06 * E.out3(u);
  drawCover(img, 0, 0, W, H, push);
  // a quiet bottom scrim only where text sits (neutral, flat)
  for (const s of shot.signs) {
    const at = shot.t0 + s.at;
    const slide = 1 - E.out3(clamp((t - shot.t0) / 0.32, 0, 1));
    const drift = (push - 1) * 220;
    if (s.kind === 'blade') {
      const w = 150, x0 = s.side === 'left' ? 64 : s.side === 'left2' ? 64 + w + 28 : W - 64 - w;
      const dir = s.side === 'right' ? 1 : -1;
      const x = x0 + dir * slide * 260 + (s.side === 'right' ? drift : -drift);
      const y = 300 + (s.side === 'left2' ? 120 : 0);
      blade(s.text, x, y, w, (i) => letterOn(t, at, i));
    } else if (s.kind === 'plaque') {
      const size = s.lines.length > 1 ? 150 : 260;
      plaque(s.lines, s.small, W / 2, 1180 + slide * 220, size, (i) => letterOn(t, at, i, 0.06));
    } else if (s.kind === 'open') {
      // the OPEN sign builds across the cuts: one more letter lights on each beat
      const letters = 'OPEN';
      const size = 300, pad = 70;
      ctx.font = FONT(size);
      const lw = [...letters].map((c) => ctx.measureText(c).width);
      const total = lw.reduce((a, b) => a + b, 0) + pad * 2;
      const x = (W - total) / 2, y = 760;
      ctx.fillStyle = INK.cabinet; ctx.fillRect(x, y, total, size * 1.25);
      ctx.fillStyle = INK.enamel; ctx.fillRect(x, y, total, 14); ctx.fillRect(x, y + size * 1.25 - 14, total, 14);
      let xx = x + pad;
      [...letters].forEach((c, i) => {
        const lit = i < s.n - 1 ? 1 : i === s.n - 1 ? TL.flicker((t - at) / 0.4) : 0;
        tubeLetter(c, xx + lw[i] / 2, y + size * 1.02, size, lit);
        xx += lw[i];
      });
    }
  }
  if (shot.note) {
    const a = smooth(shot.t0 + 0.3, shot.t0 + 0.6, t) * (1 - smooth(shot.t1 - 0.3, shot.t1, t));
    ctx.font = `600 38px 'Big Shoulders Text'`; ctx.textAlign = 'left';
    ctx.fillStyle = `rgba(255,244,246,${0.9 * a})`;
    ctx.fillText(shot.note, 64, 1490);
  }
}

// ---------------------------------------------------------------- overlays
function drawFinger(t) {
  const f = TL.finger(t);
  if (f.a <= 0.001) return;
  const x = f.x * K, y = f.y * K, r = 30 * K * (1 - 0.16 * f.press);
  ctx.save();
  ctx.globalAlpha = f.a;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${0.32 + 0.3 * f.press})`; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
  ctx.restore();
}
function drawCaption(t) {
  const c = TL.caption(t);
  if (c.a <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = c.a;
  ctx.fillStyle = INK.enamel; ctx.textAlign = 'left';
  ctx.font = FONT(112);
  ctx.fillText('Our way to celebrate', 64, 330 + c.rise);
  ctx.fillText('the launch of GTA VI.', 64, 446 + c.rise);
  ctx.font = `600 34px 'Big Shoulders Text'`;
  ctx.fillStyle = 'rgba(255,244,246,0.78)';
  ctx.fillText('Unofficial fan concept. Not affiliated with Rockstar Games. Real footage of Miami.', 64, 520 + c.rise * 0.6);
  ctx.restore();
}
async function drawFlip(t) {
  const r = TL.flipRect(t);
  if (!r) return;
  const x = r.x * K, y = r.y * K, w = r.w * K, h = r.h * K;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (r.dir > 0) {
    drawCover(await frameOf('flip', TL.flipLocal(t)), x, y, w, h);
  } else {
    // the film closes into the hero's first reel frame, which shows the Colony Hotel at night
    const last = TL.SHOTS[TL.SHOTS.length - 1];
    drawCover(await frameOf(last.clip, last.off + (t - last.t0)), x, y, w, h, 1.06);
    ctx.globalAlpha = smooth(0.25, 0.95, r.u);
    drawCover(colonyNight, x, y, w, h, 1, 0.35, 0.5);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- frame
async function decodeJpeg(b64) {
  const blob = await (await fetch('data:image/jpeg;base64,' + b64)).blob();
  return createImageBitmap(blob);
}
let lastScreen = null;
async function renderAt(s) {
  const t = s.t;
  const p = TL.pose(t);
  const ground = mixInk(INK.stucco, INK.night, TL.lights(t));
  if (p.mode === 'film') {
    await drawFilm(t);
    return;
  }
  scene.background = new THREE.Color(css(ground));
  if (s.b64) {
    const bmp = await decodeJpeg(s.b64);
    if (lastScreen) lastScreen.close();
    lastScreen = bmp;
    screenTex.image = bmp; screenTex.needsUpdate = true;
  }
  pageGroup.visible = p.mode === 'screen';
  ribbonGroup.visible = p.mode === 'ribbon';
  if (p.mode === 'screen') applyPose(pageGroup, p);
  else { applyPose(ribbonGroup, p); ribbonInner.position.y = p.travel * PH; }
  shadowMat.opacity = 0.55 * clamp((1 - p.s) / 0.2, 0, 1) * (p.mode === 'screen' ? 1 : 0);
  renderer.render(scene, camera);
  ctx.drawImage(renderer.domElement, 0, 0);
  await drawFlip(t);
}

// subs: motion-blur subframes [{ t, b64 }]; t: the frame's own time
async function frame(subs, t) {
  ctx.save();
  for (let k = 0; k < subs.length; k++) {
    // each subframe paints the full frame on a scratch layer, then joins the average
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (k === 0) { await renderAt(subs[k]); continue; }
    const prev = ctx.getImageData(0, 0, W, H);
    await renderAt(subs[k]);
    const cur = ctx.getImageData(0, 0, W, H);
    const a = prev.data, b = cur.data, wgt = 1 / (k + 1);
    for (let i = 0; i < a.length; i += 4) {
      a[i] += (b[i] - a[i]) * wgt; a[i + 1] += (b[i + 1] - a[i + 1]) * wgt; a[i + 2] += (b[i + 2] - a[i + 2]) * wgt;
    }
    ctx.putImageData(prev, 0, 0);
  }
  ctx.restore();
  drawCaption(t);
  drawFinger(t);
  return true;
}

async function setRibbon(list) {
  for (const m of ribbonTiles) { ribbonInner.remove(m); m.material.map.dispose(); m.material.dispose(); }
  ribbonTiles.length = 0;
  for (let k = 0; k < list.length; k++) {
    const t = tex();
    t.image = await decodeJpeg(list[k]); t.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    m.position.y = -k * PH;
    ribbonInner.add(m);
    ribbonTiles.push(m);
  }
  return ribbonTiles.length;
}

const ready = (async () => {
  await Promise.all([document.fonts.load(`900 40px 'Big Shoulders Display'`), document.fonts.load(`800 40px 'Big Shoulders Display'`), document.fonts.load(`600 40px 'Big Shoulders Text'`)]);
  await loadMeta();
  colonyNight = await loadImage('/site/assets/img/colony-hotel-night.jpg');
  renderer.render(scene, camera);
  return true;
})();

window.__v2 = { ready, frame, setRibbon, W, H };
