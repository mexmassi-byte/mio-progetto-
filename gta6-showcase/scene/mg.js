// =============================================================================
// "VI — Launch Film" (9:16): the MacBook acts and the glow-shape film, one deterministic
// frame at a time. WebGL renders offscreen; a 2D canvas accumulates motion-blur subframes
// and carries the kinetic typography, the flash and the fades.
// =============================================================================
import * as THREE from 'three';
import * as TL from '../render/mg_timeline.mjs';
import { buildMacbook, canvas, rrect } from './macbook.js';

const { clamp, lerp, smoothstep, E, MBP, SH: SHAPE, FILM_SHAPES } = TL;
const q = new URLSearchParams(location.search);
const W = Number(q.get('w') || 1080);
const H = Number(q.get('h') || 1920);
const SW = Number(q.get('sw') || 3024);
const SCRH = Math.round((SW * 1964) / 3024);
const DEG = Math.PI / 180;
const K = W / 1080;                       // layout scale (all type is designed on a 1080 x 1920 grid)

// ---------------------------------------------------------------- renderer + output
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const out = canvas(W, H);
document.body.appendChild(out);
const octx = out.getContext('2d');

const M = buildMacbook({ renderer, TL, SW, SH: SCRH, aspect: W / H });

// ---------------------------------------------------------------- shared SDF shapes (GLSL)
const SDF = /* glsl */`
  #define PI 3.141592653589793
  float sdCircle(vec2 p, float r) { return length(p) - r; }
  float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  float sdHex(vec2 p, float R) {                      // pointy top, circumradius R
    const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
    float r = R * 0.866025404;
    p = abs(p.yx);
    p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
    p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
    return length(p) * sign(p.y);
  }
  float sdTri(vec2 p, float r) {                      // equilateral, apex up, r = half side
    const float k = 1.7320508;
    p.x = abs(p.x) - r;
    p.y = p.y + r / k;
    if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    p.x -= clamp(p.x, -2.0 * r, 0.0);
    return -length(p) * sign(p.y);
  }
  float ndot(vec2 a, vec2 b) { return a.x * b.x - a.y * b.y; }
  float sdRhombus(vec2 p, vec2 b) {
    p = abs(p);
    float h = clamp(ndot(b - 2.0 * p, b) / dot(b, b), -1.0, 1.0);
    float d = length(p - 0.5 * b * vec2(1.0 - h, 1.0 + h));
    return d * sign(p.x * b.y + p.y * b.x - b.x * b.y);
  }
  float sdSeg(vec2 p, vec2 a, vec2 b, float w) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - w;
  }
  float sdQuad(vec2 p, vec2 a, vec2 b, vec2 c, vec2 e) {   // convex or concave quad, exact
    vec2 v[4]; v[0] = a; v[1] = b; v[2] = c; v[3] = e;
    float d = dot(p - v[0], p - v[0]);
    float s = 1.0;
    for (int i = 0; i < 4; i++) {
      int j = (i + 3) % 4;
      vec2 ed = v[j] - v[i], w = p - v[i];
      vec2 bb = w - ed * clamp(dot(w, ed) / dot(ed, ed), 0.0, 1.0);
      d = min(d, dot(bb, bb));
      bvec3 c3 = bvec3(p.y >= v[i].y, p.y < v[j].y, ed.x * w.y > ed.y * w.x);
      if (all(c3) || all(not(c3))) s *= -1.0;
    }
    return s * sqrt(d);
  }
  // Roman numeral VI, Didone construction: thick and hairline strokes, flat hairline serifs. s = cap height.
  float sdVI(vec2 p, float s) {
    p = p / s + vec2(0.105, 0.0);
    float d = sdQuad(p, vec2(-0.75, 0.5), vec2(-0.57, 0.5), vec2(-0.26, -0.5), vec2(-0.36, -0.5));   // V, thick
    d = min(d, sdQuad(p, vec2(0.095, 0.5), vec2(0.135, 0.5), vec2(-0.265, -0.5), vec2(-0.305, -0.5))); // V, hairline
    d = min(d, sdBox(p - vec2(-0.66, 0.485), vec2(0.20, 0.015), 0.0));
    d = min(d, sdBox(p - vec2(0.115, 0.485), vec2(0.115, 0.015), 0.0));
    d = min(d, sdBox(p - vec2(0.45, 0.0), vec2(0.09, 0.5), 0.0));                                      // I stem
    d = min(d, sdBox(p - vec2(0.45, 0.485), vec2(0.2, 0.015), 0.0));
    d = min(d, sdBox(p - vec2(0.45, -0.485), vec2(0.2, 0.015), 0.0));
    return d * s;
  }
  float shapeSD(int id, vec4 P, vec2 p) {
    if (id == 0) return sdCircle(p, P.x);
    if (id == 1) return sdHex(p, P.x);
    if (id == 2) return sdTri(p, P.x);
    if (id == 3) return sdRhombus(p, P.xy);
    if (id == 4) return sdVI(p, P.x);
    return sdBox(p, P.xy, P.z);
  }
  vec2 rot2(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x + s * p.y, -s * p.x + c * p.y); }
`;
const SHAPE_UNIFORMS = () => ({
  uA: { value: 0 }, uB: { value: 0 }, uPA: { value: new THREE.Vector4() }, uPB: { value: new THREE.Vector4() },
  uMix: { value: 1 }, uRot: { value: 0 }, uScale: { value: 1 }, uCenter: { value: new THREE.Vector2() },
  uColor: { value: new THREE.Color(1, 1, 1) }, uIntensity: { value: 0 },
  uStrokePx: { value: 1.5 }, uGlowPx: { value: 9 }, uHalo: { value: 0.3 }, uDraw: { value: 1 },
});
const VERT = /* glsl */`varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SHAPE_HEAD = /* glsl */`
  uniform int uA, uB; uniform vec4 uPA, uPB; uniform float uMix, uRot, uScale; uniform vec2 uCenter;
  uniform vec3 uColor; uniform float uIntensity, uStrokePx, uGlowPx, uHalo, uDraw;
  varying vec2 vP;
