"""Setzt das App-Icon aus der gerenderten 3D-Szene zusammen.

Aufruf: python3 tools/icon/make_icon.py <scene.png> <out_1024.png>
Fläche: Superellipse in tiefem Grün mit Lichtkegel, feiner Körnung und Messing-Haarlinie;
darauf der isometrische Raumausschnitt mit weichem Bodenschatten.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SS = 4  # Supersampling
N = 1024 * SS


def superellipse(size, margin, n=4.2):
    c = size / 2
    r = c - margin
    t = np.linspace(0, 2 * np.pi, 2000)
    x = c + r * np.sign(np.cos(t)) * np.abs(np.cos(t)) ** (2 / n)
    y = c + r * np.sign(np.sin(t)) * np.abs(np.sin(t)) ** (2 / n)
    return list(zip(x, y))


def mask(margin):
    m = Image.new("L", (N, N), 0)
    ImageDraw.Draw(m).polygon(superellipse(N, margin), fill=255)
    return m


def main(scene_path, out):
    yy, xx = np.mgrid[0:N, 0:N] / N
    # Grundverlauf tiefes Waldgrün, oben links heller, Lichtkegel hinter der Szene
    top = np.array([46, 74, 63]) / 255
    bot = np.array([10, 22, 18]) / 255
    t = np.clip(0.55 * yy + 0.45 * xx, 0, 1)[..., None]
    col = top * (1 - t) + bot * t
    glow = np.exp(-(((xx - 0.5) / 0.36) ** 2 + ((yy - 0.42) / 0.30) ** 2))[..., None]
    col = col + glow * np.array([0.16, 0.14, 0.09])
    rng = np.random.default_rng(13)
    col = col + rng.normal(0, 0.012, (N, N, 1))
    bg = Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8), "RGB").convert("RGBA")

    body = mask(44 * SS)
    icon = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    icon.paste(bg, (0, 0), body)

    # Innenkante: Messing-Haarlinie
    rim = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(rim)
    d.line(superellipse(N, 64 * SS) + [superellipse(N, 64 * SS)[0]], fill=(214, 178, 110, 150), width=3 * SS)
    icon = Image.alpha_composite(icon, rim)

    # Szene
    sc = Image.open(scene_path).convert("RGBA")
    S = int(N * 0.82)
    sc = sc.resize((S, S), Image.LANCZOS)
    ox, oy = (N - S) // 2, (N - S) // 2 + int(N * 0.01)
    # weicher Bodenschatten unter der Plattform
    sh = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    a = sc.split()[3].point(lambda v: 255 if v > 10 else 0)
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 170))
    sh.paste(shadow, (ox, oy + int(N * 0.035)), a)
    sh = sh.filter(ImageFilter.GaussianBlur(26 * SS))
    icon = Image.alpha_composite(icon, Image.composite(sh, Image.new("RGBA", (N, N)), body))
    layer = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    layer.paste(sc, (ox, oy), sc)
    icon = Image.alpha_composite(icon, layer)

    # Glanzkante oben (sehr dezent)
    gl = Image.new("L", (N, N), 0)
    ImageDraw.Draw(gl).ellipse((-N * 0.2, -N * 0.95, N * 1.2, N * 0.32), fill=26)
    gl = gl.filter(ImageFilter.GaussianBlur(30 * SS))
    white = Image.new("RGBA", (N, N), (255, 255, 255, 0))
    white.putalpha(Image.fromarray(np.minimum(np.array(gl), np.array(body)).astype(np.uint8)))
    icon = Image.alpha_composite(icon, white)

    icon.resize((1024, 1024), Image.LANCZOS).save(out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
