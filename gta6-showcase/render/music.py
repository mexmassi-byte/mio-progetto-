#!/usr/bin/env python3
"""
Original score for the GTA VI concept showcase — fully procedural (no samples, no
existing music). A night-time synthwave piece in D minor, timed to the picture:

  1.70 s  display wakes      -> soft swell + glassy bell chord
  10.35 s scrolling begins   -> reverse swell, beat and bass drop in (bar 0)
  44.43 s finale date rolls  -> riser, impact, wide final chord
  48.35 s picture fades out  -> score fades with it (ends at 50.0 s)

The tempo is chosen so that exactly 14 bars fit between the scroll start and the
finale hit (~98.6 BPM). Output: 48 kHz float WAV.

  python3 render/music.py <out.wav>
"""
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import uniform_filter1d

SR = 48000
DUR = 50.0
N = int(SR * DUR)
T_ON = 1.70
T0 = 10.35
T_HIT = 44.43
BARS = 14
BAR = (T_HIT - T0) / BARS
BEAT = BAR / 4
rng = np.random.default_rng(1987)

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6,
        'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def hz(name):
    midi = 12 * (int(name[-1]) + 1) + NOTE[name[:-1]]
    return 440.0 * 2 ** ((midi - 69) / 12)


def bar_t(b, beat=0.0):
    return T0 + b * BAR + beat * BEAT


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


def lp_sweep(x, cutoff_fn, block=1024):
    """Time-varying 2-pole lowpass (stereo or mono), coefficients updated per block."""
    x = np.atleast_2d(x.T).T if x.ndim == 1 else x
    y = np.zeros_like(x)
    zi = np.zeros((1, 2, x.shape[1]))
    for s in range(0, len(x), block):
        fc = min(max(cutoff_fn((s + block / 2) / SR), 30.0), SR * 0.45)
        sos = signal.butter(2, fc, 'low', fs=SR, output='sos')
        y[s:s + block], zi = signal.sosfilt(sos, x[s:s + block], axis=0, zi=zi)
    return y


def env_adsr(n, a, d, s, r, gate):
    """n samples; attack/decay/release in seconds; gate = held length (s)."""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = t > gate
    if rel.any():
        g = e[np.argmax(rel) - 1] if np.argmax(rel) > 0 else e[0]
        e[rel] = g * np.exp(-(t[rel] - gate) / max(r, 1e-4))
    return e


def add(bus, sig, t, gain=1.0, pan=0.0):
    """Mix mono/stereo `sig` into stereo `bus` starting at time t (equal-power pan)."""
    i0 = idx(t)
    if i0 >= N:
        return
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], 1) * np.sqrt(2)
    # de-click: every event gets a 1 ms fade-in and a short raised-cosine fade-out
    sig = sig.copy()
    m_in = min(len(sig), int(0.001 * SR))
    if m_in > 1:
        sig[:m_in] *= np.linspace(0, 1, m_in)[:, None]
    m_out = min(len(sig) // 5, int(0.012 * SR))
    if m_out > 1:
        sig[-m_out:] *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, m_out)))[:, None]
    n = min(len(sig), N - i0)
    if i0 < 0:
        sig = sig[-i0:]
        n = min(len(sig), N)
        i0 = 0
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


# ----------------------------------------------------------------------------- harmony
CHORDS = [
    ['D3', 'A3', 'C4', 'E4', 'F4'],     # Dm9
    ['Bb2', 'F3', 'A3', 'C4', 'D4'],    # Bbmaj7(9)
    ['F3', 'A3', 'C4', 'E4', 'G4'],     # Fmaj9
    ['C3', 'G3', 'D4', 'E4', 'G4'],     # Cadd9
]
ROOT = ['D2', 'Bb1', 'F2', 'C2']
ARP = [['D4', 'F4', 'A4', 'C5', 'E5'], ['Bb3', 'D4', 'F4', 'A4', 'C5'],
       ['F4', 'A4', 'C5', 'E5', 'G5'], ['C4', 'E4', 'G4', 'D5', 'E5']]


def chord_of(b):
    return b % 4


