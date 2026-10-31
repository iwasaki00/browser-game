"""MOTHERSHIP 01 / M07: fixed-seed, integer-only UNIFIED 01 pixel artwork.

Writes only assets/mothership-01. No external raster, game data, antialiasing or
gameplay mutation is used. Source pixels are twice the logical world size.
"""
from pathlib import Path
import hashlib
import json
import math
import random
from PIL import Image, ImageDraw
try:
    from .coastal_assets import plate
    from .art_unification import far_sprite
except ImportError:
    from coastal_assets import plate
    from art_unification import far_sprite

SEED = 9009600
INK = '#101625'
EDGE = '#c9d5bd'
STEEL = '#718c99'
TEAL = '#9acabb'
AMBER = '#e3be8d'
PURPLE = '#927e9a'
SCENES = ('shell', 'hangar', 'fusion', 'network', 'command')
ACTORS = {'commanddrone': (32, 26), 'phasestalker': (32, 32),
          'assaulttitan': (56, 48), 'commandcore': (176, 112),
          'commanddevice': (28, 32)}
STATES = ['idle', 'move', 'attack', 'death', 'hit', 'open', 'damaged', 'phase']
EFFECTS = ('command', 'shield', 'phase', 'strike', 'break', 'signal')


def line(d, points, color, width=1):
    d.line([(round(x), round(y)) for x, y in points], fill=color, width=width)


def panel(d, box, color=STEEL):
    x, y, x2, y2 = box
    plate(d, [(x, y + 6), (x + 6, y), (x2 - 5, y), (x2, y + 6),
              (x2, y2 - 5), (x2 - 6, y2), (x + 5, y2), (x, y2 - 5)], color)


