"""
Fleet24 Home illustrations: original, flat-shaded food art drawn as SVG.

Run:  python3 tools/home-art/draw.py   (writes tools/home-art/svg/*.svg)
Then: python3 tools/home-art/render.py (renders WebP into the apps)

Every image is drawn on a 512x512 transparent canvas. Keys match HOME_ART_KEYS in
backend/src/restaurants/home-art.ts.
"""
import math
import os
import random

OUT = os.path.join(os.path.dirname(__file__), 'svg')
W = 512

DEFS = """
<defs>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
    <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#2b1a0e" flood-opacity="0.28"/>
  </filter>
  <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
    <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#3a2410" flood-opacity="0.25"/>
  </filter>
  <radialGradient id="plate" cx="50%" cy="42%" r="60%">
    <stop offset="0%" stop-color="#ffffff"/><stop offset="78%" stop-color="#f4f1ec"/><stop offset="100%" stop-color="#ddd6cc"/>
  </radialGradient>
  <radialGradient id="steel" cx="45%" cy="38%" r="65%">
    <stop offset="0%" stop-color="#f6f7f9"/><stop offset="60%" stop-color="#c9ced6"/><stop offset="100%" stop-color="#8f97a3"/>
  </radialGradient>
  <radialGradient id="bowlIn" cx="50%" cy="40%" r="60%">
    <stop offset="0%" stop-color="#3b2a20"/><stop offset="100%" stop-color="#1e140e"/>
  </radialGradient>
  <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
  </linearGradient>
</defs>
"""


def svg(body, name):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f'{name}.svg'), 'w') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}" width="{W}" height="{W}">{DEFS}{body}</svg>')


def blob(cx, cy, r, color, rnd, points=9, wobble=0.22, extra=''):
    pts = []
    for i in range(points):
        a = 2 * math.pi * i / points
        rr = r * (1 + rnd.uniform(-wobble, wobble))
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d = smooth_path(pts)
    return f'<path d="{d}" fill="{color}" {extra}/>'


def smooth_path(pts):
    n = len(pts)
    d = f'M{(pts[0][0] + pts[1][0]) / 2:.1f},{(pts[0][1] + pts[1][1]) / 2:.1f} '
    for i in range(1, n + 1):
        p = pts[i % n]
        q = pts[(i + 1) % n]
        d += f'Q{p[0]:.1f},{p[1]:.1f} {(p[0] + q[0]) / 2:.1f},{(p[1] + q[1]) / 2:.1f} '
    return d + 'Z'


def plate(cx=256, cy=262, r=210, fill='url(#plate)'):
    return (f'<g filter="url(#shadow)"><circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"/></g>'
            f'<circle cx="{cx}" cy="{cy}" r="{r * 0.78}" fill="none" stroke="#000" stroke-opacity="0.05" stroke-width="3"/>')


def grains(rnd, cx, cy, r, colors, n=420, length=(9, 15)):
    out = []
    for _ in range(n):
        a = rnd.uniform(0, 2 * math.pi)
        d = r * math.sqrt(rnd.random())
        x, y = cx + d * math.cos(a), cy + d * math.sin(a)
        L = rnd.uniform(*length)
        rot = rnd.uniform(0, 180)
        out.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{L / 2:.1f}" ry="{L / 5.5:.1f}" fill="{rnd.choice(colors)}" transform="rotate({rot:.0f} {x:.1f} {y:.1f})"/>')
    return ''.join(out)


def leaf(x, y, s, rot, color='#3f9a3a', vein='#2c7a2a'):
    return (f'<g transform="translate({x} {y}) rotate({rot}) scale({s})">'
            f'<path d="M0,-14 Q12,-4 0,16 Q-12,-4 0,-14Z" fill="{color}"/>'
            f'<path d="M0,-11 L0,13" stroke="{vein}" stroke-width="1.4"/></g>')


# ---------------------------------------------------------------- dishes