mix = {k: np.zeros((N, 2)) for k in ['pad', 'bass', 'arp', 'lead', 'drums', 'fx', 'bell']}
send_hall = np.zeros((N, 2))
send_plate = np.zeros((N, 2))

# ----------------------------------------------------------------------------- pad
pad_raw = np.zeros((N, 2))
pad_bars = list(range(-4, BARS))
for b in pad_bars:
    ci = chord_of(b)
    start = bar_t(b)
    length = BAR + 1.6
    att = 1.3 if b < 0 else 0.45
    for k, nm in enumerate(CHORDS[ci]):
        f = hz(nm)
        n = int(length * SR)
        e = env_adsr(n, att, 1.0, 0.85, 0.5, BAR + 0.05)
        sl = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-9, -2, 6)) / 3
        sr_ = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-6, 3, 9)) / 3
        add(pad_raw, np.stack([sl, sr_], 1) * e[:, None], start, 0.11)
# final chord (finale): Dm9 wide, long
for nm in ['D3', 'A3', 'C4', 'E4', 'F4', 'A4', 'D5']:
    f = hz(nm)
    n = int((DUR - T_HIT + 0.1) * SR)
    e = env_adsr(n, 0.02, 2.0, 0.8, 1.5, DUR - T_HIT)
    sl = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-10, 0, 8)) / 3
    sr_ = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-8, 2, 10)) / 3
    add(pad_raw, np.stack([sl, sr_], 1) * e[:, None], T_HIT, 0.12)


def pad_cut(t):
    if t < T0:   # intro: dark -> opening
        return 260 + (2300 - 260) * (max(t - 0.6, 0) / (T0 - 0.6)) ** 1.6
    if t < bar_t(8):
        return 3000
    if t < bar_t(12):
        return 3600
    if t < T_HIT:   # build sweep
        u = (t - bar_t(12)) / (T_HIT - bar_t(12))
        return 3600 * (8500 / 3600) ** u
    u = min((t - T_HIT) / (DUR - T_HIT), 1)
    return 6500 * (900 / 6500) ** u


mix['pad'] = lp_sweep(pad_raw, pad_cut)
send_hall += mix['pad'] * 0.55

# ----------------------------------------------------------------------------- drums
def kick(v=1.0):
    n = int(0.55 * SR)
    t = np.arange(n) / SR
    f = 50 + 125 * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.21)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.004) * 0.55
    return np.tanh((body + click) * 1.6) * v


def snare(v=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 1200, 9000) * np.exp(-t / 0.13)
    tone = np.sin(2 * np.pi * 186 * t) * np.exp(-t / 0.07) * 0.8
    return (noise * 0.9 + tone) * v


def hat(v=1.0, open_=False):
    n = int((0.5 if open_ else 0.12) * SR)
    t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7200, 2) * np.exp(-t / (0.16 if open_ else 0.028)) * v


def shaker(v=1.0):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 4500, 11000) * np.minimum(1, t / 0.008) * np.exp(-t / 0.035) * v


def crash(v=1.0, dur=3.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 3800, 2) * np.exp(-t / (dur * 0.33))
    metal = sum(np.sin(2 * np.pi * f * t) for f in (3150, 4370, 5810, 6920)) * 0.05 * np.exp(-t / 0.8)
    return (x + metal) * v


kick_times = []
for b in range(BARS):
    pos = [0, 2] if b < 4 else [0, 2, 2.5] if b < 12 else [0, 1, 2, 3]
    if b == BARS - 1:
        pos = [0, 1, 2]
    for p in pos:
        tk = bar_t(b, p)
        kick_times.append(tk)
        add(mix['drums'], kick(0.95 if p in (0, 2) else 0.75), tk, 0.5)
    # snare / clap on 2 and 4 (+ gated plate)
    for p in ([1, 3] if b < BARS - 1 else [1]):
        s = snare(0.85)
        add(mix['drums'], s, bar_t(b, p), 0.38, pan=0.04)
        add(send_plate, s, bar_t(b, p), 0.55)
    # closed hats 8ths
    for k in range(8):
        p = k * 0.5
        if b == BARS - 1 and p >= 2:
            break
        v = (0.55 if k % 2 == 0 else 0.85) * (0.85 + 0.15 * rng.random())
        add(mix['drums'], hat(v), bar_t(b, p) + rng.normal(0, 0.002), 0.15, pan=0.28)
    # 16th shaker from bar 4
    if 4 <= b < BARS - 1:
        for k in range(16):
            add(mix['drums'], shaker(0.6 + 0.4 * ((k % 4) == 2)), bar_t(b, k * 0.25) + rng.normal(0, 0.003), 0.065, pan=-0.35)
    # open hats on off-beats in section B
    if 8 <= b < 12:
        for p in (0.5, 1.5, 2.5, 3.5):
            add(mix['drums'], hat(0.7, True), bar_t(b, p), 0.06, pan=0.2)
