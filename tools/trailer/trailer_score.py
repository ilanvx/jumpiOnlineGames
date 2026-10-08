"""The Jumpi trailer soundtrack (81 s), made from scratch with the little synth studio in engine.py.
Cues follow the film: dawn ambience, a morning tune, a playful police theme, the pizza build-up into a
future-bass drop (one bar = one montage cut), a calm sunset, the storm, the climax and the end sting."""
import sys, wave
import numpy as np
from engine import *

LEN = 81.0
S = Song(60, 82)          # one "bar" = 4 s, but everything below is placed in seconds
S.n = int(LEN * SR); S.buses = {k: np.zeros((S.n, 2)) for k in ("drums", "bass", "music", "lead", "fx", "amb")}
R = np.random.default_rng(11)
K = kick()

def put(bus, t, sig, pan=0.0, gain=1.0):
    if t < 0 or t >= LEN: return
    S.add(bus, t, sig, pan, gain)
def env_curve(points, n):  # piecewise-linear gain curve over the whole film
    t = np.arange(n) / SR; xs, ys = zip(*points); return np.interp(t, xs, ys)

# ---------------- ambience ----------------
def waves(sec):
    n = int(sec * SR); t = np.arange(n) / SR
    base = lp(np.stack([noise(n), noise(n)], 1), 900)
    swell = 0.45 + 0.55 * (0.5 + 0.5 * np.sin(2 * np.pi * t[:, None] / 5.5 + np.array([[0, 0.8]])))
    hiss = hp(np.stack([noise(n), noise(n)], 1), 3000) * 0.18 * swell ** 3
    return (base * swell * 0.5 + hiss) * 0.6
def chirp(f0=3000):
    n = int(0.12 * SR); t = np.arange(n) / SR
    f = f0 * (1 + 0.5 * np.sin(2 * np.pi * 18 * t)) * (1 + 0.35 * t / t[-1])
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / t[-1]) ** 2 * 0.12
def birds(t0, t1, density=2.2):
    t = t0
    while t < t1:
        f0 = R.uniform(2400, 4200)
        for k in range(R.integers(2, 5)): put("amb", t + k * 0.13, chirp(f0 * R.uniform(.9, 1.15)), pan=R.uniform(-.8, .8), gain=R.uniform(.5, 1))
        t += R.exponential(1 / density) + 0.3
def rain(sec):
    n = int(sec * SR)
    x = bp(np.stack([noise(n), noise(n)], 1), 1200, 9000) * 0.25 + lp(np.stack([noise(n), noise(n)], 1), 500) * 0.25
    drops = np.zeros((n, 2))
    for i in R.integers(0, n - 2000, int(sec * 60)):
        d = hp(noise(400), 3000) * np.exp(-np.arange(400) / 60) * R.uniform(.05, .2); drops[i:i + 400, R.integers(0, 2)] += d
    return x + drops
def thunder(near=True):
    n = int(5 * SR); t = np.arange(n) / SR
    rumble = lp(noise(n), 160, 2) * (np.exp(-t / 1.6) * (1 + 0.6 * np.sin(2 * np.pi * 1.7 * t) ** 2)) * 1.4
    crack = hp(noise(n), 1500) * np.exp(-t / 0.08) * (0.9 if near else 0.25)
    x = rumble + crack
    return np.stack([x, np.roll(x, 300)], 1) * 0.9

# ---------------- little sound effects ----------------
def ding(m=88, g=1.0): return bell(m, 1.2) * g
def coin():
    n = int(0.4 * SR); t = np.arange(n) / SR
    sq = lambda f: np.sign(np.sin(2 * np.pi * f * t))
    x = np.where(t < 0.08, sq(988), sq(1319)) * np.exp(-np.maximum(0, t - 0.08) / 0.12) * 0.12
    return x
def whoosh(sec=0.6):
    n = int(sec * SR); t = np.arange(n) / SR; x = noise(n); out = np.zeros(n); seg = 1024
    for i in range(0, n, seg):
        k = i / n; f = 400 + 5000 * np.sin(np.pi * k)
        out[i:i + seg] = bp(x[i:i + seg], f * .6, min(f * 1.4, 18000), 1)
    return out * np.sin(np.pi * t / sec) ** 2 * 0.5
def glide(f0, f1, sec, g=0.15):
    n = int(sec * SR); t = np.arange(n) / SR; f = f0 * (f1 / f0) ** (t / sec)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / sec) * g
def sparkle(t0):
    for k, m in enumerate([84, 88, 91, 96, 100, 103]): put("fx", t0 + k * 0.045, bell(m, 0.6), pan=(k % 2) * .6 - .3, gain=0.5)
