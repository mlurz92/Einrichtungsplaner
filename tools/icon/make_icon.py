"""App-Icon 2.5 „Noir“ als SVG/HTML erzeugen (Isometrie wird hier berechnet).

Aufruf: python3 tools/icon/make_icon.py && node tools/icon/render_icon.cjs
"""
import math
import os

L, B, R, F = (224, 600), (512, 434), (800, 600), (512, 766)  # Bodenecken links, hinten, rechts, vorn
H = 258  # Wandhöhe
T = 20  # Wandstärke


def add(p, q, k=1.0):
    return (p[0] + q[0] * k, p[1] + q[1] * k)


def sub(p, q):
    return (p[0] - q[0], p[1] - q[1])


def up(p, h):
    return (p[0], p[1] - h)


def fl(s, t):
    """Bodenpunkt: s entlang L→B (Tiefe), t entlang L→F (Breite)."""
    return add(add(L, sub(B, L), s), sub(F, L), t)


def wl(u, h):
    """Punkt auf der linken Wand (L→B) in Höhe h."""
    return up(add(L, sub(B, L), u), h)


def P(*pts):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)


def box(s0, s1, t0, t1, h0, h1):
    """Quader in Bodenkoordinaten: Oberseite, sichtbare Seite (s1) und Vorderseite (t1)."""
    top = [up(fl(s0, t0), h1), up(fl(s1, t0), h1), up(fl(s1, t1), h1), up(fl(s0, t1), h1)]
    side = [up(fl(s1, t0), h1), up(fl(s1, t1), h1), up(fl(s1, t1), h0), up(fl(s1, t0), h0)]
    front = [up(fl(s0, t1), h1), up(fl(s1, t1), h1), up(fl(s1, t1), h0), up(fl(s0, t1), h0)]
    return top, side, front


def poly(pts, fill, extra=""):
    return f'<polygon points="{P(*pts)}" fill="{fill}" {extra}/>'


def chair(sc, tc, back_far):
    """Polsterstuhl (Beige Vintage) mit Rückenlehne zur Tischferne; schwarzer Fuß als Schatten."""
    w, d = 0.062, 0.052
    out = []
    out.append(poly([fl(sc - w, tc - d), fl(sc + w, tc - d), fl(sc + w, tc + d), fl(sc - w, tc + d)], "#000", 'opacity="0.18"'))
    leg = [up(fl(sc - 0.01, tc), 34), up(fl(sc + 0.01, tc), 34), up(fl(sc + 0.01, tc), 0), up(fl(sc - 0.01, tc), 0)]
    out.append(poly(leg, "#141210"))
    top, side, front = box(sc - w, sc + w, tc - d, tc + d, 34, 48)
    out += [poly(side, "#a99c86"), poly(front, "#c2b49d"), poly(top, "url(#seat)")]
    tb = tc - d if back_far else tc + d - 0.02
    bt, bs, bf = box(sc - w, sc + w, tb, tb + 0.02, 48, 80)
    out += [poly(bs, "#a59781"), poly(bf, "#cdbfa7" if back_far else "#bcae96"), poly(bt, "#e6dccb")]
    return "".join(out)


