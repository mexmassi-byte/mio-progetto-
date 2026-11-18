#!/usr/bin/env python3
"""
Original score for "VI — Launch Film" (9:16 motion graphic) — fully procedural, no samples,
no existing music. 120 BPM (one bar = 2 s, one beat = 0.5 s), D minor, 32 s, synced to the picture:

  0.0 – 2.0   hook: every shape morph is a note (D5 F5 A5 C6), the VI lands on a chord hit
  2.0 – 4.0   half-time pulse + riser into the reveal
  4.0 – 6.0   reveal: downlifter, the display wakes on a glass bell chord
  6.0 – 12.5  site tour: four-on-the-floor groove, a whoosh lands on every scroll whip
  12.5 – 14.0 the music filters down, the cursor finds the play button
  14.0        click
  14.0 – 16.0 dive: riser, snare roll, a beat of silence
  16.0        drop: impact, full groove, lead melody; a hit on every cut
  24.0 – 27.5 build: cuts every beat, then every half beat; snare roll, riser
  27.5 – 28.0 everything collapses into a point (reverse swell)
  28.0        finale hit: sub boom, crash, wide Dm9, bell arpeggio; fades to silence at 31.95

  python3 render/music_mg.py <out.wav>
The DSP helpers mirror render/music.py (the score of the 16:9 showcase).
"""
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import uniform_filter1d

SR = 48000
DUR = 32.0
N = int(SR * DUR)
BEAT = 0.5
BAR = 2.0
T_CLICK, T_FILM, T_FINALE = 14.0, 16.0, 28.0
rng = np.random.default_rng(2026)

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6,
        'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def hz(name):
    midi = 12 * (int(name[-1]) + 1) + NOTE[name[:-1]]
    return 440.0 * 2 ** ((midi - 69) / 12)


def bt(bar, beat=0.0):
    return bar * BAR + beat * BEAT


def idx(t):
    return int(round(t * SR))


# ----------------------------------------------------------------------------- dsp
def polyblep(ph, dt):
    out = np.zeros_like(ph)
    m = ph < dt
    x = ph[m] / dt
    out[m] = x + x - x * x - 1.0
    m = ph > 1.0 - dt
    x = (ph[m] - 1.0) / dt
    out[m] = x * x + x + x + 1.0
    return out


def saw(f, n, phase=0.0):
    dt = f / SR
    ph = (phase + dt * np.arange(n)) % 1.0
    return 2.0 * ph - 1.0 - polyblep(ph, dt)


def square(f, n, phase=0.0):
    return 0.5 * (saw(f, n, phase) - saw(f, n, (phase + 0.5) % 1.0))


def sine(f, n, phase=0.0):
    return np.sin(2 * np.pi * (phase + f * np.arange(n) / SR))


def lp(x, fc, order=2):
    fc = min(max(fc, 20.0), SR * 0.45)
    return signal.sosfilt(signal.butter(order, fc, 'low', fs=SR, output='sos'), x, axis=0)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'high', fs=SR, output='sos'), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)


def lp_sweep(x, cutoff_fn, block=512):
    """Time-varying 2-pole lowpass, coefficients updated per block. cutoff_fn(t) in seconds of x."""
    x = np.atleast_2d(x.T).T if x.ndim == 1 else x
    y = np.zeros_like(x)
    zi = np.zeros((1, 2, x.shape[1]))
    for s in range(0, len(x), block):
        fc = min(max(cutoff_fn((s + block / 2) / SR), 30.0), SR * 0.45)
        sos = signal.butter(2, fc, 'low', fs=SR, output='sos')
        y[s:s + block], zi = signal.sosfilt(sos, x[s:s + block], axis=0, zi=zi)
    return y


