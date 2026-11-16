"""PREVENT: Before the Change. Original score (numpy synthesis, D minor, 96 bpm), UI foley, ambience, voice, ducking -> out/mix.wav"""
import json, os, sys
import numpy as np, soundfile as sf, soxr
from scipy.ndimage import maximum_filter1d, uniform_filter1d
HERE = os.path.dirname(os.path.abspath(__file__)); LIB = os.environ.get('LIB') or os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(LIB, 'core', 'audio'))
import sfx
from sfx import SR, t_, lp, hp, bp, noise, norm, add
EV = json.load(open(os.path.join(HERE, 'events.json'))); DUR = EV['dur']; ev = EV['ev']
C = json.load(open(os.path.join(HERE, 'content.json'))); VD = json.load(open(os.path.join(HERE, 'voices', 'dur.json')))
n = int(DUR * SR); BAR = 2.5; BEAT = BAR / 4
mus = np.zeros((n, 2)); fol = np.zeros((n, 2)); amb = np.zeros((n, 2)); vox = np.zeros((n, 2)); hits = np.zeros((n, 2))
f_ = lambda m: 440 * 2 ** ((m - 69) / 12)
def adsr(d, a=.005, r=.08):
    x = np.ones(int(round(d * SR))); na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    x[:na] *= np.linspace(0, 1, na); x[-nr:] *= np.linspace(1, 0, nr)[:len(x[-nr:])]; return x
def saw(m, d, det=0.0):
    tt = t_(d); f = f_(m) * (1 + det); return sum(np.sin(2 * np.pi * f * k * tt) / k for k in range(1, 9)) * .5
def sq(m, d):
    tt = t_(d); f = f_(m); return sum(np.sin(2 * np.pi * f * k * tt) / k for k in (1, 3, 5, 7)) * .6
def sine(m, d, tau=None):
    x = np.sin(2 * np.pi * f_(m) * t_(d)); return x * np.exp(-t_(d) / tau) if tau else x
def pluck(m, d=.22, v=1.0): return lp(saw(m, d) * np.exp(-t_(d) / .07), 3200) * adsr(d, .003, .03) * v
def blip(m, d=.09, v=1.0): return sine(m, d, d / 3) * adsr(d, .003, .02) * v
def pad(ms, d, v=1.0):
    x = sum(saw(m, d, dt) for m in ms for dt in (-.004, 0, .004)); return lp(x, 1400) * adsr(d, .5, .8) * v / len(ms)
def bass(m, d, v=1.0):
    tt = t_(d); f = f_(m); return (np.sin(2 * np.pi * f * tt) + .4 * np.sin(4 * np.pi * f * tt) + .22 * np.sin(6 * np.pi * f * tt)) * adsr(d, .005, .05) * v
def hat(v=1.0): return hp(noise(.05), 7000) * np.exp(-t_(.05) / .012) * v
def clap(v=1.0): return bp(noise(.14), 900, 3500) * np.exp(-t_(.14) / .035) * v
def sweep(d, f0, f1, v=1.0):
    k = np.linspace(0, 1, int(round(d * SR))); x = noise(d); y = np.zeros_like(x)
    for i in range(8):   # band sliding from f0 to f1
        a, b_ = int(i * len(x) / 8), int((i + 1) * len(x) / 8); fc = f0 * (f1 / f0) ** ((i + .5) / 8); y[a:b_] = bp(x, fc * .7, fc * 1.4)[a:b_]
    return y * np.sin(np.pi * k) ** .7 * v
def glide(f0, f1, d, v=1.0):
    k = np.linspace(0, 1, int(round(d * SR))); ph = 2 * np.pi * np.cumsum(f0 * (f1 / f0) ** k) / SR; return np.sin(ph) * adsr(d, .005, .1) * v

