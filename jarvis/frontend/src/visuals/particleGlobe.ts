// MODE B — particle Earth (reference 02-globe-reference.jpg).
// Continents come from Natural Earth land polygons (public domain, via the
// world-atlas package), rasterized into a mask and sampled on a regular
// lat/lon dot grid. Markers and arcs are driven by real research events.
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import { POINT_FRAGMENT, Scene3D, Stage, rng, shuffleGroups } from "./stage";

const DEG = Math.PI / 180;

export function latLonToVec(lat: number, lon: number, r = 1): THREE.Vector3 {
  const la = lat * DEG;
  const lo = lon * DEG;
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.cos(lo) * r);
}

async function landMask(width = 2048, height = 1024): Promise<(lat: number, lon: number) => boolean> {
  const topo = (await import("world-atlas/land-50m.json")).default as unknown as Topology;
  const geo = feature(topo, topo.objects.land) as unknown as FeatureCollection<Geometry>;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  const toXY = (lon: number, lat: number): [number, number] => [((lon + 180) / 360) * width, ((90 - lat) / 180) * height];
  const drawPolygon = (rings: number[][][]) => {
    ctx.beginPath();
    for (const ring of rings) {
      ring.forEach(([lon, lat], i) => {
        const [x, y] = toXY(lon, lat);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
    ctx.fill("evenodd");
  };
  for (const f of geo.features) {
    const g = f.geometry;
    if (g.type === "Polygon") drawPolygon(g.coordinates as number[][][]);
    else if (g.type === "MultiPolygon") (g.coordinates as number[][][][]).forEach(drawPolygon);
  }
  const data = ctx.getImageData(0, 0, width, height).data;
  return (lat, lon) => {
    const x = Math.min(width - 1, Math.max(0, Math.floor(((lon + 180) / 360) * width)));
    const y = Math.min(height - 1, Math.max(0, Math.floor(((90 - lat) / 180) * height)));
    return data[(y * width + x) * 4] > 127;
  };
}

const GLOBE_VERTEX = /* glsl */ `
  attribute float aLand;
  attribute float aRand;
  uniform float uPixel;
  uniform vec3 uLight;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vec3 n = normalize(normalMatrix * normalize(position));
    vec3 v = normalize(-mv.xyz);
    float ndv = dot(n, v);
    float front = smoothstep(-0.05, 0.25, ndv);
    float fres = pow(1.0 - max(ndv, 0.0), 2.5);
    float light = 0.35 + 0.65 * max(dot(n, normalize(uLight)), 0.0);
    float a = aLand > 0.5 ? (0.30 + 0.70 * light) : 0.07 + 0.08 * light;
    a += fres * (aLand > 0.5 ? 0.9 : 0.35);
    vAlpha = a * front * (0.75 + 0.25 * aRand);
    gl_PointSize = (aLand > 0.5 ? 1.25 : 0.9) * uPixel / -mv.z;
  }
`;

const HALO_VERTEX = /* glsl */ `
  attribute float aRand;
  attribute float aR;
  uniform float uPixel, uTime, uActivity;
  varying float vAlpha;
  void main() {
    vec3 p = position * (aR + sin(uTime * 0.3 + aRand * 20.0) * 0.004 * (1.0 + uActivity * 4.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float fall = 1.0 - smoothstep(1.0, 1.36, aR);
    vAlpha = (0.12 + 0.6 * pow(fall, 2.0)) * (0.5 + 0.5 * aRand) * (0.8 + uActivity * 0.6);
    gl_PointSize = (0.8 + aRand * 1.4) * uPixel / -mv.z;
  }
`;

const MARKER_VERTEX = /* glsl */ `
  attribute float aBorn;
  attribute float aKind;
  uniform float uPixel, uTime;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vec3 n = normalize(normalMatrix * normalize(position));
    float front = smoothstep(0.0, 0.2, dot(n, normalize(-mv.xyz)));
    float age = uTime - aBorn;
    float pulse = 0.5 + 0.5 * sin(age * 4.0);
    float life = aKind > 1.5 ? 1.0 : clamp(1.0 - (age - 40.0) / 20.0, 0.25, 1.0);
    vAlpha = front * life * (0.6 + 0.4 * pulse) * (aBorn < 0.0 ? 0.0 : 1.0);
    float base = aKind > 1.5 ? 7.0 : aKind > 0.5 ? 5.0 : 3.5;
    gl_PointSize = (base + pulse * 3.0 * step(age, 6.0)) * uPixel / -mv.z;
  }
`;

const ARC_VERTEX = /* glsl */ `
  attribute float aT;
  uniform float uBorn, uTime;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float age = uTime - uBorn;
    float head = age * 0.45;
    float trail = smoothstep(head - 0.35, head, aT) * step(aT, head);
    float drawn = step(aT, min(head, 1.0)) * 0.22;
    float fade = 1.0 - smoothstep(18.0, 26.0, age);
    vAlpha = max(trail, drawn) * fade;
  }
`;
const ARC_FRAGMENT = /* glsl */ `
  varying float vAlpha;
  void main() { gl_FragColor = vec4(vec3(0.92, 0.94, 1.0), vAlpha); }
`;

const MAX_MARKERS = 256;

export interface GlobeMarker { lat: number; lon: number; kind?: 0 | 1 | 2 }

export class ParticleGlobe implements Scene3D {
  readonly group = new THREE.Group();
  private globe: THREE.Points | null = null;
  private halo: THREE.Points;
  private markers: THREE.Points;
  private markerPos = new Float32Array(MAX_MARKERS * 3);
  private markerBorn = new Float32Array(MAX_MARKERS).fill(-1);
  private markerKind = new Float32Array(MAX_MARKERS);
  private markerNext = 0;
  private arcs: { line: THREE.Line; born: number }[] = [];
  private time = 0;
  private targetRotY = 0;
  private targetRotX = 0.25;
  private autoRotate = true;
  private activity = 0;
  private globeCount = 0;
  private materials: THREE.ShaderMaterial[] = [];
  ready: Promise<void>;
  base: { lat: number; lon: number } = { lat: 44.405, lon: 8.946 }; // default: Genova

  constructor(private stage: Stage) {
    stage.scene.add(this.group);
    stage.camera.position.set(0, 0, 3.3);
    stage.camera.lookAt(0, 0, 0);
    this.group.rotation.x = this.targetRotX;
    // Start facing the home base (Europe).
    this.targetRotY = -this.base.lon * DEG;
    this.group.rotation.y = this.targetRotY;
    this.halo = this.buildHalo();
    this.markers = this.buildMarkers();
    this.addStars();
    this.ready = this.buildGlobe();
  }

  private material(vertexShader: string, uniforms: Record<string, THREE.IUniform>, fragmentShader = POINT_FRAGMENT) {
    const m = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.materials.push(m);
    return m;
  }

  private async buildGlobe() {
    const isLand = await landMask();
    const step = { low: 1.0, medium: 0.72, high: 0.52 }[this.stage.quality];
    const pts: number[] = [];
    const land: number[] = [];
    const rand = rng(11);
    for (let lat = -89; lat <= 89; lat += step) {
      const ring = Math.max(1, Math.round((360 * Math.cos(lat * DEG)) / step));
      const off = rand() * (360 / ring);
      for (let k = 0; k < ring; k++) {
        const lon = -180 + off + (k * 360) / ring;
        const onLand = isLand(lat, lon);
        if (!onLand && rand() > 0.1) continue; // oceans: sparse faint dots
        const v = latLonToVec(lat, lon, 1);
        pts.push(v.x, v.y, v.z);
        land.push(onLand ? 1 : 0);
      }
    }
    const count = land.length;
    const pos = new Float32Array(pts);
    const aLand = new Float32Array(land);
    const aRand = new Float32Array(count).map(() => rand());
    shuffleGroups([{ arr: pos, stride: 3 }, { arr: aLand, stride: 1 }, { arr: aRand, stride: 1 }], count, rand);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aLand", new THREE.BufferAttribute(aLand, 1));
    geo.setAttribute("aRand", new THREE.BufferAttribute(aRand, 1));
    const mat = this.material(GLOBE_VERTEX, { uPixel: { value: 2 }, uLight: { value: new THREE.Vector3(-0.7, 0.55, 0.65) } });
    this.globe = new THREE.Points(geo, mat);
    this.globeCount = count;
    this.group.add(this.globe);
  }

  private buildHalo() {
    const n = { low: 2500, medium: 5000, high: 9000 }[this.stage.quality];
    const rand = rng(5);
    const pos = new Float32Array(n * 3);
    const aR = new Float32Array(n);
    const aRand = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = s * Math.cos(th);
      pos[i * 3 + 1] = u;
      pos[i * 3 + 2] = s * Math.sin(th);
      aR[i] = 1.015 + Math.pow(rand(), 2.6) * 0.36;
      aRand[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aR", new THREE.BufferAttribute(aR, 1));
    geo.setAttribute("aRand", new THREE.BufferAttribute(aRand, 1));
    const pts = new THREE.Points(geo, this.material(HALO_VERTEX, { uPixel: { value: 2 }, uTime: { value: 0 }, uActivity: { value: 0 } }));
    this.group.add(pts);
    return pts;
  }

  private addStars() {
    const n = 900;
    const rand = rng(21);
    const pos = new Float32Array(n * 3);
    const aR = new Float32Array(n).fill(1);
    const aRand = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 9 + rand() * 6;
      pos[i * 3] = s * Math.cos(th) * r;
      pos[i * 3 + 1] = u * r;
      pos[i * 3 + 2] = s * Math.sin(th) * r;
      aRand[i] = rand() * 0.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aR", new THREE.BufferAttribute(aR, 1));
    geo.setAttribute("aRand", new THREE.BufferAttribute(aRand, 1));
    this.stage.scene.add(new THREE.Points(geo, this.material(HALO_VERTEX, { uPixel: { value: 6 }, uTime: { value: 0 }, uActivity: { value: 0 } })));
  }

  private buildMarkers() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.markerPos, 3));
    geo.setAttribute("aBorn", new THREE.BufferAttribute(this.markerBorn, 1));
    geo.setAttribute("aKind", new THREE.BufferAttribute(this.markerKind, 1));
    const pts = new THREE.Points(geo, this.material(MARKER_VERTEX, { uPixel: { value: 2 }, uTime: { value: 0 } }));
    pts.frustumCulled = false;
    this.group.add(pts);
    return pts;
  }

  /** kind 0 = found business, 1 = searched city, 2 = home base. */
  addMarker(m: GlobeMarker) {
    const i = this.markerNext;
    this.markerNext = (this.markerNext + 1) % MAX_MARKERS;
    const v = latLonToVec(m.lat, m.lon, 1.008);
    this.markerPos.set([v.x, v.y, v.z], i * 3);
    this.markerBorn[i] = this.time;
    this.markerKind[i] = m.kind ?? 0;
    const g = this.markers.geometry;
    (g.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute("aBorn") as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute("aKind") as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Great-circle arc from the home base to a location, with a travelling pulse. */
  addArc(lat: number, lon: number) {
    const a = latLonToVec(this.base.lat, this.base.lon, 1);
    const b = latLonToVec(lat, lon, 1);
    const angle = a.angleTo(b);
    if (angle < 0.002) return;
    const segs = 64;
    const pos = new Float32Array((segs + 1) * 3);
    const at = new Float32Array(segs + 1);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = a.clone().lerp(b, t).normalize();
      // slerp approximation is fine at these sizes; lift the arc above the surface
      p.multiplyScalar(1.005 + Math.sin(Math.PI * t) * Math.min(0.35, angle * 0.25));
      pos.set([p.x, p.y, p.z], i * 3);
      at[i] = t;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aT", new THREE.BufferAttribute(at, 1));
    const mat = this.material(ARC_VERTEX, { uBorn: { value: this.time }, uTime: { value: this.time } }, ARC_FRAGMENT);
    const line = new THREE.Line(geo, mat);
    this.group.add(line);
    this.arcs.push({ line, born: this.time });
    if (this.arcs.length > 24) this.removeArc(0);
  }

  private removeArc(i: number) {
    const [arc] = this.arcs.splice(i, 1);
    this.group.remove(arc.line);
    arc.line.geometry.dispose();
    const m = arc.line.material as THREE.ShaderMaterial;
    m.dispose();
    this.materials = this.materials.filter((x) => x !== m);
  }

  /** Turn the globe so that lat/lon faces the camera. */
  focus(lat: number, lon: number) {
    this.autoRotate = false;
    let target = -lon * DEG;
    const cur = this.group.rotation.y;
    while (target - cur > Math.PI) target -= Math.PI * 2;
    while (target - cur < -Math.PI) target += Math.PI * 2;
    this.targetRotY = target;
    this.targetRotX = Math.max(-0.6, Math.min(0.9, lat * DEG * 0.85));
    window.clearTimeout(this.resumeTimer);
    this.resumeTimer = window.setTimeout(() => (this.autoRotate = true), 20000);
  }

  private resumeTimer = 0;

  /** 0..1 research intensity (drives halo agitation). */
  setActivity(a: number) {
    this.activity = Math.max(0, Math.min(1, a));
  }

  setDensity(f: number) {
    this.globe?.geometry.setDrawRange(0, Math.floor(this.globeCount * f));
  }

  update(dt: number, t: number) {
    this.time = t;
    const px = this.stage.pixelScale * 2.4;
    for (const m of this.materials) {
      if (m.uniforms.uPixel && m.uniforms.uPixel.value !== 6) m.uniforms.uPixel.value = px;
      if (m.uniforms.uTime) m.uniforms.uTime.value = t;
      if (m.uniforms.uActivity) m.uniforms.uActivity.value = this.activity;
    }
    if (this.autoRotate) {
      this.targetRotY += dt * (0.05 + this.activity * 0.1);
      this.targetRotX += (0.25 - this.targetRotX) * Math.min(1, dt * 0.3);
    }
    const k = Math.min(1, dt * 1.8);
    this.group.rotation.y += (this.targetRotY - this.group.rotation.y) * k;
    this.group.rotation.x += (this.targetRotX - this.group.rotation.x) * k;
    this.halo.rotation.y += dt * 0.015;
    for (let i = this.arcs.length - 1; i >= 0; i--) if (t - this.arcs[i].born > 28) this.removeArc(i);
  }

  dispose() {
    window.clearTimeout(this.resumeTimer);
    this.materials.forEach((m) => m.dispose());
    this.group.traverse((o) => (o as THREE.Points).geometry?.dispose?.());
  }
}