def bp_sweep(x, center_fn, q=1.2, block=512):
    """Time-varying band-pass (mono in, mono out)."""
    y = np.zeros_like(x)
    zi = np.zeros((2, 2))
    for s in range(0, len(x), block):
        fc = min(max(center_fn((s + block / 2) / SR), 80.0), SR * 0.4)
        lo, hi = fc / (1 + 0.5 / q), fc * (1 + 0.5 / q)
        sos = signal.butter(2, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos')
        y[s:s + block], zi = signal.sosfilt(sos, x[s:s + block], zi=zi)
    return y


def env_adsr(n, a, d, s, r, gate):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = t > gate
    if rel.any():
        g = e[np.argmax(rel) - 1] if np.argmax(rel) > 0 else e[0]
        e[rel] = g * np.exp(-(t[rel] - gate) / max(r, 1e-4))
    return e


def add(bus, sig, t, gain=1.0, pan=0.0):
    """Mix mono/stereo `sig` into stereo `bus` at time t (equal-power pan), with de-click fades."""
    i0 = idx(t)
    if i0 >= N:
        return
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], 1) * np.sqrt(2)
    sig = sig.copy()
    m_in = min(len(sig), int(0.001 * SR))
    if m_in > 1:
        sig[:m_in] *= np.linspace(0, 1, m_in)[:, None]
    m_out = min(len(sig) // 5, int(0.012 * SR))
    if m_out > 1:
        sig[-m_out:] *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, m_out)))[:, None]
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), N - i0)
    bus[i0:i0 + n] += sig[:n] * gain


def make_ir(seconds, rt60, damp, seed, predelay=0.012, gate=None):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    chans = []
    for c in range(2):
        x = r.standard_normal(n) * np.exp(-6.9 * t / rt60)
        x = lp(x, damp, 1)
        x[: int(predelay * SR)] = 0
        if gate:
            x *= 1.0 / (1.0 + np.exp((t - gate) * 90))
        chans.append(x / np.sqrt(np.sum(x ** 2)))
    return np.stack(chans, 1)


def reverb(x, ir):
    return np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:N] for c in range(2)], 1)


def pingpong(x, delay, fb, taps=6):
    out = np.zeros_like(x)
    d = idx(delay)
    mono = x.mean(1)
    for k in range(1, taps + 1):
        if k * d >= N:
            break
        out[k * d:, k % 2] += (fb ** k) * mono[: N - k * d]
    return out


def fm_bell(f, dur, ratio=3.5, index=2.4, decay=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * ratio * t) * index * np.exp(-t / (decay * 0.35))
    s = np.sin(2 * np.pi * f * t + mod)
    s += 0.35 * np.sin(2 * np.pi * f * 2.001 * t) * np.exp(-t / (decay * 0.5))
    return s * np.minimum(1, t / 0.004) * np.exp(-t / decay)


def shelf(x, f0, gain_db, kind):
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    al = np.sin(w0) / 2 * np.sqrt(2)
    c = np.cos(w0)
    sA = 2 * np.sqrt(A) * al
    if kind == 'low':
        bb = [A * ((A + 1) - (A - 1) * c + sA), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - sA)]
        aa = [(A + 1) + (A - 1) * c + sA, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - sA]
    else:
        bb = [A * ((A + 1) + (A - 1) * c + sA), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sA)]
        aa = [(A + 1) - (A - 1) * c + sA, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sA]
    return signal.lfilter(np.array(bb) / aa[0], np.array(aa) / aa[0], x, axis=0)


# ----------------------------------------------------------------------------- instruments
def kick(v=1.0):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 48 + 140 * np.exp(-t / 0.028)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.004) * 0.6
    return np.tanh((body + click) * 1.7) * v


def clap(v=1.0):
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    env = sum(np.exp(-np.clip(t - o, 0, None) / 0.008) * (t >= o) for o in (0.0, 0.011, 0.022)) * 0.6
    env += np.exp(-np.clip(t - 0.03, 0, None) / 0.12) * (t >= 0.03)
    noise = bp(rng.standard_normal(n), 900, 7500) * env
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.5
    return (noise + tone) * v


def snare(v=1.0):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 1400, 9500) * np.exp(-t / 0.1)
    tone = np.sin(2 * np.pi * 200 * t) * np.exp(-t / 0.06) * 0.7
    return (noise * 0.9 + tone) * v


