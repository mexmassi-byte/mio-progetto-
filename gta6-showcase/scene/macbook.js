// =============================================================================
// MacBook Pro 14" (Space Gray) on a dark walnut desk, studio lights, Safari chrome.
// Shared by scene.js (16:9 showcase) and mg.js (9:16 motion graphic).
// =============================================================================
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- helpers
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
export function roundedShape(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function buildMacbook({ renderer, TL, SW, SH, aspect }) {
  const { MBP } = TL;
  const baseTop = MBP.feet + MBP.baseT;
  const tilt = (MBP.tiltDeg * Math.PI) / 180;
  RectAreaLightUniformsLib.init();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.62);
  const camera = new THREE.PerspectiveCamera(26, aspect, 0.01, 30);
  let screenGlass = null;

  // ---------------------------------------------------------------- environment
  function buildEnvironment() {
    const pm = new THREE.PMREMGenerator(renderer);
    const s = new THREE.Scene();
    s.background = new THREE.Color(0x010102);
    const panel = (w, h, hex, k, pos, look) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(...pos); m.lookAt(...look); s.add(m);
    };
    panel(5, 1.6, 0xffffff, 2.4, [0, 3.2, -1.2], [0, 0, 0]);      // overhead softbox (behind)
    panel(0.6, 3.5, 0xdfe7ff, 1.4, [-3.2, 1.3, -1.4], [0, 0.3, 0]); // cool strip left
    panel(0.6, 3.5, 0xffe0c4, 1.2, [3.2, 1.3, -1.0], [0, 0.3, 0]);  // warm strip right
    panel(6, 1.0, 0xff4f93, 0.22, [0, 0.6, -4.5], [0, 0.3, 0]);     // faint city glow
    panel(4, 0.8, 0x48e2ff, 0.12, [-2.5, 0.6, 3.6], [0, 0.3, 0]);
    panel(3, 2.0, 0xffffff, 0.35, [0.8, 2.6, 2.6], [0, 0, 0]);      // soft front-top fill
    const env = pm.fromScene(s, 0.035).texture;
    pm.dispose();
    return env;
  }
  scene.environment = buildEnvironment();
  scene.environmentIntensity = 0.95;

  // ---------------------------------------------------------------- materials
  const alu = new THREE.MeshStandardMaterial({ color: new THREE.Color('#6d6e73'), metalness: 1, roughness: 0.33, fog: false });
  const aluDark = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a2a2d'), metalness: 0.6, roughness: 0.5, fog: false });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9, metalness: 0, fog: false });

  // ---------------------------------------------------------------- keyboard layout
  const U = 0.01835, GAP = 0.0025;
  const KB_W = 14.5 * U, KB_D = 6 * U;
  const KB_X0 = -KB_W / 2;
  const KB_Z0 = -MBP.D / 2 + 0.0165;      // back edge of keyboard (towards hinge)
  const TP_W = 0.1405, TP_D = 0.0805;
  const TP_Z0 = KB_Z0 + KB_D + 0.0085;
  const ROWS = [
    [['esc', 1.5], ['F1', 1], ['F2', 1], ['F3', 1], ['F4', 1], ['F5', 1], ['F6', 1], ['F7', 1], ['F8', 1], ['F9', 1], ['F10', 1], ['F11', 1], ['F12', 1], ['@touch', 1]],
    [['~|`', 1], ['!|1', 1], ['@|2', 1], ['#|3', 1], ['$|4', 1], ['%|5', 1], ['^|6', 1], ['&|7', 1], ['*|8', 1], ['(|9', 1], [')|0', 1], ['_|-', 1], ['+|=', 1], ['delete', 1.5]],
    [['tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1], ['U', 1], ['I', 1], ['O', 1], ['P', 1], ['{|[', 1], ['}|]', 1], ['||\\', 1]],
    [['caps lock', 1.75], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1], ['J', 1], ['K', 1], ['L', 1], [':|;', 1], ['"|\'', 1], ['return', 1.75]],
    [['shift', 2.25], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1], ['M', 1], ['<|,', 1], ['>|.', 1], ['?|/', 1], ['shift', 2.25]],
    [['fn', 1], ['control', 1], ['option', 1], ['command', 1.25], ['', 5], ['command', 1.25], ['option', 1], ['@left', 1], ['@updown', 1], ['@right', 1]],
  ];
  function keyRects() {
    const out = [];
    ROWS.forEach((row, ri) => {
      let x = KB_X0;
      for (const [label, w] of row) {
        const kw = w * U - GAP;
        const z = KB_Z0 + ri * U + GAP / 2;
        if (label === '@updown') {
          out.push({ label: '@up', x: x + GAP / 2, z, w: kw, d: (U - GAP) / 2 - 0.0004, row: ri });
          out.push({ label: '@down', x: x + GAP / 2, z: z + (U - GAP) / 2 + 0.0004, w: kw, d: (U - GAP) / 2 - 0.0004, row: ri });
        } else {
          out.push({ label, x: x + GAP / 2, z, w: kw, d: U - GAP, row: ri });
        }
        x += w * U;
      }
    });
    return out;
  }
  const KEYS = keyRects();

  // ---------------------------------------------------------------- textures
  // Deck (top of base): color, ORM (G=roughness, B=metalness) and emissive.
  const DECK_PX = 2048, DECK_PY = Math.round((DECK_PX * MBP.D) / MBP.W);
  const dx = (x) => ((x + MBP.W / 2) / MBP.W) * DECK_PX;
  const dz = (z) => ((z + MBP.D / 2) / MBP.D) * DECK_PY;
  const dm = (m) => (m / MBP.W) * DECK_PX;
  function deckTextures() {
    const col = canvas(DECK_PX, DECK_PY), orm = canvas(DECK_PX, DECK_PY), emi = canvas(DECK_PX, DECK_PY);
    const c = col.getContext('2d'), o = orm.getContext('2d'), e = emi.getContext('2d');
    c.fillStyle = '#6d6e73'; c.fillRect(0, 0, DECK_PX, DECK_PY);
    o.fillStyle = 'rgb(0,84,255)'; o.fillRect(0, 0, DECK_PX, DECK_PY);
    e.fillStyle = '#000'; e.fillRect(0, 0, DECK_PX, DECK_PY);
    // fine anodized grain
    const r = rng(4);
    for (let i = 0; i < 26000; i++) {
      c.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.025 + r() * 0.03})`;
      c.fillRect(r() * DECK_PX, r() * DECK_PY, 1.2, 1.2);
    }
    // keyboard well
    const pad = 0.0022;
    const kx = dx(KB_X0 - pad), kz = dz(KB_Z0 - pad), kw = dm(KB_W + 2 * pad), kd = dm(KB_D + 2 * pad);
    c.fillStyle = '#0b0b0d'; rrect(c, kx, kz, kw, kd, dm(0.003)); c.fill();
    o.fillStyle = 'rgb(0,200,0)'; rrect(o, kx, kz, kw, kd, dm(0.003)); o.fill();
    // backlight glow leaking around every key
    e.save();
    e.shadowColor = 'rgba(255,240,222,0.9)'; e.shadowBlur = dm(0.0016);
    e.strokeStyle = 'rgba(255,238,220,0.55)'; e.lineWidth = dm(0.0007);
    for (const k of KEYS) { rrect(e, dx(k.x), dz(k.z), dm(k.w), dm(k.d), dm(0.0015)); e.stroke(); }
    e.restore();
    // speaker grilles (perforations) flanking the keyboard
    const gw = 0.0118, gx = [KB_X0 - 0.0045 - gw, -KB_X0 + 0.0045];
    for (const x0 of gx) {
      for (let z = KB_Z0 + 0.0008; z < KB_Z0 + KB_D - 0.0004; z += 0.00072) {
        for (let x = x0; x < x0 + gw; x += 0.00072) {
          const off = (Math.round((z - KB_Z0) / 0.00072) % 2) * 0.00036;
          c.fillStyle = '#1b1b1e'; c.beginPath(); c.arc(dx(x + off), dz(z), dm(0.00022), 0, Math.PI * 2); c.fill();
          o.fillStyle = 'rgb(0,230,0)'; o.beginPath(); o.arc(dx(x + off), dz(z), dm(0.00022), 0, Math.PI * 2); o.fill();
        }
      }
    }
    // trackpad (glass, color-matched)
    const tx = dx(-TP_W / 2), tz = dz(TP_Z0), tw = dm(TP_W), td = dm(TP_D);
    c.fillStyle = '#5d5e63'; rrect(c, tx, tz, tw, td, dm(0.0055)); c.fill();
    c.strokeStyle = 'rgba(40,40,44,0.75)'; c.lineWidth = dm(0.00045); rrect(c, tx, tz, tw, td, dm(0.0055)); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = dm(0.0002); rrect(c, tx + dm(0.0004), tz + dm(0.0004), tw - dm(0.0008), td - dm(0.0008), dm(0.0052)); c.stroke();
    o.fillStyle = 'rgb(0,58,120)'; rrect(o, tx, tz, tw, td, dm(0.0055)); o.fill();
    // front thumb notch
    c.fillStyle = 'rgba(30,30,32,0.9)';
    c.beginPath(); c.ellipse(dx(0), DECK_PY, dm(0.016), dm(0.0018), 0, Math.PI, 0); c.fill();
    const mk = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = Math.min(4, maxAniso); return t; };
    return { color: mk(col, true), orm: mk(orm, false), emissive: mk(emi, true) };
  }

  // Key caps: legends (color + emissive) projected from above.
  const KEY_PX = 2560, KEY_PY = Math.round((KEY_PX * KB_D) / KB_W);
  function keyTextures() {
    const col = canvas(KEY_PX, KEY_PY), emi = canvas(KEY_PX, KEY_PY);
    const c = col.getContext('2d'), e = emi.getContext('2d');
    c.fillStyle = '#121214'; c.fillRect(0, 0, KEY_PX, KEY_PY);
    e.fillStyle = '#000'; e.fillRect(0, 0, KEY_PX, KEY_PY);
    const kx = (x) => ((x - KB_X0) / KB_W) * KEY_PX, kz = (z) => ((z - KB_Z0) / KB_D) * KEY_PY, km = (m) => (m / KB_W) * KEY_PX;
    const draw = (ctx, color) => {
      ctx.fillStyle = color; ctx.strokeStyle = color; ctx.textBaseline = 'alphabetic';
      for (const k of KEYS) {
        const x = kx(k.x), z = kz(k.z), w = km(k.w), d = km(k.d);
        const L = k.label;
        if (!L) continue;
        const pad = km(0.0016);
        if (L === '@touch') { ctx.lineWidth = km(0.00018); ctx.beginPath(); ctx.arc(x + w / 2, z + d / 2, km(0.0045), 0, Math.PI * 2); ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1; continue; }
        if (L.startsWith('@') && !L.includes('|')) {
          const cx = x + w / 2, cz = z + d / 2, s = km(0.0013);
          const dir = { '@left': [-1, 0], '@right': [1, 0], '@up': [0, -1], '@down': [0, 1] }[L];
          ctx.beginPath();
          if (dir[0]) { ctx.moveTo(cx + dir[0] * s, cz); ctx.lineTo(cx - dir[0] * s * 0.6, cz - s); ctx.lineTo(cx - dir[0] * s * 0.6, cz + s); }
          else { ctx.moveTo(cx, cz + dir[1] * s * 0.8); ctx.lineTo(cx - s, cz - dir[1] * s * 0.5); ctx.lineTo(cx + s, cz - dir[1] * s * 0.5); }
          ctx.closePath(); ctx.fill(); continue;
        }
        if (L.includes('|') && L.length > 1) {
          const [top, bot] = L === '||\\' ? ['|', '\\'] : L.split('|');
          ctx.font = `500 ${km(0.0033)}px Inter`; ctx.textAlign = 'center';
          ctx.fillText(top, x + w / 2, z + d * 0.42); ctx.fillText(bot, x + w / 2, z + d * 0.82); continue;
        }
        if (L.length === 1) { ctx.font = `500 ${km(0.0046)}px Inter`; ctx.textAlign = 'center'; ctx.fillText(L, x + w / 2, z + d * 0.66); continue; }
        if (/^F\d+$/.test(L)) { ctx.font = `500 ${km(0.0024)}px Inter`; ctx.textAlign = 'center'; ctx.fillText(L, x + w / 2, z + d * 0.84); ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(x + w / 2, z + d * 0.36, km(0.0011), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; continue; }
        ctx.font = `500 ${km(0.0024)}px Inter`;
        const right = ['delete', 'return'].includes(L) || (L === 'shift' && k.x > 0) || ((L === 'command' || L === 'option') && k.x > 0);
        ctx.textAlign = right ? 'right' : 'left';
        ctx.fillText(L, right ? x + w - pad : x + pad, z + d - pad * 0.9);
      }
    };
    draw(c, '#d9d9de');
    e.shadowColor = 'rgba(255,245,230,1)'; e.shadowBlur = km(0.0004);
    draw(e, '#ffffff');
    const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(2, maxAniso); return t; };
    return { color: mk(col), emissive: mk(emi) };
  }

  // Walnut desk (tileable, 1 m per tile): color + roughness. Straight fine grain along X.
  function woodTextures() {
    const N = 2048;
    const col = canvas(N, N), rgh = canvas(N, N);
    const c = col.getContext('2d'), g = rgh.getContext('2d');
    const id = c.createImageData(N, N), gd = g.createImageData(N, N);
    const r = rng(77);
    const P = 256, tab = new Float32Array(P * P);
    for (let i = 0; i < tab.length; i++) tab[i] = r();
    const S = (t) => t * t * (3 - 2 * t);
    // 2D periodic value noise (period P in both axes) -> tileable
    const vn = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = S(x - xi), yf = S(y - yi);
      const x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P;
      const a = tab[y0 * P + x0], b = tab[y0 * P + x1], cc = tab[y1 * P + x0], d = tab[y1 * P + x1];
      return (a + (b - a) * xf) * (1 - yf) + (cc + (d - cc) * xf) * yf;
    };
    for (let y = 0; y < N; y++) {
      const v = y / N;
      for (let x = 0; x < N; x++) {
        const u = x / N;
        // gentle waviness of the grain (periodic: multiples of P cells per tile)
        const warp = (vn(u * 4, v * 8) - 0.5) * 0.010 + (vn(u * 16, v * 32 + 50) - 0.5) * 0.0025;
        const vv = v + warp;
        const rings = vn(u * 2, vv * 128) * 0.5 + vn(u * 4, vv * 256 + 9) * 0.32 + vn(u * 8, vv * 768 + 3) * 0.18;
        const streak = vn(u * 6, vv * 48 + 21);
        let t = 0.36 + (rings - 0.5) * 0.55 + (streak - 0.5) * 0.22;
        // fine pores, elongated along the grain
        const pore = vn(u * 256, vv * 2048 + 7);
        if (pore > 0.9) t -= (pore - 0.9) * 0.9;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const i = (y * N + x) * 4;
        const ro = 150 + (1 - t) * 36 + (pore > 0.9 ? 18 : 0);
        id.data[i] = 26 + t * 38; id.data[i + 1] = 18 + t * 26; id.data[i + 2] = 13 + t * 17; id.data[i + 3] = ro;
        gd.data[i] = 0; gd.data[i + 1] = ro; gd.data[i + 2] = 0; gd.data[i + 3] = 255;
      }
    }
    c.putImageData(id, 0, 0); g.putImageData(gd, 0, 0);
    const mk = (cv, srgb) => {
      const t = new THREE.CanvasTexture(cv); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3.2, 2.2); t.anisotropy = 1;
      return t;
    };
    return { color: mk(col, true), rough: mk(rgh, false) };
  }

  function shadowTexture() {
    const c = canvas(512, 512), x = c.getContext('2d');
    x.fillStyle = '#000';
    x.filter = 'blur(26px)'; x.globalAlpha = 0.55; rrect(x, 70, 92, 372, 328, 40); x.fill();
    x.filter = 'blur(9px)'; x.globalAlpha = 0.9; rrect(x, 100, 120, 312, 272, 24); x.fill();
    const t = new THREE.CanvasTexture(c); return t;
  }
  function bokehTexture() {
    const c = canvas(128, 128), x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.72, 'rgba(255,255,255,0.62)');
    g.addColorStop(0.9, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // ---------------------------------------------------------------- desk
  const wood = woodTextures();
  const dof = { uFocus: { value: 0.9 }, uDof: { value: 7.0 } };
  // Custom, much cheaper desk shading (SwiftShader-friendly): Lambert terms for the studio lights,
  // a Lambertian-emitter approximation of the display glow, a broad satin sheen + fresnel,
  // LOD-biased texture sampling as depth of field, soft fade into the dark, fog + ACES.
  const deskU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    map: { value: null }, roughMap: { value: null }, uvScale: { value: new THREE.Vector2(3.2, 2.2) },
    uFocus: { value: 0.9 }, uDof: { value: 7.0 },
    uPoolPos: { value: new THREE.Vector3() }, uPoolDir: { value: new THREE.Vector3() }, uPoolCol: { value: new THREE.Color() }, uPoolCone: { value: new THREE.Vector2() },
    uRimRPos: { value: new THREE.Vector3() }, uRimRCol: { value: new THREE.Color() },
    uRimLPos: { value: new THREE.Vector3() }, uRimLCol: { value: new THREE.Color() },
    uKeyPos: { value: new THREE.Vector3() }, uKeyCol: { value: new THREE.Color() },
    uScrPos: { value: new THREE.Vector3() }, uScrN: { value: new THREE.Vector3() }, uScrCol: { value: new THREE.Color(0, 0, 0) },
    uAmb: { value: new THREE.Color(0.010, 0.010, 0.012) }, uSpec: { value: 1.6 },
    uEnvTop: { value: new THREE.Color(0.95, 0.93, 0.9) }, uEnvL: { value: new THREE.Color(0.30, 0.34, 0.42) }, uEnvR: { value: new THREE.Color(0.42, 0.32, 0.24) },
  }]);
  deskU.map.value = wood.color; deskU.roughMap.value = wood.rough;
  deskU.uFocus = dof.uFocus; deskU.uDof = dof.uDof;
  const deskMat = new THREE.ShaderMaterial({
    uniforms: deskU, fog: true,
    vertexShader: /* glsl */`
      uniform vec2 uvScale;
      varying vec3 vW; varying float vViewZ; varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv * uvScale;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        vViewZ = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      uniform sampler2D map; uniform sampler2D roughMap;
      uniform float uFocus; uniform float uDof;
      uniform vec3 uPoolPos; uniform vec3 uPoolDir; uniform vec3 uPoolCol; uniform vec2 uPoolCone;
      uniform vec3 uRimRPos; uniform vec3 uRimRCol; uniform vec3 uRimLPos; uniform vec3 uRimLCol;
      uniform vec3 uKeyPos; uniform vec3 uKeyCol;
      uniform vec3 uScrPos; uniform vec3 uScrN; uniform vec3 uScrCol;
      uniform vec3 uAmb; uniform float uSpec;
      uniform vec3 uEnvTop; uniform vec3 uEnvL; uniform vec3 uEnvR;
      varying vec3 vW; varying float vViewZ; varying vec2 vUv;
      #include <fog_pars_fragment>
      void main() {
        float bias = clamp(abs(vViewZ - uFocus) / uFocus * uDof, 0.0, 7.5);
        vec4 tex = texture2D(map, vUv, bias);
        vec3 albedo = tex.rgb;
        float rough = tex.a;
        vec3 V = normalize(cameraPosition - vW);
        vec3 col = albedo * uAmb;
        vec3 Lp = uPoolPos - vW; float dp = length(Lp); Lp /= dp;
        float cone = smoothstep(uPoolCone.x, uPoolCone.y, dot(-Lp, uPoolDir));
        col += albedo * RECIPROCAL_PI * uPoolCol * cone * max(Lp.y, 0.0) / (dp * dp);
        vec3 Lr = uRimRPos - vW; float dr = length(Lr); Lr /= dr;
        col += albedo * RECIPROCAL_PI * uRimRCol * max(Lr.y, 0.0) / (dr * dr);
        vec3 Ll = uRimLPos - vW; float dl = length(Ll); Ll /= dl;
        col += albedo * RECIPROCAL_PI * uRimLCol * max(Ll.y, 0.0) / (dl * dl);
        vec3 Lk = uKeyPos - vW; float dk = length(Lk); Lk /= dk;
        float kf = 1.0 / (dk * dk + 0.25);
        col += albedo * uKeyCol * max(Lk.y, 0.0) * kf;
        vec3 Ls = uScrPos - vW; float ds = length(Ls); Ls /= ds;
        float emit = max(dot(uScrN, -Ls), 0.0);
        col += albedo * uScrCol * emit * max(Ls.y, 0.0) / (ds * ds + 0.004);
        vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
        float fres = 0.04 + 0.96 * pow(1.0 - max(V.y, 0.0), 5.0);
        float lobe = pow(max(dot(R, Lk), 0.0), mix(26.0, 7.0, rough));
        col += uKeyCol * uSpec * lobe * fres * (1.15 - rough * 0.7) * kf;
        // analytic studio environment: overhead softbox + cool left strip + warm right strip
        float kk = mix(10.0, 3.0, rough);
        vec3 env = uEnvTop * pow(max(dot(R, vec3(0.0, 0.936, -0.351)), 0.0), kk)
                 + uEnvL * pow(max(dot(R, vec3(-0.86, 0.35, -0.38)), 0.0), kk * 1.6)
                 + uEnvR * pow(max(dot(R, vec3(0.9, 0.36, -0.28)), 0.0), kk * 1.6);
        col += env * fres * (1.1 - rough * 0.6);
        float lobeS = pow(max(dot(R, Ls), 0.0), 12.0);
        col += uScrCol * 0.05 * lobeS * fres * emit / (ds * ds + 0.01);
        col *= smoothstep(-1.02, -0.5, vW.z) * (1.0 - smoothstep(0.9, 1.5, abs(vW.x)));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), deskMat);
  desk.rotation.x = -Math.PI / 2;
  desk.position.z = 0.05;   // back edge at z = -1.05 (fully faded), city lights visible beyond
  desk.renderOrder = 10;     // draw after the laptop: early-z rejects every hidden desk fragment
  scene.add(desk);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(MBP.W * 1.36, MBP.D * 1.5), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, toneMapped: false, fog: false }));
  shadow.material.alphaMap = shadow.material.map; shadow.material.color.set(0x000000);
  shadow.material.opacity = 0.92;
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.0003, 0.004);
  scene.add(shadow);

  // background bokeh: night-city lights seen far behind / below the desk edge
  {
    const tex = bokehTexture();
    const r = rng(12);
    const cols = ['#ff4f93', '#ffb35c', '#48e2ff', '#fff1d8', '#9d7bff', '#ffcf8a', '#ffd9a8', '#ff7a5c'];
    for (let i = 0; i < 64; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(cols[i % cols.length]), transparent: true, opacity: 0.07 + r() * 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const sp = new THREE.Sprite(m);
      const z = -4.4 - r() * 2.6;
      const s = (0.07 + r() * 0.15) * (-z / 5);
      sp.scale.set(s, s, 1);
      sp.position.set((r() - 0.5) * 10.0, -1.6 + Math.pow(r(), 0.7) * 1.45, z);
      scene.add(sp);
    }
  }

  // ---------------------------------------------------------------- MacBook
  const laptop = new THREE.Group();
  scene.add(laptop);

  // base
  const deck = deckTextures();
  const deckMat = new THREE.MeshStandardMaterial({
    map: deck.color, roughnessMap: deck.orm, metalnessMap: deck.orm, roughness: 1, metalness: 1,
    emissiveMap: deck.emissive, emissive: new THREE.Color('#fff1df'), emissiveIntensity: 0, fog: false,
  });
  {
    const depth = MBP.baseT - 2 * MBP.bevel;
    const g = new THREE.ExtrudeGeometry(roundedShape(MBP.W - 2 * MBP.bevel, MBP.D - 2 * MBP.bevel, MBP.corner - MBP.bevel), {
      depth, bevelEnabled: true, bevelThickness: MBP.bevel, bevelSize: MBP.bevel, bevelSegments: 6, curveSegments: 24,
    });
    // map cap UVs to [0,1] over the full footprint
    const uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + MBP.W / 2) / MBP.W, (pos.getY(i) + MBP.D / 2) / MBP.D);
    g.rotateX(-Math.PI / 2);
    g.translate(0, MBP.feet + MBP.bevel, 0);
    const base = new THREE.Mesh(g, [deckMat, alu]);
    laptop.add(base);
  }
  // feet
  for (const [x, z] of [[-0.128, -0.085], [0.128, -0.085], [-0.128, 0.085], [0.128, 0.085]]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0058, MBP.feet + 0.0004, 24), rubber);
    f.position.set(x, (MBP.feet + 0.0004) / 2 - 0.0002, z); laptop.add(f);
  }

  // keys
  const keyTex = keyTextures();
  const keyMat = new THREE.MeshStandardMaterial({
    map: keyTex.color, roughness: 0.55, metalness: 0.0, emissiveMap: keyTex.emissive, emissive: new THREE.Color('#fff4e6'), emissiveIntensity: 0, fog: false,
  });
  {
    const geos = [];
    const kh = 0.00085, kb = 0.00018;
    for (const k of KEYS) {
      const g = new THREE.ExtrudeGeometry(roundedShape(k.w - 2 * kb, k.d - 2 * kb, Math.min(0.0016, k.d / 2 - kb - 0.0001)), {
        depth: kh, bevelEnabled: true, bevelThickness: kb, bevelSize: kb, bevelSegments: 2, curveSegments: 5,
      });
      g.rotateX(-Math.PI / 2);
      g.translate(k.x + k.w / 2, baseTop - 0.00035 + kb, k.z + k.d / 2);
      const uv = g.attributes.uv, p = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - KB_X0) / KB_W, 1 - (p.getZ(i) - KB_Z0) / KB_D);
      geos.push(g);
    }
    laptop.add(new THREE.Mesh(mergeGeometries(geos), keyMat));
  }

  // hinge barrel
  {
    const g = new THREE.CylinderGeometry(0.0046, 0.0046, 0.262, 32);
    g.rotateZ(Math.PI / 2);
    const h = new THREE.Mesh(g, aluDark);
    h.position.set(0, TL.HINGE[1] - 0.0012, TL.HINGE[2] - 0.0006);
    laptop.add(h);
  }

  // lid
  const lid = new THREE.Group();
  lid.position.set(...TL.HINGE);
  lid.rotation.x = -tilt;
  laptop.add(lid);
  {
    const lb = 0.0016;
    const g = new THREE.ExtrudeGeometry(roundedShape(MBP.W - 2 * lb, MBP.D - 2 * lb, MBP.corner - lb, 0, MBP.D / 2), {
      depth: MBP.lidT - 2 * lb, bevelEnabled: true, bevelThickness: lb, bevelSize: lb, bevelSegments: 5, curveSegments: 24,
    });
    g.translate(0, 0, -(MBP.lidT - lb));
    lid.add(new THREE.Mesh(g, alu));
  }
  // black glass front
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x020203, roughness: 0.06, metalness: 0.0, envMapIntensity: 1.0, fog: false });
  {
    const inset = 0.0011;
    const face = roundedShape(MBP.W - 2 * inset, MBP.D - 2 * inset, MBP.corner - inset, 0, MBP.D / 2);
    const sy = MBP.D - MBP.bezelTop - MBP.screenH / 2;
    const hole = new THREE.Path();
    hole.moveTo(-MBP.screenW / 2, sy - MBP.screenH / 2); hole.lineTo(-MBP.screenW / 2, sy + MBP.screenH / 2);
    hole.lineTo(MBP.screenW / 2, sy + MBP.screenH / 2); hole.lineTo(MBP.screenW / 2, sy - MBP.screenH / 2); hole.closePath();
    face.holes.push(hole);
    const g = new THREE.ShapeGeometry(face, 24);
    const m = new THREE.Mesh(g, glassMat); m.position.z = 0.00006; m.renderOrder = -2; lid.add(m);
  }
  // display
  const screenCanvas = canvas(SW, SH);
  const sctx = screenCanvas.getContext('2d');
  sctx.fillStyle = '#000'; sctx.fillRect(0, 0, SW, SH);
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.generateMipmaps = false;
  screenTex.minFilter = THREE.LinearFilter; screenTex.magFilter = THREE.LinearFilter;
  screenTex.anisotropy = Math.min(2, maxAniso);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, fog: false });
  const screenY = MBP.D - MBP.bezelTop - MBP.screenH / 2;
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(MBP.screenW, MBP.screenH), screenMat);
    m.position.set(0, screenY, 0.00012); m.renderOrder = -3; lid.add(m);
    // notch (camera housing) — invisible against the black menu-bar strip in full screen
    const notch = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(0.0305, 0.0072, 0.0016, 0, 0)), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }));
    notch.position.set(0, screenY + MBP.screenH / 2 - 0.0026, 0.00016); notch.renderOrder = -4; lid.add(notch);
    // glass reflection layer (adds only specular reflections on top of the image)
    const refl = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.05, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 0.55, fog: false });
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(MBP.screenW, MBP.screenH), refl);
    gm.position.set(0, screenY, 0.0002); lid.add(gm);
    screenGlass = gm;
  }

  // ---------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0x1b1e28, 0x050505, 0.08);
  scene.add(hemi);
  const key = new THREE.RectAreaLight(0xffeedd, 1.1, 1.5, 0.5);
  key.position.set(0, 1.2, -0.6); key.lookAt(0, 0, 0.0);
  // The key softbox is represented by the environment map for the laptop (cheaper than LTC);
  // its position/colour still drive the custom desk shader below.
  key.visible = false;
  scene.add(key);
  const pool = new THREE.SpotLight(0xffeedd, 2.6, 0, 0.27, 1.0, 2);
  pool.position.set(0.12, 1.75, 0.42); pool.target.position.set(0, 0, -0.01);
  scene.add(pool, pool.target);
  const rimR = new THREE.SpotLight(0xffd6b4, 14.0, 0, 0.5, 1.0, 2);
  rimR.position.set(0.95, 0.5, -1.15); rimR.target.position.set(0, 0.1, -0.1);
  scene.add(rimR, rimR.target);
  const rimL = new THREE.SpotLight(0xbfd2ff, 11.0, 0, 0.5, 1.0, 2);
  rimL.position.set(-1.0, 0.45, -0.95); rimL.target.position.set(0, 0.1, -0.1);
  scene.add(rimL, rimL.target);
  const screenLight = new THREE.RectAreaLight(0xffffff, 0, MBP.screenW, MBP.screenH);
  {
    const S = TL.SCREEN_CENTER, N = TL.SCREEN_NORMAL;
    screenLight.position.set(S[0] + N[0] * 0.004, S[1] + N[1] * 0.004, S[2] + N[2] * 0.004);
    screenLight.lookAt(S[0] + N[0], S[1] + N[1], S[2] + N[2]);
  }
  scene.add(screenLight);
  {
    // static lights -> desk shader uniforms (three.js units: candela for spots, nits for rect lights)
    const lin = (c, k) => new THREE.Color().copy(c).multiplyScalar(k);
    deskU.uPoolPos.value.copy(pool.position);
    deskU.uPoolDir.value.copy(pool.target.position).sub(pool.position).normalize();
    deskU.uPoolCol.value.copy(lin(pool.color, pool.intensity * 2.2));
    deskU.uPoolCone.value.set(Math.cos(pool.angle), Math.cos(pool.angle * (1 - pool.penumbra * 0.98)));
    deskU.uRimRPos.value.copy(rimR.position); deskU.uRimRCol.value.copy(lin(rimR.color, rimR.intensity * 0.55));
    deskU.uRimLPos.value.copy(rimL.position); deskU.uRimLCol.value.copy(lin(rimL.color, rimL.intensity * 0.55));
    deskU.uKeyPos.value.copy(key.position); deskU.uKeyCol.value.copy(lin(key.color, key.intensity * (key.width * key.height) / Math.PI));
    deskU.uScrPos.value.set(...TL.SCREEN_CENTER); deskU.uScrN.value.set(...TL.SCREEN_NORMAL);
  }

  // ---------------------------------------------------------------- Safari (full screen) chrome
  const STRIP = 32 / 982, TOOL = 44 / 982;
  let toolbar = null;
  function buildToolbar() {
    const w = SW, h = Math.round(SH * TOOL), s = SW / 1512;
    const c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = '#0c0c0e'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(0, h - Math.max(1, s * 0.6), w, Math.max(1, s * 0.6));
    const ic = 'rgba(235,235,245,0.62)';
    x.strokeStyle = ic; x.lineWidth = 1.4 * s; x.lineCap = 'round'; x.lineJoin = 'round';
    const cy = h / 2;
    // sidebar icon
    rrect(x, 18 * s, cy - 7 * s, 20 * s, 14 * s, 3 * s); x.stroke();
    x.beginPath(); x.moveTo(25 * s, cy - 7 * s); x.lineTo(25 * s, cy + 7 * s); x.stroke();
    // back / forward
    x.beginPath(); x.moveTo(62 * s, cy - 6 * s); x.lineTo(56 * s, cy); x.lineTo(62 * s, cy + 6 * s); x.stroke();
    x.strokeStyle = 'rgba(235,235,245,0.28)';
    x.beginPath(); x.moveTo(84 * s, cy - 6 * s); x.lineTo(90 * s, cy); x.lineTo(84 * s, cy + 6 * s); x.stroke();
    // address field
    const aw = 520 * s, ah = 30 * s, ax = (w - aw) / 2, ay = cy - ah / 2;
    x.fillStyle = 'rgba(255,255,255,0.075)'; rrect(x, ax, ay, aw, ah, 9 * s); x.fill();
    x.font = `500 ${13 * s}px Inter`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(245,245,247,0.92)';
    const label = 'gta-vi.concept';
    const tw = x.measureText(label).width;
    x.fillText(label, w / 2 + 8 * s, cy + 0.5 * s);
    // lock
    const lx = w / 2 - tw / 2 - 6 * s, ly = cy;
    x.fillStyle = 'rgba(235,235,245,0.7)'; rrect(x, lx - 5 * s, ly - 1 * s, 10 * s, 7.5 * s, 1.6 * s); x.fill();
    x.strokeStyle = 'rgba(235,235,245,0.7)'; x.lineWidth = 1.3 * s;
    x.beginPath(); x.arc(lx, ly - 1 * s, 3.2 * s, Math.PI, 0); x.stroke();
    // reload
    x.beginPath(); x.arc(ax + aw - 18 * s, cy, 5.5 * s, -Math.PI * 0.2, Math.PI * 1.45); x.stroke();
    // right icons: share, new tab, tab overview
    x.strokeStyle = ic; x.lineWidth = 1.4 * s;
    const r0 = w - 112 * s;
    rrect(x, r0 - 7 * s, cy - 3 * s, 14 * s, 12 * s, 2 * s); x.stroke();
    x.beginPath(); x.moveTo(r0, cy + 3 * s); x.lineTo(r0, cy - 10 * s); x.moveTo(r0 - 4 * s, cy - 6 * s); x.lineTo(r0, cy - 10 * s); x.lineTo(r0 + 4 * s, cy - 6 * s); x.stroke();
    const r1 = w - 72 * s;
    x.beginPath(); x.moveTo(r1 - 7 * s, cy); x.lineTo(r1 + 7 * s, cy); x.moveTo(r1, cy - 7 * s); x.lineTo(r1, cy + 7 * s); x.stroke();
    const r2 = w - 34 * s;
    rrect(x, r2 - 8 * s, cy - 5 * s, 12 * s, 11 * s, 2 * s); x.stroke();
    rrect(x, r2 - 4 * s, cy - 9 * s, 12 * s, 11 * s, 2 * s); x.stroke();
    return c;
  }

  const work = canvas(SW, SH);
  const wctx = work.getContext('2d');
  const tiny = canvas(24, 16);
  const tctx = tiny.getContext('2d', { willReadFrequently: true });
  function composite(ctx, w, h, bmp, decorate) {
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const y1 = Math.round(h * STRIP), y2 = Math.round(h * (STRIP + TOOL));
    ctx.drawImage(toolbar, 0, y1, w, y2 - y1);
    if (bmp) ctx.drawImage(bmp, 0, y2, w, h - y2);
    if (decorate) decorate(ctx, w, h, y2);
  }
  const avgColor = new THREE.Color(0, 0, 0);
  function updateScreen(bmp, targetPx, decorate = null) {
    const s = Math.min(1, Math.max(0.2, (targetPx * 1.3) / SW));
    if (s > 0.97) composite(sctx, SW, SH, bmp, decorate);
    else {
      const w = Math.round(SW * s), h = Math.round(SH * s);
      composite(wctx, w, h, bmp, decorate);
      sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(work, 0, 0, w, h, 0, 0, SW, SH);
    }
    screenTex.needsUpdate = true;
    // average colour of the visible page (drives the screen's light on keyboard + desk)
    tctx.drawImage(screenCanvas, 0, Math.round(SH * (STRIP + TOOL)), SW, Math.round(SH * (1 - STRIP - TOOL)), 0, 0, 24, 16);
    const d = tctx.getImageData(0, 0, 24, 16).data;
    let r = 0, g = 0, b = 0;
    const lin = (v) => Math.pow(v / 255, 2.2);
    for (let i = 0; i < d.length; i += 4) { r += lin(d[i]); g += lin(d[i + 1]); b += lin(d[i + 2]); }
    const n = d.length / 4;
    avgColor.setRGB(r / n, g / n, b / n, THREE.LinearSRGBColorSpace);
  }

  // ---------------------------------------------------------------- frame
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
  function projectedScreenWidth() {
    const S = TL.SCREEN_CENTER;
    _v1.set(S[0] - MBP.screenW / 2, S[1], S[2]).project(camera);
    _v2.set(S[0] + MBP.screenW / 2, S[1], S[2]).project(camera);
    return Math.abs(_v2.x - _v1.x) * renderer.domElement.width / 2;
  }

  // ---------------------------------------------------------------- per-frame helpers
  function clearScreen() {
    sctx.fillStyle = '#000'; sctx.fillRect(0, 0, SW, SH); screenTex.needsUpdate = true; avgColor.setRGB(0, 0, 0);
  }
  // display brightness, glass reflections, and the display's light on keyboard + desk
  function applyScreen(power, lightOverride = null) {
    screenMat.color.setScalar(power);
    screenGlass.visible = power < 0.999;
    if (lightOverride) {
      screenLight.color.copy(lightOverride.color);
      screenLight.intensity = lightOverride.intensity;
    } else {
      // colour of the page, softened towards neutral so it never looks garish
      const lum = 0.2126 * avgColor.r + 0.7152 * avgColor.g + 0.0722 * avgColor.b;
      screenLight.color.setRGB(avgColor.r * 0.8 + lum * 0.2, avgColor.g * 0.8 + lum * 0.2, avgColor.b * 0.8 + lum * 0.2, THREE.LinearSRGBColorSpace);
      screenLight.intensity = power * 20.0;
    }
    deskU.uScrCol.value.copy(screenLight.color).multiplyScalar(screenLight.intensity * (MBP.screenW * MBP.screenH) / Math.PI);
  }
  function setBacklight(bl) {
    keyMat.emissiveIntensity = bl * 1.15;
    deckMat.emissiveIntensity = bl * 0.42;
  }
  async function init() {
    await document.fonts.load('500 20px Inter');
    toolbar = buildToolbar();
    // rebuild key legends now that Inter is loaded
    const kt = keyTextures();
    keyMat.map = kt.color; keyMat.emissiveMap = kt.emissive; keyMat.needsUpdate = true;
  }
  return {
    scene, camera, dof, laptop, lid, desk, deskU, keyMat, deckMat, screenMat, screenTex, screenCanvas, screenLight,
    lights: { key, pool, rimR, rimL, screenLight, hemi },
    get screenGlass() { return screenGlass; },
    STRIP, TOOL, screenY, init, updateScreen, clearScreen, applyScreen, setBacklight, projectedScreenWidth,
  };

}
