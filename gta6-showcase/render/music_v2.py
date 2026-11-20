#!/usr/bin/env python3
"""
Original score for "Vice City is open" (the 9:16 film of the fan page). Fully procedural: no samples,
no existing music. 120 BPM (one bar = 2 s, one beat = 0.5 s), D minor, 30 s, and it loops: the last
half second is the hush the first half second starts from. Synced to render/v2_timeline.mjs:

  0.00 - 0.44  day: a hush, a filtered pad; the thumb flips the switch (click at 0.44)
  0.50         lights on: relay clunk, chord stab, the tubes catch (neon hum), half-time groove
  2.0  - 4.0   the page lifts into 3D: whoosh, riser, snare build
  4.0  - 9.0   the ribbon: four on the floor, arp, a long glide whoosh
  9.0          the landing hit; whooshes land on the scroll whips (10.0, 11.3, 12.6)
  12.6 - 13.46 the filter closes, the drums drop out; the thumb taps play (click + pop)
  13.55 - 14.0 the card opens: a short riser and one breath of silence
  14.0         drop: the fan film, full groove and lead; a hit on every cut, a tube on every sign
  24.0 - 26.0  OPEN builds, one letter per beat: snare roll, riser
  26.0 - 26.6  the film closes into the page: reverse swell, soft landing
  26.6 - 29.4  the caption: wide Dm9 and bells
  29.39 / 29.45 the switch again, the lights power down to the hush of frame 0

  python3 render/music_v2.py <out.wav>
The DSP helpers and instruments are those of render/music_mg.py.
"""
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import uniform_filter1d

SR = 48000
DUR = 30.0
N = int(SR * DUR)
BEAT = 0.5
BAR = 2.0
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



# ----------------------------------------------------------------------------- picture cues (v2_timeline.mjs)
T_SWITCH, T_ON = 0.44, 0.5
T_LAND, T_TAP, T_FLIP, T_FILM = 9.0, 13.46, 13.55, 14.0
WHIPS = [(9.5, 10.0), (10.8, 11.3), (12.0, 12.6)]
CUTS = [16.0, 18.0, 19.0, 20.0, 22.0]
OPEN = [24.0, 24.5, 25.0, 25.5]
T_BACK, T_HERO = 26.0, 26.6
T_OFF_TAP, T_OFF = 29.39, 29.45
# when each film sign starts catching (shot t0 + sign.at), with its letter count and stagger
SIGNS = [(14.2, 4, 0.07), (14.5, 4, 0.07), (16.15, 7, 0.07), (18.08, 5, 0.07), (19.08, 5, 0.07),
         (20.15, 4, 0.06), (22.15, 18, 0.028)] + [(t + 0.02, 1, 0.0) for t in OPEN]

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
# one chord per bar, 15 bars
PROG = ['Dm', 'Bb', 'Dm', 'Bb', 'F', 'C', 'C', 'Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Dm', 'Dm']


def chord_at(t):
    return PROG[min(len(PROG) - 1, int(t // BAR))]


mix = {k: np.zeros((N, 2)) for k in ['pad', 'bass', 'arp', 'lead', 'drums', 'fx', 'bell', 'neon']}
send_hall = np.zeros((N, 2))
send_plate = np.zeros((N, 2))
t_all = np.arange(N) / SR


def groove(t):
    """True where the beat runs."""
    return (T_ON <= t < 12.6) or (T_FILM <= t < T_BACK)


# ----------------------------------------------------------------------------- pad
pad_raw = np.zeros((N, 2))
for b in range(13):
    ch = PROG[b]
    length = BAR + 1.2
    for nm in CH[ch]:
        f = hz(nm)
        n = int(length * SR)
        e = env_adsr(n, 0.3 if b else 0.02, 1.0, 0.85, 0.45, BAR + 0.02)
        sl = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-9, -2, 6)) / 3
        sr_ = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-6, 3, 9)) / 3
        add(pad_raw, np.stack([sl, sr_], 1) * e[:, None], bt(b), 0.1)
# the closing chord: wide Dm9 from the film's close to the power-down
for nm in ['D3', 'A3', 'C4', 'E4', 'F4', 'A4', 'D5']:
    f = hz(nm)
    n = int((DUR - T_BACK) * SR)
    e = env_adsr(n, 0.4, 1.6, 0.8, 0.3, T_OFF - T_BACK)
    sl = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-10, 0, 8)) / 3
    sr_ = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-8, 2, 10)) / 3
    add(pad_raw, np.stack([sl, sr_], 1) * e[:, None], T_BACK, 0.12)
