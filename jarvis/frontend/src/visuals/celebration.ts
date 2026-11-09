// "SINGULARITY" — the mission-accomplished sequence, in the same particle
// language as the three modes (white points, additive glow, black space).
//
//   0.0  a particle galaxy spins up and falls inward, faster and faster
//   1.9  everything collapses into a trembling white core — silence
//   2.3  detonation: flash, two shock rings, the camera kicks
//   2.5  the debris locks into the words of the title, left to right,
//        while two orbits close around them and dust settles into depth
//   4.0  a light sweep runs across the letters (the data panel appears)
//   8.6  the words are blown away like ash
//
// The whole timeline runs in the vertex shader from one time uniform, so it
// costs the same as the other modes and can be rendered frame by frame.
import * as THREE from "three";
import { POINT_FRAGMENT, SIMPLEX, Scene3D, Stage, rng } from "./stage";

export const T = { gather: 1.9, detonate: 2.3, form: 2.5, info: 4.2, dissolve: 8.6, end: 10.4 };

const VERTEX = /* glsl */ `
  ${SIMPLEX}
  attribute vec3 aStart;
  attribute vec3 aTarget;
  attribute vec3 aDir;
  attribute vec2 aRnd;
  attribute float aKind;
  uniform float uT, uTime, uPixel, uHalfW;
  varying float vAlpha;

  const float G = ${T.gather.toFixed(2)};
  const float D = ${T.detonate.toFixed(2)};
  const float F = ${T.form.toFixed(2)};
  const float S = ${T.dissolve.toFixed(2)};

  mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
  mat3 rotZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
  mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }

  // Where this particle belongs once the title has formed (it can move).
  vec3 home() {
    if (aKind < 0.5) {
      vec3 q = aTarget;
      q += 0.012 * vec3(snoise(q * 3.0 + uTime * 0.6), snoise(q * 3.0 + 9.0 + uTime * 0.6), 0.0);
      return q;
    }
    if (aKind < 1.5) {
      float ring = aTarget.z;
      float a = aTarget.x + uTime * (ring < 0.5 ? 0.22 : -0.16);
      vec3 q = vec3(cos(a), 0.0, sin(a)) * aTarget.y;
      q.y += (aRnd.x - 0.5) * 0.04;
      return ring < 0.5 ? rotZ(0.10) * rotX(1.26) * q : rotZ(-0.22) * rotX(-1.12) * q;
    }
    return rotY(uTime * 0.025) * aTarget;
  }

  void main() {
    float t = uT;
    vec3 p;
    float alpha;
    float size = aKind < 0.5 ? 1.15 : (aKind < 1.5 ? 1.2 : 0.95);
    size *= 0.6 + aRnd.y * 0.8;

    if (t < G) {
      // Galaxy falling into the centre: slow start, violent end.
      float g = t / G;
      float ge = 0.15 * g * g * (3.0 - 2.0 * g) + 0.85 * pow(g, 3.2);
      float r = length(aStart.xz);
      float a = atan(aStart.z, aStart.x) + t * (0.35 + 1.2 / (r + 0.5)) + pow(g, 3.0) * 7.0;
      float s = 1.0 - ge;
      p = vec3(cos(a) * r * s, aStart.y * s * s, sin(a) * r * s);
      alpha = (aKind > 1.5 ? 0.2 : 0.3) * (0.6 + 0.5 * ge) * smoothstep(0.0, 0.5, t) * (1.0 - 0.75 * smoothstep(0.75, 1.0, g));
    } else if (t < D) {
      // The core: compressed, trembling, white hot.
      float k = (t - G) / (D - G);
      float j = sin(uTime * 70.0 + aRnd.x * 40.0);
      // A small sphere of white-hot grain, contracting and boiling.
      p = aDir * (0.12 + 0.28 * pow(aRnd.y, 2.0)) * (1.0 - 0.55 * k) * (1.0 + 0.12 * j);
      alpha = 0.035;
    } else {
      // Detonation, then the debris finds its place.
      float b = t - D;
      float spd = 1.4 + pow(aRnd.y, 2.0) * 9.0;
      vec3 e = aDir * spd * (1.0 - exp(-b * 2.6));
      float order = aKind < 0.5 ? clamp(aTarget.x / uHalfW * 0.5 + 0.5, 0.0, 1.0) * 0.9 : 0.35;
      float f = clamp((t - (F + order + aRnd.x * 0.35)) / (1.0 + aRnd.y * 0.6), 0.0, 1.0);
      float fb = f - 1.0;
      float fe = aKind < 0.5 ? 1.0 + 2.4 * fb * fb * fb + 1.4 * fb * fb : 1.0 - pow(1.0 - f, 4.0);
      vec3 h = home();
      p = mix(e, h, fe);
      float settled = aKind < 0.5 ? 0.42 : (aKind < 1.5 ? 0.5 : 0.3);
      alpha = mix(0.3, settled, fe) * (0.04 + 0.96 * smoothstep(0.05, 0.6, b));
      // Light sweep across the letters.
      if (aKind < 0.5 && t > 3.9) {
        float sx = -uHalfW * 1.5 + mod(t - 3.9, 2.6) / 2.6 * uHalfW * 3.0;
        alpha *= 1.0 + 1.3 * exp(-pow((h.x + h.y * 0.6 - sx) * 1.7, 2.0));
      }
      // Ash in the wind.
      float order2 = aKind < 0.5 ? clamp(aTarget.x / uHalfW * 0.5 + 0.5, 0.0, 1.0) * 0.6 : aRnd.x * 0.6;
      float dd = clamp((t - S - order2) / 1.3, 0.0, 1.0);
      vec3 wind = vec3(snoise(h * 0.8 + uTime * 0.3), snoise(h * 0.8 + 7.0 + uTime * 0.3) + 0.9,
                       snoise(h * 0.8 + 13.0));
      p += wind * dd * dd * 3.0;
      alpha *= 1.0 - dd;
    }

    alpha *= 0.85 + 0.15 * sin(uTime * 3.0 + aRnd.x * 40.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = alpha;
    gl_PointSize = min(size * uPixel / -mv.z, 7.0 * uPixel / 11.0);
  }
`;

