"""A tiny offline music studio: synthesized drums, bass, plucks, supersaws, pads, sidechain, delay, reverb, mastering.
Everything is generated from scratch (no samples), so the tracks are 100% original."""
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
SR = 44100
rng = np.random.default_rng(7)

def mf(n):  # midi -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)

class Song:
    def __init__(self, bpm, bars):
        self.bpm = bpm; self.beat = 60 / bpm; self.bar = self.beat * 4
        n = int((bars * self.bar + 4) * SR)
        self.buses = {k: np.zeros((n, 2)) for k in ("drums", "bass", "music", "lead", "fx")}
        self.n = n; self.kicks = []
    def at(self, bar, beat=0.0):  # time in seconds
        return bar * self.bar + beat * self.beat
    def add(self, bus, t, sig, pan=0.0, gain=1.0):
        i = int(t * SR); sig = np.asarray(sig)
        if sig.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            sig = np.stack([sig * l * 1.414, sig * r * 1.414], 1)
        j = min(self.n, i + len(sig))
        if j > i: self.buses[bus][i:j] += sig[: j - i] * gain

def env_adsr(n, a=0.005, d=0.1, s=0.7, r=0.08, hold=None):
    t = np.arange(n) / SR; hold = hold if hold is not None else n / SR - r
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = np.clip((t - hold) / max(r, 1e-6), 0, 1); return e * (1 - rel)

def lp(x, f, order=2):
    sos = butter(order, min(f, SR * 0.45), "low", fs=SR, output="sos"); return sosfilt(sos, x, axis=0)
def hp(x, f, order=2):
    sos = butter(order, f, "high", fs=SR, output="sos"); return sosfilt(sos, x, axis=0)
def bp(x, f1, f2, order=2):
    sos = butter(order, [f1, f2], "band", fs=SR, output="sos"); return sosfilt(sos, x, axis=0)

def noise(n): return rng.standard_normal(n)

# ---------- drums ----------
def kick(dur=0.42, punch=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 46 + 120 * np.exp(-t / 0.032) + 40 * np.exp(-t / 0.006)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.22)
    click = hp(noise(n), 2500) * np.exp(-t / 0.004) * 0.35 * punch
    return np.tanh((body + click) * 1.6) * 0.5
def clap():
    n = int(0.35 * SR); t = np.arange(n) / SR; x = bp(noise(n), 900, 3200)
    e = np.zeros(n)
    for k, o in enumerate((0, 0.011, 0.022)):
        e += (t >= o) * np.exp(-(t - o).clip(0) / (0.006 if k < 2 else 0.09))
    return x * e * 0.55
def snare():
    n = int(0.25 * SR); t = np.arange(n) / SR
    return (bp(noise(n), 1200, 7000) * np.exp(-t / 0.07) * 0.5 + np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04) * 0.4)
def hat(open_=False):
    n = int((0.25 if open_ else 0.05) * SR); t = np.arange(n) / SR
    return hp(noise(n), 7500, 4) * np.exp(-t / (0.08 if open_ else 0.012)) * 0.35
def shaker():
    n = int(0.07 * SR); t = np.arange(n) / SR
    return bp(noise(n), 5000, 11000) * np.sin(np.pi * t / t[-1]) ** 2 * 0.18
def crash():
    n = int(2.2 * SR); t = np.arange(n) / SR
    return hp(noise(n), 4000) * np.exp(-t / 0.7) * 0.22
def riser(sec):
    n = int(sec * SR); t = np.arange(n) / SR; x = noise(n); out = np.zeros(n); seg = 2048
    for i in range(0, n, seg):
        k = i / n; f = 300 + 9000 * k ** 2
        out[i:i + seg] = bp(x[i:i + seg], f * 0.7, min(f * 1.3, 19000), 1)
    return out * (t / sec) ** 1.5 * 0.25
def downlifter(sec=1.5):
    return riser(sec)[::-1] * 0.8
def tom(f=110):
    n = int(0.3 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * np.exp(-t / 0.03))) / SR) * np.exp(-t / 0.12) * 0.6

# ---------- tonal ----------
def additive_saw(f, n, harm_cut=9000, voices=1, detune=0.0, bright=1.0):
    t = np.arange(n) / SR; out = np.zeros(n)
    for v in range(voices):
        d = 0 if voices == 1 else (v / (voices - 1) - 0.5) * 2 * detune
        fv = f * 2 ** (d / 12); ph0 = rng.random() * 2 * np.pi
        K = int(min(harm_cut, SR * 0.45) / fv)
        for k in range(1, max(2, K)):
            out += np.sin(2 * np.pi * k * fv * t + ph0 * k) / k * (1 / (1 + (k * fv / (2500 * bright)) ** 2))
    return out / max(1, voices) ** 0.6 * 0.5
def supersaw(notes, dur, a=0.01, r=0.15, voices=7, detune=0.22, bright=1.0, width=0.8):
    n = int((dur + r) * SR); L = np.zeros(n); R = np.zeros(n)
    for m in notes:
        f = mf(m)
        L += additive_saw(f, n, 7000, voices, detune, bright); R += additive_saw(f, n, 7000, voices, detune, bright)
    e = env_adsr(n, a, 0.25, 0.8, r, dur)
    mid = (L + R) / 2; side = (L - R) / 2 * width
    return np.stack([(mid + side) * e, (mid - side) * e], 1) / max(1, len(notes)) ** 0.5