# snare roll into the finale (last bar, beats 2..3.75)
for k in range(8):
    p = 2 + k * 0.25
    s = snare(0.35 + 0.65 * k / 7)
    add(mix['drums'], s, bar_t(BARS - 1, p), 0.26)
    add(send_plate, s, bar_t(BARS - 1, p), 0.35)
# crashes
add(mix['drums'], crash(0.55), T0, 0.16, pan=-0.2)
add(mix['drums'], crash(0.5), bar_t(8), 0.14, pan=0.25)

# sidechain ducking driven by the kicks
duck = np.ones(N)
for tk in kick_times:
    i0 = idx(tk)
    L = int(0.9 * SR)
    t = np.arange(L) / SR
    ramp = np.clip(t / 0.006, 0, 1)
    shape = 1 - 0.62 * np.exp(-t / 0.13) * ramp * ramp * (3 - 2 * ramp)   # continuous at both ends
    j = min(N, i0 + L)
    duck[i0:j] = np.minimum(duck[i0:j], shape[: j - i0])

# ----------------------------------------------------------------------------- bass
bass = np.zeros((N, 2))
for b in range(BARS):
    ci = chord_of(b)
    r2 = hz(ROOT[ci])
    for k in range(8):
        if b == BARS - 1 and k >= 7:
            break
        f = r2 * (2 if k % 2 else 1)
        n = int(BEAT * 0.5 * SR * 0.9)
        x = 0.7 * saw(f, n) + 0.45 * square(f, n)
        t = np.arange(n) / SR
        cutoff = 560 + 1700 * np.exp(-t / 0.06)
        # per-note decaying filter (block-wise)
        y = np.zeros(n)
        zi = np.zeros((1, 2))
        for s in range(0, n, 256):
            sos = signal.butter(2, cutoff[s], 'low', fs=SR, output='sos')
            y[s:s + 256], zi = signal.sosfilt(sos, x[s:s + 256], zi=zi)
        y *= env_adsr(n, 0.003, 0.15, 0.7, 0.008, n / SR - 0.035)
        add(bass, y, bar_t(b, k * 0.5), 0.27)
    # sub sine under each bar
    n = int(BAR * SR)
    e = env_adsr(n, 0.01, 0.3, 0.9, 0.05, BAR - 0.05)
    add(bass, sine(r2, n) * e, bar_t(b), 0.11)
mix['bass'] = bass * duck[:, None]

# ----------------------------------------------------------------------------- arp
arp = np.zeros((N, 2))
PAT = [0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 4, 3, 1, 2, 4, 2]
for b in range(-2, BARS):
    ci = chord_of(b)
    for k in range(16):
        if b == BARS - 1 and k >= 14:
            break
        f = hz(ARP[ci][PAT[k]])
        n = int(0.32 * SR)
        x = 0.6 * saw(f, n) + 0.4 * square(f * 1.002, n)
        t = np.arange(n) / SR
        x = lp(x, 4200 if b >= 0 else 2300, 2) * np.exp(-t / 0.11) * np.minimum(1, t / 0.002)
        v = (0.2 + 0.14 * (b + 2) / 2) if b < 0 else (0.5 if b < 8 else 0.42)
        v *= 1.0 if k % 4 == 0 else 0.78
        add(arp, x, bar_t(b, k * 0.25), v, pan=0.15 * np.sin(k * 0.9))