# the hush of the day (the loop's first and last half second): a soft, dark Dm
for nm in ['D3', 'A3', 'F4']:
    f = hz(nm)
    for t0, t1 in ((0.0, T_ON + 0.3), (T_OFF - 0.1, DUR)):
        n = int((t1 - t0) * SR)
        tt = np.arange(n) / SR
        e = np.minimum(1, tt / 0.25) if t0 > 0 else np.ones(n)
        e = e * np.minimum(1, (t1 - t0 - tt) / 0.3) if t0 == 0 else e
        add(pad_raw, np.stack([sine(f, n), sine(f * 1.002, n)], 1) * e[:, None], t0, 0.05)


def pad_cut(t):
    if t < T_ON:
        return 420.0
    if t < 2.0:
        return 420 + 2400 * min(1, (t - T_ON) / 0.25)
    if t < 4.0:
        return 2800 * (1.9 ** ((t - 2.0) / 2.0))
    if t < 12.6:
        return 4200.0
    if t < 13.9:
        return 4200 * (550 / 4200) ** min(1, (t - 12.6) / 0.8)
    if t < T_BACK:
        return 5600.0
    if t < T_OFF:
        return 3200.0
    return 3200 * (300 / 3200) ** min(1, (t - T_OFF) / 0.35)


mix['pad'] = lp_sweep(pad_raw, pad_cut)
send_hall += mix['pad'] * 0.3

# ----------------------------------------------------------------------------- drums
kick_times = []


def K(t, v=1.0, g=0.5):
    kick_times.append(t)
    add(mix['drums'], kick(v), t, g)


# lights on: half-time
K(T_ON, 1.0, 0.56)
add(mix['drums'], clap(0.8), 1.0, 0.2)
K(1.5, 0.85)
for k in range(5):
    add(mix['drums'], hat(0.7), 0.75 + k * 0.25, 0.08, pan=0.25)
# the lift: kicks on the bar, a snare build into the ribbon
K(2.0, 0.9)
K(3.0, 0.8)
for i, tm in enumerate([3.0 + k * 0.125 for k in range(7)]):
    s = snare(0.3 + 0.7 * i / 6)
    add(mix['drums'], s, tm, 0.18)
    add(send_plate, s, tm, 0.25)
# four on the floor: the ribbon, the landing, the scrolls (stops for the tap)
for tb in np.arange(4.0, 12.6, BEAT):
    K(tb, 1.0 if tb in (4.0, T_LAND) else 0.92)
    if (tb / BEAT) % 2 == 1:
        add(mix['drums'], clap(0.9), tb, 0.2)
        add(send_plate, clap(0.9), tb, 0.12)
    add(mix['drums'], hat(0.85, open_=True), tb + 0.25, 0.07, pan=0.2)
    for s16 in (0.125, 0.375):
        add(mix['drums'], shaker(0.6), tb + s16, 0.05, pan=-0.3)
# the film: full groove
for tb in np.arange(T_FILM, 24.0, BEAT):
    K(tb, 1.0 if tb == T_FILM else 0.95)
    if (tb / BEAT) % 2 == 1:
        add(mix['drums'], clap(1.0), tb, 0.22)
        add(send_plate, clap(1.0), tb, 0.14)
    add(mix['drums'], hat(0.9, open_=True), tb + 0.25, 0.08, pan=0.2)
    for s16 in (0.125, 0.375):
        add(mix['drums'], shaker(0.7), tb + s16, 0.055, pan=-0.3)
# OPEN: a kick on every letter, snare roll into the close
for tb in OPEN:
    K(tb, 1.0, 0.55)
for tm in [24.0 + k * 0.25 for k in range(4)] + [25.0 + k * 0.125 for k in range(7)]:
    s = snare(0.3 + 0.7 * (tm - 24.0) / 1.75)
    add(mix['drums'], s, tm, 0.19)
    add(send_plate, s, tm, 0.25)
# crashes: lights on, the landing, the drop, the 2-s cuts
add(mix['drums'], crash(0.8, 2.6), T_ON, 0.14, pan=-0.1)
add(mix['drums'], crash(0.8, 3.0), T_LAND, 0.15, pan=0.15)
add(mix['drums'], crash(0.95, 3.4), T_FILM, 0.2, pan=-0.15)
for tm in CUTS:
    add(mix['drums'], crash(0.5, 2.0), tm, 0.1, pan=0.25 if tm % 4 else -0.25)