`;
// glow-only outline (additive light)
function glowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: SHAPE_UNIFORMS(), vertexShader: VERT,
    fragmentShader: SDF + SHAPE_HEAD + /* glsl */`
      void main() {
        vec2 p = rot2(vP - uCenter, uRot) / uScale;
        float d = mix(shapeSD(uA, uPA, p), shapeSD(uB, uPB, p), uMix) * uScale;
        float px = max(fwidth(d), 1e-7);
        float s = abs(d) - uStrokePx * px;
        float core = 1.0 - smoothstep(-px, px, s);
        float e = max(s, 0.0) / px;                 // distance from the stroke, in pixels
        float glow = exp(-e / uGlowPx), halo = exp(-e / (uGlowPx * 6.0));
        float vis = 1.0, head = 0.0;
        if (uDraw < 1.0) {                          // stroke draws on clockwise from 12 o'clock
          float ang = fract(atan(p.x, p.y) / (2.0 * PI) + 1.0);
          vis = smoothstep(uDraw + 0.004, uDraw - 0.004, ang);
          head = exp(-pow((uDraw - ang) * 26.0, 2.0)) * step(ang, uDraw + 0.02);
        }
        // the wide halo follows the drawn length globally (an angular mask would cut a wedge into it)
        vec3 col = uColor * ((core * 1.1 + glow * 0.75) * (vis + head * 1.6) + halo * uHalo * min(1.0, uDraw * 1.15));
        col += vec3(1.0, 0.96, 0.88) * core * 0.85 * (vis + head);
        gl_FragColor = vec4(col * uIntensity, 1.0);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
  });
}
function setShape(mat, A, B, m, extra = {}) {
  const u = mat.uniforms;
  u.uA.value = A.id; u.uPA.value.fromArray(A.p);
  u.uB.value = B.id; u.uPB.value.fromArray(B.p);
  u.uMix.value = m;
  for (const k in extra) {
    if (u[k].value && u[k].value.isColor) u[k].value.copy(extra[k]);
    else if (u[k].value && u[k].value.isVector2) u[k].value.set(...extra[k]);
    else u[k].value = extra[k];
  }
}

const GOLD = new THREE.Color('#efd398');      // display values (no colour management in these shaders)
const PINK = new THREE.Color('#ff4f93');
const CYAN = new THREE.Color('#48e2ff');
const GOLD_LIN = new THREE.Color().setRGB(0.86, 0.64, 0.31, THREE.LinearSRGBColorSpace);

