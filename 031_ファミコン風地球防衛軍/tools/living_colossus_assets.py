"""LIVING COLOSSUS 01: deterministic M06 pixel art, isolated from prior sets.

All drawing is integer/nearest-neighbor Pillow artwork at two source pixels per
world pixel. No external raster input or game data is loaded by this generator.
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

SEED = 6008400
INK = '#101420'
IVORY = '#d7dac1'
TEAL = '#91c9ba'
SHELL = '#668a88'
REAR = '#302333'
AMBER = '#e3bd87'
ACTORS = {'pulseworm': (36, 24), 'sporefly': (30, 24),
          'guardiancell': (42, 38), 'neuralheart': (160, 104),
          'neuralnode': (24, 28), 'bioshell': (28, 64)}
SCENES = ('entrance', 'pulse', 'fluid', 'neural', 'heart')
STATES = ['idle', 'move', 'attack', 'death', 'hit', 'open', 'damaged', 'idle']
EFFECTS = ('flow', 'foam', 'signal', 'spore', 'pulse', 'collapse', 'shield')


def line(d, points, color, width=1):
    d.line([(round(x), round(y)) for x, y in points], fill=color, width=width)


def rib(d, points, width=10, color='#695260'):
    line(d, points, INK, width + 4)
    line(d, points, color, width)
    line(d, [(x - 1, y - 2) for x, y in points], '#9b7b82', max(1, width // 4))


def background(scene):
    rng = random.Random(SEED + SCENES.index(scene) * 743)
    im = Image.new('RGBA', (640, 360), '#211e2c')
    d = ImageDraw.Draw(im)
    # Broad value planes, deliberately restrained behind world combat band.
    for y, color in ((0, '#211d2b'), (52, '#302334'), (118, '#382838'),
                     (214, '#302733'), (285, '#25252f')):
        d.rectangle((0, y, 639, 359), fill=color)
    for x in range(-80, 710, 128):
        d.polygon([(x, 0), (x + 55, 0), (x + 112, 93), (x + 92, 151),
                   (x + 143, 257), (x + 110, 360), (x + 73, 360),
                   (x + 98, 259), (x + 59, 157), (x + 69, 96)], fill='#3e2c3d')
        line(d, [(x + 44, 0), (x + 89, 94), (x + 74, 151), (x + 120, 261)], '#59404e', 3)
    # Repeated rear tissue cells have many low-contrast details, not bright noise.
    for n in range(34):
        x = rng.randrange(640); y = rng.randrange(30, 300)
        w = rng.randrange(8, 24); h = rng.randrange(4, 13)
        d.ellipse((x, y, x + w, y + h), outline='#4b3546', width=2)
    if scene == 'entrance':
        for side in (-1, 1):
            pts = [(320 + side * 302, -20), (320 + side * 277, 85),
                   (320 + side * 221, 143), (320 + side * 242, 228),
                   (320 + side * 298, 346)]
            rib(d, pts, 35, '#536668')
            for y in (58, 141, 250):
                x = 320 + side * (250 if y != 141 else 218)
                plate(d, [(x - 24, y - 20), (x + 25, y - 16), (x + 32, y + 20), (x - 20, y + 28)], '#687b78')
        d.polygon([(269, 0), (350, 0), (325, 45), (340, 64), (302, 98), (309, 57), (294, 44)], fill='#091521')
        line(d, [(275, 0), (301, 41), (315, 55), (306, 91)], '#829b93', 3)
        # Evidence of the military expedition outside the shell.
        d.rectangle((215, 291, 425, 312), fill='#1c3038', outline='#758b86', width=2)
        for x in range(227, 421, 29):
            line(d, [(x, 295), (x + 12, 304)], '#b2ad8b', 2)
    elif scene == 'pulse':
        for x in (50, 230, 410, 590):
            rib(d, [(x - 13, 4), (x + 15, 62), (x - 16, 139), (x + 15, 222), (x - 7, 302)], 24)
            for y in (44, 120, 206):
                d.ellipse((x - 25, y - 8, x + 24, y + 9), fill='#4f3e50', outline='#8a6878', width=2)
        line(d, [(0, 258), (120, 249), (250, 263), (410, 248), (640, 257)], '#775264', 7)
        line(d, [(0, 259), (120, 250), (250, 264), (410, 249), (640, 258)], '#a97885', 2)
    elif scene == 'fluid':
        for x in (41, 298, 532):
            rib(d, [(x, -10), (x + 21, 77), (x - 8, 134), (x + 28, 237), (x + 14, 318)], 32, '#435862')
            for y in range(32, 270, 49):
                line(d, [(x - 7, y), (x + 10, y + 5), (x + 19, y - 1)], '#78948d', 2)
        d.polygon([(0, 260), (90, 245), (218, 269), (358, 247), (477, 262), (640, 245), (640, 360), (0, 360)], fill='#28454b')
        for y in (279, 299, 327):
            for x in range(-30 + y % 23, 640, 82):
                line(d, [(x, y), (x + 21, y - 2), (x + 45, y)], '#527774', 2)
    elif scene == 'neural':
        for x, y in ((105, 81), (321, 142), (545, 76)):
            for side in (-1, 1):
                rib(d, [(x, y), (x + side * 52, y - 29), (x + side * 91, y - 22)], 7, '#4b646a')
                rib(d, [(x, y), (x + side * 43, y + 67), (x + side * 94, y + 91)], 6, '#4b646a')
            d.ellipse((x - 18, y - 23, x + 18, y + 22), fill='#263c46', outline='#758d8a', width=3)
            d.ellipse((x - 7, y - 11, x + 7, y + 10), fill='#80aca2')
        line(d, [(0, 290), (105, 278), (218, 296), (321, 279), (428, 295), (545, 279), (639, 291)], '#566269', 6)
    else:
        # Cavern cradle leaves center calm; the actual core is an actor, not
        # baked into the backdrop or duplicated on each repeated background.
        for side in (-1, 1):
            for k in range(4):
                rib(d, [(320 + side * 43, 338), (320 + side * (77 + k * 35), 254 - k * 13),
                        (320 + side * (135 + k * 29), 140 - k * 12), (320 + side * (110 + k * 46), -20)],
                    14, '#534353')
        d.ellipse((250, 78, 390, 267), outline='#483347', width=5)
        d.ellipse((278, 111, 362, 237), outline='#413144', width=2)
    d.rectangle((0, 329, 639, 359), fill='#20272e')
    for x in range(0, 640, 47):
        line(d, [(x, 340), (x + 17, 332), (x + 36, 339)], '#55665f', 2)
    return im


def actor(kind, frame):
    w, h = ACTORS[kind]
    im = Image.new('RGBA', (w * 2, h * 2)); d = ImageDraw.Draw(im)
    shift = frame % 2
    if kind == 'pulseworm':
        # Low, segmented armored caterpillar. Legs end at the exact foot anchor.
        for k in range(5):
            x = 13 + k * 11
            line(d, [(x, 31), (x - 4 + shift * 3, 40), (x - 7 + shift * 2, 47)], INK, 6)
            line(d, [(x, 31), (x - 4 + shift * 3, 40), (x - 7 + shift * 2, 46)], IVORY, 2)
        for k in range(5, -1, -1):
            x = 8 + k * 10; y = 10 + abs(k - 2) * 2
            plate(d, [(x - 5, y + 15), (x - 3, y + 2), (x + 7, y - 2), (x + 15, y + 6), (x + 13, y + 24)], '#72978f')
            line(d, [(x + 2, y + 6), (x + 10, y + 9)], '#c7d7b9', 2)
        plate(d, [(1, 21), (9, 14), (22, 18), (23, 32), (9, 39), (1, 33)], '#9baba1')
        d.rectangle((3, 23, 11, 26), fill=AMBER if frame == 2 else '#d9e9bf')
        line(d, [(3, 34), (13, 35), (20, 30)], INK, 2)
        if frame == 2:
            line(d, [(1, 29), (10, 29)], '#f2cb90', 3)
    elif kind == 'sporefly':
        # Broad folded membranous wings versus the worm's horizontal segments.
        for side in (-1, 1):
            wing = [(30, 20), (30 + side * 10, 4 + shift * 8),
                    (30 + side * 27, 3 + shift * 14), (30 + side * 22, 27), (30 + side * 11, 30)]
            plate(d, wing, '#6f9a9c')
            line(d, [(30, 22), (30 + side * 11, 13 + shift * 6), (30 + side * 24, 9 + shift * 12)], IVORY, 2)
            line(d, [(30 + side * 7, 24), (30 + side * 17, 22)], '#385968', 3)
            line(d, [(30 + side * 5, 33), (30 + side * 12, 41), (30 + side * 17, 44)], '#b9c9b0', 2)
        plate(d, [(24, 11), (34, 10), (40, 25), (35, 37), (25, 37), (21, 24)], '#8ca88f')
        d.ellipse((25, 27, 35, 42), fill='#6f7a9b', outline=IVORY, width=2)
        d.rectangle((24, 17, 29, 20), fill=AMBER if frame == 2 else '#e2e4b9')
        line(d, [(28, 11), (21, 5)], IVORY, 2)
        if frame == 2:
            d.ellipse((27, 37, 33, 46), fill='#d9d1a9')
    elif kind == 'guardiancell':
        for side in (-1, 1):
            for k in range(3):
                x = 42 + side * (8 + k * 9)
                pts = [(x, 41), (x + side * 4, 54 + shift * 2), (x + side * 10, 73)]
                line(d, pts, INK, 8); line(d, pts, '#b0bca6', 3)
                d.rectangle((x + side * 10 - 5, 71, x + side * 10 + 5, 75), fill='#6f9290')
        plate(d, [(9, 35), (16, 12), (39, 2), (64, 10), (76, 29), (72, 51), (42, 60), (15, 52)], '#657e91')
        for x in (24, 42, 60):
            plate(d, [(x - 10, 21), (x - 3, 9), (x + 10, 19), (x + 12, 39), (x, 49), (x - 12, 39)], '#819b9d')
        plate(d, [(2, 38), (15, 29), (31, 36), (30, 50), (11, 58), (1, 50)], '#afbaaa')
        d.rectangle((5, 38, 17, 41), fill=AMBER if frame == 2 else '#d9e2b7')
        line(d, [(3, 51), (13, 53), (22, 47)], INK, 3)
        if frame in (5, 6):
            line(d, [(41, 9), (35, 26), (44, 35), (36, 50)], INK, 4)
    elif kind == 'neuralheart':
        # Exact weakpoint center (160,128) source -> (e.x,e.y+40) world.
        for side in (-1, 1):
            for k in range(4):
                x = 160 + side * (32 + k * 25)
                rib(d, [(160 + side * 33, 139), (x, 167 - k * 11),
                        (x + side * 18, 201 - k * 7)], 13, '#729191')
            rib(d, [(160 + side * 32, 68), (160 + side * 89, 41), (160 + side * 132, 11)], 16, '#62878b')
            plate(d, [(160 + side * 32, 37), (160 + side * 77, 18),
                      (160 + side * 105, 50), (160 + side * 90, 102), (160 + side * 45, 98)], '#749293')
        plate(d, [(102, 38), (130, 7), (187, 8), (220, 45), (231, 113),
                  (213, 175), (163, 197), (111, 175), (91, 115)], '#7d859b')
        for x in (117, 195):
            line(d, [(x, 43), (x - 7, 82), (x + 4, 103)], '#c8ccb4', 3)
        d.ellipse((102, 70, 218, 186), fill=INK, outline=IVORY, width=4)
        d.ellipse((111, 79, 209, 177), fill='#334855', outline='#829da4', width=3)
        if frame in (5, 6):
            d.ellipse((124, 92, 196, 164), fill='#b2bb92', outline='#e8dfbb', width=3)
            d.ellipse((137, 105, 183, 151), fill='#edcf9a')
            d.polygon([(160, 109), (175, 127), (160, 147), (145, 128)], fill='#fbebbd')
            for side in (-1, 1):
                line(d, [(160 + side * 28, 109), (160 + side * 40, 96),
                         (160 + side * 45, 80)], '#182734', 7)
        else:
            for side in (-1, 1):
                plate(d, [(160, 81), (160 + side * 41, 88), (160 + side * 45, 157), (160, 178)], '#74969c')
            line(d, [(160, 83), (160, 175)], '#b6d5c4', 3)
            for y in (103, 127, 151):
                line(d, [(132, y), (160, y + 7), (188, y)], '#b8cdc1', 2)
        # Readable face above core, distinct from the bright damageable nucleus.
        d.polygon([(137, 47), (160, 36), (185, 47), (179, 67), (141, 67)], fill=INK)
        for x in (144, 167):
            d.rectangle((x, 51, x + 9, 54), fill=AMBER if frame == 2 else '#d7e6bf')
        if frame == 6:
            for x in (111, 203):
                line(d, [(x, 28), (x - 7, 48), (x + 8, 64), (x - 3, 85)], INK, 5)
    elif kind == 'neuralnode':
        rib(d, [(24, 54), (17, 45), (26, 35)], 7, '#5d7c81')
        plate(d, [(9, 14), (20, 3), (34, 7), (43, 21), (37, 39), (22, 44), (7, 33)], '#759698')
        d.ellipse((13, 13, 35, 35), fill=INK, outline=IVORY, width=2)
        d.ellipse((18, 18, 30, 30), fill=AMBER if frame in (2, 5) else '#9ed9bd')
        line(d, [(24, 10), (24, 4)], IVORY, 2)
        if frame == 5:
            line(d, [(11, 22), (18, 22), (22, 16), (27, 29), (31, 23), (37, 23)], '#e9e8bd', 2)
    else:
        # Shootable organic shell: tall asymmetric seam, no mechanical-door art.
        for k in range(5):
            y = 7 + k * 24
            plate(d, [(5, y + 3), (30, y - 5), (50, y + 7), (49, y + 25),
                      (27, y + 31), (4, y + 24)], '#759390' if k % 2 else '#607d85')
            line(d, [(11, y + 5), (26, y + 1), (44, y + 8)], '#bcc9ae', 2)
        line(d, [(28, 3), (24, 29), (32, 49), (22, 71), (29, 95), (24, 125)], INK, 4)
        if frame in (5, 6):
            line(d, [(28, 3), (20, 30), (36, 49), (18, 72), (33, 96), (24, 125)], AMBER, 3)
    if frame == 3:
        line(d, [(w * .52, h * .37), (w * .8, h * .8), (w * .6, h * 1.5)], INK, 4)
        line(d, [(w * .57, h * .42), (w * .9, h * .72)], AMBER, 2)
    if frame == 4:
        d.rectangle((w - 7, 4, w + 7, 6), fill='#f9e4be')
    return im


def tiles():
    im = Image.new('RGBA', (256, 64)); d = ImageDraw.Draw(im)
    for i in range(16):
        x = i % 8 * 32; y = i // 8 * 32
        d.rectangle((x, y, x + 31, y + 31), fill=('#52666b', '#3b4f59', '#726578', '#567b7b')[i % 4])
        line(d, [(x, y + 2), (x + 12, y), (x + 23, y + 3), (x + 31, y + 1)], IVORY if i < 8 else '#99b7aa', 2)
        line(d, [(x, y + 29), (x + 31, y + 31)], INK, 2)
        if i % 4 == 0:
            plate(d, [(x + 4, y + 10), (x + 16, y + 6), (x + 29, y + 13), (x + 24, y + 25), (x + 8, y + 24)], '#668189')
        elif i % 4 == 1:
            line(d, [(x + 1, y + 13), (x + 11, y + 9), (x + 20, y + 17), (x + 30, y + 12)], '#839f91', 2)
        elif i % 4 == 2:
            for dx in (6, 16, 26):
                line(d, [(x + dx, y + 5), (x + dx - 3, y + 15), (x + dx + 1, y + 27)], '#b399aa', 2)
        else:
            line(d, [(x + 2, y + 22), (x + 10, y + 15), (x + 20, y + 18), (x + 30, y + 9)], '#b1d2bd', 2)
            d.rectangle((x + 17, y + 15, x + 21, y + 19), fill=IVORY)
    return im


def effects(name):
    im = Image.new('RGBA', (512, 64)); d = ImageDraw.Draw(im)
    for f in range(8):
        rng = random.Random(SEED + f * 137)
        cx = f * 64 + 32; cy = 32; r = 5 + f * 3
        if name == 'flow':
            for n in range(3):
                y = cy - 11 + n * 11
                line(d, [(cx - 22, y), (cx + 19, y)], '#7fb5ac', 2)
                line(d, [(cx + 9, y - 5), (cx + 20, y), (cx + 9, y + 5)], IVORY, 2)
        elif name == 'foam':
            for n in range(7):
                x = cx - 24 + n * 8; y = cy + (n % 3) * 4 - f
                d.rectangle((x, y, x + 3, y + 2), fill=IVORY if n % 2 else TEAL)
        elif name == 'signal':
            line(d, [(cx - 24, cy), (cx - 9, cy), (cx - 3, cy - 8), (cx + 5, cy + 9), (cx + 11, cy), (cx + 24, cy)], TEAL, 3)
            d.rectangle((cx - 3, cy - 3, cx + 3, cy + 3), fill=IVORY)
        elif name == 'spore':
            for n in range(5):
                a = n * math.tau / 5 + f * .12
                x = cx + round(math.cos(a) * r * .8); y = cy + round(math.sin(a) * r * .8)
                d.ellipse((x - 3, y - 3, x + 3, y + 3), fill='#b8c9a4', outline='#667e88')
        elif name == 'shield':
            d.polygon([(cx, cy - r), (cx + r, cy - r // 2), (cx + r, cy + r // 2),
                       (cx, cy + r), (cx - r, cy + r // 2), (cx - r, cy - r // 2)], outline=TEAL, width=2)
            if f < 4:
                line(d, [(cx - 7, cy), (cx - 1, cy + 5), (cx + 8, cy - 7)], IVORY, 2)
        else:
            d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=AMBER if name == 'collapse' else TEAL, width=3)
            if name == 'collapse' and f < 5:
                d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill='#b48278')
                d.ellipse((cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2), fill='#e1c29b')
            for n in range(8):
                a = n * math.tau / 8; rr = r + rng.randrange(2, 8)
                x = cx + round(math.cos(a) * rr); y = cy + round(math.sin(a) * rr)
                d.rectangle((x, y, x + 2, y + 2), fill=IVORY)
    return im


def generate(root):
    dest = Path(root) / 'assets/living-colossus-01'; records = []
    def save(path, im, cell, logical, states, anchor=None):
        target = dest / path; target.parent.mkdir(parents=True, exist_ok=True)
        im.save(target, optimize=True)
        records.append({'path': path, 'size': list(im.size), 'cell': list(cell),
                        'logicalCell': list(logical), 'frames': len(states), 'states': states,
                        'anchor': anchor or {'topLeft': [0, 0]},
                        'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    backgrounds = []
    for name in SCENES:
        im = background(name); backgrounds.append(im)
        save('backgrounds/' + name + '.png', im, (640, 360), (320, 180), [name])
    save('tiles/living.png', tiles(), (32, 32), (16, 16), [f'tile{i}' for i in range(16)])
    for kind, (w, h) in ACTORS.items():
        sheet = Image.new('RGBA', (w * 16, h * 2))
        for f in range(8):
            sheet.alpha_composite(actor(kind, f), (f * w * 2, 0))
        anchor = {'centerX': 0, 'topOffset': -24, 'coreCenter': [0, 40]} if kind == 'neuralheart' else {'centerX': 0, 'feet': h}
        for far in (False, True):
            save(('far/' if far else 'sprites/') + kind + '.png', far_sprite(sheet) if far else sheet,
                 (w * 2, h * 2), (w, h), STATES, anchor)
    for name in EFFECTS:
        save('effects/' + name + '.png', effects(name), (64, 64), (32, 32), [name + ':' + str(f) for f in range(8)])
    contact = Image.new('RGB', (1280, 1120), '#18202b'); d = ImageDraw.Draw(contact)
    d.text((12, 10), 'LIVING COLOSSUS 01 / PROCEDURAL ASSET CONTACT / NOT A GAME SCREENSHOT', fill=IVORY)
    for n, bg in enumerate(backgrounds):
        x = n % 3 * 420 + 10; y = n // 3 * 260 + 35
        contact.paste(bg.resize((416, 234), Image.Resampling.NEAREST), (x, y))
        d.text((x, y + 238), SCENES[n].upper(), fill=IVORY)
    x = 16; y = 590
    for kind in ACTORS:
        im = actor(kind, 5 if kind == 'neuralheart' else 0)
        contact.paste(im, (x, y), im)
        d.text((x, y + im.height + 5), kind.upper(), fill=IVORY)
        x += im.width + 25
    contact.paste(tiles(), (16, 850))
    for n, name in enumerate(EFFECTS):
        im = effects(name).crop((192, 0, 256, 64))
        contact.paste(im, (320 + n * 130, 850), im)
        d.text((320 + n * 130, 920), name.upper(), fill=IVORY)
    d.text((16, 1010), 'SOURCE SCALE 2 / NEAREST / FIXED SEED 6008400 / OLD ASSETS NOT MODIFIED', fill=IVORY)
    save('contact-sheet.png', contact, contact.size, contact.size, ['preview'])
    catalog = {'version': '0.6.0', 'style': 'UNIFIED 01 / LIVING COLOSSUS 01', 'seed': SEED,
               'sourceScale': 2, 'sampling': 'nearest', 'generator': 'tools/living_colossus_assets.py',
               'missions': ['M06'], 'assets': records,
               'notes': ['Only assets/living-colossus-01 is written.',
                         'Actor art never imports or changes hitboxes or projectile origins.',
                         'Neural heart core source (160,128), world (e.x,e.y+40), top offset -24.',
                         'Pulse collider states and flow forces belong to mission logic, not this renderer.',
                         'Far sheets preserve exact alpha silhouettes and anchors.']}
    (dest / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'LIVING COLOSSUS 01: {len(records)} PNGs / {sum(x["frames"] for x in records)} cells / seed {SEED}')
    return catalog


if __name__ == '__main__':
    generate(Path(__file__).resolve().parents[1])