for tm in OPEN:
    add(mix['drums'], tail_tick(0.9), tm, 0.1, pan=0.35 * np.sin(tm * 7))

# sidechain ducking
duck = np.ones(N)
for tk in kick_times:
    i0 = idx(tk)
    L = int(0.32 * SR)
    shape = 1 - 0.62 * np.exp(-np.arange(L) / SR / 0.09)
    j = min(N, i0 + L)
    duck[i0:j] = np.minimum(duck[i0:j], shape[: j - i0])

# ----------------------------------------------------------------------------- bass
bass = np.zeros((N, 2))
for tb in np.arange(4.0, 26.0, BEAT * 0.5):
    if not groove(tb) or 12.6 <= tb < T_FILM:
        continue
    k = int(round(tb / (BEAT * 0.5)))
    f = hz(ROOT[chord_at(tb)]) * (2 if k % 2 else 1)
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
    add(bass, y, tb, 0.26)
# sub: held roots under the lights-on and the lift, and under every groove bar
for b in range(13):
    tb = bt(b)
    if b == 6:
        continue
    n = int(BAR * SR)
    e = env_adsr(n, 0.01, 0.3, 0.9, 0.05, BAR - 0.05)
    t0 = max(tb, T_ON)
    add(bass, sine(hz(ROOT[PROG[b]]), n) * e, t0, 0.11)
mix['bass'] = bass * duck[:, None]

# ----------------------------------------------------------------------------- arp
arp = np.zeros((N, 2))
PAT = [0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 4, 3, 1, 2, 4, 2]
for k, tm in enumerate(np.arange(T_ON, 26.0, BEAT * 0.5)):
    if 12.85 <= tm < T_FILM:
        continue
    notes = ARP[chord_at(tm)]
    nm = notes[PAT[k % 16]]
    v = 0.55 if tm < 4.0 else 1.0
    add(arp, pluck(hz(nm), 0.5, 4200, 0.2) * v, tm, 0.08, pan=0.35 * np.sin(k * 0.9))
arp = lp_sweep(arp, lambda t: pad_cut(t) * 1.5)
arp = arp * (0.55 + 0.45 * duck[:, None])
mix['arp'] = arp + pingpong(arp, BEAT * 0.75, 0.4, 6) * 0.5
send_hall += mix['arp'] * 0.2

# ----------------------------------------------------------------------------- lead (the film)
LEAD = {
    7: [(0, 1.5, 'A4'), (1.5, 0.5, 'C5'), (2, 1, 'D5'), (3, 1, 'F5')],
    8: [(0, 1.5, 'F5'), (1.5, 0.5, 'E5'), (2, 1, 'D5'), (3, 1, 'C5')],
    9: [(0, 1.5, 'C5'), (1.5, 0.5, 'D5'), (2, 1, 'A4'), (3, 1, 'C5')],
    10: [(0, 2, 'E5'), (2, 1, 'D5'), (3, 1, 'G4')],
    11: [(0, 1.5, 'A4'), (1.5, 0.5, 'C5'), (2, 2, 'D5')],
}
lead = np.zeros((N, 2))
for b, notes in LEAD.items():
    for st, du, nm in notes:
        f = hz(nm)
        n = int((du * BEAT + 0.25) * SR)
        t = np.arange(n) / SR
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.3)
        ph = np.cumsum(f * vib) / SR
        x = 0.5 * (2 * (ph % 1) - 1) + 0.35 * (2 * ((ph * 1.006) % 1) - 1) + 0.25 * np.sign(np.sin(2 * np.pi * ph * 0.5))
        y = lp_sweep(x, lambda s: 900 + 2600 * np.exp(-s / 0.25))[:, 0]
        y *= env_adsr(n, 0.008, 0.2, 0.75, 0.2, du * BEAT)
        add(lead, y, bt(b, st), 0.075, pan=0.05)
mix['lead'] = lead + pingpong(lead, BEAT * 0.75, 0.33, 5) * 0.45
send_hall += mix['lead'] * 0.25

# ----------------------------------------------------------------------------- bells (the caption)
bell = np.zeros((N, 2))
for k, tm in enumerate(np.arange(T_HERO, T_OFF - 0.2, BEAT * 0.5)):
    nm = ['D5', 'F5', 'A5', 'C6', 'E6', 'C6', 'A5', 'F5'][k % 8]
    add(bell, fm_bell(hz(nm), 1.4), tm, 0.05 * (1 - 0.4 * (tm - T_HERO) / 3), pan=0.4 * np.sin(k * 1.3))
