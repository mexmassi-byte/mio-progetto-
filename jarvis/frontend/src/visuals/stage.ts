// Shared WebGL stage: renderer, camera, render loop, adaptive quality,
// reduced-motion handling, pause when hidden, and full resource cleanup.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export type Quality = "low" | "medium" | "high";

export class WebGLUnavailable extends Error {}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function isSoftwareRenderer(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Quality explicitly chosen by the user in Settings (null = automatic). */
export function savedQuality(): Quality | null {
  try {
    const saved = localStorage.getItem("jarvis.quality");
    if (saved === "low" || saved === "medium" || saved === "high") return saved;
  } catch {
    /* ignore */
  }
  return null;
}

export function chooseQuality(): Quality {
  const saved = savedQuality();
  if (saved) return saved;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as any).deviceMemory || 8;
  if (cores >= 8 && mem >= 8) return "high";
  if (cores >= 4) return "medium";
  return "low";
}

export interface Scene3D {
  /** Called every frame with delta and elapsed time in seconds. */
  update(dt: number, t: number): void;
  /** Fraction (0..1) of particles to draw; lowered automatically when slow. */
  setDensity?(fraction: number): void;
  dispose(): void;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly reducedMotion = prefersReducedMotion();
  readonly quality: Quality;
  private content: Scene3D | null = null;
  private raf = 0;
  private last = 0;
  private elapsed = 0;
  private ro: ResizeObserver;
  private frameTimes: number[] = [];
  private density = 1;
  private pixelRatio: number;
  private minFrameMs = 0;
  private lastRender = 0;
  /** True when WebGL is emulated on the CPU (no GPU acceleration). */
  readonly software: boolean;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  fps = 0;
  /** Fixed quality (no automatic downgrade): used for frame-exact capture. */
  fixed = false;

  constructor(private canvas: HTMLCanvasElement, fov = 40) {
    if (!webglAvailable()) throw new WebGLUnavailable("WebGL non disponibile");
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    // Without a GPU, WebGL runs on the CPU and would starve the local AI
    // model: use the lightest settings and cap the frame rate.
    this.software = isSoftwareRenderer(this.renderer);
    // An explicit choice in Settings always wins over the automatic one.
    const explicit = savedQuality();
    this.quality = explicit ?? (this.software ? "low" : chooseQuality());
    if (this.software && !explicit) this.minFrameMs = 1000 / 20;
    this.renderer.setClearColor(0x000000, 1);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.quality === "high" ? 2 : 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.01, 100);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  /** Cinematic glow on the brightest particles (as in the references).
   *  Skipped in low quality: it costs one extra full-screen pass. */
  setBloom(strength = 0.9, radius = 0.55, threshold = 0.1) {
    if (this.quality === "low") return;
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), strength, radius, threshold);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  setBloomStrength(v: number) {
    if (this.bloomPass) this.bloomPass.strength = v;
  }

  get bloomEnabled(): boolean {
    return !!this.composer;
  }

  get pixelScale(): number {
    if (this.software && this.quality === "low") return (this.canvas.clientHeight || 600) / 800;
    return this.renderer.getPixelRatio() * (this.canvas.clientHeight || 600) / 800;
  }

  mount(content: Scene3D) {
    this.content = content;
    this.last = performance.now();
    this.loop();
  }

  private onVisibility = () => {
    if (document.hidden) cancelAnimationFrame(this.raf);
    else {
      this.last = performance.now();
      this.loop();
    }
  };

  private resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    if (this.minFrameMs && !this.fixed && now - this.lastRender < this.minFrameMs) return;
    this.lastRender = now;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    // Reduced motion: animation runs 5x slower instead of stopping entirely,
    // so state changes stay visible.
    this.elapsed += this.reducedMotion ? dt * 0.2 : dt;
    this.content?.update(this.reducedMotion ? dt * 0.2 : dt, this.elapsed);
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    this.adapt(dt);
  };

  private adapt(dt: number) {
    if (this.fixed) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    this.fps = Math.round(1 / avg);
    if (avg > 1 / 40) {
      // Too slow: first lower resolution, then particle count.
      if (this.composer && this.pixelRatio <= 1.25) {
        this.disableBloom(); // the glow goes before resolution and particles
      } else if (this.pixelRatio > 1) {
        this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.resize();
      } else if (this.density > 0.35) {
        this.density = Math.max(0.35, this.density - 0.15);
        this.content?.setDensity?.(this.density);
      }
    } else if (avg < 1 / 58 && this.density < 1) {
      this.density = Math.min(1, this.density + 0.05);
      this.content?.setDensity?.(this.density);
    }
  }

  private disableBloom() {
    this.bloomPass?.dispose();
    this.composer?.dispose();
    this.composer = null;
    this.bloomPass = null;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.disableBloom();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.ro.disconnect();
    this.content?.dispose();
    this.scene.traverse((obj) => {
      const o = obj as THREE.Mesh;
      o.geometry?.dispose?.();
      const mat = o.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

/** Deterministic pseudo-random generator (stable layouts between reloads). */
export function rng(seed = 1): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const POINT_FRAGMENT = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    float a = smoothstep(0.25, 0.0, d);
    gl_FragColor = vec4(vec3(0.93, 0.95, 1.0), a * vAlpha);
  }
`;

// Ashima Arts 3D simplex noise (MIT).
export const SIMPLEX = /* glsl */ `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

/** Fisher–Yates shuffle of a flat attribute array in groups of `stride`. */
export function shuffleGroups(arrays: { arr: Float32Array; stride: number }[], count: number, rand: () => number) {
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    for (const { arr, stride } of arrays) {
      for (let k = 0; k < stride; k++) {
        const a = i * stride + k;
        const b = j * stride + k;
        const tmp = arr[a];
        arr[a] = arr[b];
        arr[b] = tmp;
      }
    }
  }
}