def background(scene):
    rng = random.Random(SEED + (SCENES.index(scene) if scene in SCENES else 9) * 233)
    im = Image.new('RGBA', (640, 360), '#182332'); d = ImageDraw.Draw(im)
    for y, col in ((0, '#17202e'), (54, '#202e40'), (139, '#29384a'),
                   (218, '#263340'), (288, '#202b38')):
        d.rectangle((0, y, 639, 359), fill=col)
    for x in range(-30, 680, 106):
        d.polygon([(x, 0), (x + 20, 0), (x + 43, 98), (x + 31, 242),
                   (x + 45, 360), (x + 20, 360), (x + 8, 245), (x + 19, 101)], fill='#344151')
        line(d, [(x + 7, 1), (x + 28, 101), (x + 18, 246)], '#52616c', 2)
    # Low-contrast hardware behind the combat plane, sparse amber/teal indicators.
    for n in range(20):
        x = rng.randrange(2, 610); y = rng.randrange(18, 270)
        w = rng.randrange(12, 29)
        d.rectangle((x, y, x + w, y + 9), fill='#2c3d4c', outline='#445562')
        if n % 4 == 0:
            d.rectangle((x + 3, y + 3, x + 7, y + 4), fill='#758c84')
    if scene == 'shell':
        # Breach through the outer hull: star-black gap, layered armored ribs.
        d.polygon([(187, 0), (453, 0), (422, 37), (433, 73), (394, 108),
                   (397, 160), (349, 198), (290, 198), (244, 164),
                   (252, 113), (211, 83), (220, 43)], fill='#080f20')
        for x, y in ((247, 23), (367, 45), (321, 104), (281, 69), (382, 119)):
            d.rectangle((x, y, x + 1, y + 1), fill='#9cb3b5')
        for side in (-1, 1):
            for k in range(3):
                x = 320 + side * (111 + k * 48)
                panel(d, (x - 19, 32 + k * 12, x + 23, 255 - k * 13), '#526575')
                line(d, [(x - 6, 48 + k * 12), (x + 7, 230 - k * 13)], '#7b8d93', 2)
    elif scene == 'hangar':
        for x in (28, 224, 420):
            panel(d, (x, 29, x + 162, 236), '#3d5263')
            d.rectangle((x + 14, 47, x + 148, 214), fill='#172b3c')
            for yy in range(56, 208, 24):
                line(d, [(x + 16, yy), (x + 145, yy)], '#2f4556', 3)
            # Parked silhouettes remain darker than live drones.
            d.polygon([(x + 40, 137), (x + 68, 111), (x + 111, 121),
                       (x + 132, 152), (x + 109, 172), (x + 45, 163)], fill='#49616b')
            line(d, [(x + 52, 145), (x + 114, 148)], '#81988d', 2)
        for x in range(0, 640, 72):
            line(d, [(x, 12), (x + 46, 12), (x + 46, 31)], '#687976', 3)
    elif scene == 'fusion':
        for x in (103, 320, 537):
            panel(d, (x - 55, 20, x + 55, 262), '#48596b')
            d.rectangle((x - 33, 45, x + 33, 237), fill='#243f48', outline='#78968f', width=3)
            for yy in range(61, 229, 29):
                d.rectangle((x - 23, yy, x + 23, yy + 11), fill='#648c83')
                line(d, [(x - 14, yy + 3), (x + 13, yy + 3)], '#adc3a2', 2)
            for side in (-1, 1):
                line(d, [(x + side * 52, 31), (x + side * 75, 31),
                         (x + side * 75, 271)], '#526574', 6)
        d.rectangle((0, 275, 639, 290), fill='#2d424b')
    elif scene == 'network':
        for x, y in ((110, 73), (320, 155), (531, 77)):
            for dx, dy in ((-77, -25), (76, -31), (-84, 68), (88, 64)):
                line(d, [(x, y), (x + dx // 2, y + dy), (x + dx, y + dy)], '#4d6970', 5)
                line(d, [(x, y), (x + dx // 2, y + dy), (x + dx, y + dy)], '#789a92', 1)
            panel(d, (x - 31, y - 33, x + 31, y + 35), '#536a7a')
            d.ellipse((x - 13, y - 13, x + 13, y + 13), fill='#537d7b', outline='#a7bda5', width=2)
    elif scene == 'command':
        # Symmetric cradle frames but does not duplicate the actual boss/core.
        for side in (-1, 1):
            for k in range(3):
                x = 320 + side * (112 + k * 51)
                line(d, [(x, 0), (x + side * 20, 104),
                         (x - side * 21, 237), (x + side * 6, 320)], '#45566a', 19)
                line(d, [(x - side * 3, 0), (x + side * 16, 105),
                         (x - side * 25, 236)], '#697c89', 3)
        d.ellipse((224, 43, 416, 283), outline='#394b60', width=5)
        for x in (249, 388):
            d.rectangle((x, 77, x + 3, 230), fill='#728c91')
    else:
        # Quiet, unreadable transmission; M08 foreshadow only, no new enemy art.
        for k in range(5):
            r = 31 + k * 29
            d.ellipse((320 - r, 161 - r // 2, 320 + r, 161 + r // 2), outline='#526473', width=2)
        line(d, [(203, 160), (270, 160), (287, 134), (309, 184),
                 (336, 146), (354, 161), (437, 161)], '#91b6ac', 3)
        d.rectangle((313, 145, 328, 162), fill='#b9cbb3')
    d.rectangle((0, 324, 639, 359), fill='#192532')
    line(d, [(0, 326), (639, 326)], '#697b80', 3)
    for x in range(0, 640, 32):
        line(d, [(x, 330), (x - 8, 359)], '#354651', 2)
    return im


def actor(kind, f):
    w, h = ACTORS[kind]; im = Image.new('RGBA', (w * 2, h * 2)); d = ImageDraw.Draw(im)
    s = f % 2
    if kind == 'commanddrone':
        for side in (-1, 1):
            panel(d, (32 + side * 17 - 12, 11 + s * 2, 32 + side * 17 + 11, 30 + s * 2), '#728a96')
            line(d, [(32 + side * 18, 28), (32 + side * 23, 40 + s * 3)], INK, 5)
            line(d, [(32 + side * 18, 28), (32 + side * 23, 39 + s * 3)], TEAL, 2)
        panel(d, (18, 7, 46, 38), '#9a939f')
        d.rectangle((22, 17, 42, 24), fill=INK)
        d.rectangle((25, 19, 39, 21), fill=AMBER if f == 2 else TEAL)
        line(d, [(32, 6), (32, 1), (42, 1)], EDGE, 2)
        line(d, [(27, 38), (25, 49), (38, 49), (36, 38)], '#9cb4ae', 2)
        if f == 2:
            d.polygon([(28, 40), (32, 51), (37, 40)], fill=AMBER)
    elif kind == 'phasestalker':
        # Asymmetric crouched blade legs; never reads as a floating drone.
        for side in (-1, 1):
            leg = [(32 + side * 7, 38), (32 + side * (18 + s * 2), 47), (32 + side * (21 - s * 3), 63)]
            line(d, leg, INK, 7); line(d, leg, '#a1b9b8', 3)
            line(d, [(32 + side * 11, 23), (32 + side * 25, 36), (32 + side * 30, 29)], INK, 5)
            line(d, [(32 + side * 11, 23), (32 + side * 25, 36), (32 + side * 30, 29)], '#b9c8b7', 2)
        panel(d, (20, 12, 45, 45), '#7f7998')
        plate(d, [(17, 13), (27, 2), (45, 7), (50, 21), (35, 27), (20, 24)], '#8ca5a9')
        d.rectangle((21, 14, 38, 17), fill=AMBER if f == 2 else '#b9e0ca')
        if f == 7:
            line(d, [(7, 16), (13, 16), (13, 43), (6, 43)], '#8eb4b8', 2)
            line(d, [(54, 10), (60, 10), (60, 38), (54, 38)], '#8eb4b8', 2)
    elif kind == 'assaulttitan':
        for side in (-1, 1):
            for n in range(2):
                x = 56 + side * (18 + n * 13)
                leg = [(x, 53), (x + side * (8 + s * 2), 73), (x + side * (13 - s), 94)]
                line(d, leg, INK, 11); line(d, leg, '#829d9e', 5)
                d.rectangle((leg[-1][0] - 7, 90, leg[-1][0] + 6, 95), fill='#bdc4ad')
        plate(d, [(13, 41), (24, 12), (55, 3), (86, 13), (101, 43),
                  (89, 68), (55, 77), (24, 67)], '#7d839c')
        for x in (34, 56, 78):
            panel(d, (x - 11, 17, x + 11, 59), '#8aa0a1')
        panel(d, (2, 45, 39, 69), '#aba69d')
        d.rectangle((7, 50, 31, 54), fill=AMBER if f == 2 else TEAL)
        for x in (69, 88):
            line(d, [(x, 26), (x - 9, 3)], INK, 12)
            line(d, [(x, 26), (x - 9, 3)], '#a7b7b0', 6)
        if f in (5, 6):
            line(d, [(53, 9), (48, 27), (60, 43), (52, 63)], INK, 4)
    elif kind == 'commandcore':
        # Core center source(176,112) -> world(e.x,e.y+32), top offset -24.
        for side in (-1, 1):
            for n in range(4):
                root = (176 + side * 45, 110 + n * 9)
                joint = (176 + side * (92 + n * 17), 72 + n * 29)
                tip = (176 + side * (125 + n * 13), 34 + n * 60)
                line(d, [root, joint, tip], INK, 17)
                line(d, [root, joint, tip], '#718694', 11)
                line(d, [root, joint], '#c3c7b2', 3)
                d.ellipse((joint[0] - 7, joint[1] - 7, joint[0] + 7, joint[1] + 7), fill='#9ab4ad', outline=INK, width=2)
            plate(d, [(176 + side * 31, 52), (176 + side * 86, 17),
                      (176 + side * 132, 43), (176 + side * 149, 100),
                      (176 + side * 113, 144), (176 + side * 43, 146)], '#7f819a')
            for n in range(3):
                x = 176 + side * (63 + n * 26)
                line(d, [(x, 44 + n * 9), (x + side * 15, 75 + n * 7), (x + side * 6, 105 + n * 4)], '#c4c9b8', 3)
        plate(d, [(131, 36), (157, 3), (197, 3), (224, 36), (246, 108),
                  (224, 184), (176, 214), (126, 182), (106, 109)], '#7d929b')
        d.polygon([(149, 38), (176, 27), (206, 38), (198, 59), (155, 59)], fill=INK)
        for x in (156, 184):
            d.rectangle((x, 42, x + 12, 46), fill=AMBER if f == 2 else EDGE)
        d.ellipse((124, 60, 228, 164), fill=INK, outline=EDGE, width=4)
        d.ellipse((132, 68, 220, 156), fill='#304555', outline='#8ca7ab', width=3)
        if f in (5, 6):
            d.ellipse((143, 79, 209, 145), fill='#7e9c94', outline='#dce1bd', width=3)
            d.polygon([(176, 84), (200, 112), (176, 139), (152, 112)], fill='#e7c996')
            d.rectangle((169, 103, 183, 121), fill='#f5e9c1')
        else:
            for side in (-1, 1):
                plate(d, [(176, 70), (176 + side * 36, 80), (176 + side * 37, 142), (176, 153)], '#78999d')
            line(d, [(176, 72), (176, 150)], '#cadac6', 3)
            for yy in (91, 112, 132):
                line(d, [(151, yy), (176, yy + 5), (201, yy)], '#a9c9bf', 2)
        if f in (3, 6):
            for side in (-1, 1):
                line(d, [(176 + side * 69, 35), (176 + side * 59, 65),
                         (176 + side * 77, 94)], INK, 5)
    else:
        panel(d, (6, 9, 50, 53), '#7e8e9f')
        line(d, [(28, 4), (28, 0)], '#a9c8bb', 3)
        d.ellipse((14, 17, 42, 45), fill=INK, outline=EDGE, width=2)
        d.ellipse((20, 23, 36, 39), fill=AMBER if f in (2, 5) else TEAL)
        panel(d, (13, 50, 44, 63), '#5b7184')
        for side in (-1, 1):
            line(d, [(28 + side * 10, 14), (28 + side * 23, 5), (28 + side * 25, 19)], '#9bb8b3', 2)
    if f == 3:
        line(d, [(w * .65, h * .35), (w * .94, h * .7), (w * .8, h * 1.5)], INK, 4)
        line(d, [(w * .72, h * .4), (w * 1.1, h * .72)], AMBER, 2)
    if f == 4:
        d.rectangle((w - 7, 4, w + 7, 6), fill='#f3e8bd')
    return im


def tiles():
    im = Image.new('RGBA', (256, 64)); d = ImageDraw.Draw(im)
    for i in range(16):
        x = i % 8 * 32; y = i // 8 * 32
        d.rectangle((x, y, x + 31, y + 31), fill=('#4f6676', '#364e61', '#6d7589', '#496e78')[i % 4])
        line(d, [(x, y + 1), (x + 31, y + 1)], EDGE if i < 8 else '#9cb7ae', 2)
        line(d, [(x, y + 30), (x + 31, y + 30)], INK, 2)
        if i % 5 == 0:
            panel(d, (x + 3, y + 6, x + 28, y + 26), '#6e8591')
            d.rectangle((x + 10, y + 13, x + 20, y + 16), fill='#a8c2ac')
        elif i % 5 == 1:
            for yy in (10, 22):
                line(d, [(x + 2, y + yy), (x + 29, y + yy)], '#7e989d', 2)
        elif i % 5 == 2:
            for xx in (6, 15, 24):
                line(d, [(x + xx, y + 5), (x + xx, y + 27)], '#1d3043', 3)
                line(d, [(x + xx + 2, y + 6), (x + xx + 2, y + 26)], '#a0aca6')
        elif i % 5 == 3:
            line(d, [(x + 3, y + 27), (x + 3, y + 8), (x + 16, y + 8),
                     (x + 16, y + 24), (x + 29, y + 24)], '#acd2bb', 2)
        else:
            line(d, [(x + 2, y + 12), (x + 11, y + 6), (x + 21, y + 22), (x + 30, y + 17)], '#9eb4a8', 3)
        d.rectangle((x + 3, y + 3, x + 4, y + 4), fill=EDGE)
    return im


def effects(name):
    im = Image.new('RGBA', (512, 64)); d = ImageDraw.Draw(im)
    for f in range(8):
        rng = random.Random(SEED + f * 313)
        cx, cy, r = f * 64 + 32, 32, 5 + f * 3
        if name == 'command':
            for n in range(3):
                rr = max(2, r - n * 6)
                d.arc((cx - rr, cy - rr, cx + rr, cy + rr), 203, 337, fill=TEAL, width=2)
            d.rectangle((cx - 3, cy - 3, cx + 3, cy + 3), fill=EDGE)
        elif name == 'shield':
            d.polygon([(cx, cy - r), (cx + r, cy - r // 2), (cx + r, cy + r // 2),
                       (cx, cy + r), (cx - r, cy + r // 2), (cx - r, cy - r // 2)], outline=TEAL, width=2)
            line(d, [(cx - 7, cy), (cx - 1, cy + 5), (cx + 8, cy - 7)], EDGE, 2)
        elif name == 'phase':
            for side in (-1, 1):
                x = cx + side * (r - 2)
                line(d, [(x - side * 5, cy - 18), (x, cy - 18),
                         (x, cy + 18), (x - side * 5, cy + 18)], '#b5b0d0', 2)
            for n in range(4):
                y = cy - 14 + n * 9
                line(d, [(cx - r // 2, y), (cx + r // 2, y)], '#7ca7b4')
        elif name == 'strike':
            line(d, [(cx - r, cy), (cx + r, cy)], AMBER, 2)
            line(d, [(cx, cy - r), (cx, cy + r)], AMBER, 2)
            if f < 4:
                d.polygon([(cx, cy - r), (cx + r // 2, cy), (cx, cy + r), (cx - r // 2, cy)], fill='#f1ddac')
        elif name == 'signal':
            line(d, [(cx - 26, cy), (cx - 11, cy), (cx - 4, cy - 9),
                     (cx + 4, cy + 9), (cx + 12, cy), (cx + 26, cy)], TEAL, 2)
            d.rectangle((cx - 2, cy - 2, cx + 2, cy + 2), fill=EDGE)
        else:
            d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=AMBER, width=3)
            if f < 5:
                d.ellipse((cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2), fill='#ddc295')
            for n in range(8):
                angle = n * math.tau / 8; rr = r + rng.randrange(0, 5)
                x = cx + round(math.cos(angle) * rr); y = cy + round(math.sin(angle) * rr)
                d.rectangle((x, y, x + 2, y + 2), fill=EDGE if n % 2 else PURPLE)
    return im


def generate(root):
    out = Path(root) / 'assets/mothership-01'; records = []
    def save(path, im, cell, logical, states, anchor=None):
        target = out / path; target.parent.mkdir(parents=True, exist_ok=True)
        im.save(target, optimize=True)
        records.append({'path': path, 'size': list(im.size), 'cell': list(cell),
                        'logicalCell': list(logical), 'frames': len(states), 'states': states,
                        'anchor': anchor or {'topLeft': [0, 0]},
                        'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    for scene in (*SCENES, 'signal'):
        save('backgrounds/' + scene + '.png', background(scene), (640, 360), (320, 180), [scene])
    save('tiles/mothership.png', tiles(), (32, 32), (16, 16), ['tile' + str(i) for i in range(16)])
    for kind, (w, h) in ACTORS.items():
        sheet = Image.new('RGBA', (w * 16, h * 2))
        for f in range(8):
            sheet.alpha_composite(actor(kind, f), (f * w * 2, 0))
        anchor = {'centerX': 0, 'topOffset': -24, 'coreCenter': [0, 32]} if kind == 'commandcore' else {'centerX': 0, 'feet': h}
        for far in (False, True):
            save(('far/' if far else 'sprites/') + kind + '.png', far_sprite(sheet) if far else sheet,
                 (w * 2, h * 2), (w, h), STATES, anchor)
    for name in EFFECTS:
        save('effects/' + name + '.png', effects(name), (64, 64), (32, 32), [name + ':' + str(f) for f in range(8)])
    contact = Image.new('RGB', (1280, 1060), '#17202e'); d = ImageDraw.Draw(contact)
    d.text((12, 10), 'MOTHERSHIP 01 / ASSET CONTACT ONLY - NOT A GAME SCREENSHOT', fill=EDGE)
    for n, scene in enumerate((*SCENES, 'signal')):
        x = 10 + n % 3 * 422; y = 35 + n // 3 * 260
        contact.paste(background(scene).resize((416, 234), Image.Resampling.NEAREST), (x, y))
        d.text((x, y + 238), scene.upper(), fill=EDGE)
    x = 15
    for kind in ACTORS:
        im = actor(kind, 5 if kind == 'commandcore' else 0)
        contact.paste(im, (x, 585), im)
        d.text((x, 585 + im.height + 7), kind.upper(), fill=EDGE)
        x += im.width + 25
    contact.paste(tiles(), (15, 865))
    for n, name in enumerate(EFFECTS):
        im = effects(name).crop((192, 0, 256, 64)); x = 320 + n * 145
        contact.paste(im, (x, 865), im); d.text((x, 937), name.upper(), fill=EDGE)
    d.text((15, 1010), 'UNIFIED 01 / SOURCE SCALE 2 / NEAREST / SEED 9009600 / PREVIOUS ASSETS UNTOUCHED', fill=EDGE)
    save('contact-sheet.png', contact, contact.size, contact.size, ['preview'])
    catalog = {'version': '0.9.0', 'style': 'UNIFIED 01 / MOTHERSHIP 01', 'seed': SEED,
               'sourceScale': 2, 'sampling': 'nearest', 'generator': 'tools/mothership_assets.py',
               'missions': ['M07'], 'assets': records,
               'tileIndex': {'hull': 0, 'ceiling': 1, 'container': 2, 'gate': 3, 'biofield': 4},
               'notes': ['Only assets/mothership-01 is written.',
                         'Art never changes hitboxes, AI or weapon origins.',
                         'Command core source center (176,112), world (e.x,e.y+32), top offset -24.',
                         'Far sheets preserve exact alpha and anchors.',
                         'Signal background is a non-playable transmission hint, not M08 content.']}
    (out / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'MOTHERSHIP 01: {len(records)} PNGs / {sum(r["frames"] for r in records)} cells / seed {SEED}')
    return catalog


if __name__ == '__main__':
    generate(Path(__file__).resolve().parents[1])