const RING_VERTEX = /* glsl */ `
  attribute float aAng;
  attribute float aRnd;
  attribute float aWhich;
  uniform float uB, uPixel;
  varying float vAlpha;
  void main() {
    float bb = uB - aWhich * 0.14;
    float R = (aWhich < 0.5 ? 9.5 : 6.5) * (1.0 - exp(-max(bb, 0.0) * 2.1));
    float w = (aRnd - 0.5) * (0.06 + R * 0.035);
    vec3 dir = aWhich < 0.5 ? vec3(cos(aAng), sin(aAng), 0.0) : vec3(cos(aAng), sin(aAng) * 0.32, sin(aAng) * 0.95);
    vec3 p = dir * (R + w);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = bb < 0.0 ? 0.0 : exp(-bb * 1.5) * (0.5 + 0.5 * aRnd) * 0.8;
    gl_PointSize = (1.0 + aRnd) * uPixel / -mv.z;
  }
`;

/** Points of the title, sampled from text drawn on a 2D canvas. */
function sampleText(text: string, count: number, worldWidth: number, rand: () => number): Float32Array {
  const c = document.createElement("canvas");
  const font = `600 190px -apple-system, "SF Pro Display", "Helvetica Neue", "IBM Plex Sans", Arial, sans-serif`;
  const ctx = c.getContext("2d")!;
  ctx.font = font;
  const spacing = 22;
  const textW = ctx.measureText(text).width + spacing * text.length;
  c.width = Math.ceil(textW + 40);
  c.height = 260;
  const g = c.getContext("2d")!;
  g.font = font;
  g.fillStyle = "#fff";
  g.textBaseline = "middle";
  let x = 20;
  for (const ch of text) {
    g.fillText(ch, x, 130);
    x += g.measureText(ch).width + spacing;
  }
  const img = g.getImageData(0, 0, c.width, c.height).data;
  const px: number[] = [];
  for (let y = 0; y < c.height; y += 2) {
    for (let xx = 0; xx < c.width; xx += 2) {
      if (img[(y * c.width + xx) * 4 + 3] > 140) px.push(xx, y);
    }
  }
  const scale = worldWidth / (x - spacing - 20);
  const out = new Float32Array(count * 3);
  const n = px.length / 2;
  for (let i = 0; i < count; i++) {
    const k = Math.floor(rand() * n) * 2;
    out[i * 3] = (px[k] - 20 + (rand() - 0.5) * 2 - (x - spacing - 20) / 2) * scale;
    out[i * 3 + 1] = -(px[k + 1] - 130 + (rand() - 0.5) * 2) * scale;
    out[i * 3 + 2] = (rand() - 0.5) * 0.06;
  }
  return out;
}