def biryani():
    rnd = random.Random(1)
    b = plate(r=200)
    b += '<circle cx="256" cy="262" r="168" fill="#c98a3c"/>'
    b += grains(rnd, 256, 258, 160, ['#fff6e3', '#fbe7b9', '#f5c35c', '#ffffff', '#e8a640', '#fff1cf'], n=900)
    for _ in range(9):
        a, d = rnd.uniform(0, 6.28), rnd.uniform(20, 120)
        x, y = 256 + d * math.cos(a), 258 + d * math.sin(a)
        b += blob(x, y, rnd.uniform(20, 28), '#9b4a1d', rnd, extra='filter="url(#soft)"')
        b += blob(x - 5, y - 6, rnd.uniform(9, 13), '#c66a2c', rnd)
    for _ in range(26):
        a, d = rnd.uniform(0, 6.28), rnd.uniform(0, 150)
        b += f'<path d="M{256 + d * math.cos(a):.0f},{258 + d * math.sin(a):.0f} q6,-5 13,0" stroke="#6e3412" stroke-width="4" fill="none" stroke-linecap="round"/>'
    for _ in range(12):
        a, d = rnd.uniform(0, 6.28), rnd.uniform(0, 140)
        b += leaf(256 + d * math.cos(a), 258 + d * math.sin(a), 0.9, rnd.uniform(0, 360))
    b += '<g filter="url(#soft)"><ellipse cx="226" cy="206" rx="28" ry="22" fill="#fff8ec"/><ellipse cx="226" cy="200" rx="22" ry="15" fill="#fffdf8"/><circle cx="226" cy="204" r="10" fill="#f6b52a"/></g>'
    svg(b, 'biryani')


def curry_bowl(name, base, light, garnish, chunks, chunk_color, cream=True, seed=2):
    rnd = random.Random(seed)
    b = '<g filter="url(#shadow)"><circle cx="256" cy="262" r="200" fill="#2a1d15"/></g>'
    b += '<circle cx="256" cy="262" r="200" fill="none" stroke="#5a4232" stroke-width="10"/>'
    b += f'<circle cx="256" cy="262" r="176" fill="{base}"/>'
    b += f'<circle cx="236" cy="236" r="110" fill="{light}" opacity="0.55"/>'
    for _ in range(chunks):
        a, d = rnd.uniform(0, 6.28), rnd.uniform(10, 135)
        x, y = 256 + d * math.cos(a), 262 + d * math.sin(a)
        if chunk_color == 'paneer':
            s = rnd.uniform(26, 34)
            r = rnd.uniform(0, 40)
            b += f'<g filter="url(#soft)" transform="rotate({r:.0f} {x:.0f} {y:.0f})"><rect x="{x - s / 2:.0f}" y="{y - s / 2:.0f}" width="{s:.0f}" height="{s:.0f}" rx="6" fill="#fff6e0"/><rect x="{x - s / 2:.0f}" y="{y - s / 2:.0f}" width="{s:.0f}" height="{s / 3:.0f}" rx="6" fill="#f0c98a" opacity="0.7"/></g>'
        else:
            b += blob(x, y, rnd.uniform(20, 27), chunk_color, rnd, extra='filter="url(#soft)"')
    if cream:
        b += '<path d="M180,250 C220,200 300,300 340,240 C320,300 250,250 210,300 Z" fill="#fff8ef" opacity="0.9"/>'
        b += '<path d="M200,262 C240,230 290,290 320,256" stroke="#ffffff" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.9"/>'
    for _ in range(14):
        a, d = rnd.uniform(0, 6.28), rnd.uniform(0, 150)
        b += leaf(256 + d * math.cos(a), 262 + d * math.sin(a), 0.75, rnd.uniform(0, 360), color=garnish)
    b += '<ellipse cx="190" cy="150" rx="70" ry="22" fill="url(#gloss)" opacity="0.6" transform="rotate(-25 190 150)"/>'
    svg(b, name)


def thali():
    rnd = random.Random(3)
    b = '<g filter="url(#shadow)"><circle cx="256" cy="262" r="218" fill="url(#steel)"/></g>'
    b += '<circle cx="256" cy="262" r="196" fill="#d7dbe1"/>'

    def katori(x, y, r, fill, top=None):
        s = f'<g filter="url(#soft)"><circle cx="{x}" cy="{y}" r="{r}" fill="url(#steel)"/></g><circle cx="{x}" cy="{y}" r="{r - 9}" fill="{fill}"/>'
        if top:
            s += top
        return s

    b += katori(170, 165, 58, '#f2b21c', '<circle cx="160" cy="155" r="20" fill="#ffd25a" opacity="0.7"/>' + leaf(185, 170, 0.8, 30))
    b += katori(300, 140, 54, '#c2411f', '<circle cx="290" cy="130" r="18" fill="#e5672f" opacity="0.7"/>')
    b += katori(370, 240, 52, '#fbfaf3', ''.join(leaf(360 + rnd.uniform(-20, 20), 240 + rnd.uniform(-20, 20), 0.6, rnd.uniform(0, 360)) for _ in range(4)))
    b += katori(150, 300, 54, '#7a3b16', '<circle cx="140" cy="290" r="16" fill="#9c5326"/>')
    # rice mound
    b += '<ellipse cx="270" cy="320" rx="78" ry="60" fill="#fffaf0" filter="url(#soft)"/>'
    b += grains(rnd, 270, 318, 58, ['#ffffff', '#f7efdd', '#fff9ec'], n=220, length=(8, 12))
    # rotis
    for i, (x, y) in enumerate([(320, 410), (240, 420)]):
        b += f'<g filter="url(#soft)"><circle cx="{x}" cy="{y}" r="62" fill="#e7b46e"/></g>'
        for _ in range(16):
            a, d = rnd.uniform(0, 6.28), rnd.uniform(0, 52)
            b += f'<circle cx="{x + d * math.cos(a):.0f}" cy="{y + d * math.sin(a):.0f}" r="{rnd.uniform(3, 7):.1f}" fill="#9a5b22" opacity="0.65"/>'
    b += '<path d="M400,350 q30,-10 40,20 q-25,15 -40,-20Z" fill="#7cc04b"/>'
    svg(b, 'thali')


