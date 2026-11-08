// MODE A — volumetric particle landscape (reference 01-dashboard-reference.jpg).
// The terrain is real data: the X axis is time (one column per hour), the Z
// axis is the activity category, and every peak is a Gaussian built from the
// actual event counts. Without activity the terrain stays flat.
import * as THREE from "three";
import { POINT_FRAGMENT, SIMPLEX, Scene3D, Stage, rng, shuffleGroups } from "./stage";

export const CATEGORIES = ["tasks", "research", "leads", "chat", "dev"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Series = Record<Category, number[]>;

const W = 3.4; // world width (x)
const D = 1.7; // world depth (z)
const H = 1.05; // max height

const VERTEX = /* glsl */ `
  ${SIMPLEX}
  attribute float aFrom;
  attribute float aTo;
  attribute float aRand;
  attribute float aHaze;
  uniform float uTime, uMix, uPixel;
  varying float vAlpha;
  void main() {
    float h = mix(aFrom, aTo, uMix);
    vec3 p = position;
    float ripple = snoise(vec3(p.x * 2.2, p.z * 2.2, uTime * 0.08)) * 0.025;
    float wave = sin(p.x * 3.0 - uTime * 0.6 + p.z * 2.0) * 0.006;
    if (aHaze > 0.5) {
      // granular haze under and around the terrain
      p.y = h * ${H.toFixed(2)} * aRand * 0.9 + ripple * 0.5;
    } else {
      p.y = h * ${H.toFixed(2)} + ripple * (0.35 + h) + wave;
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depthFade = smoothstep(9.0, 1.2, -mv.z);
    float a = aHaze > 0.5 ? (0.05 + 0.18 * h) : (0.10 + 0.9 * pow(h, 0.7));
    a *= 0.55 + 0.45 * aRand;
    vAlpha = a * depthFade;
    gl_PointSize = (aHaze > 0.5 ? 0.8 : 1.0 + h * 1.6) * uPixel / -mv.z;
  }
`;

export class DataLandscape implements Scene3D {
  private points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private from: Float32Array;
  private to: Float32Array;
  private terrainCount: number;
  private total: number;
  private cellX: Float32Array;
  private cellZ: Float32Array;
  private mix = 1;
  private shown = 1;
  private orbit = 0;

  constructor(private stage: Stage) {
    const [gx, gz, haze] = { low: [170, 85, 6000], medium: [240, 120, 12000], high: [320, 160, 22000] }[stage.quality];
    this.terrainCount = gx * gz;
    this.total = this.terrainCount + haze;
    const rand = rng(3);
    const pos = new Float32Array(this.total * 3);
    const rnd = new Float32Array(this.total);
    const isHaze = new Float32Array(this.total);
    this.cellX = new Float32Array(this.total);
    this.cellZ = new Float32Array(this.total);
    for (let i = 0; i < this.total; i++) {
      let u: number, v: number;
      if (i < this.terrainCount) {
        const ix = i % gx;
        const iz = Math.floor(i / gx);
        u = (ix + rand() * 0.9) / gx;
        v = (iz + rand() * 0.9) / gz;
      } else {
        u = rand();
        v = rand();
        isHaze[i] = 1;
      }
      this.cellX[i] = u;
      this.cellZ[i] = v;
      pos[i * 3] = (u - 0.5) * W;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = (v - 0.5) * D;
      rnd[i] = rand();
    }
    shuffleGroups(
      [{ arr: pos, stride: 3 }, { arr: rnd, stride: 1 }, { arr: isHaze, stride: 1 }, { arr: this.cellX, stride: 1 }, { arr: this.cellZ, stride: 1 }],
      this.total, rand,
    );
    this.from = new Float32Array(this.total);
    this.to = new Float32Array(this.total);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aFrom", new THREE.BufferAttribute(this.from, 1));
    geo.setAttribute("aTo", new THREE.BufferAttribute(this.to, 1));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));
    geo.setAttribute("aHaze", new THREE.BufferAttribute(isHaze, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: POINT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uMix: { value: 1 }, uPixel: { value: 2 } },
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    stage.scene.add(this.points);
    this.placeCamera(0);
  }

  private placeCamera(angle: number) {
    const cam = this.stage.camera;
    const r = 3.15;
    cam.position.set(Math.sin(angle) * r, 1.05, Math.cos(angle) * r);
    cam.lookAt(0, 0.28, 0);
  }

  /** Rebuild the terrain from real activity counts (one array per category). */
  setData(series: Series) {
    const hours = Math.max(1, ...CATEGORIES.map((c) => series[c]?.length ?? 0));
    const kernels: { x: number; z: number; v: number }[] = [];
    let max = 0;
    CATEGORIES.forEach((cat, ci) => {
      const arr = series[cat] ?? [];
      arr.forEach((n, hi) => {
        if (n <= 0) return;
        const v = Math.log1p(n);
        max = Math.max(max, v);
        kernels.push({ x: (hi + 0.5) / hours, z: (ci + 0.5) / CATEGORIES.length, v });
      });
    });
    const sx = 1.6 / hours;
    const sz = 0.075;
    const heights = new Float32Array(this.total);
    if (max > 0) {
      for (let i = 0; i < this.total; i++) {
        const u = this.cellX[i];
        const w = this.cellZ[i];
        let h = 0;
        for (const k of kernels) {
          const dx = (u - k.x) / sx;
          if (dx > 4 || dx < -4) continue;
          const dz = (w - k.z) / sz;
          if (dz > 4 || dz < -4) continue;
          h += k.v * Math.exp(-0.5 * (dx * dx + dz * dz));
        }
        heights[i] = h;
      }
      let hmax = 0;
      for (let i = 0; i < this.total; i++) hmax = Math.max(hmax, heights[i]);
      if (hmax > 0) for (let i = 0; i < this.total; i++) heights[i] = Math.pow(heights[i] / hmax, 0.85);
    }
    // Animate from the currently displayed heights to the new ones.
    const geo = this.points.geometry;
    const cur = this.shown;
    for (let i = 0; i < this.total; i++) this.from[i] = this.from[i] + (this.to[i] - this.from[i]) * cur;
    this.to.set(heights);
    (geo.getAttribute("aFrom") as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute("aTo") as THREE.BufferAttribute).needsUpdate = true;
    this.mix = 0;
  }

  /** Screen position (CSS px) of a point on the ground plane, for HTML labels. */
  project(u: number, v: number, y = 0): { x: number; y: number; visible: boolean } {
    const p = new THREE.Vector3((u - 0.5) * W, y, (v - 0.5) * D).project(this.stage.camera);
    const el = this.stage.renderer.domElement;
    return { x: ((p.x + 1) / 2) * el.clientWidth, y: ((1 - p.y) / 2) * el.clientHeight, visible: p.z < 1 };
  }

  setDensity(f: number) {
    this.points.geometry.setDrawRange(0, Math.floor(this.total * f));
  }

  update(dt: number, t: number) {
    this.mix = Math.min(1, this.mix + dt / 1.6);
    const eased = this.mix < 1 ? 1 - Math.pow(1 - this.mix, 3) : 1;
    this.shown = eased;
    const u = this.material.uniforms;
    u.uTime.value = t;
    u.uMix.value = eased;
    u.uPixel.value = 1.4 * this.stage.pixelScale * 2.4;
    this.orbit = Math.sin(t * 0.05) * 0.22;
    this.placeCamera(this.orbit);
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