// ---------------------------------------------------------------- HOOK: glow shapes on the display
const HOOK_SHAPES = {
  ring: { id: SHAPE.CIRCLE, p: [0.027, 0, 0, 0] },
  hex: { id: SHAPE.HEX, p: [0.031, 0, 0, 0] },
  tri: { id: SHAPE.TRI, p: [0.034, 0, 0, 0] },
  diamond: { id: SHAPE.DIAMOND, p: [0.026, 0.042, 0, 0] },
  vi: { id: SHAPE.VI, p: [0.046, 0, 0, 0] },
  frame: { id: SHAPE.BOX, p: [MBP.screenW / 2, MBP.screenH / 2, 0.0045, 0] },
};
const HOOK = [
  { t: 0.0, s: 'ring' },
  { t: 0.5, s: 'hex', twist: 0.55 },
  { t: 1.0, s: 'tri', twist: -0.55 },
  { t: 1.5, s: 'diamond', twist: 0.55 },
  { t: 2.0, s: 'vi', twist: -0.3, md: 0.28 },
  { t: 4.0, s: 'frame', md: 0.42 },
];
function hookState(t) {
  let i = 0;
  while (i < HOOK.length - 1 && t >= HOOK[i + 1].t) i++;
  const cur = HOOK[i], prev = HOOK[Math.max(0, i - 1)];
  const m = i === 0 ? 1 : E.out3(clamp((t - cur.t) / (cur.md || 0.2), 0, 1));
  return { A: HOOK_SHAPES[prev.s], B: HOOK_SHAPES[cur.s], m, rot: (1 - m) * (cur.twist || 0), since: t - cur.t, i };
}
const hookPlaneGeo = new THREE.PlaneGeometry(0.66, 0.5);
const hookLayers = [
  { out: 0.0016, color: GOLD, k: 1.0, lag: 0.0 },
  { out: 0.012, color: PINK, k: 0.32, lag: 0.07 },
  { out: 0.026, color: CYAN, k: 0.22, lag: 0.14 },
].map((L) => {
  const mat = glowMaterial();
  const mesh = new THREE.Mesh(hookPlaneGeo, mat);
  mesh.position.set(0, M.screenY, L.out);
  mesh.renderOrder = 50;
  M.lid.add(mesh);
  return { ...L, mat, mesh };
});
// click shockwave around the play button
const PLAY_UV = TL.sitePxToScreen(TL.PLAY_SITE.x, TL.PLAY_SITE.y);
const PLAY_LOCAL = [PLAY_UV[0] * MBP.screenW, PLAY_UV[1] * MBP.screenH];
const clickRings = [0, 0.09].map((delay, j) => {
  const mat = glowMaterial();
  const mesh = new THREE.Mesh(hookPlaneGeo, mat);
  mesh.position.set(0, M.screenY, 0.0012 + j * 0.002);
  mesh.renderOrder = 51;
  M.lid.add(mesh);
  return { delay, mat, mesh };
});

function hookIntensity(t) {
  if (t > 6) return 0;
  let I = 1.0 + 0.18 * Math.sin(t * 5.1);
  for (const h of HOOK) if (t >= h.t) I += (h.s === 'vi' ? 2.2 : h.s === 'frame' ? 1.6 : 1.1) * Math.exp(-(t - h.t) / 0.13);
  I += 0.9 * smoothstep(3.3, 3.95, t) * (1 - smoothstep(4.0, 4.3, t));            // anticipation
  return I * (1 - smoothstep(4.55, 5.6, t));
}
function updateHook(t) {
  const on = t < 6;
  for (const L of hookLayers) {
    L.mesh.visible = on;
    if (!on) continue;
    const tl = Math.max(0, t - L.lag);
    const s = hookState(tl);
    const draw = t < 0.42 ? E.out3(clamp(t / 0.42, 0, 1)) : 1;
    const I = hookIntensity(tl) * L.k * (L.k < 1 ? 1 - smoothstep(4.0, 4.4, t) : 1);
    setShape(L.mat, s.A, s.B, s.m, {
      uRot: s.rot + 0.05 * Math.sin(t * 1.7), uColor: L.color, uIntensity: I, uDraw: L.k < 1 ? Math.min(1, draw * 1.02) : draw,
      uStrokePx: L.k < 1 ? 1.1 : 1.7, uGlowPx: L.k < 1 ? 7 : 10, uHalo: L.k < 1 ? 0.15 : 0.32,
    });
  }
  // click: two expanding rings from the play button
  for (const R of clickRings) {
    const u = (t - TL.T_CLICK - R.delay) / 0.7;
    R.mesh.visible = u > 0 && u < 1;
    if (!R.mesh.visible) continue;
    const r = 0.004 + 0.05 * E.out(u);
    const ring = { id: SHAPE.CIRCLE, p: [r, 0, 0, 0] };
    setShape(R.mat, ring, ring, 1, {
      uCenter: PLAY_LOCAL, uColor: GOLD, uIntensity: 1.6 * Math.pow(1 - u, 1.6), uStrokePx: 1.3, uGlowPx: 8, uHalo: 0.2, uDraw: 1,
    });
  }
  // the glow lights the keyboard and the desk while the display is still dark
  return on ? hookIntensity(t) * (1 - TL.screenPower(t)) : 0;
}

