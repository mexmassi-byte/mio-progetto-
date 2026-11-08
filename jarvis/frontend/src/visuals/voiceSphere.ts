// MODE C — organic particle sphere (reference 03-voice-reference.jpg).
// Most points lie on thin ribbons (bands around per-shell axes) that are
// warped by evolving 3D noise; the rest is faint dust that fills the volume.
// The motion reacts to the real audio level passed to setAudioLevel().
import * as THREE from "three";
import { POINT_FRAGMENT, SIMPLEX, Scene3D, Stage, rng, shuffleGroups } from "./stage";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

const PRESETS: Record<VoiceState, { amp: number; freq: number; speed: number; audioGain: number }> = {
  idle: { amp: 0.11, freq: 1.15, speed: 0.13, audioGain: 0 },
  listening: { amp: 0.13, freq: 1.4, speed: 0.28, audioGain: 0.5 },
  thinking: { amp: 0.2, freq: 2.1, speed: 0.6, audioGain: 0 },
  speaking: { amp: 0.12, freq: 1.3, speed: 0.34, audioGain: 0.65 },
};

const SHELLS = 4;
const BANDS = 7;

const VERTEX = /* glsl */ `
  ${SIMPLEX}
  attribute float aShell;
  attribute float aRand;
  attribute float aRibbon;
  uniform float uTime, uAmp, uFreq, uAudio, uPixel;
  varying float vAlpha;
  void main() {
    vec3 n = normalize(position);
    float r = 1.0 - aShell * 0.035;
    float tt = uTime;
    float n1 = snoise(n * uFreq + vec3(0.0, tt, aShell * 1.7));
    float n2 = snoise(n * uFreq * 2.4 + vec3(tt * 1.3, aShell * 3.1, 0.0));
    float disp = (n1 * 0.72 + n2 * 0.28) * (uAmp + uAudio * 0.42);
    // Ribbons also slide along the surface, so the folds keep changing.
    vec3 flow = vec3(snoise(n * 1.7 + vec3(tt * 0.6, 0.0, aShell)),
                     snoise(n * 1.7 + vec3(0.0, tt * 0.6, aShell + 5.0)),
                     snoise(n * 1.7 + vec3(aShell + 9.0, 0.0, tt * 0.6)));
    vec3 dir = normalize(n + flow * (0.08 + uAudio * 0.1) * aRibbon);
    vec3 p = dir * (r + disp);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vec3 nv = normalize(normalMatrix * dir);
    float rim = 1.0 - abs(dot(nv, normalize(-mv.xyz)));
    float a = aRibbon > 0.5
      ? 0.22 + 0.78 * pow(rim, 1.2)
      : 0.05 + 0.25 * pow(rim, 2.0);
    a *= 0.55 + 0.45 * aRand;
    vAlpha = clamp(a * (0.85 + uAudio * 0.7), 0.0, 1.0);
    gl_PointSize = (aRibbon > 0.5 ? 1.15 + aRand * 1.0 : 0.8 + aRand * 0.6) * uPixel / -mv.z;
  }
`;

function basis(axis: THREE.Vector3): [THREE.Vector3, THREE.Vector3, THREE.Vector3] {
  const w = axis.clone().normalize();
  const a = Math.abs(w.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(a, w).normalize();
  const v = new THREE.Vector3().crossVectors(w, u);
  return [u, v, w];
}

export class VoiceSphere implements Scene3D {
  private points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private state: VoiceState = "idle";
  private audio = 0;
  private targetAudio = 0;
  private count: number;
  private phase = 0;
  private cur = { ...PRESETS.idle };

  constructor(private stage: Stage) {
    const total = { low: 16000, medium: 30000, high: 48000 }[stage.quality];
    this.count = total;
    const rand = rng(7);
    const gauss = () => {
      const u = Math.max(1e-6, rand());
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
    };
    const axes = Array.from({ length: SHELLS }, (_, s) =>
      basis(new THREE.Vector3(Math.sin(s * 2.1 + 0.3), Math.cos(s * 1.3 + 0.2), Math.sin(s * 0.7 + 1.1))));
    const pos = new Float32Array(total * 3);
    const shell = new Float32Array(total);
    const rnd = new Float32Array(total);
    const ribbon = new Float32Array(total);
    const ribbonCount = Math.floor(total * 0.65);
    for (let i = 0; i < total; i++) {
      const s = Math.floor(rand() * SHELLS);
      let x: number, y: number, z: number;
      if (i < ribbonCount) {
        const [u, v, w] = axes[s];
        const band = Math.floor(rand() * BANDS);
        const lat = ((band + 0.5) / BANDS - 0.5) * Math.PI * 0.92 + gauss() * 0.018;
        const lon = rand() * Math.PI * 2;
        const c = Math.cos(lat);
        const d = new THREE.Vector3()
          .addScaledVector(u, c * Math.cos(lon)).addScaledVector(v, c * Math.sin(lon)).addScaledVector(w, Math.sin(lat));
        x = d.x; y = d.y; z = d.z;
        ribbon[i] = 1;
      } else {
        const yy = rand() * 2 - 1;
        const th = rand() * Math.PI * 2;
        const rr = Math.sqrt(1 - yy * yy);
        x = rr * Math.cos(th); y = yy; z = rr * Math.sin(th);
      }
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      shell[i] = s;
      rnd[i] = rand();
    }
    shuffleGroups([{ arr: pos, stride: 3 }, { arr: shell, stride: 1 }, { arr: rnd, stride: 1 }, { arr: ribbon, stride: 1 }], total, rand);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aShell", new THREE.BufferAttribute(shell, 1));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));
    geo.setAttribute("aRibbon", new THREE.BufferAttribute(ribbon, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: POINT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAmp: { value: 0.1 }, uFreq: { value: 1.1 }, uAudio: { value: 0 }, uPixel: { value: 2 } },
    });
    this.points = new THREE.Points(geo, this.material);
    stage.scene.add(this.points);
    stage.camera.position.set(0, -0.12, 3.5);
    stage.camera.lookAt(0, -0.12, 0);
  }

  setState(s: VoiceState) {
    this.state = s;
  }

  /** Real audio level 0..1 (RMS of microphone or speech output). */
  setAudioLevel(level: number) {
    this.targetAudio = Math.max(0, Math.min(1, level));
  }

  setDensity(f: number) {
    this.points.geometry.setDrawRange(0, Math.floor(this.count * f));
  }

  update(dt: number) {
    const p = PRESETS[this.state];
    const k = Math.min(1, dt * 2.5);
    this.cur.amp += (p.amp - this.cur.amp) * k;
    this.cur.freq += (p.freq - this.cur.freq) * k;
    this.cur.speed += (p.speed - this.cur.speed) * k;
    // Fast attack, slow release, like a VU meter.
    const target = this.targetAudio * p.audioGain;
    this.audio += (target - this.audio) * (target > this.audio ? Math.min(1, dt * 18) : Math.min(1, dt * 4));
    this.phase += dt * this.cur.speed; // integrate speed: no jumps when the state changes
    const u = this.material.uniforms;
    u.uTime.value = this.phase;
    u.uAmp.value = this.cur.amp;
    u.uFreq.value = this.cur.freq;
    u.uAudio.value = this.audio;
    u.uPixel.value = this.stage.pixelScale * 4.0;
    this.points.rotation.y += dt * 0.05;
    this.points.rotation.x = Math.sin(this.phase * 0.3) * 0.15;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