# ---------- score ----------
CH = [[50, 53, 57, 64], [46, 53, 57, 62], [41, 53, 57, 60], [48, 52, 55, 62]]   # Dm9, Bbmaj7, Fmaj9(no3 low), C6/9
ROOT = [38, 34, 29, 36]
SIL = [(63.1, 64.98), (108.0, 109.97)]
def insil(t): return any(a - .02 <= t < b for a, b in SIL)
arp = np.zeros((n, 2))
for bar in range(53):
    t0 = bar * BAR; ch = CH[bar % 4]; rt = ROOT[bar % 4]
    sec = ('fault' if bar < 7 else 'scatter' if bar < 14 else 'graph' if bar < 22 else 'warn' if bar < 26 else 'after' if bar < 32 else
           'out' if bar < 39 else 'loop' if bar < 46 else 'pilot' if bar < 50 else 'end')
    if sec == 'fault':
        if bar >= 1: add(mus, pad([38, 39, 45], BAR + .6, .16), t0)                 # D + Eb: uneasy
        for q in range(4):
            if bar >= 1 and not (bar % 2 and q == 3): add(mus, sq(38, .12) * adsr(.12) * .22, t0 + q * BEAT)
        if bar >= 1: add(mus, bass(26, .9, .5), t0)
    elif sec == 'scatter':
        add(mus, pad(ch, BAR + .8, .3), t0)
        for q in (0, 2): add(arp, pluck(ch[(bar + q) % 4] + 12, .3, .3), t0 + q * BEAT, 1, (-1) ** q * .3)
        if bar % 2 == 0: add(mus, bass(rt, 1.6, .35), t0)
    elif sec in ('graph', 'out', 'loop'):
        add(mus, pad(ch, BAR + .6, .26), t0)
        dense = (sec == 'graph' and bar >= 17) or sec == 'out' or (sec == 'loop' and bar >= 44)
        step = .25 if dense else .5
        for k in range(int(4 / step)):
            t = t0 + k * step * BEAT
            if insil(t): continue
            add(arp, pluck(ch[(k * 3 + bar) % 4] + (24 if sec == 'out' and k % 4 == 2 else 12), .2, .26), t, 1, .4 * np.sin(k * 1.3))
        if bar >= 16:
            for k in range(8):
                t = t0 + k * BEAT / 2
                if insil(t): continue
                if sec != 'graph' or bar >= 17: add(mus, bass(rt, BEAT / 2 * .9, .42), t)
                add(mus, hat(.1 if k % 2 else .06), t, 1, .2)
        if sec == 'out' or (sec == 'loop' and bar >= 44):
            for q in (1, 3): add(mus, clap(.16), t0 + q * BEAT)
    elif sec == 'warn':
        if bar < 25:
            add(mus, pad(ch, BAR + .3, .24 * (1 if bar < 24 else .6)), t0)
            for q in range(4 if bar < 24 else 2): add(arp, pluck(ch[q % 4] + 12, .3, .22), t0 + q * BEAT * (1 if bar < 24 else 2))
    elif sec == 'after':
        add(mus, pad(ch, BAR + .6, .3), t0); add(mus, bass(rt, 2.2, .45), t0)
        for q in range(4): add(arp, pluck(ch[(q + bar) % 4] + 12, .3, .24), t0 + q * BEAT, 1, (-1) ** q * .3)
        if bar >= 28:
            for k in range(8): add(mus, hat(.07), t0 + k * BEAT / 2, 1, .2)
    elif sec == 'pilot':
        add(mus, pad(ch, BAR + .8, .3), t0); add(mus, bass(rt, 2.3, .42), t0)
        for q in range(2 if bar < 48 else 1): add(arp, pluck(ch[(q + bar) % 4] + 12, .5, .26), t0 + q * 2 * BEAT)
    elif sec == 'end' and bar == 50:
        add(mus, pad([38, 45, 50, 57, 64], 7.4, .34), t0); add(mus, bass(26, 5.5, .4), t0)
# ping-pong delay on the arp
dl = int(BEAT * .75 * SR); wet = np.zeros_like(arp)
for r in range(1, 5):
    g = .42 ** r; src = arp[:, (r + 1) % 2]
    if r * dl < n: wet[r * dl:, r % 2] += src[:n - r * dl] * g
mus += arp + wet
# the drop at the lock
lk = next(e['t'] for e in ev if e['type'] == 'lock' and e.get('big'))
add(hits, glide(110, 36, 1.3, .9) * np.exp(-t_(1.3) / .6), lk); add(mus, pad([38, 50, 57, 62, 65, 69], 4.5, .5), lk)

# ---------- ambience ----------
tt = np.arange(n) / SR
hum = (np.sin(2 * np.pi * 40 * tt) * .5 + np.sin(2 * np.pi * 80 * tt) * .3 + np.sin(2 * np.pi * 120 * tt) * .14) * (1 + .15 * np.sin(2 * np.pi * .13 * tt))
room = lp(np.random.default_rng(3).standard_normal(n), 500) * .25
a_env = np.clip(tt / 1.5, 0, 1) * np.clip((DUR - tt) / 4, 0, 1)
amb[:, 0] = (hum + room) * a_env * .05; amb[:, 1] = (hum + np.roll(room, 4001)) * a_env * .05

