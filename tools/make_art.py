#!/usr/bin/env python3
"""Генерує SVG-заглушки фото, постери сцен для статичної версії і favicon.

Запуск: python3 tools/make_art.py  (без залежностей)
Кольори — з палітри DESIGN.md.
"""
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG, SURF, TEXT, MUTED, ROSE, MINT = "#05161D", "#11262E", "#E7F3F3", "#A2B9BE", "#F4858A", "#52C69F"

TOOTH = ("M32 13.5c-4.6-3.6-10.4-5.2-15.4-3.2C9.4 13.2 8.6 22 11.4 29.6c1.8 4.9 3 9.3 3.6 15.1"
         ".7 6.6 2.4 11.8 6.2 11.8 4.2 0 4.4-6.3 5.6-11.6.8-3.6 2.6-5.4 5.2-5.4s4.4 1.8 5.2 5.4"
         "c1.2 5.3 1.4 11.6 5.6 11.6 3.8 0 5.5-5.2 6.2-11.8.6-5.8 1.8-10.2 3.6-15.1 2.8-7.6 2-16.4"
         "-5.2-19.3-5-2-10.8-.4-15.4 3.2z")


def write(rel, content):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("  ", rel, len(content.encode()), "bytes")


# ---------- Заглушки фото ----------
def placeholder(w, h, label):
    s = min(w, h) * 0.22
    lines = []
    step = 28
    for i in range(-h, w, step):
        lines.append(f'<path d="M{i} {h} L{i + h} 0"/>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">
<defs><radialGradient id="g" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#1B3A42"/><stop offset="1" stop-color="{SURF}"/></radialGradient></defs>
<rect width="{w}" height="{h}" fill="url(#g)"/>
<g stroke="{MINT}" stroke-opacity=".06" stroke-width="1">{''.join(lines)}</g>
<g transform="translate({w / 2 - s / 2} {h * 0.42 - s / 2}) scale({s / 64})" fill="none" stroke="{MINT}" stroke-opacity=".55" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="{TOOTH}"/></g>
<text x="{w / 2}" y="{h * 0.42 + s * 0.85}" fill="{MUTED}" fill-opacity=".8" font-family="Nunito Sans, Segoe UI, Arial, sans-serif" font-size="{max(16, w // 26)}" text-anchor="middle" letter-spacing="2">ФОТО {label}</text>
</svg>
'''


# ---------- Постери сцен ----------
def defs():
    return f'''<defs>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{MINT}"/><stop offset="1" stop-color="{ROSE}"/></linearGradient>
</defs>'''


def dots(cx, cy, rx, ry, n, seed, color=TEXT, op=.5):
    out = []
    x = seed
    for i in range(n):
        x = (x * 9301 + 49297) % 233280
        a = x / 233280 * math.tau
        x = (x * 9301 + 49297) % 233280
        r = math.sqrt(x / 233280)
        x = (x * 9301 + 49297) % 233280
        sz = 0.8 + 1.8 * (x / 233280)
        out.append(f'<circle cx="{cx + math.cos(a) * rx * r:.1f}" cy="{cy + math.sin(a) * ry * r:.1f}" r="{sz:.1f}"/>')
    return f'<g fill="{color}" fill-opacity="{op}">{"".join(out)}</g>'


def poster1():  # зуб + орбіта променя
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">{defs()}
{dots(200, 200, 190, 190, 120, 7, MINT, .35)}
<g filter="url(#glow)">
<g transform="translate(88 70) scale(3.5)" fill="none" stroke="{TEXT}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"><path d="{TOOTH}"/><path d="M22.5 19.5c2.6-1.4 6.2-1.2 9.5 1" stroke="{MINT}"/></g>
<ellipse cx="200" cy="210" rx="170" ry="46" fill="none" stroke="url(#lg)" stroke-width="2" transform="rotate(-14 200 210)"/>
<circle cx="352" cy="168" r="5" fill="{ROSE}"/>
</g></svg>
'''


def poster2():  # спокійні хвилі
    paths = []
    for k in range(9):
        y0 = 140 + k * 22
        amp = 10 + k * 1.6
        pts = []
        for i in range(41):
            x = i * 10
            y = y0 + math.sin(i / 40 * math.tau * 1.3 + k * .5) * amp * (0.6 + 0.4 * math.cos(i / 40 * math.pi))
            pts.append(f"{x:.1f} {y:.1f}")
        col = MINT if k % 3 else TEXT
        paths.append(f'<path d="M{" L".join(pts)}" fill="none" stroke="{col}" stroke-opacity="{0.25 + k * 0.07:.2f}" stroke-width="1.4"/>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">{defs()}
<g filter="url(#glow)">{''.join(paths)}
<path d="M0 110 C 90 60, 160 150, 240 100 S 360 70, 400 96" fill="none" stroke="url(#lg)" stroke-width="2"/>
<circle cx="400" cy="96" r="5" fill="{ROSE}"/></g></svg>
'''


def tab_path(w=44, h=150, handle=48):
    hw = w / 2
    return (f"M-6 0 h12 v{handle} h{hw - 6} q4 0 4 6 v{h * .62:.0f} "
            f"q0 {h * .38:.0f} -{hw + 4} {h * .38:.0f} q-{hw + 4} 0 -{hw + 4} -{h * .38:.0f} "
            f"v-{h * .62:.0f} q0 -6 4 -6 h{hw - 6} z")


def poster3():  # віяло шкали відтінків
    shades = ["#F5F0E0", "#F3E8D3", "#EFE4C7", "#E9DCCA", "#EAD8BC", "#DED5C0", "#DACEB5", "#DBC7AF"]
    tabs = []
    for i, c in enumerate(shades):
        a = (i - 3.5) * 11
        tabs.append(f'<g transform="translate(200 52) rotate({a:.1f})"><path d="{tab_path()}" fill="{c}" fill-opacity=".9" stroke="{BG}" stroke-width="2"/></g>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">{defs()}
{dots(200, 220, 190, 160, 80, 3, MINT, .3)}
<rect x="120" y="38" width="160" height="16" rx="5" fill="{SURF}" stroke="{MINT}" stroke-opacity=".5"/>
<g>{''.join(reversed(tabs))}</g>
<path d="M40 300 A 200 200 0 0 0 360 300" fill="none" stroke="url(#lg)" stroke-width="2" filter="url(#glow)"/>
</svg>
'''


def poster4():  # коронка з кільцем сканера
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">{defs()}
{dots(200, 200, 170, 170, 90, 11, MINT, .3)}
<g filter="url(#glow)">
<path d="M110 236 C 96 170, 120 120, 160 122 C 178 104, 222 104, 240 122 C 280 120, 304 170, 290 236 C 260 256, 140 256, 110 236 Z" fill="none" stroke="{TEXT}" stroke-width="2"/>
<path d="M160 122 C 170 150, 190 150, 200 132 C 210 150, 230 150, 240 122" fill="none" stroke="{MINT}" stroke-width="1.6"/>
<ellipse cx="200" cy="190" rx="150" ry="34" fill="none" stroke="url(#lg)" stroke-width="2.2"/>
<path d="M66 190 h-20 M354 190 h20" stroke="{ROSE}" stroke-width="2"/>
</g>
<g stroke="{MINT}" stroke-opacity=".7" stroke-width="2" fill="none"><path d="M40 70 v-24 h24"/><path d="M360 70 v-24 h-24"/><path d="M40 330 v24 h24"/><path d="M360 330 v24 h-24"/></g>
</svg>
'''


def poster5():  # скляні картки
    cards = [(-110, 20, -10), (0, -10, 0), (110, 24, 10)]
    out = []
    for i, (dx, dy, rot) in enumerate(cards):
        col = MINT if i != 2 else ROSE
        out.append(f'''<g transform="translate({200 + dx} {200 + dy}) rotate({rot})">
<rect x="-56" y="-70" width="112" height="140" rx="14" fill="{col}" fill-opacity=".08" stroke="{TEXT}" stroke-opacity=".55" stroke-width="1.5"/>
<path d="M-40 -50 L 30 -64" stroke="{TEXT}" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>
<circle cx="0" cy="8" r="22" fill="none" stroke="{col}" stroke-opacity=".7" stroke-width="1.5"/></g>''')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">{defs()}
{dots(200, 200, 195, 180, 140, 5, TEXT, .28)}
<g filter="url(#glow)">{''.join(out)}
<path d="M30 300 C 120 250, 160 330, 250 280 S 360 240, 390 260" fill="none" stroke="url(#lg)" stroke-width="2"/></g></svg>
'''


def poster6():  # зубна дуга
    teeth = []
    for j in range(16):
        s = (j - 7.5) / 7.5
        th = s * 1.85
        x = 200 + 150 * math.sin(th)
        y = 230 - 120 * math.cos(th * 0.92)
        c = abs(j - 7.5) - 0.5
        w = [16, 13, 14, 14, 14, 20, 19, 18][int(c)]
        lit = j < 11
        col = TEXT if lit else MUTED
        op = .9 if lit else .35
        teeth.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{w:.0f}" ry="{w * 0.8:.0f}" fill="{col}" fill-opacity="{op * .12:.2f}" stroke="{col}" stroke-opacity="{op}" stroke-width="1.6" transform="rotate({math.degrees(th) * .9:.1f} {x:.1f} {y:.1f})"/>')
    arc = []
    for i in range(61):
        s = (i - 30) / 30
        th = s * 1.9
        arc.append(f"{200 + 182 * math.sin(th):.1f} {232 - 150 * math.cos(th * 0.92):.1f}")
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">{defs()}
{dots(200, 200, 190, 160, 70, 9, ROSE, .3)}
<g filter="url(#glow)">{''.join(teeth)}
<path d="M{" L".join(arc)}" fill="none" stroke="url(#lg)" stroke-width="2"/></g></svg>
'''


def favicon():
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="{BG}"/>
<g transform="translate(6 6) scale(.8125)" fill="none" stroke="{MINT}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="{TOOTH}"/></g>
<circle cx="47" cy="17" r="4" fill="{ROSE}"/>
</svg>
'''


if __name__ == "__main__":
    print("Заглушки фото:")
    write("assets/img/placeholder-4x5.svg", placeholder(800, 1000, "4:5"))
    write("assets/img/placeholder-3x2.svg", placeholder(1200, 800, "3:2"))
    write("assets/img/placeholder-4x3.svg", placeholder(1200, 900, "4:3"))
    print("Постери сцен:")
    for i, fn in enumerate([poster1, poster2, poster3, poster4, poster5, poster6], 1):
        write(f"assets/art/scene-{i}.svg", fn())
    print("Іконка:")
    write("assets/favicon.svg", favicon())