mix['bell'] = bell + pingpong(bell, BEAT * 0.75, 0.4, 5) * 0.45
send_hall += mix['bell'] * 0.45

# ----------------------------------------------------------------------------- neon: tubes catching
FL = [(0, 0), (0.12, 1), (0.18, 0.15), (0.34, 1), (0.4, 0.35), (0.56, 1), (1, 1)]


def flicker(u):
    return np.interp(u, [a for a, _ in FL], [v for _, v in FL], left=0, right=1)


def tube(letters, stagger, hold=0.45, v=1.0):
    """A neon sign catching letter by letter: a crackle on every off-on edge, then a quiet mains hum."""
    dur = 0.62 + stagger * max(0, letters - 1) + hold
    n = int(dur * SR)
    t = np.arange(n) / SR
    level = np.zeros(n)
    for i in range(letters):
        level += flicker((t - i * stagger) / 0.62)
    level /= letters
    edge = np.abs(np.gradient(level)) * SR
    crack = hp(rng.standard_normal(n), 1800) * np.clip(edge / 12, 0, 1)
    hum = sum(np.sin(2 * np.pi * 120 * k * t + k) / k for k in (1, 2, 3, 4, 6)) * 0.22
    hiss = bp(rng.standard_normal(n), 3000, 9000) * 0.05
    tail = np.minimum(1, (dur - t) / hold)
    x = (crack * 0.8 + (hum + hiss) * level) * tail * v
    return np.stack([x, x], 1)


neon = np.zeros((N, 2))
add(neon, tube(8, 0.07, 0.6, 1.0), T_ON + 0.26, 0.11)   # the page's own signs, with the lights
for t0, n_, st in SIGNS:
    add(neon, tube(n_, st, 0.35, 0.9), t0, 0.075)
mix['neon'] = neon
send_plate += neon * 0.3

# ----------------------------------------------------------------------------- fx
fx = np.zeros((N, 2))


def click(v=1.0):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 2400) * (np.exp(-t / 0.0025) + 0.5 * np.exp(-np.clip(t - 0.012, 0, None) / 0.003) * (t > 0.012)) * v


def pop(f0=90, v=1.0):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(f0 + 160 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.06) * v


def riser(t0, t1, lo=400, hi=9000, pitch=True):
    n = int((t1 - t0) * SR)
    u = np.arange(n) / n
    x = lp_sweep(rng.standard_normal((n, 2)), lambda s: lo * (hi / lo) ** (s / (t1 - t0))) * (u ** 2.2)[:, None]
    if pitch:
        x += (np.sin(2 * np.pi * np.cumsum(120 * (8 ** u)) / SR) * u ** 2 * 0.18)[:, None]
    return x


# the switch, twice: a toggle click and a low relay clunk
for tc in (T_SWITCH, T_OFF_TAP):
    add(fx, click(1.0), tc, 0.36, pan=-0.2)
    add(send_plate, click(1.0), tc, 0.2)
add(fx, boom(1.8, 34, 40, 0.5), T_ON, 0.3)
add(fx, stab(['D3', 'A3', 'C4', 'F4', 'A4'], 0.9, 4200, 1.0), T_ON, 0.16)
add(send_hall, stab(['D3', 'A3', 'C4', 'F4', 'A4'], 0.9, 4200, 1.0), T_ON, 0.1)
# the page lifts off: a slow whoosh, then the riser into the ribbon
add(fx, whoosh(1.4, 0.6, -0.5, 0.5, 300, 2600), 2.0, 0.08)
add(fx, riser(2.6, 3.98, 500, 8000), 2.6, 0.07)
# the glide: air passing, slowly panned
add(fx, whoosh(3.75, 0.35, 0.6, -0.6, 250, 1500), 4.6, 0.06)
# the landing
add(fx, riser(8.3, 8.98, 300, 9000, False), 8.3, 0.06)
add(fx, boom(1.8, 32, 36, 0.6), T_LAND, 0.26)
# scroll whips
for i, (a, b) in enumerate(WHIPS):
    side = 1 if i % 2 else -1
    add(fx, whoosh(b - a, 0.8, -0.7 * side, 0.7 * side), a, 0.085)
    add(fx, tail_tick(0.6), b, 0.05, pan=0.7 * side)