def pluck(m, dur=0.35, bright=1.0, decay=0.25):
    f = mf(m); n = int(dur * SR) + int(0.05 * SR); t = np.arange(n) / SR; out = np.zeros(n)
    K = int(12000 / f)
    for k in range(1, max(2, min(K, 30))):
        out += np.sin(2 * np.pi * k * f * t) / k * np.exp(-t * (1 / decay + k * 6 / bright))
    return out * np.minimum(1, t / 0.002) * 0.45
def bell(m, dur=0.8):
    f = mf(m); n = int(dur * SR); t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.2 * np.exp(-t / 0.15)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t / (dur * 0.35)) * 0.35
def marimba(m, dur=0.5):
    f = mf(m); n = int(dur * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.18) + 0.3 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t / 0.03)) * 0.5
def flute(m, dur, vib=5.5):
    f = mf(m); n = int((dur + 0.08) * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(f * (1 + 0.006 * np.sin(2 * np.pi * vib * t) * np.clip(t / 0.25, 0, 1))) / SR
    x = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph) + lp(noise(n), 3000) * 0.03
    return x * env_adsr(n, 0.04, 0.2, 0.85, 0.08, dur) * 0.4
def sub(m, dur, a=0.004, r=0.05):
    f = mf(m); n = int((dur + r) * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.tanh(3 * np.sin(2 * np.pi * f * t))
    return x * env_adsr(n, a, 0.2, 0.9, r, dur) * 0.55
def reese(m, dur):
    n = int((dur + 0.05) * SR)
    x = additive_saw(mf(m), n, 1200, 3, 0.15, 0.4)
    return x * env_adsr(n, 0.005, 0.2, 0.85, 0.05, dur) * 0.9
def keys(notes, dur):  # electric-piano chord
    n = int((dur + 0.3) * SR); t = np.arange(n) / SR; out = np.zeros(n)
    for m in notes:
        f = mf(m); mod = np.sin(2 * np.pi * f * t) * 1.2 * np.exp(-t / 0.3)
        out += np.sin(2 * np.pi * f * t + mod) * np.exp(-t / 1.2)
    return out * env_adsr(n, 0.003, 0.5, 0.8, 0.25, dur) * 0.25 / len(notes) ** 0.5
def pad(notes, dur):
    return supersaw(notes, dur, a=0.6, r=0.8, voices=5, detune=0.12, bright=0.35, width=1.0) * 0.8

# ---------- mixing ----------
def delay(x, sec, fb=0.35, mix=0.3, pingpong=True):
    d = int(sec * SR); out = x.copy(); tap = x.copy()
    for k in range(1, 6):
        tap = np.roll(tap, d, axis=0); tap[:d] = 0; tap = tap * fb
        if pingpong: tap = tap[:, ::-1]
        out += tap * mix / fb
    return out
def reverb_ir(sec=1.8, pre=0.02):
    n = int(sec * SR); t = np.arange(n) / SR
    ir = np.stack([noise(n), noise(n)], 1) * np.exp(-t / (sec / 5))[:, None]
    ir = lp(ir, 7000); ir[: int(pre * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum(0))
def reverb(x, mix=0.2, sec=1.8):
    ir = reverb_ir(sec)
    wet = np.stack([fftconvolve(x[:, 0], ir[:, 0])[: len(x)], fftconvolve(x[:, 1], ir[:, 1])[: len(x)]], 1)
    return x * (1 - mix * 0.3) + wet * mix
def sidechain(song, depth=0.75, rel=0.22):
    g = np.ones(song.n); t = np.arange(int(rel * 2.2 * SR)) / SR
    curve = 1 - depth * np.exp(-t / (rel / 3)) * (t < rel * 2.2)
    for k in song.kicks:
        i = int(k * SR); j = min(song.n, i + len(curve)); g[i:j] = np.minimum(g[i:j], curve[: j - i])
    return g[:, None]
def master(song, out_path, gains=None):
    G = {"drums": 1.0, "bass": 0.9, "music": 0.75, "lead": 0.7, "fx": 0.6, **(gains or {})}
    G["music"] *= 2.6; G["lead"] *= 3.2; G["bass"] *= 0.55
    sc = sidechain(song)
    mus = reverb(song.buses["music"] * sc, 0.28, 2.2)
    lead = reverb(delay(song.buses["lead"], song.beat * 0.75, 0.32, 0.22) * (0.35 + 0.65 * sc), 0.22, 1.8)
    bass = song.buses["bass"] * sc
    drums = song.buses["drums"]; drums = drums + reverb(drums, 0.08, 0.8) * 0.3
    fx = reverb(song.buses["fx"], 0.35, 2.5)
    mix = drums * G["drums"] + bass * G["bass"] + mus * G["music"] + lead * G["lead"] + fx * G["fx"]
    mix = hp(mix, 28)
    # glue: soft compression + limiter
    # gentle bus compression (RMS follower) then a soft limiter: loud but clean
    peak = np.max(np.abs(mix)); mix = mix / peak
    env = np.sqrt(lp(mix.mean(1) ** 2, 8, 1).clip(1e-9))
    target = np.percentile(env, 70); gr = np.minimum(1, (target / env.clip(1e-6)) ** 0.35)
    mix = mix * gr[:, None]
    mix = mix / np.percentile(np.abs(mix), 99.95) * 0.98
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix = mix / np.max(np.abs(mix)) * 0.93
    # trim trailing silence, short fades
    nz = np.where(np.abs(mix).max(1) > 1e-3)[0]; mix = mix[: nz[-1] + int(0.5 * SR)]
    f = int(0.01 * SR); mix[:f] *= np.linspace(0, 1, f)[:, None]; fo = int(1.5 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
    pcm = (mix * 32767).astype(np.int16)
    import subprocess
    p = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-", "-b:a", "128k", out_path], input=pcm.tobytes())
    return len(mix) / SR