def hat(v=1.0, open_=False):
    n = int((0.45 if open_ else 0.1) * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7600, 2) * np.exp(-t / (0.15 if open_ else 0.026)) * v


def shaker(v=1.0):
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 4800, 11500) * np.minimum(1, t / 0.007) * np.exp(-t / 0.03) * v


def crash(v=1.0, dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 3600, 2) * np.exp(-t / (dur * 0.3))
    metal = sum(np.sin(2 * np.pi * f * t) for f in (3150, 4370, 5810, 6920)) * 0.05 * np.exp(-t / 0.7)
    return (x + metal) * v


def boom(dur=2.6, f0=30.0, sweep=34.0, decay=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.tanh(1.8 * np.sin(2 * np.pi * np.cumsum(f0 + sweep * np.exp(-t / 0.2)) / SR) * np.exp(-t / decay))


def pluck(f, dur=0.9, bright=5200, decay=0.32):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = 0.55 * saw(f, n, rng.random()) + 0.45 * saw(f * 1.004, n, rng.random()) + 0.25 * square(f * 0.5, n)
    y = lp_sweep(x, lambda s: 600 + bright * np.exp(-s / 0.09))[:, 0]
    return y * np.minimum(1, t / 0.002) * np.exp(-t / decay)


def stab(notes, dur=0.6, cutoff=3800, v=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros((n, 2))
    for nm in notes:
        f = hz(nm)
        x[:, 0] += sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-8, 3)) / 2
        x[:, 1] += sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-3, 9)) / 2
    x /= len(notes)
    x = lp_sweep(x, lambda s: 500 + cutoff * np.exp(-s / 0.12))
    return x * (np.minimum(1, t / 0.003) * np.exp(-t / 0.22))[:, None] * v


