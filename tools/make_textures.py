"""Draws the app's material textures with code, so no stock photos or licences are needed."""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

OUT = Path(sys.argv[1]); OUT.mkdir(exist_ok=True)
rng = np.random.default_rng(7)

def fbm(h, w, sigmas, weights):
    out = np.zeros((h, w))
    for s, k in zip(sigmas, weights):
        n = gaussian_filter(rng.standard_normal((h, w)), s, mode="wrap")
        out += k * n / n.std()
    return (out - out.mean()) / out.std()

def colour(t, stops):
    t = np.clip(t, 0, 1)
    xs = [s[0] for s in stops]
    return np.stack([np.interp(t, xs, [s[1][i] for s in stops]) for i in range(3)], -1)

def save(arr, name, q=72):
    Image.fromarray(np.clip(arr, 0, 255).astype("uint8")).save(OUT / name, quality=q, method=6)

# ---- Timber: long grain, gently wandering, with growth rings ----
def timber(h, w, stops, plank_h):
    out = np.zeros((h, w))
    rows = h // plank_h
    for r in range(rows):
        warp = gaussian_filter(rng.standard_normal((plank_h, w)), (14, 90), mode="wrap")
        warp = warp / warp.std() * 16
        y = np.arange(plank_h)[:, None] + warp
        phase = rng.uniform(0, 6)
        rings = 0.5 + 0.5 * np.sin(y * rng.uniform(0.32, 0.5) + phase + 2.5 * np.sin(y * 0.05 + phase))
        rings = rings ** 2.2
        fibre = gaussian_filter(rng.standard_normal((plank_h, w)), (0.55, 34), mode="wrap")
        fibre = fibre / fibre.std()
        fine = gaussian_filter(rng.standard_normal((plank_h, w)), (0.4, 8), mode="wrap")
        fine = fine / fine.std()
        p = 0.48 + rng.uniform(-0.05, 0.05) + 0.17 * rings + 0.13 * fibre + 0.06 * fine
        out[r * plank_h:(r + 1) * plank_h] = p
    img = colour(out, stops)
    # dark gap and a lit edge between planks
    for r in range(1, rows):
        y = r * plank_h
        img[y - 1:y + 1] *= 0.42
        img[y + 1:y + 2] *= 1.14
    return img

CHAR = [(0, (17, 14, 12)), (0.45, (38, 30, 24)), (0.75, (58, 45, 34)), (1, (86, 67, 49))]
HINOKI = [(0, (150, 116, 80)), (0.45, (190, 156, 116)), (0.75, (209, 179, 139)), (1, (228, 205, 170))]
save(timber(256, 1024, CHAR, 64), "timber-dark.webp")
save(timber(256, 1024, HINOKI, 64), "timber-light.webp")

# ---- Stone: soft mottling with fine pits ----
def stone(stops):
    t = 0.5 + 0.20 * fbm(640, 640, [70, 26, 9], [1, .6, .35]) + 0.075 * fbm(640, 640, [1.1, .6], [1, .6])
    # fine mineral veins
    v = np.abs(fbm(640, 640, [38, 15], [1, .5]))
    t -= 0.10 * np.exp(-(v / 0.035) ** 2)
    return colour(t, stops)

SLATE = [(0, (20, 23, 21)), (0.5, (30, 33, 31)), (1, (48, 52, 48))]
LIME = [(0, (205, 205, 196)), (0.5, (226, 226, 218)), (1, (242, 242, 236))]
save(stone(SLATE), "stone-dark.webp", 60)
save(stone(LIME), "stone-light.webp", 60)