def clunk():
    return tom(85) * 1.2 + np.concatenate([hp(noise(600), 2000) * np.exp(-np.arange(600) / 80) * 0.3, np.zeros(int(0.3 * SR) - 600)])
def engine_hum(t0, t1, speed):
    n = int((t1 - t0) * SR); t = np.arange(n) / SR
    sp = np.interp(t, *zip(*speed)); f = 55 + 70 * sp
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = sum(np.sin(k * ph) / k for k in range(1, 12)) * (0.8 + 0.2 * np.sin(2 * np.pi * 23 * t))
    x = lp(x, 1400) * 0.12 * np.clip(t / .3, 0, 1) * np.clip((t1 - t0 - t) / .4, 0, 1)
    put("fx", t0, x, gain=1.0)
def screech(t0, sec=0.8):
    n = int(sec * SR); t = np.arange(n) / SR
    x = bp(noise(n), 2200, 3400, 2) * (0.6 + 0.4 * np.sin(2 * np.pi * 37 * t)) * np.sin(np.pi * t / sec) ** .5 * 0.45
    put("fx", t0, x, pan=.2)

# ---------------- music ----------------
C, D, E, F, G, A, B = 60, 62, 64, 65, 67, 69, 71
def chord_pad(t, notes, dur, g=1.0): put("music", t, pad(notes, dur), gain=g)

# 0-8 dawn: sea, birds, a soft pad that opens up, a ding when the clock turns 7:00
put("amb", 0, waves(9.5), gain=1.0)
birds(1.0, 9.0, 1.6)
chord_pad(2.5, (55, 62, 67, 71), 5.6, 0.7)
put("fx", 4.1, ding(91), gain=0.7); put("fx", 4.15, ding(96), gain=0.45)
put("fx", 4.4, whoosh(0.9), gain=0.5)

# 8-18 morning: a light marimba tune (100 bpm)
bt = 0.6; t0 = 8.2
prog = [(C, (48, 55, 64)), (A - 12, (45, 52, 60)), (F - 12, (41, 48, 57)), (G - 12, (43, 50, 59))]
mel = [E + 12, G + 12, A + 12, G + 12, E + 12, D + 12, C + 12, D + 12, E + 12, G + 12, C + 24, B + 12, A + 12, G + 12, E + 12, G + 12]
for bar in range(4):
    root, ch = prog[bar]; tb = t0 + bar * 4 * bt
    put("bass", tb, sub(root - 12, 3.6 * bt), gain=0.7)
    put("music", tb, keys(ch, 3.8 * bt), gain=0.9)
    for q in range(4):
        put("lead", tb + q * bt, marimba(mel[(bar * 4 + q) % 16], 0.5), pan=-.2, gain=0.8)
        put("lead", tb + (q + .5) * bt, marimba(mel[(bar * 4 + q + 2) % 16] - 12, 0.4), pan=.3, gain=0.45)
    for q in range(8): put("drums", tb + q * bt / 2, shaker(), pan=.3 if q % 2 else -.3, gain=0.5)
put("fx", 8.3, glide(300, 900, 1.9, 0.08), gain=0.8)        # the meter fills
put("fx", 10.15, ding(96, 0.8), gain=0.6)                  # full!
put("fx", 10.3, glide(500, 1200, 0.35, 0.18), gain=0.8)     # boing, up you get
sparkle(13.5)
put("fx", 14.4, whoosh(1.2), gain=0.45)
birds(15.5, 18.5, 1.2)

# 18-28 police: playful plucks and bass (120 bpm), a notification and a happy ending
bt = 0.5; t0 = 18.0
pb = [(C - 12, 0), (C - 12, 1), (E - 12, 1.5), (G - 12, 2), (A - 12, 3), (G - 12, 3.5)]
pmel = [(0, G + 12), (.5, A + 12), (1, G + 12), (1.5, E + 12), (2.5, C + 12), (3, D + 12), (3.5, E + 12)]
for bar in range(5):
    tb = t0 + bar * 4 * bt; tr = [0, 5, 7, 5, 0][bar]
    for m, q in pb: put("bass", tb + q * bt, sub(m + tr - 12, 0.4 * bt), gain=0.9)
    for q, m in pmel: put("lead", tb + q * bt, pluck(m + tr, 0.3, 1.2, 0.18), pan=(q % 1 - .25), gain=0.7)
    for q in range(4):
        put("drums", tb + q * bt, K, gain=0.35 if q % 2 == 0 else 0); put("drums", tb + (q + .5) * bt, hat(), gain=0.35)
        if q in (1, 3): put("drums", tb + q * bt, snare(), gain=0.35)