def main():
    Lt, Bt, Rt = up(L, H), up(B, H), up(R, H)
    ox, oy = (-0.866 * T, -0.5 * T), (0.866 * T, -0.5 * T)
    Lo, Ro, Bo = add(Lt, ox), add(Rt, oy), add(add(Bt, ox), oy)
    Lbo, Rbo = add(L, ox), add(R, oy)
    win = [wl(0.30, 66), wl(0.60, 66), wl(0.60, 214), wl(0.30, 214)]
    mull = [wl(0.45, 66), wl(0.45, 214)]
    sun = [fl(0.30, 0.0), fl(0.60, 0.0), fl(0.47, 0.62), fl(0.17, 0.62)]

    th, tk = 86, 9
    s0, s1, t0, t1 = 0.40, 0.86, 0.40, 0.62
    top, side, front = box(s0, s1, t0, t1, th - tk, th)
    tm = (t0 + t1) / 2
    legA = [up(fl(0.50, tm), th - tk), up(fl(0.56, tm), th - tk), up(fl(0.66, tm), 0), up(fl(0.60, tm), 0)]
    legB = [up(fl(0.76, tm), th - tk), up(fl(0.70, tm), th - tk), up(fl(0.60, tm), 0), up(fl(0.66, tm), 0)]
    back_row = "".join(chair(sc, 0.31, True) for sc in (0.50, 0.66, 0.82))
    front_row = "".join(chair(sc, 0.71, False) for sc in (0.50, 0.66, 0.82))

    pc = up(fl(0.63, tm), th + 126)
    pl = [up(fl(0.48, tm), th + 126), up(fl(0.78, tm), th + 126)]

    # Maßketten: parallel zu den Vorderkanten, nach außen versetzt
    off = 46
    ln = math.hypot(166, 288)
    n1 = (-166 / ln, 288 / ln)  # Normale der Kante L→F
    n2 = (166 / ln, 288 / ln)  # Normale der Kante F→R

    def chain(a, b, n):
        A, Bp = add(a, n, off), add(b, n, off)
        e = lambda p: f'<line x1="{p[0] + n[0] * 14:.1f}" y1="{p[1] + n[1] * 14:.1f}" x2="{p[0] + n[0] * (off + 14):.1f}" y2="{p[1] + n[1] * (off + 14):.1f}" stroke-width="2.5" />'
        d = sub(Bp, A)
        k = math.hypot(*d)
        u = (d[0] / k, d[1] / k)
        # Architekten-Schrägstrich (45° zur Maßlinie)
        sl = ((u[0] - n[0]) * 11, (u[1] - n[1]) * 11)
        tick = lambda p: f'<line x1="{p[0] - sl[0]:.1f}" y1="{p[1] - sl[1]:.1f}" x2="{p[0] + sl[0]:.1f}" y2="{p[1] + sl[1]:.1f}" stroke-width="4.5" />'
        return f'<line x1="{A[0]:.1f}" y1="{A[1]:.1f}" x2="{Bp[0]:.1f}" y2="{Bp[1]:.1f}" />' + e(a) + e(b) + tick(A) + tick(Bp)

    planks = "".join(f'<line x1="{fl(0, t)[0]:.1f}" y1="{fl(0, t)[1]:.1f}" x2="{fl(1, t)[0]:.1f}" y2="{fl(1, t)[1]:.1f}" />' for t in [i / 9 for i in range(1, 9)])
    joints = "".join(
        f'<line x1="{fl(s, k / 9)[0]:.1f}" y1="{fl(s, k / 9)[1]:.1f}" x2="{fl(s, (k + 1) / 9)[0]:.1f}" y2="{fl(s, (k + 1) / 9)[1]:.1f}" />'
        for k in range(9)
        for s in [((k * 0.37) % 1) * 0.8 + 0.1]
    )
    vein = f'M {top[0][0] + 30:.1f} {top[0][1] + 6:.1f} C {top[0][0] + 90:.1f} {top[0][1] + 30:.1f}, {top[1][0] - 60:.1f} {top[1][1] + 10:.1f}, {top[2][0] - 40:.1f} {top[2][1] - 4:.1f}'

    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "icon.html"), "w", encoding="utf-8") as f:
        f.write(f"""<!doctype html>
<!--
  App-Icon 2.5 „Noir“: Architekturmodell eines Raums in Isometrie auf einer Kachel aus dunklem Stein.
  Schwarze Wandkronen wie beim Schnittmodell, helle Greige-Wände, Eichenboden mit Sonnenfleck aus dem Fenster,
  Esstisch aus dunkler Keramik mit V-Fuß, Stühle in Beige, Pendelleuchte mit warmem Licht, Maßketten in
  Champagner-Gold (Planung). Erzeugt von tools/icon/make_icon.py, gerendert mit tools/icon/render_icon.cjs.
-->
<html>
<head>
<meta charset="utf-8" />
<style>html, body {{ margin: 0; background: transparent; }} svg {{ display: block; }}</style>
</head>
<body>
<svg viewBox="0 0 1024 1024" width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3d3935" /><stop offset="0.5" stop-color="#232120" /><stop offset="1" stop-color="#121110" />
    </linearGradient>
    <radialGradient id="tileGlow" cx="0.26" cy="0.14" r="0.8">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.14" /><stop offset="0.6" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="warm" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffd49a" stop-opacity="0.7" /><stop offset="0.55" stop-color="#ffc77f" stop-opacity="0.2" /><stop offset="1" stop-color="#ffc77f" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="wallL" x1="0" y1="0" x2="1" y2="0.6"><stop offset="0" stop-color="#e1d9cc" /><stop offset="1" stop-color="#f5f0e8" /></linearGradient>
    <linearGradient id="wallR" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" stop-color="#cbc1b2" /><stop offset="1" stop-color="#b2a796" /></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#cfb28c" /><stop offset="1" stop-color="#a68763" /></linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbf3" /><stop offset="1" stop-color="#f0e4cf" /></linearGradient>
    <linearGradient id="sunfleck" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#fff3da" stop-opacity="0.8" /><stop offset="1" stop-color="#fff3da" stop-opacity="0.1" /></linearGradient>
    <linearGradient id="stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d322b" /><stop offset="0.5" stop-color="#241e1a" /><stop offset="1" stop-color="#151210" /></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#efd9a8" /><stop offset="0.5" stop-color="#cda96c" /><stop offset="1" stop-color="#a07e47" /></linearGradient>
    <linearGradient id="seat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6dac6" /><stop offset="1" stop-color="#cfc1a9" /></linearGradient>
    <linearGradient id="cap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e2b28" /><stop offset="1" stop-color="#121110" /></linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#000" flood-opacity="0.5" /></filter>
    <filter id="blur18"><feGaussianBlur stdDeviation="18" /></filter>
    <filter id="blur6"><feGaussianBlur stdDeviation="6" /></filter>
    <clipPath id="floorClip"><polygon points="{P(L, B, R, F)}" /></clipPath>
    <clipPath id="wallLClip"><polygon points="{P(L, B, Bt, Lt)}" /></clipPath>
    <clipPath id="topClip"><polygon points="{P(*top)}" /></clipPath>
    <clipPath id="tileClip"><rect x="64" y="64" width="896" height="896" rx="208" /></clipPath>
  </defs>

  <g filter="url(#shadow)"><rect x="64" y="64" width="896" height="896" rx="208" fill="url(#tile)" /></g>
  <g clip-path="url(#tileClip)">
    <rect x="64" y="64" width="896" height="896" fill="url(#tileGlow)" />
    <ellipse cx="512" cy="792" rx="330" ry="68" fill="#000" opacity="0.45" filter="url(#blur18)" />
  </g>
  <rect x="65.5" y="65.5" width="893" height="893" rx="206.5" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="3" />

  <polygon points="{P(L, B, R, F)}" fill="url(#floor)" />
  <g clip-path="url(#floorClip)" stroke="#5a412a" stroke-opacity="0.16" stroke-width="2">{planks}{joints}</g>
  <g clip-path="url(#floorClip)"><polygon points="{P(*sun)}" fill="url(#sunfleck)" filter="url(#blur6)" /></g>

  <polygon points="{P(L, B, Bt, Lt)}" fill="url(#wallL)" />
  <polygon points="{P(B, R, Rt, Bt)}" fill="url(#wallR)" />
  <line x1="{B[0]}" y1="{B[1]}" x2="{Bt[0]}" y2="{Bt[1]}" stroke="#000" stroke-opacity="0.12" stroke-width="3" />
  <g clip-path="url(#wallLClip)">
    <polygon points="{P(*win)}" fill="url(#sky)" />
    <polygon points="{P(*win)}" fill="none" stroke="#1a1816" stroke-width="7" stroke-linejoin="round" />
    <line x1="{mull[0][0]:.1f}" y1="{mull[0][1]:.1f}" x2="{mull[1][0]:.1f}" y2="{mull[1][1]:.1f}" stroke="#1a1816" stroke-width="5" />
  </g>

  <ellipse cx="{pc[0]:.1f}" cy="{pc[1] + 150:.1f}" rx="215" ry="118" fill="url(#warm)" />

  {back_row}
  {poly(legA, "#0f0e0d")}{poly(legB, "#1b1917")}
  {poly(side, "#0e0c0b")}{poly(front, "#1a1613")}{poly(top, "url(#stone)")}
  <path d="{vein}" clip-path="url(#topClip)" fill="none" stroke="#cda96c" stroke-opacity="0.6" stroke-width="2.4" />
  <polygon points="{P(*top)}" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2" />
  {front_row}

  <line x1="{pc[0]:.1f}" y1="{pc[1] - 150:.1f}" x2="{pc[0]:.1f}" y2="{pc[1]:.1f}" stroke="#141210" stroke-width="3" />
  <line x1="{pl[0][0]:.1f}" y1="{pl[0][1]:.1f}" x2="{pl[1][0]:.1f}" y2="{pl[1][1]:.1f}" stroke="#141210" stroke-width="14" stroke-linecap="round" />
  <line x1="{pl[0][0] + 6:.1f}" y1="{pl[0][1] + 6:.1f}" x2="{pl[1][0] - 6:.1f}" y2="{pl[1][1] + 6:.1f}" stroke="#ffe2b0" stroke-width="3" stroke-linecap="round" opacity="0.9" />

  {poly([L, Lt, Lo, Lbo], "#1a1816")}{poly([R, Rt, Ro, Rbo], "#0f0e0d")}
  {poly([Lt, Bt, Rt, Ro, Bo, Lo], "url(#cap)")}
  <polyline points="{P(Lo, Bo, Ro)}" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="2" />

  <g stroke="url(#gold)" stroke-width="4" stroke-linecap="round" fill="none">{chain(L, F, n1)}{chain(F, R, n2)}</g>
</svg>
</body>
</html>
""")


if __name__ == "__main__":
    main()
