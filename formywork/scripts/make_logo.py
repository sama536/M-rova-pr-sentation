"""Génère les fichiers du logo FormyWork (mot-symbole vectorisé depuis la police Fraunces).

Usage : .venv/bin/python scripts/make_logo.py   (nécessite fonttools + brotli et frontend/node_modules)
"""

from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
FONT = ROOT / "frontend/node_modules/@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2"
OUT = ROOT / "frontend/public"
NAVY, CREAM, ORANGE, ORANGE_STRONG = "#14264A", "#FBF5EA", "#F6A560", "#E8793A"

font = TTFont(FONT)
axes = {a.axisTag: a for a in font["fvar"].axes}
loc = {"wght": 620}
if "opsz" in axes:
    loc["opsz"] = 72
if "SOFT" in axes:
    loc["SOFT"] = 100
if "WONK" in axes:
    loc["WONK"] = 0
font = instantiateVariableFont(font, loc)
glyphs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
upem = font["head"].unitsPerEm


def text_paths(text: str, size: float, x0: float, baseline: float, tracking: float = -0.01):
    scale = size / upem
    x = x0
    out = []
    for ch in text:
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        out.append(pen.getCommands())
        x += hmtx[name][0] * scale + tracking * size
    return " ".join(out), x


def mark(bg: str, fg: str, sun: str, x=0.0, y=0.0, s=1.0) -> str:
    # Carré arrondi + un « F » en trait épais dont la barre haute mène vers un soleil levant.
    return (
        f'<g transform="translate({x} {y}) scale({s})">'
        f'<rect x="2" y="2" width="60" height="60" rx="17" fill="{bg}"/>'
        f'<path d="M23 47V24.5C23 21.5 25 19.5 28 19.5H37.5M23 33.5H34" fill="none" stroke="{fg}" '
        f'stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
        f'<circle cx="46" cy="19.5" r="6" fill="{sun}"/>'
        "</g>"
    )


def write(name: str, svg: str) -> None:
    (OUT / name).write_text(svg, encoding="utf-8")
    print("écrit", OUT / name)


OUT.mkdir(parents=True, exist_ok=True)
write("logo-mark.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="FormyWork">'
      f"{mark(NAVY, CREAM, ORANGE)}</svg>")
write("logo-mark-dark.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="FormyWork">'
      f"{mark(CREAM, NAVY, ORANGE_STRONG)}</svg>")
write("favicon.svg",
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><style>'
      f".b{{fill:{NAVY}}}.f{{stroke:{CREAM}}}.s{{fill:{ORANGE}}}"
      f"@media (prefers-color-scheme: dark){{.b{{fill:{CREAM}}}.f{{stroke:{NAVY}}}.s{{fill:{ORANGE_STRONG}}}}}</style>"
      '<rect class="b" x="2" y="2" width="60" height="60" rx="17"/>'
      '<path class="f" d="M23 47V24.5C23 21.5 25 19.5 28 19.5H37.5M23 33.5H34" fill="none" stroke-width="7" '
      'stroke-linecap="round" stroke-linejoin="round"/><circle class="s" cx="46" cy="19.5" r="6"/></svg>')

for variant, (bg, fg, sun, word, word2) in {
    "logo-light.svg": (NAVY, CREAM, ORANGE, NAVY, ORANGE_STRONG),
    "logo-dark.svg": (CREAM, NAVY, ORANGE_STRONG, CREAM, ORANGE),
}.items():
    p1, x_end = text_paths("Formy", 40, 78, 45)
    p2, x_end = text_paths("Work", 40, x_end, 45)
    width = round(x_end + 6)
    write(variant,
          f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 64" role="img" aria-label="FormyWork">'
          f'{mark(bg, fg, sun)}<path d="{p1}" fill="{word}"/><path d="{p2}" fill="{word2}"/></svg>')
