/* ==========================================================================
   art.js — original, procedural artwork for the concept site.
   No external images: every skyline, palm, bridge and light is generated
   deterministically from a seed, so the page renders identically every time.
   ========================================================================== */
(function (G) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);

  function RNG(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function hex(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(h, a) { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
  function mix(h1, h2, t) {
    const a = hex(h1), b = hex(h2);
    return '#' + a.map((v, i) => Math.round(lerp(v, b[i], t)).toString(16).padStart(2, '0')).join('');
  }
  function vgrad(ctx, y0, y1, stops) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (const s of stops) g.addColorStop(s[0], s[1]);
    return g;
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }

  /* ------------------------------------------------------------------ sky */
  function paintSky(ctx, W, H, hz, spec) {
    ctx.fillStyle = vgrad(ctx, 0, hz, spec.sky);
    ctx.fillRect(0, 0, W, hz + 2);
    for (const g of spec.glows || []) {
      ctx.save();
      ctx.globalCompositeOperation = g.op || 'screen';
      ctx.translate(g.x * W, g.y * H);
      ctx.scale(1, g.sy || 0.45);
      const R = g.r * W;
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      rg.addColorStop(0, g.c);
      rg.addColorStop(g.mid || 0.45, g.c2 || g.c.replace(/[\d.]+\)$/, (m) => String(parseFloat(m) * 0.35) + ')'));
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(-R, -R, 2 * R, 2 * R);
      ctx.restore();
    }
  }

  function paintStars(ctx, W, top, n, r, k, maxA) {
    for (let i = 0; i < n; i++) {
      const x = r() * W;
      const y = Math.pow(r(), 1.5) * top;
      const s = (0.35 + r() * r() * 1.25) * k;
      const a = (0.15 + r() * 0.85) * (maxA || 0.85) * (1 - (y / top) * 0.7);
      ctx.fillStyle = `rgba(255,${235 + Math.floor(r() * 20)},${215 + Math.floor(r() * 40)},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
    }
  }

  function paintOrb(ctx, x, y, R, spec) {
    // spec: {core, edge, halo, haloR, haloA, crescent}
    const hr = R * (spec.haloR || 7);
    const hg = ctx.createRadialGradient(x, y, R * 0.6, x, y, hr);
    hg.addColorStop(0, rgba(spec.halo, spec.haloA || 0.22));
    hg.addColorStop(0.25, rgba(spec.halo, (spec.haloA || 0.22) * 0.35));
    hg.addColorStop(1, rgba(spec.halo, 0));
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = hg; ctx.fillRect(x - hr, y - hr, hr * 2, hr * 2);
    ctx.restore();
    const L = mk(Math.ceil(R * 2.4), Math.ceil(R * 2.4));
    const l = L.getContext('2d');
    const cx = L.width / 2, cy = L.height / 2;
    const dg = l.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
    dg.addColorStop(0, spec.core); dg.addColorStop(1, spec.edge);
    l.fillStyle = dg; l.beginPath(); l.arc(cx, cy, R, 0, TAU); l.fill();
    if (spec.craters) {
      const r = RNG(91);
      for (let i = 0; i < 9; i++) {
        l.fillStyle = `rgba(120,100,90,${0.05 + r() * 0.07})`;
        l.beginPath(); l.arc(cx + (r() - 0.5) * R * 1.2, cy + (r() - 0.5) * R * 1.2, R * (0.06 + r() * 0.16), 0, TAU); l.fill();
      }
    }
    if (spec.crescent) {
      l.globalCompositeOperation = 'destination-out';
      l.fillStyle = '#000';
      l.beginPath(); l.arc(cx + R * spec.crescent, cy - R * 0.12, R * 0.98, 0, TAU); l.fill();
    }
    ctx.drawImage(L, x - cx, y - cy);
  }

  function paintClouds(ctx, W, H, spec, r, k) {
    // Paint at 1/4 resolution and upscale: soft, cheap, and blur-free.
    const q = 4;
    const C = mk(W / q, H / q);
    const c = C.getContext('2d');
    for (let i = 0; i < spec.n; i++) {
      const y = lerp(spec.y0, spec.y1, Math.pow(r(), spec.bias || 1)) * C.height;
      const x = r() * C.width;
      const rx = (spec.rx[0] + r() * (spec.rx[1] - spec.rx[0])) * k / q;
      const ry = rx * (0.05 + r() * 0.1);
      const t = clamp((y / C.height - spec.y0) / Math.max(0.0001, spec.y1 - spec.y0), 0, 1);
      const col = mix(spec.top, spec.low, smooth(t));
      const a = spec.a * (0.35 + r() * 0.65);
      for (const dx of [0, -C.width, C.width]) {
        const g = c.createRadialGradient(x + dx, y, 0, x + dx, y, rx);
        g.addColorStop(0, rgba(col, a));
        g.addColorStop(0.55, rgba(col, a * 0.45));
        g.addColorStop(1, rgba(col, 0));
        c.save(); c.translate(x + dx, y); c.scale(1, ry / rx); c.translate(-(x + dx), -y);
        c.fillStyle = g; c.beginPath(); c.arc(x + dx, y, rx, 0, TAU); c.fill();
        c.restore();
      }
    }
    return C;
  }

  /* ------------------------------------------------------------ skyline */
  const KINDS = ['flat', 'flat', 'step', 'spire', 'slant', 'round', 'crown', 'flat', 'step', 'crown'];

  function genBuildings(r, W, H, spec, k) {
    const out = [];
    let x = spec.x0 * W - 30 * k;
    while (x < spec.x1 * W + 30 * k) {
      const w = (spec.bw[0] + r() * (spec.bw[1] - spec.bw[0])) * k;
      const cx = (x + w / 2) / W;
      let hf = spec.h[0] + r() * (spec.h[1] - spec.h[0]);
      for (const c of spec.clusters || []) {
        const d = (cx - c.c) / c.w;
        hf += c.h * Math.exp(-d * d) * (0.3 + 0.7 * r());
      }
      out.push({ x, w, h: hf * H, kind: pick(r, KINDS), seed: Math.floor(r() * 1e9) });
      x += w * (spec.gap[0] + r() * (spec.gap[1] - spec.gap[0]));
    }
    return out;
  }

  function buildingPath(b, base, k) {
    const p = new Path2D();
    const x = b.x, w = b.w, top = base - b.h;
    switch (b.kind) {
      case 'step': {
        const s1 = w * 0.12, s2 = w * 0.25, h1 = Math.min(b.h * 0.05, 26 * k), h2 = Math.min(b.h * 0.05, 22 * k);
        p.moveTo(x, base); p.lineTo(x, top + h1 + h2); p.lineTo(x + s1, top + h1 + h2); p.lineTo(x + s1, top + h2);
        p.lineTo(x + s2, top + h2); p.lineTo(x + s2, top); p.lineTo(x + w - s2, top); p.lineTo(x + w - s2, top + h2);
        p.lineTo(x + w - s1, top + h2); p.lineTo(x + w - s1, top + h1 + h2); p.lineTo(x + w, top + h1 + h2); p.lineTo(x + w, base);
        break;
      }
      case 'spire': {
        p.rect(x, top, w, b.h);
        const sw = Math.max(1.2 * k, w * 0.05);
        p.moveTo(x + w / 2 - sw, top); p.lineTo(x + w / 2, top - b.h * 0.16); p.lineTo(x + w / 2 + sw, top);
        break;
      }
      case 'slant': {
        p.moveTo(x, base); p.lineTo(x, top + w * 0.42); p.lineTo(x + w, top); p.lineTo(x + w, base);
        break;
      }
      case 'round': {
        p.moveTo(x, base); p.lineTo(x, top + w / 2);
        p.arc(x + w / 2, top + w / 2, w / 2, Math.PI, 0); p.lineTo(x + w, base);
        break;
      }
      case 'crown': {
        const cw = w * 0.62, ch = Math.min(b.h * 0.07, 34 * k);
        p.rect(x, top + ch, w, b.h - ch);
        p.rect(x + (w - cw) / 2, top, cw, ch + 1);
        break;
      }
      default:
        p.rect(x, top, w, b.h);
        p.rect(x + w * 0.2, top - 4 * k, w * 0.18, 4 * k);
    }
    p.closePath();
    return p;
  }

  function paintSkyline(ctx, W, H, base, spec, r, k, lights) {
    const list = genBuildings(r, W, H, spec, k);
    const tallest = list.slice().sort((a, b) => b.h - a.h);
    const neonSet = new Set(tallest.slice(0, spec.neonCount || 0).map((b) => b));
    const tops = [];
    for (const b of list) {
      const br = RNG(b.seed);
      const path = buildingPath(b, base, k);
      const top = base - b.h;
      // silhouette with subtle vertical gradient
      ctx.fillStyle = vgrad(ctx, top, base, [[0, spec.body[0]], [1, spec.body[1]]]);
      ctx.fill(path);
      ctx.save();
      ctx.clip(path);
      // facade uplight wash (Miami-style colored lighting)
      if (spec.wash && br() < spec.wash) {
        const col = pick(br, spec.neon);
        const fromTop = br() < 0.5;
        ctx.fillStyle = vgrad(ctx, top, base, fromTop
          ? [[0, rgba(col, 0.42)], [0.35, rgba(col, 0.12)], [1, rgba(col, 0)]]
          : [[0, rgba(col, 0)], [0.6, rgba(col, 0.08)], [1, rgba(col, 0.34)]]);
        ctx.fillRect(b.x, top - b.h * 0.2, b.w, b.h * 1.2);
      }
      // windows
      if (spec.windows) {
        const style = br();
        const ww = (2.4 + br() * 1.2) * k * spec.winScale, wh = (3.2 + br() * 1.4) * k * spec.winScale;
        const gx = ww + (2.2 + br() * 2.4) * k * spec.winScale, gy = wh + (2.6 + br() * 2.6) * k * spec.winScale;
        const pad = 3 * k;
        const warm = br() < spec.warm;
        const pLit = spec.lit * (0.45 + br() * 0.9);
        const y0 = top + Math.max(6 * k, b.h * 0.04);
        if (style < (spec.bandProb || 0)) {
          const col = pick(br, ['#bff3ff', '#ffd2ec', '#fff2dc', '#9fe9ff']);
          for (let y = y0; y < base - 4 * k; y += gy * 1.25) {
            if (br() < 0.82) {
              ctx.fillStyle = rgba(col, 0.25 + br() * 0.55);
              ctx.fillRect(b.x + pad, y, b.w - pad * 2, Math.max(1, 1.1 * k));
            }
          }
        } else {
          const rows = Math.floor((base - y0) / gy), cols = Math.max(1, Math.floor((b.w - pad * 2) / gx));
          const ox = b.x + (b.w - cols * gx) / 2 + (gx - ww) / 2;
          for (let j = 0; j < rows; j++) {
            const floorBoost = br() < 0.12 ? 1.9 : br() < 0.3 ? 0.25 : 1;
            for (let i = 0; i < cols; i++) {
              if (br() < pLit * floorBoost) {
                const t = br();
                let col;
                if (warm) col = t < 0.7 ? '#ffd39a' : t < 0.92 ? '#ffe9c4' : '#fff6e6';
                else col = t < 0.6 ? '#d4ebff' : t < 0.85 ? '#eef6ff' : '#ffd8a8';
                if (br() < 0.025) col = pick(br, spec.neon);
                const a = 0.35 + br() * 0.65;
                ctx.fillStyle = rgba(col, a);
                const wx = ox + i * gx, wy = y0 + j * gy;
                ctx.fillRect(wx, wy, ww, wh);
                if (lights && a > 0.92 && br() < spec.lightProb) lights.push({ x: wx + ww / 2, y: wy, c: col, i: 0.35 + br() * 0.4 });
              }
            }
          }
        }
      }
      ctx.restore();
      // rim light on one edge
      if (spec.rim && br() < 0.55) {
        ctx.fillStyle = vgrad(ctx, top, base, [[0, rgba(spec.rim, 0.28)], [1, rgba(spec.rim, 0.04)]]);
        ctx.fillRect(b.x + b.w - 1.4 * k, top, 1.4 * k, b.h);
      }
      // neon crown outline
      if (neonSet.has(b)) {
        const col = pick(br, spec.neon);
        ctx.save();
        ctx.beginPath();
        ctx.rect(b.x - 40 * k, top - b.h * 0.3, b.w + 80 * k, Math.min(b.h * 0.32, 110 * k) + b.h * 0.3);
        ctx.clip();
        ctx.shadowColor = col; ctx.shadowBlur = 16 * k;
        ctx.strokeStyle = rgba(col, 0.95); ctx.lineWidth = 1.8 * k;
        ctx.stroke(path);
        ctx.shadowBlur = 0;
        ctx.restore();
        // vertical neon accent strips
        if (br() < 0.6) {
          ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 10 * k;
          ctx.fillStyle = rgba(col, 0.85);
          ctx.fillRect(b.x + 2 * k, top + b.h * 0.08, 1.2 * k, b.h * (0.25 + br() * 0.4));
          ctx.fillRect(b.x + b.w - 3.2 * k, top + b.h * 0.08, 1.2 * k, b.h * (0.25 + br() * 0.4));
          ctx.restore();
        }
        if (lights) lights.push({ x: b.x + b.w / 2, y: top, c: col, i: 1.0, w: b.w * 0.5 });
      }
      if (b.h > H * 0.12) tops.push({ x: b.x + b.w / 2, y: top - (b.kind === 'spire' ? b.h * 0.16 : 3 * k), h: b.h });
    }
    return { list, tops: tops.sort((a, b) => b.h - a.h) };
  }

  /* --------------------------------------------------------------- palms */
  function paintPalm(ctx, x, y, h, lean, k, t, opts) {
    opts = opts || {};
    const col = opts.color || '#020205';
    const phase = opts.phase || 0;
    const sway = Math.sin(t * 0.7 + phase) * 0.018 + Math.sin(t * 1.9 + phase * 2.1) * 0.006;
    const cx = x + lean * h + sway * h * 0.6, cy = y - h;
    // trunk (tapered, gently curved)
    const segs = 22;
    ctx.fillStyle = col;
    ctx.beginPath();
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const bx = x + (cx - x) * u + Math.sin(u * Math.PI) * h * (opts.bend || 0.06) * Math.sign(lean || 1);
      const by = y + (cy - y) * u;
      pts.push([bx, by, lerp(h * 0.03, h * 0.016, u)]);
    }
    for (const p of pts) ctx.lineTo(p[0] - p[2], p[1]);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0] + pts[i][2], pts[i][1]);
    ctx.closePath(); ctx.fill();
    // trunk rings (subtle texture)
    if (opts.rings !== false) {
      ctx.strokeStyle = rgba(opts.ringColor || '#2a1d33', 0.55); ctx.lineWidth = Math.max(0.6, 0.7 * k);
      for (let i = 2; i < pts.length - 1; i += 1) {
        ctx.beginPath(); ctx.moveTo(pts[i][0] - pts[i][2], pts[i][1]); ctx.lineTo(pts[i][0] + pts[i][2], pts[i][1] + h * 0.004); ctx.stroke();
      }
    }
    // fronds
    const n = opts.fronds || 13;
    const L = h * (opts.frond || 0.5);
    const r = RNG(opts.seed || 3);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'round';
    for (let f = 0; f < n; f++) {
      const base = (f / n) * TAU + r() * 0.4;
      let ang = base + Math.sin(t * 0.9 + f * 1.7 + phase) * 0.03 + sway * 0.8;
      let dx = Math.cos(ang), dy = Math.sin(ang) * 0.55 - 0.18; // flattened crown, slightly upward
      const len = L * (0.75 + r() * 0.35);
      const droop = 0.25 + r() * 0.35 + Math.max(0, dy) * 0.6;
      const ex = cx + dx * len, ey = cy + dy * len + droop * len * 0.55;
      const mx = cx + dx * len * 0.5, my = cy + dy * len * 0.5 - len * 0.12;
      // spine
      ctx.lineWidth = Math.max(0.8, h * 0.006);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
      // leaflets: filled tapered blades hanging from the spine
      const leaves = opts.leaves || 26;
      const bw = Math.max(0.6, h * 0.0034);
      ctx.beginPath();
      for (let i = 2; i < leaves; i++) {
        const u = i / leaves;
        const px = (1 - u) * (1 - u) * cx + 2 * (1 - u) * u * mx + u * u * ex;
        const py = (1 - u) * (1 - u) * cy + 2 * (1 - u) * u * my + u * u * ey;
        const tx0 = 2 * (1 - u) * (mx - cx) + 2 * u * (ex - mx);
        const ty0 = 2 * (1 - u) * (my - cy) + 2 * u * (ey - my);
        const tl = Math.hypot(tx0, ty0) || 1;
        const tx = tx0 / tl, ty = ty0 / tl;
        let nx = -ty, ny = tx;
        if (ny > 0) { nx = -nx; ny = -ny; } // n points "up" on screen
        const ll = len * 0.27 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08 + 0.04)), 0.8) * (0.82 + r() * 0.3);
        // upper blade: toward tip, slightly raised; lower blade: hangs down
        const dirs = [
          [tx * 0.8 + nx * 0.45, ty * 0.8 + ny * 0.45 + 0.25],
          [tx * 0.45 - nx * 0.2, ty * 0.45 - ny * 0.2 + 0.95],
        ];
        for (const d of dirs) {
          const dl = Math.hypot(d[0], d[1]) || 1;
          const dx2 = d[0] / dl, dy2 = d[1] / dl;
          const qx = -dy2, qy = dx2;
          const tipx = px + dx2 * ll, tipy = py + dy2 * ll + ll * 0.18;
          ctx.moveTo(px + qx * bw, py + qy * bw);
          ctx.quadraticCurveTo(px + dx2 * ll * 0.55 + qx * bw * 0.8, py + dy2 * ll * 0.55 + qy * bw * 0.8 + ll * 0.04, tipx, tipy);
          ctx.quadraticCurveTo(px + dx2 * ll * 0.55 - qx * bw * 0.8, py + dy2 * ll * 0.55 - qy * bw * 0.8 + ll * 0.04, px - qx * bw, py - qy * bw);
          ctx.closePath();
        }
      }
      ctx.fill();
    }
    // coconuts / crown mass
    ctx.beginPath(); ctx.arc(cx, cy + h * 0.01, h * 0.028, 0, TAU); ctx.fill();
  }

  /* -------------------------------------------------------------- water */
  function buildWaterSource(W, H, hz, backdrop, lights, spec, k) {
    const wh = H - hz;
    const C = mk(W, wh);
    const c = C.getContext('2d');
    // mirrored scene
    c.save();
    c.filter = `blur(${(spec.blur || 2) * k}px)`;
    c.setTransform(1, 0, 0, -spec.squash, 0, spec.squash * hz);
    c.drawImage(backdrop, 0, 0, W, hz, 0, 0, W, hz);
    c.restore();
    c.filter = 'none';
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = vgrad(c, 0, wh, [[0, 'rgba(0,0,0,' + spec.alpha[0] + ')'], [0.35, 'rgba(0,0,0,' + spec.alpha[1] + ')'], [1, 'rgba(0,0,0,' + spec.alpha[2] + ')']]);
    c.fillRect(0, 0, W, wh);
    c.globalCompositeOperation = 'source-over';
    // glitter columns for strong lights
    const r = RNG(spec.seed || 5);
    c.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const baseY = (L.wl != null ? (L.wl - hz) + (L.wl - L.y) * 0.9 : (hz - L.y) * spec.squash);
      const len = (0.05 + L.i * 0.22) * wh * (spec.streak || 1);
      const w0 = (L.w ? Math.min(L.w, 26 * k) : (1.2 + L.i * 2.6) * k);
      for (let y = baseY; y < baseY + len && y < wh; y += (1.6 + r() * 2.8) * k) {
        const u = (y - baseY) / len;
        const a = L.i * Math.pow(1 - u, 1.6) * (0.25 + r() * 0.75) * (spec.streakA || 0.55);
        if (a < 0.02) continue;
        const ww = w0 * (0.6 + r() * 0.9) * (1 + (y / wh) * 1.5);
        c.fillStyle = rgba(L.c, a);
        c.fillRect(L.x - ww / 2 + (r() - 0.5) * 3 * k, y, ww, Math.max(1, (0.8 + r() * 1.2) * k));
      }
    }
    c.globalCompositeOperation = 'source-over';
    return C;
  }

  function drawWater(ctx, W, H, hz, src, base, t, spec, k) {
    const wh = H - hz;
    ctx.drawImage(base, 0, hz);
    const strip = Math.max(1, Math.round(2.5 * k));
    for (let y = 0; y < wh; y += strip) {
      const d = y / wh;
      const amp = (0.6 + d * d * 14 + d * 3) * k * (spec.amp || 1);
      const dx = Math.sin(y * 0.055 / k + t * 1.35 + Math.sin(y * 0.013 / k - t * 0.4) * 2.2) * amp
        + Math.sin(y * 0.21 / k - t * 2.6) * amp * 0.35;
      ctx.globalAlpha = 0.82 + 0.18 * Math.sin(y * 0.37 / k + t * 3.1);
      ctx.drawImage(src, 0, y, W, strip, dx, hz + y, W, strip);
    }
    ctx.globalAlpha = 1;
  }

  function waterBase(W, H, hz, spec) {
    const C = mk(W, H - hz);
    const c = C.getContext('2d');
    c.fillStyle = vgrad(c, 0, H - hz, spec.water);
    c.fillRect(0, 0, W, H - hz);
    return C;
  }

  /* ------------------------------------------------------------- bridge */
  function bez(p0, p1, p2, u) {
    return [
      (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0],
      (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1],
    ];
  }
  function paintBridge(ctx, W, H, spec, k, lights) {
    const P0 = [spec.p0[0] * W, spec.p0[1] * H], P1 = [spec.p1[0] * W, spec.p1[1] * H], P2 = [spec.p2[0] * W, spec.p2[1] * H];
    const N = 220;
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = bez(P0, P1, P2, u);
      const th = lerp(spec.thick[0], spec.thick[1], Math.pow(u, 0.7)) * H;
      top.push(p); bot.push([p[0], p[1] + th]);
    }
    // piers
    ctx.fillStyle = spec.pier || '#05050a';
    for (let i = 0; i <= N; i += spec.pierStep || 10) {
      const u = i / N, p = top[i];
      const th = lerp(spec.thick[0], spec.thick[1], Math.pow(u, 0.7)) * H;
      const ph = th * (spec.pierH || 2.2);
      const pw = Math.max(1, th * 0.35);
      ctx.fillRect(p[0] - pw / 2, p[1] + th, pw, ph);
    }
    // deck
    ctx.fillStyle = spec.deck || '#07070d';
    ctx.beginPath();
    top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.closePath(); ctx.fill();
    // deck edge highlight
    ctx.strokeStyle = rgba(spec.edge || '#ffb98a', 0.55); ctx.lineWidth = Math.max(0.6, k * 1.1);
    ctx.beginPath(); top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    // lamps
    const lampCol = spec.lamp || '#ffc77a';
    for (let i = 4; i <= N; i += spec.lampStep || 9) {
      const u = i / N, p = top[i];
      const th = lerp(spec.thick[0], spec.thick[1], Math.pow(u, 0.7)) * H;
      const lh = th * 3.2;
      ctx.strokeStyle = spec.deck || '#07070d'; ctx.lineWidth = Math.max(0.6, th * 0.12);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - lh); ctx.stroke();
      const gr = Math.max(1.4 * k, th * 0.55);
      const g = ctx.createRadialGradient(p[0], p[1] - lh, 0, p[0], p[1] - lh, gr * 3);
      g.addColorStop(0, rgba('#fff4dc', 0.95)); g.addColorStop(0.15, rgba(lampCol, 0.75)); g.addColorStop(1, rgba(lampCol, 0));
      ctx.fillStyle = g; ctx.fillRect(p[0] - gr * 3, p[1] - lh - gr * 3, gr * 6, gr * 6);
      if (lights) lights.push({ x: p[0], y: p[1] - lh, c: lampCol, i: 0.55 + (1 - u) * 0.3, wl: p[1] + th * (spec.pierH || 2.2) + th });
    }
    return { top, bot, P0, P1, P2 };
  }

  function glowSprite(col, size) {
    const C = mk(size, size), c = C.getContext('2d');
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.12, rgba(col, 0.95));
    g.addColorStop(0.4, rgba(col, 0.28));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, size, size);
    return C;
  }

  /* ------------------------------------------------------------ helpers */
  function vignette(ctx, W, H, a, inner) {
    const g = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * (inner || 0.35), W / 2, H / 2, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function dither(ctx, W, H, amt, seed) {
    // Low-amplitude noise to prevent gradient banding (applied once to static layers).
    const id = ctx.getImageData(0, 0, W, H), d = id.data;
    const r = RNG(seed || 77);
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * amt;
      d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n, 0, 255); d[i + 2] = clamp(d[i + 2] + n, 0, 255);
    }
    ctx.putImageData(id, 0, 0);
  }
  function shoreline(ctx, W, H, y, k, r, spec) {
    ctx.fillStyle = spec.land || '#040409';
    ctx.fillRect(0, y - 1.5 * k, W, (spec.landH || 5) * k);
    // promenade lights
    for (let x = r() * 10 * k; x < W; x += (9 + r() * 12) * k) {
      if (r() < 0.25) continue;
      const g = ctx.createRadialGradient(x, y - 2 * k, 0, x, y - 2 * k, 6 * k);
      const col = r() < 0.75 ? '#ffc277' : '#bfe6ff';
      g.addColorStop(0, rgba('#fff5e0', 0.9)); g.addColorStop(0.3, rgba(col, 0.5)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(x - 6 * k, y - 8 * k, 12 * k, 12 * k);
    }
    // tiny distant palms
    for (let i = 0; i < (spec.tinyPalms || 0); i++) {
      const x = r() * W, hh = (10 + r() * 14) * k;
      paintPalm(ctx, x, y, hh, (r() - 0.5) * 0.3, k * 0.4, 0, { fronds: 8, leaves: 9, frond: 0.55, seed: Math.floor(r() * 999), rings: false, color: spec.land || '#040409' });
    }
  }

  /* ===================================================================
     HERO: animated Vice City at night
     =================================================================== */
  class ViceHero {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.ready = false;
    }
    build(W, H) {
      this.c.width = W; this.c.height = H;
      this.W = W; this.H = H;
      const k = W / 1512; // 1 unit = 1 CSS px at the 1512 design width
      this.k = k;
      const hz = Math.round(H * 0.6);
      this.hz = hz;
      const r = RNG(1987);
      const lights = [];

      // ---- backdrop (static, above horizon) ----
      const B = mk(W, H);
      const b = B.getContext('2d');
      paintSky(b, W, H, hz, {
        sky: [[0, '#020309'], [0.32, '#060821'], [0.55, '#110c31'], [0.74, '#2a1245'], [0.9, '#5c1c55'], [0.975, '#9a2f62'], [1, '#c4466b']],
        glows: [
          { x: 0.64, y: 0.6, r: 0.62, sy: 0.32, c: 'rgba(255,86,130,0.55)' },
          { x: 0.7, y: 0.6, r: 0.3, sy: 0.35, c: 'rgba(255,160,96,0.30)' },
          { x: 0.2, y: 0.6, r: 0.4, sy: 0.25, c: 'rgba(140,90,255,0.25)' },
        ],
      });
      paintStars(b, W, hz * 0.62, 340, r, k, 0.8);
      paintOrb(b, 0.735 * W, 0.135 * H, 19 * k, { core: '#fffaf1', edge: '#ead7b8', halo: '#ffe6d2', haloA: 0.2, haloR: 9, craters: true });
      const cl = paintClouds(b, W, H, { n: 30, y0: 0.1, y1: 0.57, bias: 0.7, rx: [170, 520], top: '#2a285a', low: '#ff6f8e', a: 0.2 }, r, k);
      b.drawImage(cl, 0, 0, W, H);

      // far city (hazy)
      const F = mk(W, H), f = F.getContext('2d');
      paintSkyline(f, W, H, hz, {
        x0: 0.0, x1: 1.0, bw: [10, 28], gap: [0.5, 1.0], h: [0.01, 0.05],
        clusters: [{ c: 0.62, w: 0.22, h: 0.11 }, { c: 0.25, w: 0.12, h: 0.04 }],
        body: ['#1d1335', '#170f2b'], windows: true, winScale: 0.7, lit: 0.22, warm: 0.7, neon: ['#ff4f93', '#48e2ff'], lightProb: 0,
      }, r, k, null);
      f.globalCompositeOperation = 'source-atop';
      f.fillStyle = vgrad(f, hz - H * 0.2, hz, [[0, 'rgba(120,60,140,0.35)'], [1, 'rgba(255,110,140,0.45)']]);
      f.fillRect(0, 0, W, H);
      b.drawImage(F, 0, 0);

      // main city
      const M = mk(W, H), m = M.getContext('2d');
      const city = paintSkyline(m, W, H, hz, {
        x0: 0.3, x1: 1.02, bw: [24, 64], gap: [0.55, 1.05], h: [0.012, 0.05],
        clusters: [{ c: 0.68, w: 0.13, h: 0.25 }, { c: 0.82, w: 0.08, h: 0.16 }, { c: 0.5, w: 0.08, h: 0.12 }, { c: 0.95, w: 0.06, h: 0.07 }],
        body: ['#0b0a19', '#07060f'], windows: true, winScale: 1, lit: 0.42, warm: 0.62,
        neon: ['#ff4f93', '#48e2ff', '#9d7bff', '#ffb35c', '#ff4f93'], neonCount: 7, wash: 0.32, rim: '#ff7ab0', bandProb: 0.16, lightProb: 0.05,
      }, r, k, lights);
      // low-rise left (Miami Beach-like)
      paintSkyline(m, W, H, hz, {
        x0: 0.0, x1: 0.32, bw: [16, 44], gap: [0.6, 1.1], h: [0.008, 0.03],
        clusters: [{ c: 0.14, w: 0.06, h: 0.05 }],
        body: ['#0b0a17', '#07060e'], windows: true, winScale: 0.9, lit: 0.35, warm: 0.75,
        neon: ['#ff4f93', '#48e2ff', '#ffb35c'], neonCount: 0, wash: 0.25, rim: '#9d7bff', bandProb: 0.08, lightProb: 0.04,
      }, r, k, lights);
      this.tops = city.tops.slice(0, 7);
      // bloom on city lights
      const glow = mk(W / 2, H / 2), gctx = glow.getContext('2d');
      gctx.filter = `blur(${6 * k}px)`;
      gctx.drawImage(M, 0, 0, W / 2, H / 2);
      b.drawImage(M, 0, 0);
      b.save(); b.globalCompositeOperation = 'lighter'; b.globalAlpha = 0.55; b.drawImage(glow, 0, 0, W, H); b.restore();
      // horizon haze over city base
      b.save(); b.globalCompositeOperation = 'screen';
      b.fillStyle = vgrad(b, hz - H * 0.09, hz, [[0, 'rgba(255,110,150,0)'], [1, 'rgba(255,120,150,0.22)']]);
      b.fillRect(0, hz - H * 0.09, W, H * 0.09);
      b.restore();
      shoreline(b, W, H, hz, k, r, { land: '#050409', landH: 4, tinyPalms: 26 });
      dither(b, W, hz + 4, 3, 11);
      this.backdrop = B;

      // ---- water ----
      this.wbase = waterBase(W, H, hz, { water: [[0, '#3a1640'], [0.08, '#1a0d2c'], [0.35, '#0a0817'], [1, '#030308']] });
      this.wsrc = buildWaterSource(W, H, hz, B, lights, { squash: 0.92, blur: 1.6, alpha: [0.85, 0.5, 0.2], streak: 1.2, streakA: 0.6, seed: 9 }, k);

      // ---- bridge (mid-ground, near end bottom-right) ----
      const BR = mk(W, H), brc = BR.getContext('2d');
      const blights = [];
      this.bridge = paintBridge(brc, W, H, {
        p0: [1.08, 0.86], p1: [0.74, 0.69], p2: [0.4, hz / H + 0.004],
        thick: [0.016, 0.0016], pierStep: 12, pierH: 1.6, lampStep: 11, lamp: '#ffc477', edge: '#ffd2a8',
        deck: '#06060b', pier: '#04040a',
      }, k, blights);
      // bridge lamp reflections
      const BL = mk(W, H - hz), blc = BL.getContext('2d');
      blc.globalCompositeOperation = 'lighter';
      const r2 = RNG(41);
      for (const L of blights) {
        const y0 = L.wl - hz;
        const len = (40 + L.i * 90) * k;
        for (let y = y0; y < y0 + len && y < H - hz; y += (1.5 + r2() * 2.5) * k) {
          const u = (y - y0) / len;
          const a = Math.pow(1 - u, 1.8) * (0.2 + r2() * 0.6) * 0.65;
          const ww = (1.5 + r2() * 3) * k * (1 + (y / (H - hz)) * 1.5);
          blc.fillStyle = rgba(L.c, a);
          blc.fillRect(L.x - ww / 2 + (r2() - 0.5) * 2 * k, y, ww, Math.max(1, 1.1 * k));
        }
      }
      this.bridgeRefl = BL;
      this.bridgeLayer = BR;
      this.carHead = glowSprite('#fff0c8', 64);
      this.carTail = glowSprite('#ff2a2a', 64);
      const rc = RNG(77);
      this.cars = [];
      for (let i = 0; i < 46; i++) this.cars.push({ phase: rc(), speed: 0.022 + rc() * 0.018, dir: rc() < 0.5 ? 1 : -1, lane: rc() });

      // ---- palms (foreground) ----
      this.palms = [
        { x: 0.958, y: 1.05, h: 1.22, lean: -0.1, seed: 37, phase: 2.6, fronds: 15 },
        { x: 1.04, y: 1.07, h: 0.98, lean: -0.17, seed: 11, phase: 0.3, fronds: 13 },
      ];
      // ---- vignette (static overlay) ----
      const V = mk(W, H), v = V.getContext('2d');
      vignette(v, W, H, 0.55, 0.32);
      this.vign = V;
      // star twinkle subset
      this.twinkle = [];
      const rt = RNG(5);
      for (let i = 0; i < 26; i++) this.twinkle.push({ x: rt() * W, y: Math.pow(rt(), 1.6) * hz * 0.5, s: (0.8 + rt() * 1.1) * k, p: rt() * TAU, f: 0.6 + rt() * 1.6 });
      this.ready = true;
    }

    draw(t, opts) {
      if (!this.ready) return;
      opts = opts || {};
      const { W, H, hz, k } = this;
      const ctx = this.ctx;
      const intro = clamp(opts.intro == null ? 1 : opts.intro, 0, 1);
      const fade = clamp(opts.fade == null ? 1 : opts.fade, 0, 1);
      const scrollPx = (opts.scroll || 0) * (opts.dpr || 2);
      // camera: slow push-out on load + gentle drift + scroll parallax
      const push = 1 + 0.11 * Math.pow(1 - intro, 3) + 0.018 * Math.sin(t * 0.05);
      const scale = push * (1 + scrollPx / H * 0.08);
      const fx = W * 0.62, fy = H * 0.55;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#020205'; ctx.fillRect(0, 0, W, H);
      ctx.setTransform(scale, 0, 0, scale, fx - fx * scale + Math.sin(t * 0.07) * 6 * k, fy - fy * scale + scrollPx * 0.42);

      // sky + city
      ctx.drawImage(this.backdrop, 0, 0, W, hz + 4, 0, 0, W, hz + 4);
      // twinkling stars
      for (const s of this.twinkle) {
        const a = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * s.f * 2.2 + s.p), 3);
        ctx.fillStyle = `rgba(255,248,236,${(a * 0.8).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, TAU); ctx.fill();
      }
      // aviation lights (blink)
      for (let i = 0; i < this.tops.length; i++) {
        const tp = this.tops[i];
        const ph = (t * 0.62 + i * 0.37) % 1;
        const on = ph < 0.16 ? Math.sin((ph / 0.16) * Math.PI) : 0;
        if (on > 0.01) {
          const R = 9 * k;
          const g = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, R);
          g.addColorStop(0, `rgba(255,235,235,${on})`); g.addColorStop(0.25, `rgba(255,40,50,${0.8 * on})`); g.addColorStop(1, 'rgba(255,40,50,0)');
          ctx.fillStyle = g; ctx.fillRect(tp.x - R, tp.y - R, R * 2, R * 2);
        }
      }
      // water
      drawWater(ctx, W, H, hz, this.wsrc, this.wbase, t, { amp: 1 }, k);
      // bridge reflections (shimmer)
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 2.3);
      ctx.drawImage(this.bridgeRefl, 0, hz);
      ctx.globalAlpha = 1;
      // sparkles on the water
      const sr = RNG(Math.floor(t * 9) + 13);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 90; i++) {
        const x = W * (0.3 + sr() * 0.7), y = hz + Math.pow(sr(), 1.7) * (H - hz) * 0.7;
        const a = sr() * 0.35;
        ctx.fillStyle = sr() < 0.5 ? `rgba(255,170,200,${a})` : `rgba(255,220,170,${a})`;
        ctx.fillRect(x, y, (2 + sr() * 7) * k, 0.9 * k);
      }
      ctx.globalCompositeOperation = 'source-over';
      // bridge + traffic
      ctx.drawImage(this.bridgeLayer, 0, 0);
      const br = this.bridge;
      ctx.globalCompositeOperation = 'lighter';
      for (const car of this.cars) {
        let s = (car.phase + t * car.speed) % 1;
        if (car.dir < 0) s = 1 - s;
        const u = Math.pow(s, 1.35);
        const th = lerp(0.016, 0.0016, Math.pow(u, 0.7)) * H;
        const size = Math.max(3.5 * k, th * 1.5);
        const spr = car.dir < 0 ? this.carHead : this.carTail;
        for (let j = 0; j < 4; j++) {
          const uu = Math.pow(clamp(s - car.dir * j * 0.0035, 0, 1), 1.35);
          const p = bez(br.P0, br.P1, br.P2, uu);
          const tt = lerp(0.016, 0.0016, Math.pow(uu, 0.7)) * H;
          const yy = p[1] - tt * (0.12 + car.lane * 0.28);
          ctx.globalAlpha = 0.95 * (1 - j * 0.24);
          const sz = size * (1 - j * 0.12);
          ctx.drawImage(spr, p[0] - sz / 2, yy - sz / 2, sz, sz);
        }
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
      // foreground palms
      for (const pm of this.palms) {
        paintPalm(ctx, pm.x * W, pm.y * H, pm.h * H * 0.62, pm.lean, k, t, { seed: pm.seed, phase: pm.phase, fronds: pm.fronds, leaves: 30, frond: 0.42, color: '#020204', ringColor: '#1c1426' });
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.vign, 0, 0);
      // intro fade from black
      if (fade < 1) {
        ctx.fillStyle = `rgba(0,0,0,${(1 - smooth(fade)).toFixed(4)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  /* ===================================================================
     STATIC SCENES for cards / thumbnails
     =================================================================== */
  function scene(canvas, name) {
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    const k = W / 760;
    const r = RNG(name.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);
    const lights = [];

    const cityScene = (o) => {
      const hz = Math.round(H * o.hz);
      const B = mk(W, H), b = B.getContext('2d');
      paintSky(b, W, H, hz, o);
      if (o.stars) paintStars(b, W, hz * 0.7, o.stars, r, k, 0.7);
      if (o.orb) paintOrb(b, o.orb.x * W, o.orb.y * H, o.orb.r * W, o.orb);
      if (o.clouds) b.drawImage(paintClouds(b, W, H, o.clouds, r, k), 0, 0, W, H);
      if (o.far) {
        const F = mk(W, H), f = F.getContext('2d');
        paintSkyline(f, W, H, hz, o.far, r, k, null);
        f.globalCompositeOperation = 'source-atop'; f.fillStyle = o.farHaze; f.fillRect(0, 0, W, H);
        b.drawImage(F, 0, 0);
      }
      if (o.city) {
        const M = mk(W, H), m = M.getContext('2d');
        paintSkyline(m, W, H, hz, o.city, r, k, lights);
        const gl = mk(W / 2, H / 2), g = gl.getContext('2d');
        g.filter = `blur(${5 * k}px)`; g.drawImage(M, 0, 0, W / 2, H / 2);
        b.drawImage(M, 0, 0);
        b.save(); b.globalCompositeOperation = 'lighter'; b.globalAlpha = 0.5; b.drawImage(gl, 0, 0, W, H); b.restore();
      }
      if (o.extra) o.extra(b, hz);
      shoreline(b, W, H, hz, k, r, { land: o.land || '#050409', landH: 3, tinyPalms: o.tinyPalms || 0 });
      ctx.drawImage(B, 0, 0);
      const base = waterBase(W, H, hz, { water: o.water });
      const src = buildWaterSource(W, H, hz, B, lights, { squash: 0.9, blur: 1.2, alpha: o.reflA || [0.8, 0.45, 0.15], streak: 1, streakA: 0.55 }, k);
      drawWater(ctx, W, H, hz, src, base, 0.7, { amp: 0.8 }, k);
      if (o.post) o.post(ctx, hz);
      for (const p of o.palms || []) paintPalm(ctx, p.x * W, p.y * H, p.h * H, p.lean, k, 0.5, { seed: p.seed || 3, fronds: p.f || 12, leaves: 24, frond: 0.5, color: o.palmColor || '#030306', ringColor: '#191422' });
      vignette(ctx, W, H, o.vig == null ? 0.5 : o.vig, 0.3);
    };

    const NEON = ['#ff4f93', '#48e2ff', '#9d7bff', '#ffb35c'];

    switch (name) {
      case 'vice':
        cityScene({
          hz: 0.62, stars: 120,
          sky: [[0, '#03040c'], [0.5, '#120c33'], [0.85, '#4a1650'], [1, '#b73d69']],
          glows: [{ x: 0.5, y: 0.62, r: 0.9, sy: 0.35, c: 'rgba(255,90,140,0.5)' }],
          orb: { x: 0.72, y: 0.17, r: 0.045, core: '#fff8ee', edge: '#e8d4b4', halo: '#ffe2d0', haloA: 0.2, craters: true },
          far: { x0: 0, x1: 1, bw: [12, 26], gap: [0.5, 0.9], h: [0.02, 0.06], clusters: [{ c: 0.5, w: 0.3, h: 0.1 }], body: ['#1b1233', '#160f2a'], windows: false, neon: NEON },
          farHaze: 'rgba(160,70,140,0.35)',
          city: { x0: 0, x1: 1, bw: [34, 80], gap: [0.6, 1], h: [0.02, 0.08], clusters: [{ c: 0.5, w: 0.25, h: 0.3 }], body: ['#0b0a19', '#07060f'], windows: true, winScale: 1.2, lit: 0.45, warm: 0.6, neon: NEON, neonCount: 4, wash: 0.4, rim: '#ff7ab0', bandProb: 0.18, lightProb: 0.08 },
          water: [[0, '#3a1640'], [0.15, '#160b28'], [1, '#030308']],
          palms: [{ x: 0.05, y: 1.03, h: 0.62, lean: 0.12, seed: 4 }, { x: 0.98, y: 1.04, h: 0.5, lean: -0.1, seed: 9 }],
        });
        break;
      case 'leonida-wide':
        cityScene({
          hz: 0.6, stars: 60,
          sky: [[0, '#0b1030'], [0.38, '#2c1f57'], [0.62, '#7a3466'], [0.82, '#e0625e'], [0.95, '#ffad6b'], [1, '#ffd394']],
          glows: [{ x: 0.36, y: 0.61, r: 0.6, sy: 0.35, c: 'rgba(255,170,100,0.6)' }, { x: 0.36, y: 0.6, r: 0.12, sy: 0.6, c: 'rgba(255,236,200,0.6)' }],
          clouds: { n: 26, y0: 0.15, y1: 0.55, rx: [140, 420], top: '#3c2c6a', low: '#ff8f7a', a: 0.4 },
          far: { x0: 0.5, x1: 1, bw: [12, 26], gap: [0.5, 0.9], h: [0.01, 0.04], clusters: [{ c: 0.78, w: 0.12, h: 0.08 }], body: ['#5a2c5c', '#4a2450'], windows: false, neon: NEON },
          farHaze: 'rgba(255,140,120,0.3)',
          city: { x0: 0.56, x1: 1.02, bw: [26, 60], gap: [0.6, 1], h: [0.01, 0.04], clusters: [{ c: 0.8, w: 0.1, h: 0.22 }, { c: 0.66, w: 0.05, h: 0.1 }], body: ['#1c1230', '#120c22'], windows: true, winScale: 1, lit: 0.2, warm: 0.85, neon: NEON, neonCount: 2, wash: 0.2, rim: '#ffb07a', bandProb: 0.1, lightProb: 0.05 },
          water: [[0, '#b65a5e'], [0.08, '#5a2a4e'], [0.4, '#1a1030'], [1, '#05040c']],
          reflA: [0.9, 0.55, 0.2],
          post: (c, hz) => {
            // sun glitter path
            const rr = RNG(3);
            c.save(); c.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 520; i++) {
              const y = hz + Math.pow(rr(), 1.4) * (H - hz);
              const spread = (6 + (y - hz) * 0.32) * (rr() - 0.5) * 2;
              const a = (1 - (y - hz) / (H - hz)) * 0.45 * rr();
              c.fillStyle = `rgba(255,${190 + Math.floor(rr() * 50)},${120 + Math.floor(rr() * 60)},${a})`;
              c.fillRect(W * 0.36 + spread, y, (2 + rr() * 9) * k, 1.1 * k);
            }
            c.restore();
          },
          palms: [{ x: 0.04, y: 1.04, h: 0.78, lean: 0.14, seed: 5, f: 14 }, { x: 0.14, y: 1.06, h: 0.55, lean: 0.06, seed: 8 }],
          palmColor: '#0a0610', vig: 0.45,
        });
        break;
      case 'keys': {
        cityScene({
          hz: 0.56, stars: 50,
          sky: [[0, '#08142e'], [0.45, '#1f3d6b'], [0.78, '#5f6f9a'], [0.93, '#e6a07f'], [1, '#ffc79a']],
          glows: [{ x: 0.7, y: 0.57, r: 0.6, sy: 0.3, c: 'rgba(255,190,140,0.45)' }],
          clouds: { n: 18, y0: 0.2, y1: 0.5, rx: [160, 380], top: '#2c3f6e', low: '#ffb39a', a: 0.35 },
          water: [[0, '#d39a86'], [0.1, '#4f6f8f'], [0.45, '#13324a'], [1, '#04101a']],
          reflA: [0.7, 0.4, 0.1],
          extra: (b, hz) => {
            // small islands
            b.fillStyle = '#0d1424';
            for (const [cx, w] of [[0.18, 0.12], [0.84, 0.08]]) {
              b.beginPath(); b.ellipse(cx * W, hz, w * W, 10 * k, 0, Math.PI, 0); b.fill();
              for (let i = 0; i < 5; i++) paintPalm(b, (cx + (r() - 0.5) * w) * W, hz - 2 * k, (14 + r() * 12) * k, (r() - 0.5) * 0.4, k * 0.5, 0, { fronds: 9, leaves: 10, seed: i + 3, rings: false, color: '#0d1424' });
            }
          },
          post: (c, hz) => {
            paintBridge(c, W, H, { p0: [-0.1, 0.84], p1: [0.35, 0.62], p2: [0.78, hz / H + 0.003], thick: [0.03, 0.002], pierStep: 7, pierH: 1.4, lampStep: 9, lamp: '#ffd08a', edge: '#ffc2a0', deck: '#0b1220', pier: '#09101c' }, k, null);
          },
          palms: [{ x: 0.95, y: 1.04, h: 0.6, lean: -0.12, seed: 21 }],
          palmColor: '#050913',
        });
        break;
      }
      case 'grassrivers': {
        const hz = Math.round(H * 0.58);
        paintSky(ctx, W, H, hz, {
          sky: [[0, '#02070a'], [0.5, '#06171b'], [0.85, '#123a36'], [1, '#2f5a46']],
          glows: [{ x: 0.62, y: 0.25, r: 0.5, sy: 0.9, c: 'rgba(170,230,210,0.16)' }],
        });
        paintStars(ctx, W, hz * 0.7, 140, r, k, 0.8);
        paintOrb(ctx, 0.62 * W, 0.25 * H, 0.06 * W, { core: '#f4fff8', edge: '#cfe4d8', halo: '#c6f0dc', haloA: 0.22, haloR: 6, craters: true });
        // distant hammock tree line
        ctx.fillStyle = '#031210';
        ctx.beginPath(); ctx.moveTo(0, hz);
        for (let x = 0; x <= W; x += 3 * k) ctx.lineTo(x, hz - (6 + 10 * Math.abs(Math.sin(x * 0.011 / k)) + 14 * Math.pow(Math.abs(Math.sin(x * 0.0037 / k + 1)), 3) + r() * 4) * k);
        ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
        // water + moon path
        ctx.fillStyle = vgrad(ctx, hz, H, [[0, '#183a33'], [0.3, '#08191a'], [1, '#020607']]); ctx.fillRect(0, hz, W, H - hz);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 260; i++) {
          const y = hz + Math.pow(r(), 1.3) * (H - hz) * 0.85;
          const s = (4 + (y - hz) * 0.12) * (r() - 0.5) * 2;
          ctx.fillStyle = `rgba(200,255,230,${(1 - (y - hz) / (H - hz)) * 0.4 * r()})`;
          ctx.fillRect(0.62 * W + s, y, (3 + r() * 8) * k, 1.1 * k);
        }
        ctx.globalCompositeOperation = 'source-over';
        // fog bands
        for (let i = 0; i < 5; i++) {
          const y = hz + (r() - 0.3) * 30 * k;
          const g = ctx.createLinearGradient(0, y - 18 * k, 0, y + 18 * k);
          g.addColorStop(0, 'rgba(180,230,210,0)'); g.addColorStop(0.5, `rgba(180,230,210,${0.06 + r() * 0.07})`); g.addColorStop(1, 'rgba(180,230,210,0)');
          ctx.fillStyle = g; ctx.fillRect(0, y - 18 * k, W, 36 * k);
        }
        // sawgrass
        ctx.strokeStyle = '#010504';
        for (let i = 0; i < 900; i++) {
          const x = r() * W, by = H - Math.pow(r(), 2) * H * 0.22;
          const hh = (30 + r() * 120) * k * (by / H);
          ctx.lineWidth = (0.6 + r() * 1.4) * k;
          ctx.beginPath(); ctx.moveTo(x, by); ctx.quadraticCurveTo(x + (r() - 0.5) * 10 * k, by - hh * 0.6, x + (r() - 0.5) * 26 * k, by - hh); ctx.stroke();
        }
        vignette(ctx, W, H, 0.55, 0.3);
        break;
      }
      case 'port': {
        cityScene({
          hz: 0.64, stars: 30,
          sky: [[0, '#07070b'], [0.5, '#1a1214'], [0.85, '#5a2e1c'], [1, '#c26a2c']],
          glows: [{ x: 0.5, y: 0.64, r: 0.8, sy: 0.3, c: 'rgba(255,140,60,0.5)' }],
          water: [[0, '#6a3a1e'], [0.12, '#2a1810'], [1, '#050404']],
          reflA: [0.8, 0.45, 0.12],
          extra: (b, hz) => {
            // container stacks
            const cols = ['#3a2a22', '#2c3a44', '#4a2626', '#3b3b2a', '#2a2a3a'];
            for (let x = 0; x < W; x += 22 * k) {
              const stack = Math.floor(r() * 4);
              for (let j = 0; j < stack; j++) { b.fillStyle = mix(pick(r, cols), '#000000', 0.55); b.fillRect(x, hz - (j + 1) * 9 * k, 20 * k, 8 * k); }
            }
            // gantry cranes
            b.strokeStyle = '#0b0807'; b.fillStyle = '#0b0807';
            for (const cx of [0.16, 0.42, 0.66, 0.88]) {
              const x = cx * W, hh = (150 + r() * 60) * k, w = 46 * k;
              b.lineWidth = 4 * k;
              b.beginPath(); b.moveTo(x - w / 2, hz); b.lineTo(x - w / 2, hz - hh); b.moveTo(x + w / 2, hz); b.lineTo(x + w / 2, hz - hh); b.stroke();
              b.lineWidth = 2 * k;
              for (let y = hz - 20 * k; y > hz - hh; y -= 26 * k) { b.beginPath(); b.moveTo(x - w / 2, y); b.lineTo(x + w / 2, y - 26 * k); b.stroke(); }
              b.fillRect(x - w * 1.6, hz - hh - 8 * k, w * 3.8, 8 * k);
              b.lineWidth = 1.2 * k; b.beginPath(); b.moveTo(x, hz - hh - 8 * k); b.lineTo(x, hz - hh - 40 * k); b.lineTo(x - w * 1.6, hz - hh - 8 * k); b.moveTo(x, hz - hh - 40 * k); b.lineTo(x + w * 2.2, hz - hh - 8 * k); b.stroke();
              const g = b.createRadialGradient(x, hz - hh - 40 * k, 0, x, hz - hh - 40 * k, 8 * k);
              g.addColorStop(0, 'rgba(255,220,220,1)'); g.addColorStop(0.3, 'rgba(255,40,40,.8)'); g.addColorStop(1, 'rgba(255,40,40,0)');
              b.fillStyle = g; b.fillRect(x - 8 * k, hz - hh - 48 * k, 16 * k, 16 * k); b.fillStyle = '#0b0807';
            }
            // sodium lamps
            for (let x = 10 * k; x < W; x += 34 * k) {
              const g = b.createRadialGradient(x, hz - 40 * k, 0, x, hz - 40 * k, 26 * k);
              g.addColorStop(0, 'rgba(255,230,180,.9)'); g.addColorStop(0.15, 'rgba(255,160,70,.55)'); g.addColorStop(1, 'rgba(255,140,60,0)');
              b.fillStyle = g; b.fillRect(x - 26 * k, hz - 66 * k, 52 * k, 52 * k);
              lights.push({ x, y: hz - 40 * k, c: '#ffae5c', i: 0.6 });
            }
          },
          land: '#070505',
          palms: [{ x: 0.02, y: 1.04, h: 0.5, lean: 0.1, seed: 31 }],
          palmColor: '#050303',
        });
        break;
      }
      case 'ambrosia': {
        const hz = Math.round(H * 0.66);
        paintSky(ctx, W, H, hz, {
          sky: [[0, '#1a0f22'], [0.35, '#5c2236'], [0.7, '#d4593a'], [0.9, '#ffa24f'], [1, '#ffd37e']],
          glows: [{ x: 0.5, y: 0.6, r: 0.7, sy: 0.5, c: 'rgba(255,190,110,0.5)' }],
        });
        paintOrb(ctx, 0.5 * W, 0.58 * H, 0.12 * W, { core: '#fff3d0', edge: '#ffb45e', halo: '#ffc27a', haloA: 0.35, haloR: 3 });
        // heat haze bands
        for (let i = 0; i < 7; i++) { ctx.fillStyle = `rgba(255,200,140,${0.05 + r() * 0.05})`; ctx.fillRect(0, hz - (8 + i * 9 + r() * 4) * k, W, (1 + r() * 2) * k); }
        // land
        ctx.fillStyle = vgrad(ctx, hz, H, [[0, '#2a1218'], [1, '#07040a']]); ctx.fillRect(0, hz, W, H - hz);
        // water tower, silos, power lines
        ctx.fillStyle = '#12080c'; ctx.strokeStyle = '#12080c';
        const tx = 0.24 * W;
        ctx.lineWidth = 2.4 * k;
        ctx.beginPath(); ctx.moveTo(tx - 16 * k, hz); ctx.lineTo(tx - 9 * k, hz - 90 * k); ctx.moveTo(tx + 16 * k, hz); ctx.lineTo(tx + 9 * k, hz - 90 * k); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(tx, hz - 104 * k, 28 * k, 20 * k, 0, 0, TAU); ctx.fill();
        ctx.fillRect(tx - 2 * k, hz - 132 * k, 4 * k, 12 * k);
        for (const [sx, sw, sh] of [[0.7, 22, 120], [0.75, 22, 104], [0.8, 26, 140]]) {
          ctx.fillRect(sx * W, hz - sh * k, sw * k, sh * k);
          ctx.beginPath(); ctx.ellipse(sx * W + sw * k / 2, hz - sh * k, sw * k / 2, 6 * k, 0, Math.PI, 0); ctx.fill();
        }
        ctx.lineWidth = 1 * k;
        for (const px of [0.05, 0.38, 0.6, 0.95]) {
          ctx.fillRect(px * W - 1.5 * k, hz - 70 * k, 3 * k, 70 * k); ctx.fillRect(px * W - 12 * k, hz - 66 * k, 24 * k, 2.4 * k);
        }
        for (const off of [-10, 0, 10]) {
          ctx.beginPath(); ctx.moveTo(0.05 * W + off * k, hz - 65 * k);
          ctx.quadraticCurveTo(0.215 * W, hz - 48 * k, 0.38 * W + off * k, hz - 65 * k);
          ctx.quadraticCurveTo(0.49 * W, hz - 50 * k, 0.6 * W + off * k, hz - 65 * k);
          ctx.quadraticCurveTo(0.775 * W, hz - 48 * k, 0.95 * W + off * k, hz - 65 * k); ctx.stroke();
        }
        paintPalm(ctx, 0.9 * W, H * 1.02, H * 0.55, -0.1, k, 0.5, { seed: 7, fronds: 12, leaves: 22, color: '#0c0508', ringColor: '#24121a' });
        vignette(ctx, W, H, 0.5, 0.3);
        break;
      }
      case 'kalaga': {
        const hz = Math.round(H * 0.7);
        paintSky(ctx, W, H, hz, {
          sky: [[0, '#070a1c'], [0.45, '#22204a'], [0.75, '#6a3f6a'], [0.92, '#d8846a'], [1, '#f6b486']],
          glows: [{ x: 0.3, y: 0.68, r: 0.6, sy: 0.4, c: 'rgba(255,170,130,0.35)' }],
        });
        paintStars(ctx, W, H * 0.45, 160, r, k, 0.85);
        paintOrb(ctx, 0.74 * W, 0.16 * H, 0.03 * W, { core: '#fffaf0', edge: '#efe0c4', halo: '#ffe8d0', haloA: 0.18, crescent: 0.42 });
        const ridges = [['#6b4a78', 0.52, 0.06], ['#4a3460', 0.58, 0.08], ['#2c2142', 0.66, 0.1], ['#171328', 0.76, 0.12], ['#0a0814', 0.88, 0.1]];
        ridges.forEach(([col, y, amp], i) => {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.moveTo(0, H);
          const ph = r() * 10;
          for (let x = 0; x <= W; x += 4 * k) {
            const u = x / W;
            const yy = y * H - (Math.sin(u * 5 + ph) * 0.5 + Math.sin(u * 13 + ph * 2) * 0.22 + Math.sin(u * 31 + ph) * 0.06 + 0.5) * amp * H;
            ctx.lineTo(x, yy);
          }
          ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
          if (i >= 3) {
            // pines along ridge
            for (let x = 0; x < W; x += (5 + r() * 9) * k) {
              const u = x / W;
              const yy = y * H - (Math.sin(u * 5 + ph) * 0.5 + Math.sin(u * 13 + ph * 2) * 0.22 + Math.sin(u * 31 + ph) * 0.06 + 0.5) * amp * H;
              const th = (12 + r() * 22) * k * (i === 4 ? 1.6 : 1);
              ctx.beginPath(); ctx.moveTo(x, yy - th); ctx.lineTo(x - th * 0.28, yy + 2 * k); ctx.lineTo(x + th * 0.28, yy + 2 * k); ctx.closePath(); ctx.fill();
            }
          }
          // atmospheric mist between ridges
          ctx.fillStyle = vgrad(ctx, y * H - amp * H, y * H + 20 * k, [[0, 'rgba(255,190,160,0)'], [1, 'rgba(255,190,170,0.08)']]);
          ctx.fillRect(0, y * H - amp * H, W, amp * H + 20 * k);
        });
        vignette(ctx, W, H, 0.5, 0.3);
        break;
      }
      case 'extended':
        cityScene({
          hz: 0.66, stars: 0,
          sky: [[0, '#2a1240'], [0.4, '#7a2a5e'], [0.75, '#ff6b6b'], [0.92, '#ffb36b'], [1, '#ffe0a0']],
          glows: [{ x: 0.62, y: 0.64, r: 0.5, sy: 0.4, c: 'rgba(255,220,150,0.6)' }],
          orb: { x: 0.62, y: 0.63, r: 0.07, core: '#fff7d6', edge: '#ffc070', halo: '#ffd090', haloA: 0.4, haloR: 3 },
          clouds: { n: 16, y0: 0.2, y1: 0.55, rx: [160, 420], top: '#5a2a6a', low: '#ffb08a', a: 0.4 },
          city: { x0: 0, x1: 0.48, bw: [40, 90], gap: [0.75, 1.05], h: [0.03, 0.09], clusters: [{ c: 0.2, w: 0.2, h: 0.08 }], body: ['#2a1630', '#1d0f22'], windows: true, winScale: 1.3, lit: 0.18, warm: 0.9, neon: ['#ff4f93', '#48e2ff'], neonCount: 3, wash: 0.3, rim: '#ffb07a', lightProb: 0.05 },
          water: [[0, '#ff9a7a'], [0.12, '#8a3a5e'], [0.5, '#2a1230'], [1, '#08040c']],
          reflA: [0.9, 0.5, 0.15],
          palms: [{ x: 0.86, y: 1.04, h: 0.7, lean: -0.08, seed: 12, f: 13 }, { x: 0.96, y: 1.06, h: 0.55, lean: -0.15, seed: 15 }],
          palmColor: '#12061a', vig: 0.4,
        });
        break;
      case 't2':
        cityScene({
          hz: 0.62, stars: 0,
          sky: [[0, '#3b1450'], [0.45, '#b03a6a'], [0.8, '#ff8a5c'], [1, '#ffd08a']],
          glows: [{ x: 0.42, y: 0.62, r: 0.6, sy: 0.4, c: 'rgba(255,200,140,0.55)' }],
          orb: { x: 0.42, y: 0.6, r: 0.08, core: '#fff3cf', edge: '#ffb070', halo: '#ffc890', haloA: 0.35, haloR: 3 },
          water: [[0, '#ffa07a'], [0.15, '#9a3a62'], [0.5, '#341434'], [1, '#0a040c']],
          reflA: [0.9, 0.5, 0.15],
          post: (c, hz) => {
            // speedboat wake
            const bx = 0.66 * W, by = hz + (H - hz) * 0.42;
            c.save(); c.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 80; i++) {
              const u = i / 80;
              const a = (1 - u) * 0.5;
              c.fillStyle = `rgba(255,235,220,${a})`;
              c.fillRect(bx - u * W * 0.5, by + u * 18 * k - u * u * 6 * k, 6 * k, 1.4 * k);
              c.fillRect(bx - u * W * 0.5, by + u * 34 * k, 6 * k, 1.2 * k);
            }
            c.restore();
            c.fillStyle = '#12060e';
            c.beginPath(); c.moveTo(bx - 4 * k, by + 4 * k); c.lineTo(bx + 30 * k, by + 6 * k); c.lineTo(bx + 24 * k, by + 12 * k); c.lineTo(bx - 2 * k, by + 11 * k); c.closePath(); c.fill();
          },
          palms: [{ x: 0.06, y: 1.04, h: 0.66, lean: 0.12, seed: 17, f: 13 }, { x: 0.93, y: 1.05, h: 0.6, lean: -0.12, seed: 19, f: 12 }],
          palmColor: '#14061a', vig: 0.42,
        });
        break;
      case 't1':
        cityScene({
          hz: 0.6, stars: 40,
          sky: [[0, '#0b0b2a'], [0.45, '#3a2463'], [0.78, '#a2507a'], [0.94, '#ff9a7a'], [1, '#ffc49a']],
          glows: [{ x: 0.3, y: 0.6, r: 0.6, sy: 0.35, c: 'rgba(255,170,130,0.5)' }],
          clouds: { n: 22, y0: 0.15, y1: 0.55, rx: [160, 420], top: '#3a2a6a', low: '#ffa08a', a: 0.45 },
          far: { x0: 0, x1: 1, bw: [12, 26], gap: [0.5, 0.9], h: [0.02, 0.05], clusters: [{ c: 0.65, w: 0.2, h: 0.08 }], body: ['#4a2a5a', '#3a2048'], windows: false, neon: NEON },
          farHaze: 'rgba(255,140,140,0.25)',
          city: { x0: 0.25, x1: 1, bw: [30, 70], gap: [0.6, 1], h: [0.02, 0.06], clusters: [{ c: 0.66, w: 0.15, h: 0.26 }], body: ['#1a1030', '#120a22'], windows: true, winScale: 1.2, lit: 0.3, warm: 0.8, neon: NEON, neonCount: 3, wash: 0.25, rim: '#ffa07a', lightProb: 0.06 },
          water: [[0, '#b0607a'], [0.12, '#4a2450'], [0.5, '#160c28'], [1, '#04030a']],
          palms: [{ x: 0.08, y: 1.05, h: 0.6, lean: 0.1, seed: 2 }],
          palmColor: '#0a0614', vig: 0.45,
        });
        break;
      case 'preload': {
        ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#0c0712'], [1, '#040306']]); ctx.fillRect(0, 0, W, H);
        const cx = W / 2, cy = H / 2;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
        g.addColorStop(0, 'rgba(255,79,147,0.28)'); g.addColorStop(0.5, 'rgba(141,107,255,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 4; i++) {
          ctx.strokeStyle = `rgba(239,211,152,${0.5 - i * 0.1})`; ctx.lineWidth = (1.4 - i * 0.2) * k;
          ctx.beginPath(); ctx.arc(cx, cy, H * (0.26 + i * 0.09), -Math.PI / 2, -Math.PI / 2 + TAU * (0.89 - i * 0.12)); ctx.stroke();
        }
        ctx.font = `500 ${Math.round(H * 0.3)}px "Bodoni Moda", serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tg = ctx.createLinearGradient(cx - H * 0.2, cy - H * 0.2, cx + H * 0.2, cy + H * 0.2);
        tg.addColorStop(0, '#fff1cf'); tg.addColorStop(0.5, '#d0a65c'); tg.addColorStop(1, '#f5deaa');
        ctx.shadowColor = 'rgba(239,211,152,0.5)'; ctx.shadowBlur = 24 * k;
        ctx.fillStyle = tg; ctx.fillText('VI', cx, cy + H * 0.02);
        ctx.shadowBlur = 0;
        for (let i = 0; i < 160; i++) {
          ctx.fillStyle = `rgba(255,${200 + Math.floor(r() * 55)},${200 + Math.floor(r() * 55)},${r() * 0.6})`;
          ctx.fillRect(r() * W, r() * H, 1.4 * k, 1.4 * k);
        }
        vignette(ctx, W, H, 0.6, 0.3);
        break;
      }
      case 'film': {
        // Neon boulevard at night with long-exposure light trails.
        const vx = W * 0.6, vy = H * 0.5;
        ctx.fillStyle = vgrad(ctx, 0, H, [[0, '#07051a'], [0.45, '#1a0a2e'], [0.5, '#3a1040'], [1, '#050308']]);
        ctx.fillRect(0, 0, W, H);
        const sg = ctx.createRadialGradient(vx, vy, 0, vx, vy, W * 0.4);
        sg.addColorStop(0, 'rgba(255,90,150,0.55)'); sg.addColorStop(0.4, 'rgba(140,80,255,0.18)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
        paintStars(ctx, W, H * 0.25, 60, r, k, 0.5);
        // receding buildings on both sides
        const sides = [-1, 1];
        for (const s of sides) {
          for (let i = 0; i < 16; i++) {
            const d0 = Math.pow(i / 16, 1.6), d1 = Math.pow((i + 0.85) / 16, 1.6);
            const xNear = s < 0 ? lerp(-0.1 * W, vx - 30 * k, d0) : lerp(1.1 * W, vx + 30 * k, d0);
            const xFar = s < 0 ? lerp(-0.1 * W, vx - 30 * k, d1) : lerp(1.1 * W, vx + 30 * k, d1);
            const hNear = (1 - d0) * H * (0.55 + r() * 0.35), hFar = (1 - d1) * H * (0.55 + r() * 0.35);
            const yNear = lerp(H * 1.05, vy, d0), yFar = lerp(H * 1.05, vy, d1);
            ctx.fillStyle = mix('#0b0816', '#1a1030', d0);
            ctx.beginPath(); ctx.moveTo(xNear, yNear); ctx.lineTo(xNear, yNear - hNear); ctx.lineTo(xFar, yFar - hFar); ctx.lineTo(xFar, yFar); ctx.closePath(); ctx.fill();
            // windows
            for (let j = 0; j < 14; j++) {
              if (r() < 0.45) continue;
              const u = r(), v = r();
              const x = lerp(xNear, xFar, u), yb = lerp(yNear, yFar, u), hh = lerp(hNear, hFar, u);
              ctx.fillStyle = rgba(r() < 0.7 ? '#ffd39a' : '#cfe8ff', 0.4 + r() * 0.5);
              ctx.fillRect(x, yb - hh * (0.1 + v * 0.8), Math.max(1, 3 * k * (1 - d0)), Math.max(1, 4 * k * (1 - d0)));
            }
            // neon signs
            if (r() < 0.55) {
              const col = pick(r, ['#ff4f93', '#48e2ff', '#9d7bff', '#ffb35c']);
              const u = 0.3 + r() * 0.4;
              const x = lerp(xNear, xFar, u), yb = lerp(yNear, yFar, u), hh = lerp(hNear, hFar, u);
              const sw = Math.max(2, 26 * k * (1 - d0)), sh = Math.max(2, 9 * k * (1 - d0));
              ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 18 * k * (1 - d0) + 4;
              ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.8, 2 * k * (1 - d0));
              ctx.strokeRect(x - sw / 2, yb - hh * 0.5, sw, sh);
              ctx.restore();
            }
          }
        }
        // road
        ctx.fillStyle = vgrad(ctx, vy, H, [[0, '#1a0c22'], [1, '#050307']]);
        ctx.beginPath(); ctx.moveTo(vx - 6 * k, vy); ctx.lineTo(vx + 6 * k, vy); ctx.lineTo(W * 1.3, H); ctx.lineTo(-W * 0.1, H); ctx.closePath(); ctx.fill();
        // wet reflections on the road
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 70; i++) {
          const u = r();
          const x = lerp(vx, r() < 0.5 ? -W * 0.1 : W * 1.3, u * r());
          const y = lerp(vy, H, u);
          ctx.fillStyle = rgba(pick(r, ['#ff4f93', '#48e2ff', '#ffb35c', '#9d7bff']), 0.08 + r() * 0.12);
          ctx.fillRect(x, y, (1 + u * 3) * k, (10 + u * 60) * k);
        }
        // light trails
        const trail = (x0, col, w, a) => {
          for (const [lw, aa] of [[w * 7, a * 0.08], [w * 3, a * 0.22], [w, a]]) {
            ctx.strokeStyle = rgba(col, aa); ctx.lineWidth = lw * k;
            ctx.beginPath(); ctx.moveTo(x0, H + 10 * k); ctx.bezierCurveTo(x0 + (vx - x0) * 0.35, H * 0.82, vx + (x0 - vx) * 0.12, vy + 12 * k, vx + (x0 - vx) * 0.01, vy + 1); ctx.stroke();
          }
        };
        const tr = RNG(8);
        for (let i = 0; i < 9; i++) trail(W * (0.02 + tr() * 0.32), '#ff2a3a', 1.6 + tr() * 2, 0.75);
        for (let i = 0; i < 9; i++) trail(W * (0.62 + tr() * 0.55), '#fff1d0', 1.6 + tr() * 2.2, 0.8);
        for (let i = 0; i < 3; i++) trail(W * (0.4 + tr() * 0.15), '#ffb35c', 1.2, 0.6);
        ctx.globalCompositeOperation = 'source-over';
        vignette(ctx, W, H, 0.6, 0.25);
        break;
      }
      default:
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
    }
  }

  G.ViceArt = { ViceHero, scene, RNG };
})(window);