def breads():
    rnd = random.Random(4)
    b = plate(r=205)
    for (x, y, rx, ry, rot) in [(210, 230, 150, 105, -18), (290, 290, 150, 100, 14)]:
        b += f'<g filter="url(#soft)" transform="rotate({rot} {x} {y})"><ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#efc785"/>'
        b += f'<ellipse cx="{x - 20}" cy="{y - 15}" rx="{rx * 0.7:.0f}" ry="{ry * 0.6:.0f}" fill="#f6d9a0"/>'
        for _ in range(30):
            a, d = rnd.uniform(0, 6.28), rnd.uniform(0, 0.85)
            b += f'<ellipse cx="{x + rx * d * math.cos(a):.0f}" cy="{y + ry * d * math.sin(a):.0f}" rx="{rnd.uniform(5, 12):.0f}" ry="{rnd.uniform(3, 7):.0f}" fill="#8a4b19" opacity="{rnd.uniform(0.45, 0.8):.2f}"/>'
        b += '</g>'
    b += '<g filter="url(#soft)"><rect x="330" y="140" width="56" height="40" rx="8" fill="#ffe27a"/><rect x="336" y="144" width="44" height="12" rx="4" fill="#fff2b0"/></g>'
    for _ in range(10):
        b += leaf(rnd.uniform(160, 360), rnd.uniform(200, 330), 0.6, rnd.uniform(0, 360))
    svg(b, 'breads')


def starters():
    rnd = random.Random(5)
    b = plate(r=205)
    for _ in range(9):
        a, d = rnd.uniform(0, 6.28), rnd.uniform(0, 110)
        x, y = 240 + d * math.cos(a), 270 + d * math.sin(a)
        b += blob(x, y, rnd.uniform(28, 36), '#c0561f', rnd, points=11, wobble=0.25, extra='filter="url(#soft)"')
        b += blob(x - 6, y - 8, rnd.uniform(12, 18), '#e0812f', rnd)
        for _ in range(4):
            b += f'<circle cx="{x + rnd.uniform(-18, 18):.0f}" cy="{y + rnd.uniform(-18, 18):.0f}" r="3" fill="#6b2a0c"/>'
    b += '<g filter="url(#soft)"><circle cx="380" cy="160" r="46" fill="url(#steel)"/><circle cx="380" cy="160" r="36" fill="#3f9b3a"/><circle cx="372" cy="152" r="14" fill="#6cc25a"/></g>'
    b += '<g filter="url(#soft)"><path d="M120,170 a40,40 0 0 1 70,-30 l-35,35z" fill="#f5e04b"/><path d="M128,166 a32,32 0 0 1 56,-24" stroke="#fff6a8" stroke-width="5" fill="none"/></g>'
    b += '<g><circle cx="370" cy="350" r="30" fill="#f2e7dc"/><circle cx="370" cy="350" r="18" fill="none" stroke="#c94a6a" stroke-width="6"/></g>'
    svg(b, 'starters')