# ---------- foley, on the picture's own event times ----------
KEY = [62, 65, 69, 72, 74, 77, 81]
for e in ev:
    t, ty = e['t'], e['type']
    if insil(t) and ty not in ('lock', 'rejoin'): continue
    if ty == 'scan':
        v = .14 if e.get('small') else .24; add(fol, sweep(e['d'], 300, 2600, v), t); add(fol, sine(81, e['d']) * adsr(e['d'], .2, .3) * .02, t)
    elif ty == 'erase': add(fol, sweep(e['d'], 3200, 250, .26), t)
    elif ty == 'lock':
        tgt = hits
        add(tgt, sfx.thump(.9 if e.get('big') else .6, 62), t); add(tgt, sfx.clack(1.0, .35), t + .012)
        add(tgt, blip(86, .09, .22), t + .05); add(tgt, blip(81, .12, .22), t + .15)
    elif ty == 'fault':
        d = 1.2; x = sq(51, d) * (np.sin(2 * np.pi * 23 * t_(d)) > 0) * adsr(d, .01, .5) * .16; add(fol, lp(x, 2400), t)
    elif ty == 'run': add(fol, sweep(.6, 500, 3000, .18), t, 1, .3)
    elif ty == 'break':
        for k, m in enumerate((75, 70, 63)): add(fol, blip(m, .14, .26), t + k * .07, 1, -.3 + .3 * e['i'])
        add(fol, bp(noise(.25), 1500, 5000) * np.exp(-t_(.25) / .05) * .2, t)
    elif ty == 'tick': add(fol, blip(KEY[e['i'] % 7] + 12, .05, .1), t, 1, -.6 + e['i'] * .09)
    elif ty == 'same': add(fol, blip(86, .3, .14), t); add(fol, blip(93, .3, .1), t + .08)
    elif ty == 'fall':
        rng = np.random.default_rng(5)
        for k in range(60): add(fol, blip(74 + int(rng.integers(0, 12)), .04, .05), t + rng.random() * e['d'], 1, rng.random() * 1.6 - .8)
    elif ty == 'blip': add(fol, blip(KEY[e['i'] + 2] + 12, .1, .16), t)
    elif ty == 'edge': add(fol, blip(KEY[(e['i'] * 2) % 7] + 12 + 12 * (e['i'] // 27), .06, .07), t, 1, np.sin(e['i']) * .7)
    elif ty == 'roll':
        for k in range(int(e['d'] * 24)): add(fol, blip(96 if k % 2 else 93, .018, .06), t + k / 24)
    elif ty == 'confirm':
        v = .3 if e.get('big') else .22
        for k, m in enumerate((86, 93, 100)): add(hits, sine(m, .9, .28) * adsr(.9, .004, .2) * v, t + k * .012)
    elif ty == 'leader': add(fol, glide(600, 1800, .18, .12), t)
    elif ty == 'ok': add(fol, blip(86 + 2 * e['i'], .16, .16), t, 1, -.3 + .3 * e['i'])
    elif ty == 'beam': add(fol, sweep(.55, 400, 4200, .22), t, 1, (-.5, .5, .2)[e['i']])
    elif ty == 'dock': add(fol, blip(74 + 3 * e['i'], .1, .14), t)
    elif ty == 'join': add(fol, sweep(1.1, 250, 2400, .2), t, 1, -.5 + e['i']); add(fol, sfx.thump(.4, 80), t + 1.1)
    elif ty == 'brk':
        add(hits, glide(520, 70, .5, .4), t); add(fol, bp(noise(.13), 800, 6000) * (np.random.default_rng(2).random(int(.13 * SR)) > .5) * .3, t)
    elif ty == 'rejoin':
        add(hits, sfx.thump(.6, 70), t); add(hits, blip(81, .1, .24), t + .03); add(hits, blip(86, .18, .24), t + .12)
    elif ty == 'gauge': add(fol, glide(220, 660, e['d'], .05), t)
    elif ty == 'powerdown': add(fol, glide(300, 40, e['d'], .22), t); add(fol, sweep(e['d'], 2500, 200, .16), t)

# ---------- voice ----------
for v in C['voice']:
    x, sr = sf.read(os.path.join(HERE, 'voices', v['id'] + '.wav'))
    if x.ndim > 1: x = x.mean(1)
    x = soxr.resample(x, sr, SR); x = sfx.compress(norm(x, .9), thr=.2, ratio=3.0); add(vox, norm(x, .8), v['at'])

# ---------- mix: duck music and foley under the voice with a held envelope; silences are true silences ----------
ve = (np.abs(vox).max(1) > .01).astype(float); ve = maximum_filter1d(ve, int(.5 * SR)); ve = uniform_filter1d(ve, int(.12 * SR))
gate = np.ones(n)
for a, b_ in SIL: gate[int(a * SR):int(b_ * SR)] = 0
gate = np.clip(uniform_filter1d(gate, int(.03 * SR)) * 1.0, 0, 1); gate[gate < .999] *= gate[gate < .999]
mus = lp(mus.T, 9000).T * (1 - .8 * ve)[:, None] * .75 * gate[:, None]
fol = fol * (1 - .75 * ve)[:, None] * gate[:, None]
amb = amb * gate[:, None]
fade = np.clip((DUR - tt) / 3.0, 0, 1)[:, None]
mix = (mus + fol * .9 + hits * .9 + amb) * fade + vox * 1.0
for c in (0, 1): mix[:, c] = sfx.limit(mix[:, c], .92)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR)
lo = np.sqrt((lp(mix[:, 0], 120) ** 2).mean()); al = np.sqrt((mix[:, 0] ** 2).mean())
print(f'mix.wav {DUR:.1f}s  peak {np.abs(mix).max():.2f}  low-band {20 * np.log10(lo / al):.1f} dB rel.')