arp = arp * (0.55 + 0.45 * duck[:, None])
mix['arp'] = arp + pingpong(arp, BEAT * 0.75, 0.42, 6) * 0.55
send_hall += mix['arp'] * 0.25

# ----------------------------------------------------------------------------- lead (section B + build)
LEAD = {
    8: [(0, 'A4', 1), (1, 'C5', 0.5), (1.5, 'D5', 1.5), (3, 'E5', 0.5), (3.5, 'D5', 0.5)],
    9: [(0, 'D5', 1), (1, 'F5', 1), (2, 'E5', 0.75), (2.75, 'D5', 1.25)],
    10: [(0, 'C5', 1), (1, 'A4', 0.5), (1.5, 'C5', 1.5), (3, 'E5', 0.5), (3.5, 'G5', 0.5)],
    11: [(0, 'E5', 1.5), (1.5, 'D5', 0.5), (2, 'C5', 1), (3, 'A4', 1)],
    12: [(0, 'D5', 2), (2, 'E5', 2)],
    13: [(0, 'F5', 1.5), (1.5, 'G5', 1), (2.5, 'A5', 1)],
}
lead = np.zeros((N, 2))
for b, notes in LEAD.items():
    for beat, nm, d in notes:
        f = hz(nm)
        dur = d * BEAT + 1.4
        s = fm_bell(f, dur, ratio=2.0, index=1.6, decay=0.9) * 0.8
        s += sine(f * 0.5, len(s)) * np.exp(-np.arange(len(s)) / SR / 0.7) * 0.25
        add(lead, s, bar_t(b, beat), 0.25, pan=-0.1)
mix['lead'] = lead + pingpong(lead, BEAT * 0.75, 0.35, 5) * 0.5
send_hall += mix['lead'] * 0.45

# ----------------------------------------------------------------------------- bells (display wake + finale)
bell = np.zeros((N, 2))
for k, nm in enumerate(['D5', 'A5', 'E6']):
    add(bell, fm_bell(hz(nm), 4.0, 3.5, 2.0, 1.8), T_ON + 0.02 + k * 0.035, 0.15, pan=(-0.3, 0.05, 0.3)[k])
for k, nm in enumerate(['D5', 'F5', 'A5', 'C6', 'E6', 'A6']):
    add(bell, fm_bell(hz(nm), 4.5, 3.5, 1.8, 2.0), T_HIT + 0.05 + k * 0.29, 0.12, pan=np.sin(k * 1.3) * 0.5)
mix['bell'] = bell + pingpong(bell, BEAT * 0.75, 0.4, 5) * 0.45
send_hall += mix['bell'] * 0.7