export class CelebrationScene implements Scene3D {
  private material: THREE.ShaderMaterial;
  private ringMaterial: THREE.ShaderMaterial;
  private group = new THREE.Group();
  private t = 0;

  private shake = new THREE.Vector3();

  constructor(private stage: Stage, title: string) {
    const total = { low: 26000, medium: 46000, high: 72000 }[stage.quality];
    const rand = rng(42);
    const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-6, rand()))) * Math.cos(2 * Math.PI * rand());
    const aspect = Math.max(0.5, stage.camera.aspect || 16 / 9);
    const visibleW = 2 * 7.4 * Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2)) * aspect;
    const worldW = Math.min(7.6, visibleW * 0.84);

    const nText = Math.floor(total * 0.4);
    const nOrbit = Math.floor(total * 0.12);
    const textPts = sampleText(title.toUpperCase(), nText, worldW, rand);

    const start = new Float32Array(total * 3);
    const target = new Float32Array(total * 3);
    const dir = new Float32Array(total * 3);
    const rnd = new Float32Array(total * 2);
    const kind = new Float32Array(total);
    const v = new THREE.Vector3();
    for (let i = 0; i < total; i++) {
      const k = i < nText ? 0 : i < nText + nOrbit ? 1 : 2;
      kind[i] = k;
      rnd[i * 2] = rand();
      rnd[i * 2 + 1] = rand();
      // Start: a three-armed galaxy, plus a halo that fills the screen.
      if (rand() < 0.78) {
        const r = 1.2 + Math.pow(rand(), 0.6) * 10.5;
        const arm = Math.floor(rand() * 3);
        const a = (arm * 2 * Math.PI) / 3 + r * 0.42 + gauss() * 0.32;
        start.set([Math.cos(a) * r, gauss() * 0.22 * (1 + r * 0.06), Math.sin(a) * r], i * 3);
      } else {
        v.set(gauss(), gauss() * 0.5, gauss()).normalize().multiplyScalar(5 + rand() * 9);
        start.set([v.x, v.y, v.z], i * 3);
      }
      // Explosion direction: a third of the debris flies in the screen plane (a visible ring).
      if (rand() < 0.33) {
        const a = rand() * Math.PI * 2;
        v.set(Math.cos(a), Math.sin(a), (rand() - 0.5) * 0.15);
      } else v.set(gauss(), gauss(), gauss());
      v.normalize();
      dir.set([v.x, v.y, v.z], i * 3);
      // Final place.
      if (k === 0) target.set(textPts.subarray(i * 3, i * 3 + 3), i * 3);
      else if (k === 1) {
        const ring = rand() < 0.55 ? 0 : 1;
        target.set([rand() * Math.PI * 2, (ring === 0 ? worldW * 0.6 : worldW * 0.66) + gauss() * 0.02, ring], i * 3);
      } else {
        v.set(gauss(), gauss() * 0.7, gauss()).normalize().multiplyScalar(4.5 + Math.pow(rand(), 0.7) * 10);
        target.set([v.x, v.y, v.z - 3], i * 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(total * 3), 3));
    geo.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
    geo.setAttribute("aTarget", new THREE.BufferAttribute(target, 3));
    geo.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
    geo.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 2));
    geo.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX, fragmentShader: POINT_FRAGMENT, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uTime: { value: 0 }, uPixel: { value: 1 }, uHalfW: { value: worldW / 2 } },
    });
    this.group.add(new THREE.Points(geo, this.material));

    // Shock rings.
    const nRing = { low: 3000, medium: 5000, high: 8000 }[stage.quality];
    const ang = new Float32Array(nRing);
    const rr = new Float32Array(nRing);
    const which = new Float32Array(nRing);
    for (let i = 0; i < nRing; i++) {
      ang[i] = rand() * Math.PI * 2;
      rr[i] = rand();
      which[i] = i % 3 === 0 ? 1 : 0;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nRing * 3), 3));
    rg.setAttribute("aAng", new THREE.BufferAttribute(ang, 1));
    rg.setAttribute("aRnd", new THREE.BufferAttribute(rr, 1));
    rg.setAttribute("aWhich", new THREE.BufferAttribute(which, 1));
    rg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);
    this.ringMaterial = new THREE.ShaderMaterial({
      vertexShader: RING_VERTEX, fragmentShader: POINT_FRAGMENT, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, uniforms: { uB: { value: -1 }, uPixel: { value: 1 } },
    });
    this.group.add(new THREE.Points(rg, this.ringMaterial));
    stage.scene.add(this.group);
    stage.setBloom(0.8, 0.5, 0.2);
  }

  /** Timeline position in seconds (driven by the component's clock). */
  setTime(t: number) {
    this.t = t;
  }

  update(dt: number, time: number) {
    const t = this.t;

    const u = this.material.uniforms;
    u.uT.value = t;
    u.uTime.value = time;
    u.uPixel.value = 11 * this.stage.pixelScale;
    this.ringMaterial.uniforms.uB.value = t - T.detonate;
    this.ringMaterial.uniforms.uPixel.value = 11 * this.stage.pixelScale;

    // Camera: above the galaxy while it falls, then face to face with the title.
    const cam = this.stage.camera;
    const b = t - T.detonate;
    if (t < T.detonate) {
      const g = Math.min(1, t / T.gather);
      const a = 0.35 - t * 0.12;
      const dist = 10.5 - g * g * 3.2;
      const h = 4.2 - g * 2.0;
      cam.position.set(Math.sin(a) * dist, h, Math.cos(a) * dist);
      if (t > T.gather) {
        const k = (t - T.gather) / (T.detonate - T.gather);
        this.shake.set(Math.random() - 0.5, Math.random() - 0.5, 0).multiplyScalar(0.035 * k);
        cam.position.add(this.shake);
      }
    } else {
      const k = Math.min(1, b / 1.6);
      const e = 1 - Math.pow(1 - k, 3);
      const a = 0.35 - T.detonate * 0.12;
      const d0 = 10.5 - 3.2;
      const from = new THREE.Vector3(Math.sin(a) * d0, 2.2, Math.cos(a) * d0);
      const drift = new THREE.Vector3(Math.sin(time * 0.33) * 0.5, Math.cos(time * 0.27) * 0.2, 7.4);
      cam.position.copy(from.lerp(drift, e));
      const kick = Math.exp(-b * 7);
      this.shake.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.28 * kick);
      cam.position.add(this.shake);
    }
    cam.lookAt(0, 0, 0);

    // Glow: builds up, burns at the core, settles.
    let bloom = 0.7;
    if (t < T.gather) bloom = 0.7 + Math.pow(t / T.gather, 3) * 0.6;
    else if (t < T.detonate) bloom = 1.3 + Math.sin(time * 40) * 0.2;
    else bloom = 0.75 + 0.9 * Math.exp(-b * 2.2);
    this.stage.setBloomStrength(bloom);
    void dt;
  }

  dispose() {
    this.stage.scene.remove(this.group);
  }
}