# the tap on play, the card opening
add(fx, click(1.0), T_TAP + 0.02, 0.4, pan=0.15)
add(send_plate, click(1.0), T_TAP + 0.02, 0.25)
add(fx, pop(90, 1.0), T_TAP + 0.02, 0.28)
add(fx, riser(T_FLIP, 13.92, 500, 11000), T_FLIP, 0.09)
# the drop
add(fx, boom(2.4, 30, 36, 0.8), T_FILM, 0.34)
add(send_hall, crash(0.7, 2.4), T_FILM, 0.1)
# OPEN: riser to the close
add(fx, riser(24.0, 25.98, 400, 10000), 24.0, 0.07)
# the close: the film is drawn back into the page, it lands soft
n = int((T_HERO - T_BACK) * SR)
u = np.arange(n) / n
add(fx, hp(rng.standard_normal((n, 2)), 2200) * (u ** 3)[:, None], T_BACK, 0.06)
add(fx, boom(1.6, 34, 30, 0.5), T_HERO, 0.18)
add(fx, crash(0.5, 2.6), T_HERO, 0.06)
# lights off: the power drops (a sagging hum and a thump), down to the hush
n = int(0.5 * SR)
t = np.arange(n) / SR
sag = np.sin(2 * np.pi * np.cumsum(120 * np.exp(-t / 0.15) + 30) / SR) * np.exp(-t / 0.14)
add(fx, np.stack([sag, sag], 1), T_OFF, 0.12)
add(fx, pop(60, 1.0), T_OFF, 0.22)
mix['fx'] = fx
send_hall += fx * 0.25


# ----------------------------------------------------------------------------- breaths and stops
def gap(t0, t1, depth=0.95, fade=0.03):
    g = np.ones(N)
    a, b = idx(t0), idx(t1)
    fl = int(fade * SR)
    g[a:b] = 1 - depth
    g[max(0, a - fl):a] = np.linspace(1, 1 - depth, a - max(0, a - fl))
    g[b:b + fl] = np.linspace(1 - depth, 1, len(g[b:b + fl]))
    return g


pre_drop = gap(13.92, T_FILM - 0.004, 0.97, 0.02)
pre_ribbon = gap(3.9, 3.996, 0.6, 0.015)
for k in ('drums', 'bass', 'arp', 'lead', 'pad'):
    mix[k] *= (pre_drop * pre_ribbon)[:, None]
# the groove buses end with the film; everything but the hush ends with the lights
end_groove = 1 - np.clip((t_all - (T_BACK - 0.03)) / 0.03, 0, 1)
for k in ('drums', 'bass', 'arp', 'lead'):
    mix[k] *= end_groove[:, None]
lights_off = 1 - np.clip((t_all - T_OFF) / 0.4, 0, 1)
for k in ('bell', 'neon', 'arp'):
    mix[k] *= lights_off[:, None]

# ----------------------------------------------------------------------------- reverbs + master
hall = reverb(send_hall, make_ir(3.0, 2.6, 5200, 11, 0.02))
plate = reverb(send_plate, make_ir(0.6, 0.9, 7000, 23, 0.004, gate=0.32))
# the hall tail must not spill over the loop point: it is gated with the lights
hall *= (1 - 0.85 * np.clip((t_all - T_OFF) / 0.45, 0, 1))[:, None]
gains = {'pad': 0.8, 'bass': 0.95, 'arp': 0.7, 'lead': 0.85, 'drums': 1.0, 'fx': 1.0, 'bell': 0.9, 'neon': 0.8}
out = sum(mix[k] * g for k, g in gains.items()) + hall * 0.4 + plate * 0.28
out *= pre_drop[:, None]
out = hp(out, 28, 2)
out = shelf(out, 95, -2.0, 'low')
out = shelf(out, 3800, 3.0, 'high')

rms = np.sqrt(uniform_filter1d(out.mean(1) ** 2, 2400) + 1e-12)
db = 20 * np.log10(rms)
gr_db = np.where(db > -16, (db + 16) * (1 - 1 / 2.0), 0)
gr = 10 ** (-signal.lfilter([0.002], [1, -0.998], gr_db) / 20)
out *= gr[:, None]
# the loop seam: 8 ms in and out, so the 30-s file repeats without a click
ramp = int(0.008 * SR)
out[:ramp] *= np.linspace(0, 1, ramp)[:, None]
out[-ramp:] *= np.linspace(1, 0, ramp)[:, None]

peak = np.max(np.abs(out))
out = np.tanh(out / peak * 1.1) / np.tanh(1.1) * 0.89
assert np.isfinite(out).all()
dst = sys.argv[1] if len(sys.argv) > 1 else 'score_v2.wav'
wavfile.write(dst, SR, out.astype(np.float32))
print(f'120 BPM, {DUR:.0f} s, peak-in {peak:.3f} -> {dst}')