def rolls():
    rnd = random.Random(6)
    b = '<ellipse cx="256" cy="420" rx="190" ry="34" fill="#2b1a0e" opacity="0.18"/>'
    for (x, rot) in [(190, -20), (320, 16)]:
        b += f'<g transform="rotate({rot} {x} 270)" filter="url(#shadow)">'
        b += f'<rect x="{x - 62}" y="150" width="124" height="250" rx="60" fill="#e9b875"/>'
        b += f'<rect x="{x - 62}" y="260" width="124" height="140" rx="20" fill="#f6efe3"/>'
        b += f'<path d="M{x - 62},300 l124,-20" stroke="#d9cbb5" stroke-width="3"/>'
        b += f'<ellipse cx="{x}" cy="170" rx="60" ry="40" fill="#f6d6a0"/>'
        b += f'<ellipse cx="{x}" cy="172" rx="48" ry="30" fill="#b9541d"/>'
        for _ in range(9):
            b += f'<circle cx="{x + rnd.uniform(-38, 38):.0f}" cy="{172 + rnd.uniform(-20, 20):.0f}" r="{rnd.uniform(6, 10):.0f}" fill="{rnd.choice(["#7fbf45", "#e33b2f", "#fff2d6", "#8b3a12"])}"/>'
        b += '</g>'
    svg(b, 'rolls')


def beverages():
    b = '<ellipse cx="256" cy="452" rx="130" ry="22" fill="#2b1a0e" opacity="0.2"/>'
    b += '<g filter="url(#shadow)"><path d="M150,110 L362,110 L338,440 Q336,456 320,456 L192,456 Q176,456 174,440 Z" fill="#fdfbf7" opacity="0.35"/></g>'
    b += '<path d="M160,170 L352,170 L338,438 Q336,450 322,450 L190,450 Q176,450 174,438 Z" fill="#a8622a"/>'
    b += '<path d="M160,170 L352,170 L346,250 L166,250 Z" fill="#f4e3c8"/>'
    for (x, y) in [(210, 290), (290, 320), (240, 360)]:
        b += f'<rect x="{x}" y="{y}" width="42" height="40" rx="8" fill="#ffffff" opacity="0.45" transform="rotate(15 {x} {y})"/>'
    b += '<path d="M150,110 L362,110 L338,440 Q336,456 320,456 L192,456 Q176,456 174,440 Z" fill="none" stroke="#ffffff" stroke-opacity="0.8" stroke-width="5"/>'
    b += '<rect x="290" y="40" width="18" height="230" rx="9" fill="#2f9e57" transform="rotate(12 300 150)"/>'
    b += '<path d="M180,130 L190,420" stroke="#ffffff" stroke-width="10" stroke-opacity="0.5" stroke-linecap="round"/>'
    b += '<circle cx="230" cy="200" r="10" fill="#7a4220"/><circle cx="270" cy="210" r="8" fill="#7a4220"/>'
    svg(b, 'beverages')


def pizza():
    rnd = random.Random(7)
    b = '<g filter="url(#shadow)"><circle cx="256" cy="262" r="210" fill="#8a5a33"/></g>'
    b += '<circle cx="256" cy="262" r="196" fill="#d98e3f"/>'
    b += '<circle cx="256" cy="262" r="172" fill="#c8321f"/>'
    for _ in range(26):
        a, d = rnd.uniform(0, 6.28), rnd.uniform(0, 150)
        b += blob(256 + d * math.cos(a), 262 + d * math.sin(a), rnd.uniform(22, 34), '#fbe08c', rnd, wobble=0.3)
    for _ in range(11):
        a, d = rnd.uniform(0, 6.28), rnd.uniform(20, 140)
        x, y = 256 + d * math.cos(a), 262 + d * math.sin(a)
        b += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="20" fill="#a71f16"/><circle cx="{x - 5:.0f}" cy="{y - 5:.0f}" r="7" fill="#d4473a"/>'
    for _ in range(10):
        a, d = rnd.uniform(0, 6.28), rnd.uniform(0, 150)
        b += leaf(256 + d * math.cos(a), 262 + d * math.sin(a), 1.1, rnd.uniform(0, 360), color='#2f8a3a')
    for i in range(6):
        a = i * math.pi / 3
        b += f'<line x1="256" y1="262" x2="{256 + 196 * math.cos(a):.0f}" y2="{262 + 196 * math.sin(a):.0f}" stroke="#7b3e18" stroke-opacity="0.45" stroke-width="4"/>'
    svg(b, 'pizza')


