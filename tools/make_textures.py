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

# ---- Japanese maple: full star-shaped leaves on loose, sweeping branches ----
S = 2  # drawn large, then scaled down for clean edges
W, H = 900, 1100


def bezier(a, c, b, t):
    return ((1 - t) ** 2 * a[0] + 2 * t * (1 - t) * c[0] + t ** 2 * b[0],
            (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * c[1] + t ** 2 * b[1])


def polar(angle, radius):
    return (radius * math.cos(angle), radius * math.sin(angle))


def maple_outline(r, radius):
    """Points around one leaf, centred on its stalk, pointing along +x.
    Seven fingers joined for half their length, each with a long tip."""
    fingers = [(-132, .50), (-90, .78), (-46, .95), (0, 1.0), (46, .95), (90, .78), (132, .50)]
    tips, pts = [], []
    gap = math.radians(44)
    for i, (deg, length) in enumerate(fingers):
        a = math.radians(deg + r.uniform(-3, 3))
        tip = polar(a, radius * length * r.uniform(.95, 1.05))
        tips.append(tip)
        left = polar(a - gap / 2, radius * .46 * (.62 + length * .38))
        right = polar(a + gap / 2, radius * .46 * (.62 + length * .38))
        bulge_l = polar(a - gap * .36, radius * length * .74)
        bulge_r = polar(a + gap * .36, radius * length * .74)
        for side, (start, control, end) in enumerate([(left, bulge_l, tip), (tip, bulge_r, right)]):
            for k in range(1, 15):
                t = k / 14
                x, y = bezier(start, control, end, t)
                # fine teeth along the edge
                d = radius * .012 * (1 if k % 2 else -1)
                pts.append((x * (1 + d / radius * 3), y * (1 + d / radius * 3)))
    return pts, tips


def draw_maple_leaf(layer, x, y, angle, radius, base, seed):
    r = random.Random(seed)
    size = int(radius * 2.5)
    c = size / 2
    pts, tips = maple_outline(r, radius)
    tilt = r.uniform(.74, 1)  # seen a little from the side
    place = lambda p: (c + p[0] * tilt, c + p[1])
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).polygon([place(p) for p in pts], fill=255)
    yy, xx = np.mgrid[0:size, 0:size]
    dist = np.hypot((xx - c) / tilt, yy - c) / radius
    shade = (.86 + .24 * np.clip(dist, 0, 1)) * r.uniform(.86, 1.1)
    rgb = np.array(base, float)[None, None] * shade[..., None]
    arr = np.dstack([np.clip(rgb, 0, 255), np.array(mask, float)]).astype("uint8")
    leaf = Image.fromarray(arr, "RGBA")
    d = ImageDraw.Draw(leaf)
    vein = tuple(min(255, int(v * 1.28)) for v in base) + (90,)
    for tip in tips:
        d.line([place((0, 0)), place((tip[0] * .92, tip[1] * .92))], fill=vein, width=max(1, int(radius * .014)))
    layer.alpha_composite(leaf.rotate(-angle, resample=Image.BICUBIC), (max(0, int(x - c)), max(0, int(y - c))))


def branch(layer, start, end, bend, width, stem):
    """Draws a wandering branch and returns the points along it."""
    d = ImageDraw.Draw(layer)
    control = ((start[0] + end[0]) / 2 + bend[0], (start[1] + end[1]) / 2 + bend[1])
    pts = [bezier(start, control, end, i / 50) for i in range(51)]
    for i in range(50):
        d.line([pts[i], pts[i + 1]], fill=stem, width=max(1, int(width * (1 - .72 * i / 50) * S)))
    return pts


def add_leaf(layer, px, py, r, base, stem, scale):
    angle = r.uniform(35, 150)  # hanging, turned this way and that
    radius = r.uniform(92, 128) * S * scale
    stalk = radius * r.uniform(.5, .78)
    lx = px + stalk * math.cos(math.radians(angle))
    ly = py + stalk * math.sin(math.radians(angle))
    ImageDraw.Draw(layer).line([(px, py), (lx, ly)], fill=stem, width=max(1, S))
    draw_maple_leaf(layer, lx + radius * .15 * math.cos(math.radians(angle)), ly, angle, radius, base, r.random())


def tree_limb(layer, start, end, bend, base, stem, seed, scale):
    r = random.Random(seed)
    main = branch(layer, start, end, bend, 6.5 * scale, stem)
    for t in (.3, .46, .6, .74, .88):
        px, py = main[int(t * 50)]
        tx = px + r.uniform(-210, -60) * S * scale
        ty = py + r.uniform(90, 210) * S * scale
        twig = branch(layer, (px, py), (tx, ty), (r.uniform(-30, 30) * S, r.uniform(-60, -20) * S), 3 * scale, stem)
        for q in (.55, 1.0):
            x, y = twig[int(q * 50)]
            add_leaf(layer, x, y, r, base, stem, scale)
    x, y = main[-1]
    add_leaf(layer, x, y, r, base, stem, scale)


def maple(base, stem, name, shadow_name, shadow_col):
    size = (W * S, H * S)
    far = Image.new("RGBA", size, (0, 0, 0, 0))
    near = Image.new("RGBA", size, (0, 0, 0, 0))
    stem_a = stem + (255,)
    faint = tuple(int(c * .8) for c in base)
    tree_limb(far, (W*S*1.03, H*S*.20), (W*S*.46, H*S*.34), (W*S*.03, -H*S*.14), faint, stem_a, 3, .8)
    tree_limb(near, (W*S*1.04, -30), (W*S*.2, H*S*.17), (W*S*.05, -H*S*.05), base, stem_a, 9, 1.0)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    img.alpha_composite(far.filter(ImageFilter.GaussianBlur(3.5 * S)))
    img.alpha_composite(near.filter(ImageFilter.GaussianBlur(.8 * S)))
    img.resize((720, 880), Image.LANCZOS).save(OUT / name, quality=78, method=6)
    # The same branch as a soft shadow on the wall
    al = Image.alpha_composite(far, near).getchannel("A").resize((W // 2, H // 2), Image.BILINEAR).filter(ImageFilter.GaussianBlur(11))
    shadow = Image.new("RGBA", al.size, shadow_col + (0,))
    shadow.putalpha(al)
    shadow.save(OUT / shadow_name, quality=55, method=6)


maple((38, 64, 46), (34, 34, 28), "maple-dark.webp", "maple-shadow-dark.webp", (8, 11, 9))
maple((64, 96, 72), (92, 88, 72), "maple-light.webp", "maple-shadow-light.webp", (64, 74, 62))