// ---------------------------------------------------------------- footage
const meta = {};
const frameCache = new Map();
async function loadMeta() {
  for (const c of ['card', 'city', 'bridge', 'boule', 'port', 'drone', 'drive', 'lights', 'tower']) {
    meta[c] = await (await fetch(`/footage/${c}/meta.json`)).json();
  }
}
async function loadFrame(clip, local, flip) {
  const m = meta[clip];
  const idx = clamp(Math.floor(local * m.fps + 1e-6) + 1, 1, m.frames);
  const key = `${clip}/${idx}/${flip ? 1 : 0}`;
  if (frameCache.has(key)) return frameCache.get(key);
  const blob = await (await fetch(`/footage/${clip}/f_${String(idx).padStart(4, '0')}.jpg`)).blob();
  const bmp = await createImageBitmap(blob, flip ? { imageOrientation: 'flipY' } : {});
  frameCache.set(key, bmp);
  if (frameCache.size > 14) {
    const k0 = frameCache.keys().next().value;
    const b0 = frameCache.get(k0);
    frameCache.delete(k0);
    if (b0 !== footTex.image) b0.close();
  }
  return bmp;
}

// ---------------------------------------------------------------- FILM scene
const film = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(30, W / H, 0.05, 50) };
film.scene.background = new THREE.Color(0x000000);
const footTex = new THREE.Texture();
footTex.colorSpace = THREE.NoColorSpace;
footTex.flipY = false;
footTex.generateMipmaps = true;
footTex.minFilter = THREE.LinearMipmapLinearFilter;
footTex.magFilter = THREE.LinearFilter;
footTex.anisotropy = 2;
const CARD = [0.5625, 1.0];
// footage inside the shape (opaque, premultiplied), outline glow outside (additive)
const cardMat = new THREE.ShaderMaterial({
  uniforms: { ...SHAPE_UNIFORMS(), uTex: { value: footTex }, uFoot: { value: new THREE.Vector2(...CARD) }, uFill: { value: 1 }, uFlash: { value: 0 }, uZoom: { value: 1 } },
  vertexShader: VERT,
  fragmentShader: SDF + SHAPE_HEAD + /* glsl */`
    uniform sampler2D uTex; uniform vec2 uFoot; uniform float uFill, uFlash, uZoom;
    void main() {
      vec2 p = rot2(vP - uCenter, uRot) / uScale;
      float d = mix(shapeSD(uA, uPA, p), shapeSD(uB, uPB, p), uMix) * uScale;
      float px = max(fwidth(d), 1e-7);
      float inside = 1.0 - smoothstep(-px, px, d);
      vec2 uv = clamp(vP / uFoot / uZoom + 0.5, 0.001, 0.999);
      vec3 foot = texture2D(uTex, uv).rgb;
      foot = mix(foot, foot * foot * (3.0 - 2.0 * foot), 0.35);          // gentle S-curve
      float din = max(-d, 0.0) / px;
      float inner = exp(-din / (uGlowPx * 2.2));
      vec3 col = foot * uFill * (1.0 - 0.5 * inner) * inside;
      float s = abs(d) - uStrokePx * px;
      float core = 1.0 - smoothstep(-px, px, s);
      float e = max(s, 0.0) / px;
      float glow = exp(-e / uGlowPx), halo = exp(-e / (uGlowPx * 6.0));
      vec3 light = uColor * (core * 1.1 + glow * 0.75 + halo * uHalo + inside * inner * 0.45) + vec3(1.0, 0.96, 0.88) * core * 0.85;
      col += light * uIntensity + vec3(1.0, 0.97, 0.92) * uFlash * inside;
      gl_FragColor = vec4(col, inside);
    }`,
  transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
});
const card = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.7), cardMat);
card.renderOrder = 10;
film.scene.add(card);
// ambient light of the footage behind the card (very blurred, like the glow of a screen in the dark)
const ambMat = new THREE.ShaderMaterial({
  uniforms: { uTex: { value: footTex }, uK: { value: 0.0 } },
  vertexShader: VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D uTex; uniform float uK; varying vec2 vP;
    void main() {
      vec2 uv = clamp(vP / vec2(3.2, 5.0) + 0.5, 0.02, 0.98);
      vec3 c = texture2D(uTex, uv, 7.0).rgb;
      float r = length(vP / vec2(1.6, 2.2));
      gl_FragColor = vec4(c * uK * exp(-r * r * 2.2), 1.0);
    }`,
  depthWrite: false, depthTest: false, toneMapped: false, blending: THREE.AdditiveBlending, transparent: true,
});
const amb = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), ambMat);
amb.position.z = -1.6; amb.renderOrder = 1;
film.scene.add(amb);
// echo outlines for depth (behind the card and one in front)
const filmEchoes = [
  { z: -0.24, color: PINK, k: 0.42, lag: 0.05, order: 2 },
  { z: -0.55, color: CYAN, k: 0.3, lag: 0.1, order: 3 },
  { z: 0.3, color: GOLD, k: 0.22, lag: 0.03, order: 20 },
].map((L) => {
  const mat = glowMaterial();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.8), mat);
  mesh.position.z = L.z; mesh.renderOrder = L.order;
  film.scene.add(mesh);
  return { ...L, mat, mesh };
});

function filmShapeAt(t) {
  const { shot, index, prev } = TL.filmShot(t);
  const A = FILM_SHAPES[prev ? prev.shape : shot.shape], B = FILM_SHAPES[shot.shape];
  const len = shot.t1 - shot.t0;
  const md = shot.finale ? 0.5 : len <= 0.3 ? 0.13 : 0.22;
  const m = index === 0 ? 1 : E.out3(clamp((t - shot.t0) / md, 0, 1));
  const twist = shot.finale ? 0 : (index % 2 ? 0.5 : -0.5);
  let scale = 1;
  if (shot.collapse) scale = 1 - 0.988 * E.in(clamp((t - shot.t0) / (len - 0.06), 0, 1));
  if (shot.finale) scale = 1 + 0.12 * (1 - E.out(clamp((t - shot.t0) / 0.9, 0, 1)));
  return { shot, index, A, B, m, rot: (1 - m) * twist, scale };
}
function filmIntensity(t, shot) {
  const since = t - shot.t0;
  let I = 1.0 + 0.35 * TL.beatPulse(t, 0.14);
  I += (shot.finale ? 2.6 : 1.4) * Math.exp(-since / (shot.finale ? 0.35 : 0.09));
  if (t < TL.T_FINALE) I += 0.5 * smoothstep(24, 27.5, t);
  if (shot.collapse) I += 1.6 * smoothstep(27.5, 27.95, t);
  return I;
}
async function renderFilm(t) {
  const st = filmShapeAt(t);
  const { shot } = st;
  const local = shot.off + (t - shot.t0) * (shot.finale ? 0.6 : 1);
  const bmp = await loadFrame(shot.clip, local, true);
  if (footTex.image !== bmp) { footTex.image = bmp; footTex.needsUpdate = true; }
  const cam = TL.filmCamera(t);
  film.camera.position.set(...cam.pos);
  film.camera.fov = cam.fov; film.camera.updateProjectionMatrix();
  film.camera.up.set(0, 1, 0);
  film.camera.lookAt(...cam.target);
  film.camera.rotateZ(cam.roll * DEG);
  const I = filmIntensity(t, shot);
  const fill = shot.finale ? smoothstep(28.05, 28.7, t) : shot.collapse ? 1 - smoothstep(27.6, 27.9, t) : 1;
  setShape(cardMat, st.A, st.B, st.m, {
    uRot: st.rot, uScale: st.scale, uColor: GOLD, uIntensity: I, uStrokePx: 1.6, uGlowPx: 10, uHalo: 0.32,
  });
  cardMat.uniforms.uFill.value = fill;
  cardMat.uniforms.uFlash.value = shot.finale ? 0 : 0.22 * Math.exp(-(t - shot.t0) / 0.05);
  ambMat.uniforms.uK.value = 0.16 * fill * (shot.collapse ? 1 - smoothstep(27.5, 27.8, t) : 1);
  const echoK = 1 - smoothstep(28.7, 29.8, t);
  for (const L of filmEchoes) {
    const sl = filmShapeAt(Math.max(TL.T_FILM, t - L.lag));
    L.mesh.visible = echoK > 0.001;
    setShape(L.mat, sl.A, sl.B, sl.m, {
      uRot: sl.rot, uScale: sl.scale, uColor: L.color, uIntensity: I * L.k * echoK, uStrokePx: 1.1, uGlowPx: 7, uHalo: 0.12,
    });
  }
  renderer.render(film.scene, film.camera);
}

// ---------------------------------------------------------------- MacBook acts
let cfg = { film: { x: 136, y: 5117.5, w: 1240, h: 600 } };
let cardBmp = null;
function cardDecorator(t, scrollY) {
  const a = smoothstep(14.08, 14.4, t);
  if (a <= 0 || !cardBmp) return null;
  const r = cfg.film;
  return (ctx, w, h, y2) => {
    const sx = w / 1512, sy = (h - y2) / 906;
    const x = r.x * sx, y = y2 + (r.y - scrollY) * sy, cw = r.w * sx, ch = r.h * sy;
    ctx.save();
    rrect(ctx, x, y, cw, ch, 32 * sx); ctx.clip();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, cw, ch);
    const z = 1 + 0.07 * (1 - E.out3(clamp((t - 14.08) / 0.9, 0, 1)));
    ctx.drawImage(cardBmp, x + (cw - cw * z) / 2, y + (ch - ch * z) / 2, cw * z, ch * z);
    // player chrome: progress bar along the bottom edge
    const bw = cw - 112 * sx, bx = x + 56 * sx, by = y + ch - 30 * sx;
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(bx, by, bw, 3 * sx);
    ctx.fillStyle = '#efd398'; ctx.fillRect(bx, by, bw * clamp((t - 14.08) / 95, 0, 1) + 2 * sx, 3 * sx);
    ctx.restore();
  };
}
async function decodeJpeg(b64) {
  const blob = await (await fetch('data:image/jpeg;base64,' + b64)).blob();
  return createImageBitmap(blob);
}
let screenCleared = false;
async function renderMac(t, b64, scrollY) {
  const cam = TL.camera(t);
  const c = M.camera;
  c.position.set(...cam.pos);
  c.fov = cam.fov; c.updateProjectionMatrix();
  c.up.set(0, 1, 0);
  c.lookAt(...cam.target);
  c.rotateZ(cam.roll * DEG);
  M.dof.uFocus.value = cam.focus;
  const power = TL.screenPower(t);
  const target = M.projectedScreenWidth();
  if (t >= 14.0) cardBmp = await loadFrame('card', t - 14.08, false);
  if (b64) {
    const bmp = await decodeJpeg(b64);
    M.updateScreen(bmp, target, cardDecorator(t, scrollY));
    bmp.close();
    screenCleared = false;
  } else if (!screenCleared) {
    M.clearScreen(); screenCleared = true;
  }
  M.applyScreen(power);
  const glowLight = updateHook(t);
  if (glowLight > 0.001) {
    // add the gold light of the glow shapes to the display's light
    const col = M.screenLight.color.clone().multiplyScalar(M.screenLight.intensity).add(GOLD_LIN.clone().multiplyScalar(glowLight * 7));
    const I = Math.max(col.r, col.g, col.b, 1e-6);
    M.screenLight.color.copy(col).multiplyScalar(1 / I);
    M.screenLight.intensity = I;
    M.deskU.uScrCol.value.copy(M.screenLight.color).multiplyScalar(I * (MBP.screenW * MBP.screenH) / Math.PI);
  }
  M.setBacklight(TL.backlight(t));
  renderer.render(M.scene, M.camera);
  return target;
}

// ---------------------------------------------------------------- typography
const CREAM = '#f3ece0';
const F = {
  serif: (px) => `italic 500 ${px * K}px 'Bodoni Moda'`,
  caps: (px) => `600 ${px * K}px 'Inter Tight'`,
  bold: (px) => `700 ${px * K}px 'Inter Tight'`,
  black: (px) => `800 ${px * K}px 'Inter Tight'`,
  body: (px) => `400 ${px * K}px 'Inter'`,
};
const goldFill = (ctx, y, size) => {
  const g = ctx.createLinearGradient(0, y - size * 0.82, 0, y + size * 0.08);
  g.addColorStop(0, '#fff4da'); g.addColorStop(0.42, '#efd398'); g.addColorStop(1, '#bf9550');
  return g;
};
// One line of kinetic type: words rise out of a mask (expo-out), leave upwards (cubic-in).
function kline(ctx, t, o) {
  const tin = o.tin, tout = o.tout ?? 999;
  if (t < tin || t > tout + 0.8) return;
  const size = o.size * K;
  ctx.save();
  ctx.font = o.font(o.size);
  ctx.textBaseline = 'alphabetic';
  const trackIn = o.track0 != null ? lerp(o.track0, o.track ?? 0, E.out(clamp((t - tin) / 1.1, 0, 1))) : (o.track ?? 0);
  ctx.letterSpacing = `${trackIn * K}px`;
  const words = o.text.split(' ');
  const space = ctx.measureText(' ').width;
  const ws = words.map((w) => ctx.measureText(w).width);
  let x = o.x * K;
  const y = o.y * K;
  const stagger = o.stagger ?? 0.07, dur = o.dur ?? 0.62;
  words.forEach((w, i) => {
    const u = clamp((t - tin - i * stagger) / dur, 0, 1);
    const v = clamp((t - tout - i * 0.035) / 0.34, 0, 1);
    if (u <= 0 || v >= 1) { x += ws[i] + space; return; }
    const dy = (1 - E.out(u)) * size * 1.08 - E.in(v) * size * 1.08;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - size * 0.6, y - size * 1.06, ws[i] + size * 1.2, size * 1.36); ctx.clip();
    const gold = o.goldWords && o.goldWords.includes(i);
    ctx.fillStyle = o.fill === 'gold' || gold ? goldFill(ctx, y + dy, size) : o.fill;
    if (o.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 26 * K; ctx.shadowOffsetY = 4 * K; }
    ctx.globalAlpha = (o.alpha ?? 1) * Math.min(1, u * 2.5);
    ctx.fillText(w, x, y + dy);
    ctx.restore();
    x += ws[i] + space;
  });
  ctx.restore();
}
// kicker: a drawn gold rule + tracked caps
function kicker(ctx, t, o) {
  if (t < o.tin || t > (o.tout ?? 999) + 0.8) return;
  const u = E.out(clamp((t - o.tin) / 0.7, 0, 1));
  const v = E.in(clamp((t - (o.tout ?? 999)) / 0.3, 0, 1));
  const len = 44 * K * u * (1 - v);
  ctx.save();
  ctx.fillStyle = 'rgba(239,211,152,0.95)';
  ctx.fillRect(o.x * K, o.y * K - 9 * K, len, 2 * K);
  ctx.restore();
  kline(ctx, t, { ...o, x: o.x + 60, font: F.caps, size: o.size ?? 26, fill: 'rgba(239,211,152,0.95)', track0: 22, track: 7, stagger: 0.03, shadow: false });
}

const TEXT = [];
// HOOK — the caption
TEXT.push((c, t) => kline(c, t, { tin: 0.06, tout: 3.5, x: 90, y: 338, size: 132, font: F.serif, fill: CREAM, text: 'Our way' }));
TEXT.push((c, t) => kline(c, t, { tin: 0.52, tout: 3.55, x: 90, y: 476, size: 132, font: F.serif, fill: CREAM, text: 'to celebrate' }));
TEXT.push((c, t) => kicker(c, t, { tin: 1.0, tout: 3.6, x: 96, y: 1380, size: 30, text: 'THE LAUNCH OF' }));
TEXT.push((c, t) => kline(c, t, { tin: 2.0, tout: 3.65, x: 86, y: 1548, size: 170, font: F.black, fill: 'gold', track: -4, text: 'GTA VI', stagger: 0.09 }));
// TOUR — what we are looking at, chapter by chapter
TEXT.push((c, t) => kicker(c, t, { tin: 5.3, tout: 13.35, x: 96, y: 268, size: 22, text: 'A FAN-MADE LANDING PAGE' }));
const CHAPTERS = [
  [6.25, 6.95, 'The story'], [7.25, 7.95, 'Key features'], [8.25, 8.95, 'Only in Leonida'], [9.25, 9.95, 'Jason & Lucia'],
  [10.25, 10.95, 'Editions'], [11.25, 11.88, 'November 19'], [12.3, 14.9, 'Launch Trailer'],
];
CHAPTERS.forEach(([tin, tout, title], i) => {
  TEXT.push((c, t) => kline(c, t, { tin, tout, x: 96, y: 1366, size: 27, font: F.caps, fill: 'rgba(239,211,152,0.95)', track: 7, text: `0${i + 1} / 07`, shadow: false, stagger: 0 }));
  TEXT.push((c, t) => kline(c, t, { tin: tin + 0.05, tout, x: 92, y: 1458, size: 78, font: F.serif, fill: CREAM, text: title }));
});
// FILM — facts, one per shot
const LABELS = [
  [16.12, 17.72, '01 — THE SETTING', ['Vice City'], 150],
  [18.08, 19.72, '02 — THE STATE', ['Leonida'], 150],
  [20.08, 21.72, '03 — THE DUO', ['Jason & Lucia'], 128],
  [22.08, 23.72, '04 — THE DATE', ['11.19.2026'], 140],
  [24.05, 25.8, '05 — THE PLATFORMS', ['PlayStation 5', 'Xbox Series X|S'], 104],
];
for (const [tin, tout, k, lines, size] of LABELS) {
  const y0 = lines.length > 1 ? 1180 : 1250;
  TEXT.push((c, t) => kicker(c, t, { tin, tout, x: 96, y: y0, size: 27, text: k }));
  lines.forEach((ln, j) => {
    TEXT.push((c, t) => kline(c, t, { tin: tin + 0.06 + j * 0.1, tout: tout + j * 0.04, x: 90, y: y0 + 136 + j * size * 1.02, size, font: F.serif, fill: CREAM, text: ln }));
  });
}
// FINALE — the caption, the date, the fine print
TEXT.push((c, t) => kline(c, t, { tin: 28.2, x: 92, y: 352, size: 86, font: F.serif, fill: CREAM, text: 'Our way to celebrate' }));
TEXT.push((c, t) => kline(c, t, { tin: 28.42, x: 92, y: 458, size: 86, font: F.serif, fill: CREAM, text: 'the launch of GTA VI.', goldWords: [3, 4] }));
TEXT.push((c, t) => kline(c, t, { tin: 28.75, x: 90, y: 1398, size: 112, font: F.bold, fill: 'gold', track: -2, text: '11.19.2026' }));
TEXT.push((c, t) => kline(c, t, { tin: 28.95, x: 96, y: 1454, size: 23, font: F.caps, fill: 'rgba(243,236,224,0.82)', track: 7, text: 'PLAYSTATION 5  ·  XBOX SERIES X|S', shadow: false, stagger: 0.02 }));
TEXT.push((c, t) => kline(c, t, { tin: 29.35, x: 96, y: 1522, size: 19, font: F.body, fill: 'rgba(255,255,255,0.5)', text: 'Unofficial fan concept. Not affiliated with Rockstar Games or Take-Two Interactive.', shadow: false, stagger: 0.012, dur: 0.5 }));
TEXT.push((c, t) => kline(c, t, { tin: 29.5, x: 96, y: 1550, size: 19, font: F.body, fill: 'rgba(255,255,255,0.5)', text: 'Footage: Pexels & Mixkit (royalty-free). Original music.', shadow: false, stagger: 0.012, dur: 0.5 }));

function overlays(t) {
  const c = octx;
  // dive flash into the film, and the finale hit
  let f = t < TL.T_FILM ? Math.pow(smoothstep(15.3, 16.0, t), 2.2) : Math.exp(-(t - TL.T_FILM) / 0.17);
  if (t >= TL.T_FINALE) f = Math.max(f, 0.55 * Math.exp(-(t - TL.T_FINALE) / 0.22));
  if (f > 0.002) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * (0.22 + 0.75 * f));
    g.addColorStop(0, `rgba(255,250,240,${f})`);
    g.addColorStop(0.4, `rgba(255,232,190,${0.75 * f})`);
    g.addColorStop(1, 'rgba(239,211,152,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (f > 0.55) { c.fillStyle = `rgba(255,248,236,${((f - 0.55) / 0.45) * 0.95})`; c.fillRect(0, 0, W, H); }
    c.restore();
  }
  // vertical safe-area scrim behind the lower text block (only where text sits over footage)
  for (const draw of TEXT) draw(c, t);
  // end on black: the clip loops back into the black first frame
  const fade = smoothstep(31.05, 31.95, t);
  if (fade > 0) { c.fillStyle = `rgba(0,0,0,${fade})`; c.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- frame
// subs: motion-blur subframes [{ t, b64, scrollY }], equally weighted; t: the frame's own time
async function frame(subs, t) {
  octx.save();
  octx.globalCompositeOperation = 'source-over';
  for (let k = 0; k < subs.length; k++) {
    const s = subs[k];
    if (s.t < TL.T_FILM) await renderMac(s.t, s.b64, s.scrollY);
    else await renderFilm(s.t);
    octx.globalAlpha = 1 / (k + 1);
    octx.drawImage(renderer.domElement, 0, 0);
  }
  octx.restore();
  overlays(t);
  return true;
}

// ---------------------------------------------------------------- boot
const ready = (async () => {
  await Promise.all([
    document.fonts.load(`italic 500 40px 'Bodoni Moda'`), document.fonts.load(`500 40px 'Bodoni Moda'`),
    document.fonts.load(`600 40px 'Inter Tight'`), document.fonts.load(`800 40px 'Inter Tight'`),
    document.fonts.load(`400 40px 'Inter'`), document.fonts.load(`500 40px 'Inter'`),
  ]);
  await M.init();
  await loadMeta();
  footTex.image = await loadFrame('city', 0, true); footTex.needsUpdate = true;
  renderer.compile(M.scene, M.camera);
  renderer.compile(film.scene, film.camera);
  renderer.render(film.scene, film.camera);
  renderer.render(M.scene, M.camera);
  return true;
})();

window.__scene = { ready, frame, configure: (c) => { cfg = { ...cfg, ...c }; }, W, H, SW, SH: SCRH };
window.__dbg = { M, film, renderer, THREE };