def burger(name='burger', fries=True, scale=1.0):
    rnd = random.Random(8)
    s = scale
    g = f'<g transform="translate({256 - 256 * s:.0f} {256 - 256 * s:.0f}) scale({s})">'
    g += '<ellipse cx="236" cy="440" rx="170" ry="26" fill="#2b1a0e" opacity="0.2"/>'
    if fries:
        g += '<g filter="url(#shadow)"><path d="M352,250 L452,250 L438,430 L366,430 Z" fill="#d6332a"/></g>'
        for i in range(8):
            x = 360 + i * 11
            g += f'<rect x="{x}" y="{170 + rnd.uniform(0, 40):.0f}" width="14" height="110" rx="4" fill="#f7c843" transform="rotate({rnd.uniform(-10, 10):.0f} {x} 250)"/>'
        g += '<path d="M352,250 L452,250 L446,300 L358,300 Z" fill="#b8241c"/>'
    g += '<g filter="url(#shadow)">'
    g += '<path d="M76,360 Q76,420 140,420 L330,420 Q396,420 396,360 Z" fill="#d88a3a"/>'
    g += '<path d="M70,340 Q236,380 402,340 L402,362 Q236,400 70,362 Z" fill="#5a2c14"/>'
    g += '<rect x="70" y="300" width="332" height="48" rx="22" fill="#6b3418"/>'
    g += '<path d="M60,300 Q100,280 130,300 Q160,320 190,298 Q220,280 250,300 Q280,322 310,298 Q340,280 370,300 Q400,318 412,296 L412,312 L60,312Z" fill="#f6c12c"/>'
    g += '<path d="M56,282 Q90,262 120,284 Q150,304 182,280 Q214,260 246,284 Q278,306 310,282 Q342,262 374,286 Q402,302 416,278 L416,296 L56,296Z" fill="#59b33a"/>'
    g += '<rect x="80" y="262" width="312" height="22" rx="10" fill="#e5463a"/>'
    g += '<path d="M66,262 Q66,120 236,120 Q406,120 406,262 Z" fill="#e39a45"/>'
    g += '<path d="M90,230 Q100,140 236,136 Q300,136 340,170" stroke="#f6c37a" stroke-width="16" fill="none" stroke-linecap="round" opacity="0.7"/>'
    for _ in range(18):
        x, y = rnd.uniform(110, 360), rnd.uniform(150, 230)
        g += f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="6" ry="3.4" fill="#fff4dc" transform="rotate({rnd.uniform(-40, 40):.0f} {x:.0f} {y:.0f})"/>'
    g += '</g></g>'
    svg(g, name)


def fried_chicken():
    rnd = random.Random(9)
    b = '<ellipse cx="256" cy="450" rx="170" ry="26" fill="#2b1a0e" opacity="0.2"/>'
    bucket = '<g filter="url(#shadow)"><path d="M130,240 L382,240 L352,440 L160,440 Z" fill="#ffffff"/>'
    for i in range(5):
        bucket += f'<path d="M{150 + i * 50},240 L{176 + i * 40},440 L{196 + i * 40},440 L{172 + i * 50},240 Z" fill="#d9302a"/>'
    bucket += '</g>'
    pieces = ''
    for (x, y, r) in [(180, 210, 58), (330, 205, 56), (256, 175, 62), (215, 140, 46), (305, 130, 44)]:
        pieces += f'<g filter="url(#soft)">{blob(x, y, r, "#b8651f", rnd, points=12, wobble=0.16)}{blob(x - 10, y - 14, r * 0.5, "#dd9440", rnd, points=10, wobble=0.25)}</g>'
        for _ in range(7):
            pieces += f'<circle cx="{x + rnd.uniform(-r * 0.6, r * 0.6):.0f}" cy="{y + rnd.uniform(-r * 0.5, r * 0.5):.0f}" r="{rnd.uniform(3, 6):.0f}" fill="#f2b763"/>'
    rim = '<rect x="122" y="232" width="268" height="26" rx="8" fill="#d9302a" filter="url(#soft)"/>'
    b += bucket + pieces + rim
    svg(b, 'fried-chicken')


def cookie():
    rnd = random.Random(10)
    b = ''
    for (x, y, r) in [(190, 300, 140), (330, 210, 120)]:
        b += f'<g filter="url(#shadow)">{blob(x, y, r, "#d99a4e", rnd, points=14, wobble=0.05)}</g>'
        b += blob(x - r * 0.15, y - r * 0.18, r * 0.62, '#e8b46a', rnd, points=12, wobble=0.08)
        for _ in range(14):
            a, d = rnd.uniform(0, 6.28), rnd.uniform(0, r * 0.8)
            cx, cy = x + d * math.cos(a), y + d * math.sin(a)
            b += blob(cx, cy, rnd.uniform(9, 15), '#3b1f12', rnd, points=6, wobble=0.3)
            b += f'<circle cx="{cx - 3:.0f}" cy="{cy - 3:.0f}" r="3" fill="#6b3a22"/>'
        for _ in range(20):
            a, d = rnd.uniform(0, 6.28), rnd.uniform(0, r * 0.85)
            b += f'<circle cx="{x + d * math.cos(a):.0f}" cy="{y + d * math.sin(a):.0f}" r="2.4" fill="#a8672c" opacity="0.6"/>'
    svg(b, 'cookie')