# ----------------------------------------------------------------------------- fx
fx = np.zeros((N, 2))
t_all = np.arange(N) / SR
# intro drone + night air (fades out after the drop)
dn = int((T0 + 3.0) * SR)
td = np.arange(dn) / SR
drone = (sine(hz('D2'), dn) + 0.6 * sine(hz('A2'), dn) + 0.25 * sine(hz('D3') * 1.003, dn))
drone *= (0.75 + 0.25 * np.sin(2 * np.pi * 0.11 * td)) * np.minimum(1, td / 2.2) * np.clip((T0 + 3.0 - td) / 3.0, 0, 1)
add(fx, lp(drone, 500), 0.0, 0.10)
air = bp(rng.standard_normal((dn, 2)), 250, 2600)
air *= (np.minimum(1, td / 1.5) * np.clip((T0 + 1.0 - td) / 2.0, 0, 1))[:, None]
add(fx, air, 0.0, 0.018)
# display wake: soft rising swell into the bell + a warm low thump
sw = int(0.65 * SR)
ts = np.arange(sw) / SR
swell = lp(rng.standard_normal(sw), 2200) * (ts / ts[-1]) ** 2.2
add(fx, swell, T_ON - 0.63, 0.05)
thn = int(0.9 * SR)
tt = np.arange(thn) / SR
thump = np.sin(2 * np.pi * np.cumsum(70 * np.exp(-tt / 0.5) + 38) / SR) * np.exp(-tt / 0.35)
add(fx, thump, T_ON, 0.16)
# reverse swell into the drop (bar 0)
rv = int(1.6 * SR)
tr = np.arange(rv) / SR
rev = lp_sweep(rng.standard_normal((rv, 2)), lambda x: 250 * (9000 / 250) ** (x / 1.6)) * ((tr / tr[-1]) ** 3)[:, None]
add(fx, rev, T0 - 1.6, 0.09)
# riser across the build (bars 12-13), cut right before the hit
rs0 = bar_t(12)
rn = int((T_HIT - rs0 - 0.16) * SR)
trr = np.arange(rn) / SR
u = trr / trr[-1]
riser = lp_sweep(rng.standard_normal((rn, 2)), lambda x: 400 * (9500 / 400) ** (x / (rn / SR))) * (u ** 2.2)[:, None]
pitch = np.sin(2 * np.pi * np.cumsum(110 * (8 ** u)) / SR) * u ** 2 * 0.25
add(fx, riser + pitch[:, None], rs0, 0.08)
# impact: sub boom + thump + crash
bn = int(3.2 * SR)
tb = np.arange(bn) / SR
boom = np.tanh(1.8 * np.sin(2 * np.pi * np.cumsum(32 + 30 * np.exp(-tb / 0.22)) / SR) * np.exp(-tb / 1.25))
add(fx, boom, T_HIT, 0.36)
add(fx, lp(rng.standard_normal(int(0.4 * SR)), 900) * np.exp(-np.arange(int(0.4 * SR)) / SR / 0.09), T_HIT, 0.30)
cr = crash(1.0, 4.2)
add(fx, cr, T_HIT, 0.21)
add(send_hall, cr, T_HIT, 0.25)
mix['fx'] = fx
send_hall += fx * 0.35

# ----------------------------------------------------------------------------- pre-hit 'breath'
dip = 1 - 0.8 * np.clip((t_all - (T_HIT - 0.24)) / 0.2, 0, 1)   # these buses stay quiet after the hit
for k in ('drums', 'bass', 'arp', 'lead'):
    mix[k] *= dip[:, None]


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


# ----------------------------------------------------------------------------- reverbs + master
hall = reverb(send_hall, make_ir(4.2, 3.4, 5200, 11, 0.022))
plate = reverb(send_plate, make_ir(0.6, 0.9, 7000, 23, 0.004, gate=0.34))
gains = {'pad': 0.85, 'bass': 0.95, 'arp': 0.7, 'lead': 0.8, 'drums': 1.0, 'fx': 1.0, 'bell': 0.9}
out = sum(mix[k] * g for k, g in gains.items()) + hall * 0.42 + plate * 0.30
out = hp(out, 28, 2)
out = shelf(out, 95, -2.5, 'low')
out = shelf(out, 3800, 3.0, 'high')

# gentle glue compression (RMS detector, 2:1 above -16 dBFS) + soft clip
rms = np.sqrt(uniform_filter1d(out.mean(1) ** 2, 2400) + 1e-12)
db = 20 * np.log10(rms)
gr_db = np.where(db > -16, (db + 16) * (1 - 1 / 2.0), 0)
gr = 10 ** (-signal.lfilter([0.002], [1, -0.998], gr_db) / 20)
out *= gr[:, None]

# picture-synced fades
fade = np.clip(t_all / 1.2, 0, 1) * np.clip((DUR - 0.02 - t_all) / (DUR - 0.02 - 48.35), 0, 1)
out *= (0.5 - 0.5 * np.cos(np.pi * fade))[:, None]

peak = np.max(np.abs(out))
out = np.tanh(out / peak * 1.1) / np.tanh(1.1) * 0.89
assert np.isfinite(out).all()
wavfile.write(sys.argv[1] if len(sys.argv) > 1 else 'score.wav', SR, out.astype(np.float32))
print(f'bar {BAR:.4f}s  ({240 / BAR:.2f} BPM)  peak-in {peak:.3f}  -> {sys.argv[1] if len(sys.argv) > 1 else "score.wav"}')
