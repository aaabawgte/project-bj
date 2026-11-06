#!/usr/bin/env python3
"""Original sound design for the Project BJ film, synthesized from scratch with numpy.

No samples or third-party audio are used, so the soundtrack is fully original and free of
licensing issues. Every cue (whooshes, UI clicks, typing, final chime) is synced to the same
frame timeline the video uses: src/timeline.json.

Output: public/audio/soundtrack.wav (44.1 kHz, 16-bit stereo)
"""
import json
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
T = json.loads((ROOT / "src" / "timeline.json").read_text())
SR = 44100
FPS = T["fps"]
DUR = T["duration"] / FPS + 0.0
N = int(DUR * SR)
rng = np.random.default_rng(7)


def sec(frame):
    return frame / FPS


def note(name):
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + (octave - 4) * 12) / 12)


def env_adsr(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na) ** 2
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e


def lowpass(x, cutoff):
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    h = 1 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(X * (h[:, None] if x.ndim == 2 else h), n=x.shape[0], axis=0)


def reverb(x, seconds=2.4, mix=0.28):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.stack([rng.standard_normal(n), rng.standard_normal(n)], 1) * np.exp(-t * 6.5 / seconds)[:, None]
    ir = lowpass(ir, 5200)
    ir /= np.sqrt((ir ** 2).sum(0))
    L = x.shape[0] + n
    size = 1 << (L - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(x, size, axis=0) * np.fft.rfft(ir, size, axis=0), size, axis=0)[: x.shape[0]]
    return x * (1 - mix) + wet * mix * 1.6


out = np.zeros((N, 2))


def add(sig, start_s, gain=1.0, pan=0.0):
    i = int(start_s * SR)
    if i >= N:
        return
    if sig.ndim == 1:
        sig = np.stack([sig * np.cos((pan + 1) * np.pi / 4), sig * np.sin((pan + 1) * np.pi / 4)], 1) * np.sqrt(2)
    j = min(N, i + sig.shape[0])
    out[i:j] += sig[: j - i] * gain


# --- Pad: warm, slowly evolving chords that change with the story beats -------------------
chords = [
    (0, ["D3", "A3", "C#4", "E4", "F#4"]),
    (262, ["B2", "F#3", "A3", "D4", "E4"]),
    (556, ["G2", "D3", "F#3", "A3", "B3"]),
    (750, ["A2", "E3", "A3", "C#4", "E4"]),
    (858, ["D3", "A3", "E4", "F#4", "A4"]),
    (952, ["D2", "A2", "F#3", "E4", "A4"]),
]
pad = np.zeros(N)
t_all = np.arange(N) / SR
for idx, (f0, notes) in enumerate(chords):
    start = sec(f0) - (0.6 if idx else 0)
    end = sec(chords[idx + 1][0]) + 0.9 if idx + 1 < len(chords) else DUR
    i0, i1 = max(0, int(start * SR)), min(N, int(end * SR))
    t = t_all[i0:i1]
    seg = np.zeros(i1 - i0)
    for k, nm in enumerate(notes):
        f = note(nm)
        for det in (-0.12, 0.0, 0.13):
            ff = f * 2 ** (det / 12)
            seg += np.sin(2 * np.pi * ff * t + k) * 0.6 + 0.18 * np.sin(4 * np.pi * ff * t + k * 2)
    seg *= 1 + 0.12 * np.sin(2 * np.pi * 0.23 * t + idx)
    seg *= env_adsr(len(seg), 1.0 if idx else 2.4, 0.9 if idx + 1 < len(chords) else 2.5)
    pad[i0:i1] += seg
pad = lowpass(pad, 1900) * 0.016
add(np.stack([pad, np.roll(pad, 600)], 1), 0)

# --- Gentle pulse + plucked arpeggio during the product demo (100 BPM) -------------------
beat = 60 / 100
demo_start, demo_end = sec(150), sec(856)
b = demo_start
k = 0
while b < demo_end:
    # soft sine kick on beats
    n = int(0.35 * SR)
    tt = np.arange(n) / SR
    kick = np.sin(2 * np.pi * (48 + 70 * np.exp(-tt * 28)) * tt) * np.exp(-tt * 9)
    fade_in = min(1, (b - demo_start) / 3)
    add(kick, b, 0.16 * fade_in)
    # plucks on eighths, following the current chord
    for half in (0, 0.5):
        tb = b + half * beat
        f_now = tb * FPS
        cur = [c for c in chords if c[0] <= f_now][-1][1]
        nm = cur[(k * 2 + int(half * 2) * 3) % len(cur)]
        f = note(nm) * 2
        n = int(0.5 * SR)
        tt = np.arange(n) / SR
        pl = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 7.5) * env_adsr(n, 0.004, 0.05)
        add(pl, tb, 0.035 * fade_in, pan=-0.35 if (k + int(half * 2)) % 2 else 0.35)
    b += beat
    k += 1

# --- Transitions: airy filtered-noise whooshes ------------------------------------------
for f in T["audio"]["whoosh"]:
    n = int(0.9 * SR)
    tt = np.arange(n) / SR
    noise = rng.standard_normal((n, 2))
    sweep = lowpass(noise, 2600) - lowpass(noise, 300)
    shape = np.sin(np.pi * np.clip(tt / 0.9, 0, 1)) ** 3
    add(sweep * shape[:, None], sec(f) - 0.45, 0.05)

# --- UI: clicks and typing --------------------------------------------------------------
def click(freq, length, noise_amt):
    n = int(length * SR)
    tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * tt) * np.exp(-tt / (length / 5))
    s += rng.standard_normal(n) * noise_amt * np.exp(-tt / 0.002)
    return s


for f in T["audio"]["click"]:
    add(click(2100, 0.05, 0.4), sec(f), 0.11)
    add(click(950, 0.07, 0.0), sec(f), 0.05)
for f in T["audio"]["type"]:
    add(click(3200, 0.025, 0.6), sec(f), 0.05, pan=0.15)

# --- Hero swell + final chime -----------------------------------------------------------
n = int(2.2 * SR)
tt = np.arange(n) / SR
swell = lowpass(rng.standard_normal(n), 900) * (tt / 2.2) ** 2 * np.exp(-np.clip(tt - 2.0, 0, None) * 30)
add(swell, sec(858) - 2.0, 0.05)

chime_t = sec(T["audio"]["chime"])
for base, g in ((note("D5"), 0.06), (note("A5"), 0.03), (note("F#6"), 0.012)):
    n = int(4.5 * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, dec in ((1, 1, 1.6), (2.0, 0.35, 2.4), (3.01, 0.18, 3.5), (4.2, 0.08, 5)):
        s += amp * np.sin(2 * np.pi * base * ratio * tt) * np.exp(-tt * dec)
    add(s * env_adsr(n, 0.003, 0.4), chime_t, g)

# --- Master -----------------------------------------------------------------------------
out = reverb(out)
fade = np.ones(N)
fi, fo = int(0.25 * SR), int(1.6 * SR)
fade[:fi] = np.linspace(0, 1, fi)
fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
out *= fade[:, None]
out /= np.max(np.abs(out)) / 0.89  # ≈ -1 dBFS peak
pcm = (np.clip(out, -1, 1) * 32767).astype("<i2")

dest = ROOT / "public" / "audio" / "soundtrack.wav"
dest.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(dest), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"wrote {dest} ({DUR:.2f}s)")