def brownies():
    rnd = random.Random(11)
    b = plate(r=190, cy=300)

    def piece(x, y, s):
        t = f'<g filter="url(#shadow)" transform="translate({x} {y})">'
        t += f'<path d="M0,{s * 0.35} L{s * 0.6},0 L{s * 1.6},{s * 0.2} L{s},{s * 0.6} Z" fill="#4a2617"/>'
        t += f'<path d="M0,{s * 0.35} L{s},{s * 0.6} L{s},{s * 1.05} L0,{s * 0.8} Z" fill="#2f170d"/>'
        t += f'<path d="M{s},{s * 0.6} L{s * 1.6},{s * 0.2} L{s * 1.6},{s * 0.65} L{s},{s * 1.05} Z" fill="#3b1d10"/>'
        for _ in range(10):
            t += f'<circle cx="{rnd.uniform(s * 0.3, s * 1.3):.0f}" cy="{rnd.uniform(s * 0.15, s * 0.5):.0f}" r="{rnd.uniform(2, 5):.0f}" fill="#6b3a22"/>'
        t += f'<path d="M{s * 0.4},{s * 0.25} L{s * 1.0},{s * 0.12}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round"/>'
        return t + '</g>'

    b += piece(100, 220, 130) + piece(250, 160, 110) + piece(230, 300, 100)
    b += '<path d="M120,190 q40,-40 90,-10" stroke="#e9d8c8" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.8"/>'
    svg(b, 'brownies')


def cake(name, sponge, cream, drip, top):
    b = '<ellipse cx="256" cy="440" rx="200" ry="36" fill="#2b1a0e" opacity="0.18"/>'
    b += '<g filter="url(#shadow)"><ellipse cx="256" cy="420" rx="196" ry="44" fill="#f2efe9"/></g>'
    b += f'<path d="M96,200 L96,390 Q256,450 416,390 L416,200 Z" fill="{cream}"/>'
    for y in (250, 320):
        b += f'<path d="M96,{y} Q256,{y + 52} 416,{y} L416,{y + 28} Q256,{y + 80} 96,{y + 28} Z" fill="{sponge}"/>'
    b += f'<ellipse cx="256" cy="200" rx="160" ry="48" fill="{cream}"/>'
    b += f'<path d="M96,200 Q96,250 120,252 Q140,254 140,230 Q150,270 176,262 Q196,256 196,236 Q210,280 236,268 Q256,258 262,240 Q276,282 304,270 Q324,262 328,238 Q340,276 366,262 Q388,250 392,228 Q404,252 416,240 L416,200 Z" fill="{drip}"/>'
    b += f'<ellipse cx="256" cy="198" rx="160" ry="46" fill="{drip}"/>'
    b += '<ellipse cx="220" cy="186" rx="80" ry="14" fill="#ffffff" opacity="0.25"/>'
    for i, x in enumerate([176, 226, 286, 336]):
        b += f'<g filter="url(#soft)"><path d="M{x - 20},{196 - (i % 2) * 6} q20,-34 40,0 q-20,12 -40,0z" fill="{cream}"/></g>'
        b += f'<circle cx="{x}" cy="{172 - (i % 2) * 6}" r="13" fill="{top}"/><circle cx="{x - 4}" cy="{168 - (i % 2) * 6}" r="4" fill="#ffffff" opacity="0.6"/>'
    svg(b, name)


def pastry(name, layers, cream, top, glaze):
    b = '<ellipse cx="256" cy="430" rx="190" ry="30" fill="#2b1a0e" opacity="0.18"/>'
    b += '<g filter="url(#shadow)"><path d="M90,400 L420,400 L420,250 L150,170 Z" fill="none"/>'
    b += '<path d="M120,390 L420,390 L420,230 L120,300 Z" fill="#000" opacity="0"/>'
    y0 = 390
    h = 150
    for i, c in enumerate(layers):
        top_y = y0 - h * (i + 1) / len(layers)
        bot_y = y0 - h * i / len(layers)
        b += f'<path d="M110,{bot_y + 20:.0f} L410,{bot_y - 30:.0f} L410,{top_y - 30:.0f} L110,{top_y + 20:.0f} Z" fill="{c}"/>'
    b += f'<path d="M110,{y0 - h + 20} L410,{y0 - h - 30} L300,{y0 - h - 80} Z" fill="{glaze}"/>'
    b += f'<path d="M110,{y0 + 20} L410,{y0 - 30} L410,{y0 - h - 30} L300,{y0 - h - 80} L110,{y0 - h + 20} Z" fill="none" stroke="#000" stroke-opacity="0.06" stroke-width="3"/></g>'
    b += f'<g filter="url(#soft)"><path d="M250,{y0 - h - 60} q30,-60 60,0 q-30,16 -60,0z" fill="{cream}"/><path d="M262,{y0 - h - 66} q18,-36 36,0" stroke="#ffffff" stroke-width="5" fill="none" opacity="0.7"/></g>'
    b += f'<circle cx="280" cy="{y0 - h - 102}" r="18" fill="{top}"/><path d="M282,{y0 - h - 118} q10,-26 28,-30" stroke="#3d7a24" stroke-width="4" fill="none"/>'
    svg(b, name)


