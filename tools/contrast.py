#!/usr/bin/env python3
"""Перевірка палітри «Емалі»: OKLCH -> sRGB (HEX) і контраст WCAG 2.x для кожної пари.

Запуск:  python3 tools/contrast.py
Без залежностей. Кольори мають збігатися з :root у styles.css.
"""
import math

PALETTE = {
    # назва:        (L,     C,     h)
    "--bg":        (0.190, 0.028, 226),   # чорнильно-синій, як рентгенівська плівка
    "--surface":   (0.255, 0.030, 224),   # скляні плашки
    "--text":      (0.955, 0.012, 200),   # перламутрова емаль
    "--muted":     (0.770, 0.026, 212),   # другорядний текст
    "--accent":    (0.740, 0.135, 18),    # корал ясен: головна кнопка
    "--accent-2":  (0.750, 0.120, 168),   # м'ята фтору: деталі, фокус
}

# Зразки шкали кольорів на прайсі (нейтральна емаль, не акцент)
SHADES = {
    "B1":  (0.955, 0.022, 92),
    "A1":  (0.935, 0.030, 85),
    "B2":  (0.920, 0.040, 90),
    "D2":  (0.900, 0.028, 75),
    "A2":  (0.890, 0.042, 80),
    "C1":  (0.875, 0.030, 88),
    "C2":  (0.855, 0.036, 85),
    "D4":  (0.840, 0.040, 72),
}


def oklch_to_srgb(L, C, h):
    a = C * math.cos(math.radians(h))
    b = C * math.sin(math.radians(h))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    lin = (r, g, bl)
    in_gamut = all(-1e-4 <= v <= 1 + 1e-4 for v in lin)

    def enc(v):
        v = min(max(v, 0.0), 1.0)
        return 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055

    return tuple(enc(v) for v in lin), in_gamut


def to_hex(rgb):
    return "#" + "".join(f"{round(c * 255):02X}" for c in rgb)


def from_hex(hx):
    hx = hx.lstrip("#")
    return tuple(int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4))


def luminance(rgb):
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(c1, c2):
    a, b = luminance(c1), luminance(c2)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


HEX = {}
print("Палітра")
for name, lch in {**PALETTE, **{f"shade {k}": v for k, v in SHADES.items()}}.items():
    rgb, ok = oklch_to_srgb(*lch)
    hx = to_hex(rgb)
    HEX[name] = hx
    print(f"  {name:12} oklch({lch[0]:.3f} {lch[1]:.3f} {lch[2]})  {hx}  {'в гамі sRGB' if ok else 'ПОЗА ГАМОЮ'}")

RGB = {k: from_hex(v) for k, v in HEX.items()}

# (передній план, тло, мінімум, де на сторінці)
PAIRS = [
    ("--text", "--bg", 4.5, "основний текст"),
    ("--text", "--surface", 4.5, "текст на скляних плашках"),
    ("--muted", "--bg", 4.5, "підписи, другорядний текст"),
    ("--muted", "--surface", 4.5, "підписи на плашках"),
    ("--bg", "--accent", 4.5, "текст на кнопці «Записатися»"),
    ("--accent", "--bg", 3.0, "коралова кнопка на тлі (межа кнопки)"),
    ("--accent", "--surface", 3.0, "коралова кнопка на плашці"),
    ("--accent-2", "--bg", 4.5, "м'ятні мітки й посилання"),
    ("--accent-2", "--surface", 4.5, "м'ятні мітки на плашках"),
    ("--accent-2", "--bg", 3.0, "кільце фокусу"),
    ("--bg", "--accent-2", 4.5, "текст на м'ятному бейджі"),
    ("--text", "--accent", 1.0, "(довідково) світлий текст на коралі — не використовуємо"),
]
for k in SHADES:
    PAIRS.append(("--bg", f"shade {k}", 4.5, f"текст на зразку {k}"))
PAIRS.append(("--surface", "shade D4", 4.5, "дрібний текст --surface на найтемнішому зразку"))

print("\nКонтраст WCAG 2.x")
fails = 0
for fg, bg, need, where in PAIRS:
    r = contrast(RGB[fg], RGB[bg])
    ok = r >= need
    if not ok and need > 1.0:
        fails += 1
    mark = "OK " if ok else ("—  " if need == 1.0 else "FAIL")
    print(f"  {mark} {fg:>10} на {bg:<10} {r:5.2f}:1  (норма {need}:1)  {where}")

print("\nУсі пари проходять." if not fails else f"\nНе проходять: {fails}")
