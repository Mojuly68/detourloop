"""DetourLoop icon set: a road that leaves the straight line, loops once, and carries on.

Draws everything with Pillow at 4x and downsamples, so there are no external tools.
Run from the repo root:  python tools/make_icons.py
Writes the Expo assets in apps/mobile/assets and the Next.js icons in apps/web/src/app.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
MOBILE = ROOT / "apps/mobile/assets"
WEB = ROOT / "apps/web/src/app"

NAVY = (24, 60, 80)          # color.ocean  #183C50
NAVY_DEEP = (14, 38, 52)
SAND = (215, 197, 167)       # color.sand   #D7C5A7
CREAM = (248, 247, 243)      # color.white  #F8F7F3
SS = 4                        # supersampling factor


def loop_path(n=900, run=1.45, back=1.3, lift=1.45, tilt=24):
    """A road that runs along, turns back on itself in one loop, and carries on.
    Symmetric about the middle (x odd, y even), so the loop sits on the line between the ends;
    then tilted to climb bottom-left -> top-right. Returned in a unit box (0..1, screen coords)."""
    pts = []
    for i in range(n + 1):
        t = -1 + 2 * i / n
        x = run * t - back * math.sin(math.pi * t)
        y = lift * (1 + math.cos(math.pi * t)) / 2
        pts.append((x, y))
    a = math.radians(tilt)
    pts = [(x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)) for x, y in pts]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    s = 1 / max(w, h)
    ox, oy = (1 - w * s) / 2 - min(xs) * s, (1 - h * s) / 2 - min(ys) * s
    return [(x * s + ox, 1 - (y * s + oy)) for x, y in pts]  # flip y: screen coords


def draw_mark(img, box, line=SAND, start=CREAM, end=CREAM, stroke=0.085, mono=None):
    """Draw the looped route into `box` (x0, y0, size) of an RGBA image (already supersampled)."""
    d = ImageDraw.Draw(img)
    x0, y0, size = box
    pts = [(x0 + px * size, y0 + py * size) for px, py in loop_path()]
    r = stroke * size / 2
    col = mono or line
    for x, y in pts:  # round-capped stroke: discs along the path
        d.ellipse((x - r, y - r, x + r, y + r), fill=col)
    # start: small ring, end: solid dot (origin -> destination)
    sx, sy = pts[0]
    ex, ey = pts[-1]
    R = r * 1.9
    d.ellipse((sx - R, sy - R, sx + R, sy + R), fill=mono or start)
    ri = R * 0.48
    d.ellipse((sx - ri, sy - ri, sx + ri, sy + ri), fill=(0, 0, 0, 0) if mono else NAVY)
    d.ellipse((ex - R, ey - R, ex + R, ey + R), fill=mono or end)


def canvas(px, bg=None):
    big = px * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    if bg == "gradient":
        g = ImageDraw.Draw(img)
        for yy in range(big):  # soft vertical light: lighter top, deeper bottom
            f = yy / big
            c = tuple(int(NAVY[i] * (1 - f) + NAVY_DEEP[i] * f) for i in range(3))
            g.line((0, yy, big, yy), fill=c + (255,))
    elif bg:
        img.paste(bg + (255,), (0, 0, big, big))
    return img


def done(img, px, path, mode="RGBA"):
    out = img.resize((px, px), Image.LANCZOS)
    if mode == "RGB":
        out = out.convert("RGB")
    path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path)
    print("wrote", path.relative_to(ROOT), f"{px}x{px}")
    return out


def mark_in(px, frac, **kw):
    """Canvas of px with the mark filling `frac` of it, centred."""
    big = px * SS
    size = big * frac
    return (big - size) / 2, (big - size) / 2, size


def main():
    # iOS / store icon: full-bleed, no transparency (Apple rejects alpha)
    img = canvas(1024, "gradient")
    draw_mark(img, mark_in(1024, 0.66))
    done(img, 1024, MOBILE / "icon.png", "RGB")

    # Android adaptive: foreground inside the 66% safe zone, plain background, monochrome for themed icons
    img = canvas(1024)
    draw_mark(img, mark_in(1024, 0.44))
    done(img, 1024, MOBILE / "android-icon-foreground.png")
    done(canvas(1024, "gradient"), 1024, MOBILE / "android-icon-background.png", "RGB")
    img = canvas(1024)
    draw_mark(img, mark_in(1024, 0.44), mono=(255, 255, 255, 255))
    done(img, 1024, MOBILE / "android-icon-monochrome.png")

    # Splash mark (transparent) for a future expo-splash-screen config
    img = canvas(512)
    draw_mark(img, mark_in(512, 0.8), start=NAVY, end=NAVY, line=NAVY)
    done(img, 512, MOBILE / "splash-icon.png")

    # Favicons: rounded tile so the mark reads on light and dark tabs; thicker stroke at small sizes
    def tile(px, frac=0.68, stroke=0.11):
        im = canvas(px)
        big = px * SS
        m = Image.new("L", (big, big), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, big - 1, big - 1), radius=big * 0.22, fill=255)
        bg = canvas(px, "gradient")
        im.paste(bg, (0, 0), m)
        draw_mark(im, mark_in(px, frac), stroke=stroke)
        return im

    done(tile(48), 48, MOBILE / "favicon.png")
    done(tile(512, stroke=0.095), 512, WEB / "icon.png")
    apple = canvas(180, "gradient")
    draw_mark(apple, mark_in(180, 0.64))
    done(apple, 180, WEB / "apple-icon.png", "RGB")
    ico = tile(256, stroke=0.12).resize((256, 256), Image.LANCZOS)
    ico.save(WEB / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("wrote apps/web/src/app/favicon.ico 16/32/48")

    # Preview sheet for review (not shipped)
    sheet = Image.new("RGB", (1400, 420), (244, 241, 236))
    sheet.paste(Image.open(MOBILE / "icon.png").resize((360, 360)), (30, 30))
    fg = Image.open(MOBILE / "android-icon-foreground.png").resize((360, 360))
    bgc = Image.open(MOBILE / "android-icon-background.png").resize((360, 360)).convert("RGBA")
    bgc.alpha_composite(fg)
    circ = Image.new("L", (360, 360), 0)
    ImageDraw.Draw(circ).ellipse((0, 0, 359, 359), fill=255)
    sheet.paste(bgc, (420, 30), circ)
    mono = Image.open(MOBILE / "android-icon-monochrome.png").resize((180, 180))
    dark = Image.new("RGBA", (180, 180), (40, 40, 40, 255))
    dark.alpha_composite(mono)
    sheet.paste(dark, (810, 30))
    x = 1010
    for s in (16, 32, 48):
        f = Image.open(WEB / "icon.png").resize((s, s), Image.LANCZOS) if s != 48 else Image.open(MOBILE / "favicon.png")
        sheet.paste(f, (x, 60), f)
        big = f.resize((s * 4, s * 4), Image.NEAREST)
        sheet.paste(big, (x, 230), big)
        x += s * 4 + 20
    out = ROOT / "tools/icon-preview.png"
    sheet.save(out)
    print("wrote", out.relative_to(ROOT))


if __name__ == "__main__":
    main()