def whoosh(dur, rise=0.8, pan_from=-0.6, pan_to=0.6, lo=380, hi=4200):
    """Noise swept up in pitch and level, landing at the end; panned across."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / t[-1]
    x = bp_sweep(rng.standard_normal(n), lambda s: lo * (hi / lo) ** (s / dur))
    env = u ** (2.0 * rise) * (1 - np.exp(-(1 - u) * 60))
    x *= env
    a = (np.linspace(pan_from, pan_to, n) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1) * np.sqrt(2)


def tail_tick(v=1.0):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 3000) * np.exp(-t / 0.012) * v


# ----------------------------------------------------------------------------- harmony
CH = {
    'Dm': ['D3', 'A3', 'C4', 'E4', 'F4'],
    'Bb': ['Bb2', 'F3', 'A3', 'C4', 'D4'],
    'F': ['F3', 'A3', 'C4', 'E4', 'G4'],
    'C': ['C3', 'G3', 'D4', 'E4', 'G4'],
}
ROOT = {'Dm': 'D2', 'Bb': 'Bb1', 'F': 'F2', 'C': 'C2'}
ARP = {'Dm': ['D4', 'F4', 'A4', 'C5', 'E5'], 'Bb': ['Bb3', 'D4', 'F4', 'A4', 'C5'],
       'F': ['F4', 'A4', 'C5', 'E5', 'G5'], 'C': ['C4', 'E4', 'G4', 'D5', 'E5']}
# one chord per bar
PROG = ['Dm', 'Dm', 'Bb', 'Dm', 'Bb', 'F', 'C', 'C', 'Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Dm', 'Dm']

mix = {k: np.zeros((N, 2)) for k in ['pad', 'bass', 'arp', 'lead', 'drums', 'fx', 'bell', 'hook']}
send_hall = np.zeros((N, 2))
send_plate = np.zeros((N, 2))
t_all = np.arange(N) / SR

# ----------------------------------------------------------------------------- pad (bars 0..13) + finale chord
pad_raw = np.zeros((N, 2))
for b in range(14):
    ch = PROG[b]
    length = BAR + 1.2
    for nm in CH[ch]:
        f = hz(nm)
        n = int(length * SR)
        e = env_adsr(n, 0.35 if b else 0.02, 1.0, 0.85, 0.45, BAR + 0.02)
        sl = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-9, -2, 6)) / 3
        sr_ = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-6, 3, 9)) / 3
        add(pad_raw, np.stack([sl, sr_], 1) * e[:, None], bt(b), 0.1)
for nm in ['D3', 'A3', 'C4', 'E4', 'F4', 'A4', 'D5']:
    f = hz(nm)
    n = int((DUR - T_FINALE) * SR)
    e = env_adsr(n, 0.015, 1.6, 0.8, 1.2, DUR - T_FINALE - 1.0)
    sl = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-10, 0, 8)) / 3
    sr_ = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-8, 2, 10)) / 3
    add(pad_raw, np.stack([sl, sr_], 1) * e[:, None], T_FINALE, 0.13)


def pad_cut(t):
    if t < 4.0:
        return 700 + 1900 * (t / 4.0) ** 1.5
    if t < 6.0:
        return 2600
    if t < 12.5:
        return 3600
    if t < 14.0:                                     # the click: everything closes in
        return 3600 * (700 / 3600) ** ((t - 12.5) / 1.5)
    if t < 16.0:                                     # dive: opens again
        return 700 * (6000 / 700) ** ((t - 14.0) / 2.0)
    if t < 24.0:
        return 4800
    if t < T_FINALE:
        return 4800 * (9000 / 4800) ** ((t - 24.0) / 4.0)
    return 7000 * (900 / 7000) ** min((t - T_FINALE) / 4.0, 1.0)


mix['pad'] = lp_sweep(pad_raw, pad_cut)
send_hall += mix['pad'] * 0.5

# ----------------------------------------------------------------------------- hook: the shape morphs as notes
hook = np.zeros((N, 2))
for k, (tm, nm) in enumerate([(0.0, 'D5'), (0.5, 'F5'), (1.0, 'A5'), (1.5, 'C6')]):
    s = pluck(hz(nm), 1.2, 6000, 0.38)
    add(hook, s, tm, 0.34, pan=(-0.35, 0.35, -0.2, 0.2)[k])
    add(hook, pluck(hz(nm) * 0.5, 0.8, 2500, 0.25), tm, 0.16)
    add(mix['drums'], tail_tick(0.8), tm, 0.10, pan=0.3)
# the VI lands: chord stab + octave
add(hook, stab(['D4', 'F4', 'A4', 'C5', 'E5'], 1.4, 5200, 1.0), 2.0, 0.5)
add(hook, pluck(hz('D6'), 1.6, 7000, 0.5), 2.0, 0.26)
mix['hook'] = hook + pingpong(hook, BEAT * 0.75, 0.4, 6) * 0.5
send_hall += mix['hook'] * 0.55

# ----------------------------------------------------------------------------- drums
kick_times = []


def K(t, v=1.0, g=0.5):
    kick_times.append(t)
    add(mix['drums'], kick(v), t, g)


# hook: impacts on 0 and 2.0, half-time pulse after the VI
K(0.0, 1.0, 0.55)
for tm in (2.0, 3.0, 3.5, 3.75):
    K(tm, 0.95 if tm in (2.0, 3.0) else 0.7, 0.5)
add(mix['drums'], clap(0.9), 3.0, 0.32)
add(send_plate, clap(0.9), 3.0, 0.5)
# reveal: one soft kick on the screen wake, then a breath
K(4.0, 0.9, 0.45)
# groove: tour (bars 3..6, until the click), film (bars 8..12), build (13)
for b in list(range(3, 7)) + list(range(8, 14)):
    for p in range(4):
        tm = bt(b, p)
        if b == 6 and p >= 3:
            continue                                  # the click bar thins out
        if b == 13 and p >= 3:
            continue                                  # the collapse
        K(tm, 0.95, 0.5)
    for p in (1, 3):
        if (b == 6 and p == 3) or (b == 13 and p == 3):
            continue
        c = clap(0.85)
        add(mix['drums'], c, bt(b, p), 0.3, pan=0.03)
        add(send_plate, c, bt(b, p), 0.5)
    for k in range(8):
        if (b == 6 and k >= 6) or (b == 13 and k >= 6):
            break
        v = (0.5 if k % 2 == 0 else 0.85) * (0.85 + 0.15 * rng.random())
        add(mix['drums'], hat(v), bt(b, k * 0.5) + rng.normal(0, 0.002), 0.14, pan=0.28)
    if b >= 8:
        for p in (0.5, 1.5, 2.5, 3.5):
            if b == 13 and p > 2.5:
                continue
            add(mix['drums'], hat(0.7, True), bt(b, p), 0.055, pan=0.2)
        for k in range(16):
            if b == 13 and k >= 12:
                break
            add(mix['drums'], shaker(0.6 + 0.4 * ((k % 4) == 2)), bt(b, k * 0.25) + rng.normal(0, 0.003), 0.06, pan=-0.35)
# dive: snare roll 15.0 -> 15.88, accelerating
roll = [15.0 + i * 0.125 for i in range(4)] + [15.5 + i * 0.0625 for i in range(6)]
for i, tm in enumerate(roll):
    s = snare(0.35 + 0.65 * i / (len(roll) - 1))
    add(mix['drums'], s, tm, 0.24)
    add(send_plate, s, tm, 0.3)
# build: 8th snares in bar 12 (beats 2..4), 16ths in bar 13 until the collapse
for tm in [bt(12, 2) + i * 0.25 for i in range(8)] + [bt(13, 0) + i * 0.125 for i in range(12)]:
    s = snare(0.3 + 0.7 * (tm - 25.0) / 2.4)
    add(mix['drums'], s, tm, 0.2)
    add(send_plate, s, tm, 0.25)
# crashes on the drop and on every 2-s cut of the film
add(mix['drums'], crash(0.9, 3.4), T_FILM, 0.2, pan=-0.15)
for tm in (18.0, 20.0, 22.0, 24.0):
    add(mix['drums'], crash(0.55, 2.2), tm, 0.12, pan=0.25 if tm % 4 else -0.25)
# a short hit on every fast cut (beats from 24, half beats from 26)
for tm in [24.0 + i * 0.5 for i in range(4)] + [26.0 + i * 0.25 for i in range(6)]:
    add(mix['drums'], tail_tick(0.9), tm, 0.12, pan=0.35 * np.sin(tm * 7))

# sidechain ducking
duck = np.ones(N)
for tk in kick_times:
    i0 = idx(tk)
    L = int(0.45 * SR)
    t = np.arange(L) / SR
    ramp = np.clip(t / 0.005, 0, 1)
    shape = 1 - 0.6 * np.exp(-t / 0.11) * ramp * ramp * (3 - 2 * ramp)
    j = min(N, i0 + L)
    duck[i0:j] = np.minimum(duck[i0:j], shape[: j - i0])

# ----------------------------------------------------------------------------- bass (groove bars)
bass = np.zeros((N, 2))
for b in list(range(3, 7)) + list(range(8, 14)):
    r2 = hz(ROOT[PROG[b]])
    for k in range(8):
        if b in (6, 13) and k >= 6:
            break
        f = r2 * (2 if k % 2 else 1)
        n = int(BEAT * 0.5 * SR * 0.9)
        x = 0.7 * saw(f, n) + 0.45 * square(f, n)
        t = np.arange(n) / SR
        cutoff = 520 + 1800 * np.exp(-t / 0.05)
        y = np.zeros(n)
        zi = np.zeros((1, 2))
        for s in range(0, n, 256):
            sos = signal.butter(2, cutoff[s], 'low', fs=SR, output='sos')
            y[s:s + 256], zi = signal.sosfilt(sos, x[s:s + 256], zi=zi)
        y *= env_adsr(n, 0.003, 0.12, 0.7, 0.008, n / SR - 0.03)
        add(bass, y, bt(b, k * 0.5), 0.26)
    n = int(BAR * SR)
    e = env_adsr(n, 0.01, 0.3, 0.9, 0.05, BAR - 0.05)
    add(bass, sine(r2, n) * e, bt(b), 0.11)
mix['bass'] = bass * duck[:, None]

# ----------------------------------------------------------------------------- arp (from the VI to the finale)
arp = np.zeros((N, 2))
PAT = [0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 4, 3, 1, 2, 4, 2]
for b in range(1, 14):
    if b == 7:
        continue                                      # the dive has no arp
    ch = PROG[b]
    for k in range(16):
        tm = bt(b, k * 0.25)
        if b == 1 and tm < 2.0:
            continue
        if b == 13 and k >= 12:
            break
        f = hz(ARP[ch][PAT[k]])
        n = int(0.3 * SR)
        x = 0.6 * saw(f, n) + 0.4 * square(f * 1.002, n)
        t = np.arange(n) / SR
        x = lp(x, 2400 if b < 3 else 4400, 2) * np.exp(-t / 0.1) * np.minimum(1, t / 0.002)
        v = 0.28 if b < 3 else (0.42 if b < 8 else 0.38)
        v *= 1.0 if k % 4 == 0 else 0.78
        add(arp, x, tm, v, pan=0.15 * np.sin(k * 0.9))
arp = lp_sweep(arp, lambda t: pad_cut(t) * 1.6)
arp = arp * (0.55 + 0.45 * duck[:, None])
mix['arp'] = arp + pingpong(arp, BEAT * 0.75, 0.4, 6) * 0.5
send_hall += mix['arp'] * 0.22

# ----------------------------------------------------------------------------- lead melody (film)
LEAD = {
    8: [(0, 'A4', 0.75), (0.75, 'C5', 0.75), (1.5, 'D5', 1.0), (2.5, 'F5', 0.5), (3, 'E5', 1.0)],
    9: [(0, 'D5', 0.75), (0.75, 'C5', 0.75), (1.5, 'A4', 1.5), (3, 'F4', 1.0)],
    10: [(0, 'A4', 0.75), (0.75, 'C5', 0.75), (1.5, 'F5', 1.0), (2.5, 'G5', 0.5), (3, 'A5', 1.0)],
    11: [(0, 'G5', 0.75), (0.75, 'E5', 0.75), (1.5, 'D5', 1.5), (3, 'C5', 1.0)],
    12: [(0, 'D5', 1.0), (1, 'F5', 1.0), (2, 'A5', 1.0), (3, 'C6', 1.0)],
    13: [(0, 'D6', 1.5)],
}
lead = np.zeros((N, 2))
for b, notes in LEAD.items():
    for beat, nm, d in notes:
        f = hz(nm)
        n = int((d * BEAT + 0.25) * SR)
        t = np.arange(n) / SR
        x = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-7, 0, 7)) / 3
        x += 0.3 * square(f * 0.5, n)
        x = lp_sweep(x, lambda s: 1400 + 3800 * np.exp(-s / 0.2))[:, 0]
        e = env_adsr(n, 0.006, 0.25, 0.65, 0.12, d * BEAT)
        add(lead, x * e, bt(b, beat), 0.17, pan=-0.08)
        add(lead, fm_bell(f * 2, d * BEAT + 0.8, 3.0, 1.2, 0.5), bt(b, beat), 0.05, pan=0.2)
mix['lead'] = lead + pingpong(lead, BEAT * 0.75, 0.33, 5) * 0.45
send_hall += mix['lead'] * 0.4

# ----------------------------------------------------------------------------- bells
bell = np.zeros((N, 2))
for k, nm in enumerate(['D5', 'A5', 'E6']):                      # display wakes
    add(bell, fm_bell(hz(nm), 3.5, 3.5, 2.0, 1.6), 4.28 + k * 0.035, 0.14, pan=(-0.3, 0.05, 0.3)[k])
for k, nm in enumerate(['D5', 'F5', 'A5', 'C6', 'E6', 'A6']):    # finale
    add(bell, fm_bell(hz(nm), 3.6, 3.5, 1.8, 1.7), T_FINALE + 0.04 + k * 0.25, 0.12, pan=np.sin(k * 1.3) * 0.5)
mix['bell'] = bell + pingpong(bell, BEAT * 0.75, 0.4, 5) * 0.45
send_hall += mix['bell'] * 0.7

# ----------------------------------------------------------------------------- fx
fx = np.zeros((N, 2))
# opening impact (0.0) and the VI hit (2.0)
add(fx, boom(2.0, 32, 36, 0.7), 0.0, 0.34)
add(fx, crash(0.7, 2.4), 0.0, 0.1)
add(send_hall, crash(0.7, 2.4), 0.0, 0.12)
add(fx, boom(1.6, 32, 30, 0.6), 2.0, 0.26)
# riser into the reveal (2.6 -> 3.98) and a downlifter after it
n = int(1.38 * SR)
u = np.arange(n) / n
add(fx, lp_sweep(rng.standard_normal((n, 2)), lambda s: 500 * (8000 / 500) ** (s / 1.38)) * (u ** 2.2)[:, None], 2.6, 0.07)
n = int(1.6 * SR)
u = np.arange(n) / n
add(fx, lp_sweep(rng.standard_normal((n, 2)), lambda s: 7000 * (300 / 7000) ** (s / 1.6)) * (np.exp(-u * 3.5))[:, None], 4.0, 0.06)
# reverse swell into the groove (6.0)
n = int(0.9 * SR)
u = np.arange(n) / n
add(fx, lp_sweep(rng.standard_normal((n, 2)), lambda s: 300 * (9000 / 300) ** (s / 0.9)) * (u ** 3)[:, None], 6.0 - 0.9, 0.07)
# a whoosh lands on every scroll whip of the site tour
for i, land in enumerate([6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5]):
    d = 0.57 if land == 12.5 else 0.5
    side = 1 if i % 2 else -1
    add(fx, whoosh(d, 0.8, -0.7 * side, 0.7 * side), land - d, 0.085)
    add(fx, tail_tick(0.6), land, 0.05, pan=0.7 * side)
# the click: crisp trackpad click + low UI 'pop'
n = int(0.06 * SR)
t = np.arange(n) / SR
clk = hp(rng.standard_normal(n), 2400) * (np.exp(-t / 0.0025) + 0.5 * np.exp(-np.clip(t - 0.012, 0, None) / 0.003) * (t > 0.012))
add(fx, clk, T_CLICK + 0.04, 0.4, pan=0.15)
add(send_plate, clk, T_CLICK + 0.04, 0.25)
n = int(0.25 * SR)
t = np.arange(n) / SR
pop = np.sin(2 * np.pi * np.cumsum(90 + 160 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.06)
add(fx, pop, T_CLICK + 0.04, 0.28)
# dive riser (14.05 -> 15.9) with rising pitch, then a beat of silence before the drop
rs0 = 14.05
n = int((15.9 - rs0) * SR)
u = np.arange(n) / n
noise = lp_sweep(rng.standard_normal((n, 2)), lambda s: 400 * (11000 / 400) ** (s / (n / SR)))
pitch = np.sin(2 * np.pi * np.cumsum(110 * (10 ** u)) / SR) * u ** 2 * 0.22
add(fx, (noise * (u ** 2.4)[:, None] + pitch[:, None]), rs0, 0.09)
# the drop (16.0): sub boom + thump + reverse cymbal into it
add(fx, boom(2.8, 30, 34, 1.1), T_FILM, 0.38)
add(fx, lp(rng.standard_normal(int(0.4 * SR)), 900) * np.exp(-np.arange(int(0.4 * SR)) / SR / 0.08), T_FILM, 0.3)
# smaller sub hits on each 2-s cut
for tm in (18.0, 20.0, 22.0):
    add(fx, boom(1.0, 34, 24, 0.35), tm, 0.16)
# build riser (24.0 -> 27.5) and the collapse: reverse swell sucking into the finale hit
n = int(3.5 * SR)
u = np.arange(n) / n
noise = lp_sweep(rng.standard_normal((n, 2)), lambda s: 500 * (10000 / 500) ** (s / 3.5))
pitch = np.sin(2 * np.pi * np.cumsum(140 * (6 ** u)) / SR) * u ** 2 * 0.18
add(fx, noise * (u ** 2.6)[:, None] + pitch[:, None], 24.0, 0.07)
n = int(0.5 * SR)
u = np.arange(n) / n
rev = hp(rng.standard_normal((n, 2)), 2500) * (u ** 3.5)[:, None]
add(fx, rev, T_FINALE - 0.5, 0.16)
# finale hit
add(fx, boom(3.6, 29, 34, 1.3), T_FINALE, 0.4)
add(fx, lp(rng.standard_normal(int(0.4 * SR)), 900) * np.exp(-np.arange(int(0.4 * SR)) / SR / 0.09), T_FINALE, 0.3)
cr = crash(1.0, 3.8)
add(fx, cr, T_FINALE, 0.2)
add(send_hall, cr, T_FINALE, 0.22)
mix['fx'] = fx
send_hall += fx * 0.3

# ----------------------------------------------------------------------------- breaths (silences before the hits)
def gap(t0, t1, depth=0.95, fade=0.03):
    g = np.ones(N)
    a, b = idx(t0), idx(t1)
    fl = int(fade * SR)
    g[a:b] = 1 - depth
    g[max(0, a - fl):a] = np.linspace(1, 1 - depth, a - max(0, a - fl))
    g[b:b + fl] = np.linspace(1 - depth, 1, len(g[b:b + fl]))
    return g


pre_drop = gap(15.9, T_FILM - 0.004, 0.97, 0.02)
pre_fin = gap(27.5, T_FINALE - 0.004, 0.9, 0.03)
for k in ('drums', 'bass', 'arp', 'lead', 'pad', 'hook'):
    mix[k] *= (pre_drop * pre_fin)[:, None]
mix['fx'] *= pre_drop[:, None]                       # the reverse swell before the finale stays
for k in ('drums', 'bass', 'arp', 'lead'):           # these buses stay quiet after the finale hit
    mix[k] *= (1 - np.clip((t_all - (T_FINALE - 0.05)) / 0.05, 0, 1))[:, None]

# ----------------------------------------------------------------------------- reverbs + master
hall = reverb(send_hall, make_ir(3.6, 3.0, 5200, 11, 0.02))
plate = reverb(send_plate, make_ir(0.6, 0.9, 7000, 23, 0.004, gate=0.32))
gains = {'pad': 0.8, 'bass': 0.95, 'arp': 0.7, 'lead': 0.85, 'drums': 1.0, 'fx': 1.0, 'bell': 0.9, 'hook': 0.9}
out = sum(mix[k] * g for k, g in gains.items()) + hall * 0.4 + plate * 0.28
out *= pre_drop[:, None]                             # the whole mix stops for a beat before the drop
out = hp(out, 28, 2)
out = shelf(out, 95, -2.0, 'low')
out = shelf(out, 3800, 3.0, 'high')

rms = np.sqrt(uniform_filter1d(out.mean(1) ** 2, 2400) + 1e-12)
db = 20 * np.log10(rms)
gr_db = np.where(db > -16, (db + 16) * (1 - 1 / 2.0), 0)
gr = 10 ** (-signal.lfilter([0.002], [1, -0.998], gr_db) / 20)
out *= gr[:, None]

# picture-synced fade out (the video fades to black 31.05 -> 31.95); the start is an impact
fade = np.clip((31.95 - t_all) / (31.95 - 30.6), 0, 1)
out *= (0.5 - 0.5 * np.cos(np.pi * fade))[:, None]

peak = np.max(np.abs(out))
out = np.tanh(out / peak * 1.1) / np.tanh(1.1) * 0.89
assert np.isfinite(out).all()
dst = sys.argv[1] if len(sys.argv) > 1 else 'score_mg.wav'
wavfile.write(dst, SR, out.astype(np.float32))
print(f'120 BPM, {DUR:.0f} s, peak-in {peak:.3f} -> {dst}')
