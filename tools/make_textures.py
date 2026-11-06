"""Draws the app's material textures with code, so no stock photos or licences are needed."""
import math, random, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter, map_coordinates

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

# ---- Bamboo: arching stems of slender leaves, drawn in layers ----
S = 2  # drawn large, then scaled down for clean edges
W, H = 900, 1100

def leaf_mask(length, width, curve):
    pad = 8
    w, h = int(length + pad * 2), int(width * 2 + abs(curve) * 2 + pad * 2)
    n = 40
    top, bottom, mid = [], [], []
    cy = h / 2
    for i in range(n + 1):
        t = i / n
        x = pad + t * length
        c = curve * math.sin(math.pi * t)
        half = width * (math.sin(math.pi * t ** 0.62) ** 0.9)
        mid.append((x, cy + c)); top.append((x, cy + c - half)); bottom.append((x, cy + c + half))
    return (w, h, top, bottom, mid, cy)

def draw_leaf(layer, x, y, angle, length, width, base, seed):
    r = random.Random(seed)
    curve = r.uniform(-.09, .09) * length
    w, h, top, bottom, mid, cy = leaf_mask(length, width, curve)
    # Colour across the leaf: lit on one side of the midrib, dark on the other
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon(top + bottom[::-1], fill=255)
    yy, xx = np.mgrid[0:h, 0:w]
    midy = np.interp(xx[0], [p[0] for p in mid], [p[1] for p in mid])[None, :]
    side = (yy - midy) / (width + 1e-6)
    shade = 1 + 0.30 * np.tanh(-side * 2.4) * r.choice([1, 1, -1])
    along = np.clip((xx - 8) / length, 0, 1)
    shade *= 0.80 + 0.40 * np.sin(np.pi * along) ** .7
    # Long parallel veins, as on bamboo
    shade *= 1 + 0.07 * np.sin(side * 24)
    rib = np.exp(-((yy - midy) / 1.3) ** 2)
    rgb = np.array(base, float)[None, None] * shade[..., None]
    rgb = rgb + rib[..., None] * np.array([26, 34, 22])
    arr = np.dstack([np.clip(rgb, 0, 255), np.array(mask, float)]).astype("uint8")
    leaf = Image.fromarray(arr, "RGBA").rotate(-angle, expand=True, resample=Image.BICUBIC)
    # the point where the stem meets the leaf stays at (x, y)
    a = math.radians(angle)
    ox, oy = w / 2 - 8 - (w / 2 - 8) * 0, 0
    cx, cy2 = leaf.width / 2, leaf.height / 2
    dx = (w / 2 - 8) * math.cos(a); dy = (w / 2 - 8) * math.sin(a)
    layer.alpha_composite(leaf, (max(0, int(x + dx - cx)), max(0, int(y + dy - cy2))))

def branch(layer, start, end, bend, base, stem, leaves, seed, scale=1.0):
    r = random.Random(seed)
    d = ImageDraw.Draw(layer)
    pts = []
    for i in range(61):
        t = i / 60
        mx = (start[0] + end[0]) / 2 + bend[0]; my = (start[1] + end[1]) / 2 + bend[1]
        x = (1 - t) ** 2 * start[0] + 2 * t * (1 - t) * mx + t ** 2 * end[0]
        y = (1 - t) ** 2 * start[1] + 2 * t * (1 - t) * my + t ** 2 * end[1]
        pts.append((x, y))
    for i in range(60):
        d.line([pts[i], pts[i + 1]], fill=stem, width=max(1, int((5.5 - 3.5 * i / 60) * S * scale)))
    # sprays of leaves, drooping as gravity would have them
    for s in range(leaves):
        t = 0.2 + 0.8 * (s + r.uniform(-.2, .2)) / max(leaves - 1, 1)
        px, py = pts[min(60, int(t * 60))]
        for k in range(r.randint(3, 4)):
            ang = r.uniform(62, 128) + (k - 1.5) * 21 + (10 if px < W * S * .5 else -6)
            ln = r.uniform(165, 245) * S * scale
            wd = ln * r.uniform(.082, .105)
            tint = r.uniform(.8, 1.12)
            draw_leaf(layer, px, py, ang, ln, wd, tuple(c * tint for c in base), r.random())

def plant(base, stem, name, shadow_name, shadow_col):
    size = (W * S, H * S)
    back = Image.new("RGBA", size, (0, 0, 0, 0))
    branch(back, (W*S*.98, -20), (W*S*.26, H*S*.34), (140*S, 150*S), tuple(c*.62 for c in base), tuple(int(c*.7) for c in stem)+(255,), 6, 11, .82)
    front = Image.new("RGBA", size, (0, 0, 0, 0))
    branch(front, (W*S*1.02, 50), (W*S*.46, H*S*.56), (190*S, 40*S), base, stem+(255,), 7, 23, 1.0)
    # the back stem sits slightly out of focus, for depth
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    img.alpha_composite(back.filter(ImageFilter.GaussianBlur(2.4 * S)))
    # the front leaves cast a shadow on what is behind them
    a = front.getchannel("A").filter(ImageFilter.GaussianBlur(8 * S))
    sh = Image.new("RGBA", size, (0, 0, 0, 0)); sh.putalpha(a.point(lambda v: int(v * .42)))
    img.alpha_composite(sh, (-8 * S, 14 * S)) if False else img.alpha_composite(sh)
    img.alpha_composite(front)
    img = img.resize((W, H), Image.LANCZOS)
    img.save(OUT / name, quality=82, method=6)
    # The same plant as a soft shadow on the wall
    al = Image.alpha_composite(back, front).getchannel("A").resize((W // 2, H // 2), Image.BILINEAR).filter(ImageFilter.GaussianBlur(9))
    shadow = Image.new("RGBA", al.size, shadow_col + (0,)); shadow.putalpha(al)
    shadow.save(OUT / shadow_name, quality=55, method=6)

plant((34, 62, 46), (40, 56, 38), "bamboo-dark.webp", "bamboo-shadow-dark.webp", (8, 11, 9))
plant((44, 84, 58), (72, 90, 58), "bamboo-light.webp", "bamboo-shadow-light.webp", (64, 74, 62))