put("fx", 18.4, ding(88), gain=0.8); put("fx", 18.62, ding(93), gain=0.8)
for k, m in enumerate([72, 76, 79, 84, 88]): put("fx", 26.9 + k * 0.07, bell(m, 0.8), gain=0.5)
put("fx", 27.55, whoosh(0.6), gain=0.7)

# 28-47 the ride: a future-bass build at 160 bpm (one bar = 1.5 s) into the drop at 38 (one bar per montage cut)
bt = 60 / 160; BAR = 4 * bt; t0 = 29.0
put("fx", 28.55, clunk(), gain=1.0)
put("fx", 28.0, riser(1.2), gain=0.6)
fb = [(D, (62, 66, 69, 73)), (A - 12, (57, 61, 64, 68)), (B - 12, (59, 62, 66, 69)), (G - 12, (55, 59, 62, 66))]
hook = [(0, 74), (.75, 76), (1.5, 78), (2.5, 81), (3, 78)]
for bar in range(6):     # build 29-38
    tb = t0 + bar * BAR; root, ch = fb[bar % 4]; k = bar / 5
    put("music", tb, supersaw(ch, BAR * 0.95, a=0.02, r=0.1, voices=5, detune=0.18, bright=0.35 + 0.6 * k), gain=0.45 + 0.4 * k)
    put("bass", tb, sub(root - 24, BAR * 0.9), gain=0.8)
    for q in range(4): put("drums", tb + q * bt, K, gain=0.55 + 0.3 * k); S.kicks.append(tb + q * bt)
    for q in range(8): put("drums", tb + q * bt / 2, hat(), gain=0.3 + 0.2 * k)
    if bar >= 4:
        step = 0.25 if bar == 4 else 0.125
        for q in np.arange(0, 4, step): put("drums", tb + q * bt, snare(), gain=0.25 + 0.45 * q / 4)
    for q, m in hook: put("lead", tb + q * bt, pluck(m + (12 if bar >= 4 else 0), 0.3, 1.5, 0.2), pan=.15, gain=0.45 + 0.3 * k)
put("fx", 33.0, riser(5.0), gain=0.8)
engine_hum(29.4, 36.3, [(0, 0.2), (1.2, 0.8), (3, 1.0), (4.9, 0.5), (5.2, 0.9), (6.9, 0.2)])
put("fx", 29.9, ding(93, 0.6), gain=0.5); put("fx", 32.4, ding(93, 0.6), gain=0.5); put("fx", 32.55, ding(98, 0.6), gain=0.4)
screech(32.25, 0.9)
for k in range(5): put("fx", 37.25 + k * 0.08, coin(), pan=(k % 2) * .6 - .3, gain=0.9)
def drop(t_start, bars, energy=1.0):
    for bar in range(bars):
        tb = t_start + bar * BAR; root, ch = fb[bar % 4]
        put("drums", tb, K, gain=1.0); S.kicks.append(tb); put("drums", tb + 2.5 * bt, K, gain=0.8); S.kicks.append(tb + 2.5 * bt)
        put("drums", tb + 2 * bt, clap(), gain=0.9); put("drums", tb + 2 * bt, snare(), gain=0.5)
        for q in range(8): put("drums", tb + q * bt / 2, hat(), pan=.3 if q % 2 else -.3, gain=0.45 if q % 2 else 0.3)
        for q in (0, .75, 1.5, 2, 2.75, 3.5):     # the classic chopped future-bass chords
            put("music", tb + q * bt, supersaw(ch, bt * 0.6, a=0.005, r=0.08, voices=7, detune=0.22, bright=1.0), gain=0.95 * energy)
        put("bass", tb, sub(root - 24, BAR * 0.95), gain=1.0)
        for q, m in hook: put("lead", tb + q * bt, bell(m + 12, 0.5), pan=-.1, gain=0.55 * energy)
        if bar == 0: put("fx", tb, crash(), gain=1.0)
drop(38.0, 6)
for k, tcut in enumerate([39.5, 41.0, 42.5, 44.0, 45.5]): put("fx", tcut, whoosh(0.35), gain=0.35)
put("fx", 39.1, coin(), gain=0.8); put("fx", 40.9, ding(91), gain=0.5)
for k in range(10): put("fx", 41.0 + 0.04 * k ** 1.6, hat(), gain=0.25)        # wheel ticks
for k in range(4): put("fx", 42.3 + k * 0.07, coin(), gain=0.8)
for k, m in enumerate([79, 84, 88]): put("fx", 43.5 + k * 0.08, bell(m, 0.6), gain=0.5)  # tier up
put("fx", 44.75, coin(), gain=0.9); sparkle(44.7)
put("fx", 46.5, ding(91), gain=0.5)
put("fx", 46.9, downlifter(1.4), gain=0.6)