def desserts():
    rnd = random.Random(12)
    b = '<g filter="url(#shadow)"><circle cx="256" cy="262" r="200" fill="#e9e2d6"/></g>'
    b += '<circle cx="256" cy="262" r="176" fill="#d88b2d" opacity="0.85"/>'
    b += '<circle cx="230" cy="236" r="120" fill="#f0b45a" opacity="0.5"/>'
    for (x, y) in [(200, 210), (310, 220), (250, 310), (170, 310), (330, 320)]:
        b += f'<g filter="url(#soft)"><circle cx="{x}" cy="{y}" r="52" fill="#5a2210"/><circle cx="{x - 14}" cy="{y - 16}" r="20" fill="#8a3a1a"/><ellipse cx="{x - 18}" cy="{y - 24}" rx="12" ry="6" fill="#ffffff" opacity="0.45"/></g>'
    for _ in range(14):
        a, d = rnd.uniform(0, 6.28), rnd.uniform(0, 150)
        b += f'<ellipse cx="{256 + d * math.cos(a):.0f}" cy="{262 + d * math.sin(a):.0f}" rx="7" ry="3" fill="#6fae45" transform="rotate({rnd.uniform(0, 180):.0f} {256 + d * math.cos(a):.0f} {262 + d * math.sin(a):.0f})"/>'
    svg(b, 'desserts')


# ---------------------------------------------------------------- offer graphics and shortcuts

def badge_percent():
    b = '<g filter="url(#shadow)"><path d="M256,40 L300,90 L366,80 L376,146 L436,176 L406,236 L436,296 L376,326 L366,392 L300,382 L256,432 L212,382 L146,392 L136,326 L76,296 L106,236 L76,176 L136,146 L146,80 L212,90 Z" fill="#2f6bff"/></g>'
    b += '<circle cx="256" cy="236" r="130" fill="#4f86ff"/>'
    b += '<circle cx="206" cy="186" r="36" fill="none" stroke="#ffffff" stroke-width="22"/>'
    b += '<circle cx="306" cy="286" r="36" fill="none" stroke="#ffffff" stroke-width="22"/>'
    b += '<path d="M316,160 L196,312" stroke="#ffffff" stroke-width="26" stroke-linecap="round"/>'
    svg(b, 'promo-percent')


def bolt_shape(fill1='#ffb020', fill2='#ff5b1f', name='promo-bolt', ring=False):
    b = '<defs><linearGradient id="bolt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs>' % (fill1, fill2)
    if ring:
        b += '<g filter="url(#shadow)"><circle cx="256" cy="276" r="176" fill="#ffffff"/></g><circle cx="256" cy="276" r="150" fill="none" stroke="#e9ecf5" stroke-width="16"/>'
        b += '<rect x="226" y="66" width="60" height="42" rx="12" fill="#ffffff" filter="url(#soft)"/>'
        b += '<g transform="translate(256 276) scale(0.62) translate(-256 -256)">'
    else:
        b += '<g>'
    b += '<g filter="url(#shadow)"><path d="M300,40 L120,290 L238,290 L196,472 L392,206 L270,206 Z" fill="url(#bolt)"/></g>'
    b += '<path d="M290,70 L150,272" stroke="#ffffff" stroke-opacity="0.45" stroke-width="14" stroke-linecap="round"/></g>'
    svg(b, name)


