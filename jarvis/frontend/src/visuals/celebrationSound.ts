// Sound of the mission-accomplished sequence, synthesized (no audio files):
// a rising vortex, a breath of silence, the impact, then a bright chord.
// Works on a live AudioContext and on an OfflineAudioContext (for export).
import { T } from "./celebration";

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  return buf;
}

export function playCelebration(ctx: BaseAudioContext, at = 0, volume = 0.8): void {
  const t0 = at;
  const master = ctx.createGain();
  master.gain.value = volume;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);

  // 1. Vortex: band-passed noise sweeping up + a rising sub tone.
  const riser = ctx.createBufferSource();
  riser.buffer = noiseBuffer(ctx, T.gather + 0.1);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 2.5;
  bp.frequency.setValueAtTime(180, t0);
  bp.frequency.exponentialRampToValueAtTime(5200, t0 + T.gather);
  const rg = ctx.createGain();
  rg.gain.setValueAtTime(0.0001, t0);
  rg.gain.exponentialRampToValueAtTime(0.35, t0 + T.gather - 0.05);
  rg.gain.linearRampToValueAtTime(0, t0 + T.gather + 0.02);
  riser.connect(bp).connect(rg).connect(master);
  riser.start(t0);
  riser.stop(t0 + T.gather + 0.1);

  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(38, t0);
  sub.frequency.exponentialRampToValueAtTime(140, t0 + T.gather);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t0);
  sg.gain.exponentialRampToValueAtTime(0.28, t0 + T.gather - 0.05);
  sg.gain.linearRampToValueAtTime(0, t0 + T.gather + 0.02);
  sub.connect(sg).connect(master);
  sub.start(t0);
  sub.stop(t0 + T.gather + 0.1);

  // 2. The core: a faint high tremble during the silence.
  const hi = ctx.createOscillator();
  hi.frequency.value = 2400;
  const hg = ctx.createGain();
  hg.gain.setValueAtTime(0, t0 + T.gather);
  hg.gain.linearRampToValueAtTime(0.025, t0 + T.detonate - 0.05);
  hg.gain.linearRampToValueAtTime(0, t0 + T.detonate);
  hi.connect(hg).connect(master);
  hi.start(t0 + T.gather);
  hi.stop(t0 + T.detonate + 0.05);

  // 3. Impact: falling sine boom + noise burst.
  const td = t0 + T.detonate;
  const boom = ctx.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(110, td);
  boom.frequency.exponentialRampToValueAtTime(26, td + 1.6);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.9, td);
  bg.gain.exponentialRampToValueAtTime(0.001, td + 2.2);
  boom.connect(bg).connect(master);
  boom.start(td);
  boom.stop(td + 2.3);

  const burst = ctx.createBufferSource();
  burst.buffer = noiseBuffer(ctx, 1.6);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(7000, td);
  lp.frequency.exponentialRampToValueAtTime(300, td + 1.4);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.5, td);
  ng.gain.exponentialRampToValueAtTime(0.001, td + 1.5);
  burst.connect(lp).connect(ng).connect(master);
  burst.start(td);

  // 4. The chord as the title forms (C major add 9, slightly detuned pairs).
  const tc = t0 + T.form + 0.15;
  [261.63, 392.0, 523.25, 587.33, 783.99, 1046.5].forEach((f, i) => {
    for (const det of [-3, 3]) {
      const o = ctx.createOscillator();
      o.type = i < 2 ? "triangle" : "sine";
      o.frequency.value = f;
      o.detune.value = det;
      const g = ctx.createGain();
      const start = tc + i * 0.09;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.03, start + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, start + 4.6);
      o.connect(g).connect(master);
      o.start(start);
      o.stop(start + 4.8);
    }
  });

  // 5. A soft shimmer for each light sweep across the letters.
  for (let k = 0; k < 2; k++) {
    const ts = t0 + 3.9 + k * 2.6 + 0.9;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(1568, ts);
    o.frequency.exponentialRampToValueAtTime(3136, ts + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ts);
    g.gain.linearRampToValueAtTime(0.012, ts + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0005, ts + 0.9);
    o.connect(g).connect(master);
    o.start(ts);
    o.stop(ts + 1);
  }
}

/** 16-bit PCM WAV from a rendered buffer (for the demo video export). */
export function toWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels;
  const n = buf.length;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o: number, s: string) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  data.setUint32(4, 36 + n * ch * 2, true);
  w(8, "WAVEfmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, buf.sampleRate, true);
  data.setUint32(28, buf.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  w(36, "data");
  data.setUint32(40, n * ch * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, buf.getChannelData(c)[i]));
      data.setInt16(o, v * 32767, true);
      o += 2;
    }
  }
  return new Blob([data], { type: "audio/wav" });
}