# 47-57 sunset: calm piano and pad, the sea; the first drops of rain
put("amb", 47.0, waves(10.5), gain=0.8)
bt = 0.75; t0 = 47.2
for bar, (root, ch) in enumerate([(G - 12, (55, 59, 62, 66)), (E - 12, (52, 55, 59, 62)), (C - 12, (48, 52, 55, 59)), (D - 12, (50, 54, 57, 62))]):
    tb = t0 + bar * 4 * bt; g = 1 - 0.35 * max(0, bar - 2)
    chord_pad(tb, ch, 4 * bt, 0.6 * g); put("music", tb, keys(ch, 3.6 * bt), gain=0.9 * g); put("bass", tb, sub(root - 12, 3.8 * bt), gain=0.5 * g)
    for q, d in ((0, 0), (1, 1), (2, 2), (3, 1)): put("lead", tb + q * bt, flute(ch[d] + 12, 0.7 * bt), gain=0.5 * g)
for k, m in enumerate([86, 91, 95]): put("fx", 49.4 + k * .09, bell(m, 0.5), gain=0.35)    # emoji pop
put("fx", 54.2, whoosh(1.0), gain=0.4)
# the rain: from a few drops at 52 to a downpour by the storm, then gone with the night shots
rn = int(LEN * SR); rcurve = env_curve([(0, 0), (51.8, 0), (55, .35), (57, .7), (58, 1.0), (67, 1.0), (68.2, 0), (LEN, 0)], rn)
rbed = rain(LEN) * rcurve[:, None] * 0.55; S.buses["amb"] += rbed

# 57-67 the storm at night: deep pads, a heartbeat, thunder with the lightning, a riser into the climax
t0 = 57.0
for k, ch in enumerate([(45, 52, 57, 60), (41, 48, 53, 57), (43, 50, 55, 59)]):
    chord_pad(t0 + k * 3.3, ch, 3.4, 0.55)
    put("bass", t0 + k * 3.3, sub(ch[0] - 12, 3.2), gain=0.6)
for k in range(9): put("drums", 57.5 + k * 1.05, K, gain=0.45)
put("amb", 58.45, thunder(True), gain=1.0)
put("amb", 62.6, thunder(False), gain=0.7)
for k, tw in enumerate([60.2, 61.9, 63.6, 65.3]): put("lead", tw, bell(84 - k * 2, 1.4), gain=0.35)   # each window
put("fx", 64.0, riser(3.0), gain=0.9)
for q in np.arange(0, 1, 0.0625): put("drums", 66.0 + q, snare(), gain=0.2 + 0.6 * q)

# 67-75 the climax: the big drop again, hard cut at the end
bt = 60 / 160; BAR = 4 * bt
drop(67.0, 5, 1.1)
for k in range(10): put("fx", 71.6 + k * 0.34, whoosh(0.2), gain=0.3)
cut = int(74.88 * SR)
for b in S.buses.values(): b[cut:int(75.3 * SR)] *= np.linspace(1, 0, int(75.3 * SR) - cut)[:, None] ** 4; b[int(75.3 * SR):int(75.4 * SR)] = 0

# 75-81 the end card: a warm sting and a ding for the logo
for b in S.buses.values(): b[int(75.4 * SR):] *= 0
chord_pad(75.4, (50, 57, 62, 66, 69), 5.0, 0.8)
put("music", 75.4, keys((62, 66, 69, 74), 4.5), gain=1.0)
put("bass", 75.4, sub(38, 4.5), gain=0.7)
put("fx", 75.4, crash(), gain=0.5)
for k, m in enumerate([86, 90, 93, 98]): put("fx", 77.6 + k * 0.06, bell(m, 1.2), gain=0.55)
put("fx", 78.4, coin(), gain=0.7)

# ---------------- mix ----------------
sc = sidechain(S)
mus = reverb(S.buses["music"] * sc, 0.28, 2.2) * 1.9
lead = reverb(delay(S.buses["lead"], 0.28, 0.3, 0.2), 0.22, 1.8) * 2.0
bass = S.buses["bass"] * sc * 0.6
drums = S.buses["drums"]; drums = drums + reverb(drums, 0.08, 0.8) * 0.3
fx = reverb(S.buses["fx"], 0.3, 2.2) * 0.9
amb = S.buses["amb"] * 0.9
mix = drums + bass + mus + lead + fx + amb
mix = hp(mix, 25)
mix = mix / np.percentile(np.abs(mix), 99.9) * 0.9
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix = mix / np.max(np.abs(mix)) * 0.92
fade = np.ones(len(mix)); fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR)); mix *= fade[:, None]
out = (mix * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print("ok", len(mix) / SR)
