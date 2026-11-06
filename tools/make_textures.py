"""Draws the app's stone texture with code, so no stock photos or licences are needed."""
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