def feast():
    b = '<defs><linearGradient id="flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3d1f"/><stop offset="0.6" stop-color="#ff9a1f"/><stop offset="1" stop-color="#ffd84a"/></linearGradient></defs>'
    b += plate(cy=330, r=160)
    b += '<g filter="url(#shadow)"><path d="M256,60 C330,140 360,190 330,260 C318,290 290,306 256,306 C210,306 176,276 176,232 C176,190 206,170 216,130 C236,160 236,180 256,190 C266,150 266,110 256,60 Z" fill="url(#flame)"/></g>'
    b += '<path d="M256,180 C290,220 296,250 280,276 C270,292 242,292 232,276 C220,256 232,232 246,214 C250,236 262,236 256,180Z" fill="#fff1a8"/>'
    svg(b, 'promo-feast')


def flash():
    bolt_shape('#ffd84a', '#ff7a1f', 'promo-flash', ring=True)


def tag():
    b = '<g filter="url(#shadow)"><path d="M120,90 L300,90 L440,236 L286,394 L120,256 Z" fill="#ff6a2b" transform="rotate(8 280 240)"/></g>'
    b += '<circle cx="190" cy="160" r="24" fill="#ffffff" transform="rotate(8 280 240)"/>'
    b += '<g transform="rotate(8 280 240)"><circle cx="262" cy="210" r="18" fill="none" stroke="#ffffff" stroke-width="12"/><circle cx="330" cy="290" r="18" fill="none" stroke="#ffffff" stroke-width="12"/><path d="M340,200 L252,300" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/></g>'
    svg(b, 'shortcut-offers')


def orders_bag():
    b = '<g filter="url(#shadow)"><path d="M120,170 L392,170 L410,450 L102,450 Z" fill="#f5a524"/></g>'
    b += '<path d="M120,170 L392,170 L396,220 L116,220 Z" fill="#e08a12"/>'
    b += '<path d="M190,170 C190,90 322,90 322,170" stroke="#9c5a08" stroke-width="18" fill="none" stroke-linecap="round"/>'
    b += '<circle cx="256" cy="330" r="74" fill="#ffffff"/>'
    b += '<path d="M220,330 L248,358 L298,300" stroke="#1fae5b" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    svg(b, 'shortcut-orders')


def heart():
    b = '<defs><linearGradient id="heart" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b8b"/><stop offset="1" stop-color="#e5294f"/></linearGradient></defs>'
    b += '<g filter="url(#shadow)"><path d="M256,440 C120,340 60,270 60,190 C60,120 112,72 176,72 C214,72 240,92 256,120 C272,92 298,72 336,72 C400,72 452,120 452,190 C452,270 392,340 256,440 Z" fill="url(#heart)"/></g>'
    b += '<path d="M120,170 C120,130 150,110 180,112" stroke="#ffffff" stroke-opacity="0.6" stroke-width="20" fill="none" stroke-linecap="round"/>'
    svg(b, 'shortcut-favourites')


def veg():
    b = '<g filter="url(#shadow)"><rect x="96" y="96" width="320" height="320" rx="56" fill="#ffffff"/></g>'
    b += '<rect x="120" y="120" width="272" height="272" rx="40" fill="none" stroke="#1f9d55" stroke-width="22"/>'
    b += '<circle cx="256" cy="256" r="74" fill="#1f9d55"/>'
    b += leaf(330, 140, 4.2, 40, color='#6cc04a', vein='#3f8d2a')
    svg(b, 'shortcut-veg')


def main():
    biryani()
    thali()
    curry_bowl('main-course', '#d2541f', '#f08a3a', '#3f9a3a', 9, '#8a3414', seed=2)
    curry_bowl('paneer', '#e77a1e', '#f7b04a', '#3f9a3a', 10, 'paneer', seed=13)
    breads()
    starters()
    rolls()
    beverages()
    pizza()
    burger()
    burger('shortcut-food', fries=False, scale=1.05)
    fried_chicken()
    cookie()
    brownies()
    cake('vanilla-cake', '#f3d29a', '#fffaf1', '#fff3dc', '#e3243b')
    cake('chocolate-cake', '#5a2e1a', '#7a4026', '#3a1a0d', '#e3243b')
    pastry('cream-pastry', ['#f3d29a', '#fffaf1', '#f3d29a', '#fffaf1'], '#fffaf1', '#e3243b', '#fff3dc')
    pastry('chocolate-pastry', ['#4a2617', '#a86a43', '#4a2617', '#a86a43'], '#f6e6d6', '#e3243b', '#2f160b')
    desserts()
    badge_percent()
    bolt_shape()
    feast()
    flash()
    bolt_shape('#7dd3fc', '#2563eb', 'shortcut-fast')
    tag()
    orders_bag()
    heart()
    veg()


if __name__ == '__main__':
    main()
    print('\n'.join(sorted(os.listdir(OUT))))
