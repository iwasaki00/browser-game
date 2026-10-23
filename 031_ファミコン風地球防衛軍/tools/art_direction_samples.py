"""Isolated, deterministic art study. Never writes production assets or game data."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import json
import math
import random

SEED = 24032023
P = {
    "ink": "#090f1b", "deep": "#14242f", "shadow": "#223743",
    "steel": "#456573", "mid": "#6d9297", "edge": "#a0c0b5", "light": "#c4d2b7",
    "white": "#f1f0d5", "olive0": "#39473e", "olive": "#7a8964", "olive1": "#bcc596",
    "teal0": "#21767e", "teal": "#44c6bd", "teal1": "#adf0d1",
    "shell0": "#382936", "shell1": "#623d4d", "shell2": "#ad6976",
    "shell3": "#d98e82", "shell4": "#edac88", "bone": "#dfc29d",
    "amber0": "#855033", "amber": "#e59e54", "gold": "#f2cf7c",
    "acid0": "#6f894e", "acid": "#aecb69", "acid1": "#e5edaa",
    "violet0": "#504a7d", "violet": "#9987cf", "violet1": "#d5c5f0",
    "clear": (0, 0, 0, 0),
}


def rgba(size):
    return Image.new("RGBA", size, (0, 0, 0, 0))


def box(d, bounds, color):
    d.rectangle(tuple(int(v) for v in bounds), fill=P.get(color, color))


def poly(d, points, color):
    d.polygon([(int(x), int(y)) for x, y in points], fill=P.get(color, color))


def line(d, points, color, width=1):
    d.line([(int(x), int(y)) for x, y in points], fill=P.get(color, color), width=width)


def oval(d, bounds, color):
    d.ellipse(tuple(int(v) for v in bounds), fill=P.get(color, color))


def ranger(pose=0):
    im = rgba((48, 64)); d = ImageDraw.Draw(im)
    # Field pack and antenna: deliberately separate from the helmet silhouette.
    poly(d, [(8, 25), (14, 22), (20, 27), (19, 45), (8, 44), (6, 37)], "ink")
    box(d, (9, 27, 15, 40), "olive0"); box(d, (9, 27, 11, 36), "olive")
    box(d, (7, 19, 8, 30), "steel"); box(d, (7, 16, 8, 19), "edge")
    # Rear leg, then the forward leg. Two poses are not a completed walk cycle.
    poly(d, [(23, 42), (33, 43), (32, 53), (36, 59), (40, 60), (40, 63), (29, 63), (25, 54)], "ink")
    poly(d, [(26, 44), (31, 45), (30, 53), (34, 59), (30, 60), (27, 53)], "steel")
    box(d, (30, 59, 36, 60), "mid")
    if pose:
        poly(d, [(15, 41), (24, 44), (21, 51), (13, 55), (11, 60), (3, 60), (3, 56), (9, 54), (15, 48)], "ink")
        poly(d, [(17, 44), (21, 45), (18, 50), (10, 56), (7, 56), (15, 49)], "olive")
        line(d, [(15, 45), (18, 45), (17, 48), (10, 53)], "olive1", 2)
    else:
        poly(d, [(15, 42), (24, 44), (23, 54), (20, 59), (23, 61), (23, 63), (10, 63), (10, 59), (14, 54)], "ink")
        poly(d, [(17, 44), (22, 45), (20, 54), (17, 58), (13, 58), (16, 52)], "olive")
        box(d, (16, 47, 20, 50), "olive1"); box(d, (12, 60, 19, 61), "mid")
    # Torso: a coherent large shadow mass, broken only by plates and a strap.
    poly(d, [(16, 24), (28, 24), (34, 31), (31, 43), (24, 47), (14, 44), (12, 32)], "ink")
    poly(d, [(17, 27), (27, 26), (30, 32), (28, 42), (22, 44), (15, 41), (15, 31)], "olive0")
    poly(d, [(17, 27), (27, 27), (28, 34), (17, 35)], "olive")
    line(d, [(17, 27), (25, 27), (28, 30)], "olive1", 2)
    box(d, (16, 36, 21, 40), "steel"); box(d, (23, 36, 27, 41), "steel")
    box(d, (16, 36, 20, 36), "edge"); box(d, (23, 36, 26, 36), "mid")
    line(d, [(15, 26), (24, 38), (26, 43)], "deep", 2)
    # Shoulder and forearm form a clear horizontal aim line.
    poly(d, [(12, 25), (20, 25), (23, 29), (21, 35), (13, 34), (10, 30)], "ink")
    poly(d, [(13, 27), (19, 27), (21, 29), (19, 32), (13, 31)], "mid")
    line(d, [(13, 26), (19, 26), (21, 28)], "light", 1)
    poly(d, [(24, 31), (31, 31), (34, 35), (39, 34), (40, 39), (31, 41), (26, 38)], "ink")
    poly(d, [(27, 33), (30, 33), (33, 37), (37, 36), (37, 38), (31, 39)], "steel")
    box(d, (31, 35, 37, 36), "edge")
    # Helmet/visor. The bright face points right; no isolated facial noise.
    poly(d, [(16, 8), (29, 7), (34, 11), (36, 18), (34, 23), (20, 24), (14, 20), (13, 14)], "ink")
    poly(d, [(16, 11), (28, 9), (32, 12), (32, 15), (16, 16)], "olive")
    line(d, [(16, 11), (21, 9), (28, 9)], "light", 2)
    box(d, (17, 15, 34, 22), "teal0"); box(d, (23, 15, 34, 19), "teal")
    box(d, (29, 15, 34, 16), "teal1"); box(d, (17, 17, 20, 21), "deep")
    box(d, (20, 22, 30, 23), "mid"); box(d, (14, 17, 17, 21), "steel")
    # Rifle remains inside the original 24x32 logical envelope.
    poly(d, [(29, 28), (44, 28), (44, 30), (46, 30), (46, 33), (36, 34), (34, 38), (30, 37), (31, 33), (26, 33)], "ink")
    box(d, (30, 29, 42, 31), "mid"); box(d, (37, 29, 45, 30), "edge")
    box(d, (34, 27, 39, 28), "deep"); box(d, (35, 27, 38, 27), "teal")
    box(d, (33, 33, 35, 36), "olive"); box(d, (44, 31, 45, 31), "deep")
    return im


def wing(pose=0):
    im = rgba((48, 64)); d = ImageDraw.Draw(im)
    # Broad swept propulsion fins, not a recolored Ranger backpack.
    poly(d, [(17, 26), (3, 4), (1, 6), (3, 34), (14, 46), (22, 38)], "ink")
    poly(d, [(15, 28), (5, 10), (6, 30), (15, 40), (18, 36)], "steel")
    poly(d, [(6, 13), (8, 20), (10, 31), (7, 28)], "edge")
    line(d, [(7, 31), (14, 38), (17, 36)], "teal0", 2)
    poly(d, [(21, 25), (16, 1), (18, 1), (29, 12), (30, 30)], "ink")
    poly(d, [(20, 9), (26, 14), (27, 24), (23, 25)], "mid")
    line(d, [(20, 8), (26, 13), (27, 16)], "light", 2)
    # Lift legs: diagonal knees/boots keep the airborne pose readable.
    poly(d, [(23, 42), (31, 42), (31, 49), (25, 53), (25, 59), (21, 62), (17, 61), (18, 53), (24, 47)], "ink")
    poly(d, [(25, 44), (29, 45), (28, 48), (22, 54), (21, 58), (19, 58), (21, 52)], "steel")
    line(d, [(26, 44), (28, 45), (25, 49), (22, 51)], "edge", 2)
    poly(d, [(30, 41), (36, 43), (35, 48), (41, 50), (44, 53), (42, 57), (32, 53), (28, 49)], "ink")
    poly(d, [(32, 44), (34, 45), (32, 48), (40, 52), (39, 54), (31, 51)], "mid")
    # Slim chest, a lighter harness and a waist gap.
    poly(d, [(22, 25), (32, 25), (36, 32), (33, 42), (27, 46), (20, 42), (18, 32)], "ink")
    poly(d, [(23, 27), (30, 27), (33, 32), (30, 41), (24, 42), (21, 37)], "steel")
    poly(d, [(23, 27), (29, 27), (31, 32), (23, 34)], "mid")
    line(d, [(24, 27), (29, 28), (31, 31)], "light", 2)
    box(d, (25, 35, 29, 38), "teal0"); box(d, (26, 35, 28, 35), "teal")
    poly(d, [(24, 11), (34, 10), (39, 15), (39, 22), (33, 25), (24, 22), (21, 17)], "ink")
    poly(d, [(24, 13), (33, 12), (36, 15), (25, 17), (23, 16)], "edge")
    box(d, (27, 16, 38, 23), "teal0"); box(d, (30, 16, 38, 20), "teal")
    box(d, (35, 16, 38, 17), "teal1"); box(d, (26, 24, 33, 24), "mid")
    poly(d, [(30, 29), (35, 30), (38, 34), (43, 34), (43, 38), (35, 39), (31, 35)], "ink")
    line(d, [(32, 30), (36, 35), (41, 35)], "edge", 3)
    box(d, (35, 29, 46, 33), "ink"); box(d, (36, 30, 45, 31), "mid")
    box(d, (43, 30, 45, 30), "light")
    # Compact, hard-edged exhaust; this is not a large translucent glow.
    box(d, (12, 38, 18, 45), "ink"); box(d, (13, 39, 16, 43), "mid")
    poly(d, [(13, 45), (17, 45), (16, 57 if pose else 52), (13, 49)], "teal0")
    poly(d, [(14, 45), (16, 45), (15, 53 if pose else 49)], "teal1")
    return im


def crawler(pose=0):
    im = rgba((64, 64)); d = ImageDraw.Draw(im)
    for x in (23, 37, 50):
        poly(d, [(x, 36), (x+5, 41), (x+9, 52), (x+5, 56), (x+4, 47), (x-2, 42)], "shell0")
    # Low, curved abdomen and visible underside.
    poly(d, [(14, 32), (23, 22), (44, 21), (56, 29), (61, 39), (53, 46), (22, 46), (13, 40)], "ink")
    poly(d, [(18, 33), (26, 27), (46, 27), (55, 33), (56, 40), (49, 44), (22, 43)], "shell1")
    box(d, (25, 40, 46, 43), "shell3")
    for x, y, w in ((18, 25, 15), (30, 22, 15), (42, 24, 14)):
        poly(d, [(x, y+5), (x+5, y), (x+w-3, y+1), (x+w, y+9), (x+w-3, y+15), (x+1, y+14)], "ink")
        poly(d, [(x+2, y+5), (x+6, y+2), (x+w-4, y+3), (x+w-2, y+9), (x+w-4, y+12), (x+3, y+11)], "shell2")
        poly(d, [(x+3, y+5), (x+7, y+3), (x+w-4, y+4), (x+w-3, y+6), (x+6, y+7)], "shell3")
        line(d, [(x+5, y+4), (x+8, y+3), (x+w-5, y+4)], "shell4", 1)
    for i, x in enumerate((23, 36, 49)):
        step = (2 if i % 2 == pose else -1)
        poly(d, [(x, 40), (x+4, 41), (x+3, 49), (x-2+step, 57), (x+1+step, 59), (x+1+step, 61), (x-8+step, 61), (x-8+step, 58), (x-3, 49)], "ink")
        poly(d, [(x, 43), (x+2, 43), (x, 49), (x-5+step, 57), (x-6+step, 57), (x-2, 48)], "shell2")
        box(d, (x-6+step, 58, x-3+step, 58), "shell4")
    poly(d, [(7, 31), (16, 28), (23, 33), (21, 43), (14, 47), (5, 42)], "ink")
    poly(d, [(9, 32), (16, 31), (20, 34), (18, 40), (11, 42), (7, 39)], "shell2")
    line(d, [(9, 33), (14, 32), (18, 34)], "shell4", 2)
    box(d, (7, 35, 12, 38), "ink"); box(d, (7, 35, 10, 36), "acid1")
    poly(d, [(8, 41), (5, 43), (1, 43), (2, 48), (8, 49), (13, 44)], "ink")
    poly(d, [(8, 42), (4, 45), (3, 44), (4, 47), (8, 47)], "bone")
    poly(d, [(15, 44), (13, 49), (7, 53), (4, 51), (10, 49), (10, 44)], "ink")
    line(d, [(12, 46), (11, 49), (7, 51)], "shell4", 2)
    return im


def needle(pose=0):
    im = rgba((64, 64)); d = ImageDraw.Draw(im)
    y = -4 if pose else 0
    # Two broad membranes, with intentionally open negative space between them.
    poly(d, [(29, 29), (5, 9+y), (2, 11+y), (7, 33), (23, 38)], "ink")
    poly(d, [(27, 29), (7, 14+y), (10, 30), (22, 34)], "shell1")
    poly(d, [(9, 18+y), (18, 23), (23, 31), (12, 29)], "shell3")
    line(d, [(7, 15+y), (12, 28), (23, 33)], "shell4", 1)
    line(d, [(12, 18), (17, 27), (23, 31)], "shell0", 2)
    poly(d, [(34, 26), (57, 5+y), (62, 6+y), (56, 26), (41, 35)], "ink")
    poly(d, [(37, 26), (58, 9+y), (53, 24), (41, 31)], "shell2")
    line(d, [(39, 26), (57, 10+y), (54, 18)], "shell4", 2)
    line(d, [(44, 24), (48, 26), (53, 22)], "shell0", 1)
    poly(d, [(36, 35), (54, 45), (58, 58), (45, 53), (31, 40)], "ink")
    poly(d, [(38, 38), (51, 46), (54, 54), (46, 50)], "shell2")
    line(d, [(41, 40), (50, 46), (52, 49)], "shell4", 1)
    poly(d, [(24, 27), (34, 21), (45, 27), (54, 32), (45, 37), (33, 44), (24, 39)], "ink")
    poly(d, [(28, 28), (34, 24), (42, 28), (47, 32), (40, 36), (33, 40), (27, 37)], "shell2")
    line(d, [(30, 27), (34, 25), (41, 29)], "shell4", 2)
    line(d, [(32, 31), (34, 36), (34, 39)], "shell0", 2)
    poly(d, [(18, 30), (24, 27), (29, 31), (28, 37), (20, 39), (16, 35)], "ink")
    poly(d, [(20, 31), (25, 30), (26, 34), (21, 36), (18, 35)], "shell3")
    box(d, (17, 32, 22, 34), "acid"); box(d, (17, 32, 20, 32), "acid1")
    poly(d, [(32, 40), (39, 39), (35, 56), (32, 52)], "ink")
    poly(d, [(34, 43), (36, 42), (34, 51)], "amber")
    line(d, [(21, 38), (17, 44), (14, 44)], "shell3", 2)
    return im


def boss(pose=0):
    im = rgba((192, 128)); d = ImageDraw.Draw(im)
    # Rear legs frame the abdomen before the large plates are drawn.
    for x in (64, 100, 139, 160):
        poly(d, [(x, 65), (x+15, 77), (x+18, 102), (x+28, 119), (x+25, 123), (x+12, 106), (x+9, 84), (x-5, 77)], "ink")
        line(d, [(x+3, 74), (x+12, 84), (x+15, 104), (x+23, 118)], "shell0", 4)
    poly(d, [(42, 51), (78, 21), (134, 16), (167, 31), (187, 58), (181, 84), (161, 102), (108, 109), (65, 94), (39, 72)], "ink")
    poly(d, [(51, 54), (80, 32), (136, 25), (162, 39), (178, 59), (172, 81), (155, 94), (108, 101), (67, 88), (47, 72)], "shell0")
    poly(d, [(66, 65), (105, 57), (162, 63), (172, 80), (151, 98), (108, 103), (68, 87)], "shell1")
    # Overlapping sculpted plates. Large highlights are clusters, not vertical stripes.
    for x, y, w, h in ((63, 31, 34, 48), (87, 21, 37, 54), (115, 20, 36, 55), (143, 29, 32, 48), (164, 43, 21, 35)):
        poly(d, [(x, y+12), (x+9, y), (x+w-12, y+1), (x+w-2, y+16), (x+w, y+30), (x+w-10, y+h), (x+9, y+h-5)], "ink")
        poly(d, [(x+3, y+13), (x+11, y+4), (x+w-13, y+5), (x+w-5, y+18), (x+w-4, y+30), (x+w-11, y+h-5), (x+11, y+h-9)], "shell2")
        poly(d, [(x+5, y+13), (x+12, y+6), (x+w-14, y+7), (x+w-9, y+16), (x+w-11, y+23), (x+10, y+22)], "shell3")
        line(d, [(x+8, y+12), (x+13, y+8), (x+w-15, y+9)], "shell4", 2)
        line(d, [(x+11, y+28), (x+14, y+34), (x+15, y+h-11)], "shell1", 2)
    for x, y in ((83, 23), (112, 17), (143, 23)):
        poly(d, [(x-5, y+8), (x-7, y-13), (x-2, y-16), (x+10, y+9)], "ink")
        poly(d, [(x-3, y+4), (x-4, y-10), (x-1, y-10), (x+6, y+6)], "shell3")
        line(d, [(x-4, y-9), (x-1, y-7), (x+3, y+2)], "bone", 1)
    # Head, cheek plates and two acid-yellow eye slits.
    poly(d, [(23, 51), (46, 42), (67, 49), (78, 64), (66, 84), (42, 91), (22, 79), (17, 65)], "ink")
    poly(d, [(26, 54), (47, 46), (63, 52), (71, 63), (62, 77), (42, 85), (25, 75), (22, 64)], "shell1")
    poly(d, [(26, 54), (44, 49), (61, 54), (65, 60), (43, 62), (25, 63)], "shell3")
    line(d, [(27, 54), (44, 50), (55, 53)], "shell4", 2)
    poly(d, [(22, 64), (43, 60), (48, 65), (38, 72), (22, 72)], "ink")
    line(d, [(23, 65), (33, 63), (40, 64)], "acid", 3); box(d, (23, 64, 28, 65), "acid1")
    line(d, [(48, 62), (58, 61), (62, 64)], "acid0", 2)
    # Mandibles, wider in the attack pose.
    extra = 5 if pose else 0
    poly(d, [(26, 73), (18, 77), (3, 72-extra), (1, 76-extra), (8, 88), (24, 91), (36, 82)], "ink")
    poly(d, [(25, 77), (18, 81), (6, 77-extra), (11, 85), (22, 87), (29, 82)], "bone")
    poly(d, [(40, 81), (33, 94), (17, 104+extra), (6, 102+extra), (9, 97), (23, 94), (27, 82)], "ink")
    poly(d, [(32, 86), (29, 94), (17, 101+extra), (11, 100), (24, 96)], "shell4")
    # The abdominal organ has a recessed rim, not a flat bright rectangle.
    poly(d, [(107, 74), (125, 68), (145, 77), (148, 94), (131, 105), (110, 99), (102, 87)], "ink")
    poly(d, [(111, 78), (125, 72), (141, 79), (143, 92), (130, 100), (113, 95), (108, 86)], "amber0")
    poly(d, [(115, 80), (126, 76), (137, 81), (138, 90), (129, 96), (117, 92), (113, 86)], "amber")
    poly(d, [(120, 81), (127, 78), (134, 82), (135, 88), (128, 91), (121, 88)], "gold")
    box(d, (124, 81, 129, 84), "white")
    line(d, [(114, 96), (121, 98), (125, 97)], "shell3", 2)
    # Heavy, angular near legs leave readable gaps all the way down to the feet.
    for i, x in enumerate((58, 88, 157)):
        dx = 3 if pose and i == 0 else 0
        poly(d, [(x, 76), (x+10, 81), (x+3, 96), (x-10-dx, 112), (x-9, 119), (x+2, 121), (x+3, 126), (x-19, 126), (x-22, 118), (x-16, 108), (x-5, 91)], "ink")
        poly(d, [(x, 80), (x+6, 84), (x, 95), (x-14, 113), (x-15, 119), (x-19, 117), (x-12, 107), (x-4, 92)], "shell2")
        line(d, [(x, 81), (x+3, 84), (x-3, 94), (x-13, 107)], "shell4", 2)
        oval(d, (x-18, 107, x-9, 116), "shell1"); box(d, (x-17, 108, x-13, 110), "shell3")
        line(d, [(x-14, 121), (x-6, 122), (x-2, 124)], "bone", 2)
    return im


WEAPONS = ["A-01", "R-04", "H-08", "T-06", "D-19"]


def weapon_icon(index):
    im = rgba((32, 32)); d = ImageDraw.Draw(im)
    if index == 0:
        poly(d, [(2, 13), (9, 10), (23, 10), (23, 12), (30, 12), (30, 16), (22, 18), (18, 18), (18, 27), (12, 28), (10, 19), (5, 21), (2, 19)], "ink")
        box(d, (9, 12, 22, 16), "steel"); box(d, (10, 12, 21, 12), "edge")
        box(d, (22, 13, 29, 14), "mid"); box(d, (4, 14, 8, 17), "olive")
        poly(d, [(12, 18), (16, 18), (16, 25), (13, 26)], "olive"); box(d, (13, 19, 14, 24), "olive1")
        box(d, (13, 7, 21, 10), "ink"); box(d, (14, 8, 19, 8), "teal")
        box(d, (10, 14, 12, 15), "deep"); box(d, (18, 14, 21, 15), "deep")
    elif index == 1:
        poly(d, [(4, 9), (24, 7), (29, 10), (30, 19), (25, 23), (7, 23), (2, 19), (2, 12)], "ink")
        poly(d, [(5, 11), (24, 9), (26, 12), (26, 19), (23, 21), (6, 21), (4, 18)], "olive0")
        box(d, (7, 11, 22, 13), "olive1"); box(d, (7, 14, 22, 18), "olive")
        box(d, (9, 14, 11, 18), "amber"); box(d, (20, 11, 22, 20), "steel")
        oval(d, (23, 9, 29, 21), "steel"); oval(d, (24, 11, 28, 19), "ink")
        box(d, (7, 23, 13, 27), "ink"); box(d, (8, 23, 11, 25), "mid")
        box(d, (17, 22, 20, 27), "ink"); box(d, (18, 23, 19, 25), "steel")
    elif index == 2:
        poly(d, [(3, 11), (16, 3), (29, 8), (29, 19), (16, 28), (3, 23)], "ink")
        poly(d, [(5, 12), (16, 6), (26, 10), (26, 18), (15, 25), (5, 21)], "steel")
        poly(d, [(6, 12), (16, 7), (24, 10), (14, 16)], "mid")
        for x, y in ((10, 13), (16, 10), (21, 14)):
            poly(d, [(x, y), (x+4, y-2), (x+6, y), (x+5, y+5), (x+1, y+7)], "ink")
            line(d, [(x+1, y+1), (x+4, y), (x+4, y+3)], "edge", 1)
            box(d, (x+2, y+3, x+3, y+4), "acid")
        line(d, [(5, 20), (14, 24), (25, 18)], "olive0", 2)
        box(d, (5, 13, 7, 15), "gold")
    elif index == 3:
        poly(d, [(3, 13), (12, 9), (20, 10), (22, 5), (29, 3), (30, 7), (25, 10), (25, 21), (30, 23), (29, 27), (21, 24), (20, 20), (15, 21), (13, 28), (8, 27), (9, 21), (3, 21)], "ink")
        box(d, (5, 14, 18, 19), "steel"); box(d, (6, 14, 17, 15), "edge")
        for x in (11, 14, 17):
            box(d, (x, 11, x+1, 21), "violet0"); box(d, (x, 12, x, 19), "violet")
        line(d, [(21, 12), (23, 7), (28, 5)], "edge", 2)
        line(d, [(21, 19), (23, 23), (28, 25)], "edge", 2)
        line(d, [(26, 9), (24, 13), (28, 16), (24, 20), (26, 23)], "violet1", 1)
        box(d, (10, 22, 12, 25), "olive")
    else:
        line(d, [(15, 19), (5, 28), (2, 28)], "ink", 4)
        line(d, [(17, 19), (26, 28), (30, 28)], "ink", 4)
        line(d, [(16, 19), (16, 29)], "ink", 4)
        line(d, [(15, 21), (6, 27)], "mid", 2); line(d, [(18, 21), (26, 27)], "steel", 2)
        box(d, (15, 22, 16, 28), "edge")
        poly(d, [(9, 12), (17, 8), (24, 12), (23, 21), (10, 21), (7, 17)], "ink")
        poly(d, [(10, 13), (17, 11), (21, 13), (20, 18), (10, 18)], "steel")
        line(d, [(10, 13), (17, 11), (20, 12)], "edge", 2)
        box(d, (15, 9, 30, 13), "ink"); box(d, (17, 10, 29, 11), "mid")
        box(d, (11, 15, 14, 16), "teal"); box(d, (18, 19, 20, 20), "amber")
        line(d, [(9, 13), (6, 8), (6, 4)], "steel", 1); box(d, (5, 4, 7, 5), "teal")
    return im


def projectile(index):
    im = rgba((32, 32)); d = ImageDraw.Draw(im)
    if index in (0, 4):
        line(d, [(3, 16), (21, 16)], "teal0" if index == 4 else "amber0", 2)
        poly(d, [(18, 13), (26, 13), (30, 15), (26, 18), (18, 18)], "teal" if index == 4 else "gold")
        line(d, [(22, 14), (28, 15)], "white", 2)
    elif index == 1:
        poly(d, [(9, 11), (22, 11), (29, 16), (22, 21), (9, 21), (6, 25), (5, 20), (7, 16), (5, 11), (6, 7)], "ink")
        poly(d, [(11, 13), (22, 13), (26, 16), (22, 18), (11, 18)], "edge")
        box(d, (12, 13, 19, 14), "white"); box(d, (20, 15, 23, 18), "amber")
        poly(d, [(9, 13), (9, 19), (1, 17), (4, 15), (1, 14)], "amber")
        box(d, (6, 14, 9, 16), "gold")
    elif index == 2:
        for x, y in ((2, 7), (8, 19)):
            line(d, [(x, y+2), (x+5, y+2)], "acid0", 1)
            poly(d, [(x+5, y), (x+13, y), (x+17, y+2), (x+13, y+4), (x+5, y+4), (x+2, y+7)], "ink")
            box(d, (x+7, y+1, x+12, y+2), "light"); box(d, (x+13, y+1, x+15, y+2), "acid")
            line(d, [(x+5, y+3), (x+3, y+5)], "mid", 1)
    else:
        line(d, [(2, 17), (10, 8), (9, 15), (19, 12), (17, 21), (30, 12)], "violet0", 5)
        line(d, [(2, 17), (10, 8), (9, 15), (19, 12), (17, 21), (30, 12)], "violet", 3)
        line(d, [(3, 17), (9, 10), (8, 16), (18, 13), (17, 20), (29, 12)], "white", 1)
        line(d, [(14, 14), (17, 6), (24, 3)], "violet1", 1)
        line(d, [(18, 20), (24, 25), (27, 23)], "violet1", 1)
    return im


def impact(index, frame):
    im = rgba((64, 64)); d = ImageDraw.Draw(im); rng = random.Random(SEED+index*100+frame)
    radius = (7, 15, 22, 27)[frame]
    color = ("gold", "amber", "acid", "violet", "teal")[index]
    if index == 1:
        # Faceted blast silhouette, hard-edged inner heat and broken pressure ring.
        pts = []
        for k in range(18):
            a=k*math.tau/18; r=radius+(3 if k % 2 else -2)
            pts.append((32+math.cos(a)*r, 32+math.sin(a)*r*.8))
        if frame < 3: poly(d, pts, "amber0"); poly(d, [(32+(x-32)*.8,32+(y-32)*.8) for x,y in pts], "amber")
        if frame < 2: oval(d, (27-frame*5, 27-frame*4, 37+frame*5, 37+frame*4), "gold"); box(d, (29,29,34,34),"white")
        if frame > 0:
            for start in (5, 105, 200, 290):
                arc=[(32+math.cos(math.radians(a))*radius,32+math.sin(math.radians(a))*radius*.6) for a in range(start,start+51,8)]
                line(d, arc, "gold", 2)
    elif index == 3:
        for k in range(4):
            a=k*math.tau/4+.3; dx=math.cos(a); dy=math.sin(a)
            pts=[(32,32),(32+dx*radius*.4-dy*4,32+dy*radius*.4+dx*4),(32+dx*radius*.65+dy*3,32+dy*radius*.65-dx*3),(32+dx*radius,32+dy*radius)]
            line(d,pts,"violet",3);line(d,pts,"violet1",1)
    else:
        for k in range(7 if index == 0 else 5):
            a=k*math.tau/(7 if index == 0 else 5)+.2; r=radius+rng.randrange(-3,3)
            x=32+math.cos(a)*r;y=32+math.sin(a)*r
            line(d,[(32+math.cos(a)*3,32+math.sin(a)*3),(x,y)],color,2)
            box(d,(x-1,y-1,x+1,y+1),"white" if frame<2 else color)
    if frame<2 and index != 1:
        poly(d,[(32,24),(35,29),(40,32),(35,35),(32,40),(29,35),(24,32),(29,29)],color)
        box(d,(30,30,33,33),"white")
    return im


def tiles(underground=False):
    sheet=rgba((128,64)); rng=random.Random(SEED+(2 if underground else 1))
    for n in range(8):
        im=rgba((32,32));d=ImageDraw.Draw(im)
        base="steel" if underground else "shadow"
        box(d,(0,0,31,31),"ink");box(d,(0,3,31,30),base)
        box(d,(0,0,31,1),"edge");box(d,(0,2,31,3),"mid")
        box(d,(0,4,31,5),"deep");box(d,(0,29,31,31),"deep")
        if underground:
            if n<4:
                box(d,(2,8,29,26),"deep");box(d,(3,9,28,24),"shadow")
                line(d,[(3,23),(3,9),(27,9)],"mid",1)
                for x,y in ((5,11),(26,11),(5,22),(26,22)):box(d,(x,y,x+1,y+1),"edge")
                if n==1:
                    for x in range(8,24,4):box(d,(x,13,x+1,20),"ink");box(d,(x+1,13,x+2,13),"steel")
                if n==2:line(d,[(8,18),(16,18),(18,14),(25,14)],"teal0",2)
                if n==3:box(d,(11,13,21,21),"ink");box(d,(13,15,18,16),"acid0")
            elif n==4:
                box(d,(0,11,31,23),"ink");box(d,(0,12,31,20),"mid");box(d,(0,13,31,14),"edge");box(d,(0,19,31,21),"steel")
                box(d,(12,9,17,24),"deep");box(d,(13,10,16,23),"steel");box(d,(13,10,14,21),"edge")
            elif n==5:
                for x in (3,12,21):line(d,[(x,6),(x+4,13),(x+2,28)],"ink",4);line(d,[(x,6),(x+4,13),(x+2,28)],"olive0",2)
            else:
                for x in range(-16,48,12):poly(d,[(x,8),(x+5,8),(x+17,23),(x+12,23)],"amber0" if n==6 else "deep")
                box(d,(0,26,31,28),"steel")
        else:
            if n<3:
                for _ in range(11):
                    x=rng.randrange(2,29);y=rng.randrange(8,27);box(d,(x,y,x+1,y),"steel" if rng.random()<.5 else "deep")
                if n in (1,2):line(d,[(3,25),(10,19),(16,21),(22,12),(29,9)],"ink",2)
                if n==2:line(d,[(16,21),(17,27),(21,29)],"deep",1)
            elif n==3:
                box(d,(2,9,29,25),"steel");line(d,[(3,10),(27,10)],"mid",1);line(d,[(3,24),(28,24)],"deep",2)
                box(d,(15,7,16,28),"ink")
            elif n<7:
                box(d,(0,7,31,10),"steel");box(d,(0,11,31,24),"deep");box(d,(0,25,31,28),"steel")
                line(d,[(2,23),(14,11),(17,11),(29,23)],"mid",2)
                if n in (4,6):box(d,((0 if n==4 else 27),6,(4 if n==4 else 31),28),"mid")
            else:
                box(d,(3,7,28,28),"olive0");box(d,(4,7,27,9),"olive1");box(d,(6,12,25,14),"olive")
                line(d,[(6,25),(25,16)],"ink",2);box(d,(7,17,11,20),"amber")
        sheet.alpha_composite(im,((n%4)*32,(n//4)*32))
    return sheet


def city_layers():
    rng=random.Random(SEED+101);far=Image.new("RGB",(640,360));d=ImageDraw.Draw(far)
    # A restrained quantized atmospheric ramp; no blur, resampling or random noise.
    for y in range(0,296,16):
        t=y/288;col=tuple(round(a+(b-a)*t) for a,b in zip((8,19,31),(26,52,64)))
        box(d,(0,y,639,min(295,y+15)),col)
    box(d,(0,296,639,359),"#0c1c27")
    oval(d,(485,42,535,92),"#344d54");oval(d,(490,45,534,90),"#5a7070")
    oval(d,(501,53,513,63),"#425c61");oval(d,(514,74,523,81),"#4e6769")
    for x,w,h in ((18,52,100),(81,38,142),(129,71,115),(211,39,171),(258,61,128),(330,53,146),(397,42,102),(450,61,137),(527,43,104),(581,40,146)):
        y=296-h;poly(d,[(x,y+9),(x+5,y),(x+w-7,y),(x+w,y+10),(x+w,295),(x,295)],"#1b303c")
        if w>45:box(d,(x+7,y+12,x+11,290),"#243c46")
        for wy in range(y+17,277,15):
            for wx in range(x+14,x+w-7,11):
                if rng.random()<.32:box(d,(wx,wy,wx+2,wy+4),"#3d5352" if rng.random()<.7 else "#625d43")
    mid=rgba((640,360));d=ImageDraw.Draw(mid)
    # A broken elevated transit line, with asymmetric buildings underneath.
    box(d,(0,216,639,226),"#1a303b");box(d,(0,216,639,218),"#314b53")
    for x in (16,163,342,575):poly(d,[(x,225),(x+14,225),(x+22,296),(x-4,296)],"#1a2e37")
    poly(d,[(48,142),(86,142),(86,156),(121,153),(145,169),(141,294),(47,294)],"#182c37")
    poly(d,[(46,142),(61,137),(72,144),(85,141),(85,152),(48,153)],"#30464b")
    for y in (166,186,205,248,268):
        box(d,(52,y,136,y+3),"#293f47")
        for x in (58,78,113):
            box(d,(x,y+6,x+10,y+14),"#0e202d")
            if (x+y)%3:box(d,(x+1,y+6,x+5,y+7),"#625d43")
    poly(d,[(442,160),(473,149),(521,160),(537,182),(534,295),(439,295)],"#203641")
    line(d,[(444,162),(474,153),(518,164)],"#3a5156",2)
    for x in (449,479,510):box(d,(x,177,x+7,291),"#2c444c")
    for y in (179,202,252):box(d,(458,y,505,y+14),"#142935");box(d,(463,y+2,468,y+5),"#49615e")
    # Sparse damage rather than a uniform noise overlay.
    line(d,[(119,156),(112,181),(122,196),(117,215)],"#0c202c",3)
    line(d,[(482,155),(489,188),(480,219),(485,238)],"#142935",2)
    near=rgba((640,360));d=ImageDraw.Draw(near)
    box(d,(0,268,29,295),"#101f2a");poly(d,[(0,269),(12,260),(25,273),(34,294),(0,294)],"#2b4149")
    line(d,[(7,268),(18,271),(24,282)],"#3b5357",2)
    box(d,(610,147,619,295),"#111f29");box(d,(610,146,613,294),"#314850")
    line(d,[(604,145),(625,145),(628,139)],"#3b5156",2)
    box(d,(624,137,632,139),"#8b8158")
    for x,y in ((33,289),(578,286),(593,291)):poly(d,[(x,y+6),(x+5,y),(x+14,y+2),(x+18,y+6)],"#31464d")
    return [far.convert("RGBA"),mid,near]


def underground_layers():
    far=Image.new("RGBA",(640,360),"#071a24");d=ImageDraw.Draw(far)
    box(d,(0,156,639,295),"#0e2730");box(d,(0,296,639,359),"#0a1923")
    for x,w in ((45,151),(264,130),(461,128)):
        poly(d,[(x,292),(x,72),(x+25,39),(x+w-25,39),(x+w,72),(x+w,292)],"#1c353d")
        poly(d,[(x+13,292),(x+13,77),(x+32,55),(x+w-32,55),(x+w-13,77),(x+w-13,292)],"#091d28")
        line(d,[(x+13,290),(x+13,77),(x+32,55),(x+w-32,55)],"#29434a",2)
        for yy in (100,158,215):line(d,[(x+18,yy),(x+w-18,yy)],"#112e37",2)
    mid=rgba((640,360));d=ImageDraw.Draw(mid)
    box(d,(0,24,639,40),"#081923");box(d,(0,25,639,30),"#3b5358");box(d,(0,31,639,35),"#263e47")
    for x in (20,203,416,602):box(d,(x,20,x+12,44),"#132b35");box(d,(x+1,21,x+4,40),"#49615f")
    # Long service pipe turns around the train bay; rounded raster elbows.
    line(d,[(81,50),(81,185),(133,207),(552,207)],"#081923",15)
    line(d,[(81,50),(81,183),(135,204),(552,204)],"#29464c",10)
    line(d,[(78,50),(78,183),(134,201),(552,201)],"#405a5e",2)
    for x in (152,370,536):box(d,(x,195,x+7,213),"#172e38");box(d,(x+1,197,x+3,210),"#4d645f")
    # Abandoned rail carriage: windows form one group, not wallpaper repetition.
    poly(d,[(200,239),(216,223),(418,223),(444,239),(449,279),(197,279)],"#0b202b")
    line(d,[(211,228),(416,228),(440,242)],"#304b51",3)
    for x in (218,260,302,375):
        box(d,(x,236,x+28,250),"#071823");box(d,(x+1,236,x+25,237),"#344d52")
        line(d,[(x+3,238),(x+14,248)],"#18343f",1)
    box(d,(341,235,364,274),"#142e38");line(d,[(343,237),(360,237),(360,271)],"#385156",1)
    line(d,[(202,259),(440,259)],"#344d52",2)
    for x in (233,402):oval(d,(x-12,271,x+12,294),"#06151f");oval(d,(x-5,278,x+5,288),"#28424a")
    near=rgba((640,360));d=ImageDraw.Draw(near)
    for x in (0,609):
        box(d,(x,0,x+30,295),"#0b1e29");box(d,(x+3,40,x+10,291),"#2a434c")
        box(d,(x+11,39,x+26,295),"#172e39");box(d,(x+3,39,x+10,40),"#52665f")
        for y in (62,159,260):box(d,(x+2,y,x+27,y+6),"#263f49");box(d,(x+4,y+1,x+6,y+2),"#52665f")
    line(d,[(46,42),(41,83),(56,109),(49,151)],"#0a1c25",3)
    line(d,[(572,41),(581,87),(564,125),(577,173)],"#243e42",3)
    line(d,[(573,42),(582,87),(565,125)],"#465844",1)
    box(d,(49,109,55,117),"#5d7048");box(d,(50,109,53,110),"#91a566")
    # A single dim practical light, never brighter than the actor's face.
    box(d,(493,50,547,56),"#1e353a");box(d,(499,51,540,53),"#879477")
    line(d,[(38,288),(92,285),(112,291)],"#2b4247",2)
    return [far,mid,near]


def atlas(frames, columns=None):
    columns=columns or len(frames);w,h=frames[0].size
    out=rgba((w*columns,h*math.ceil(len(frames)/columns)))
    for i,im in enumerate(frames):out.alpha_composite(im,((i%columns)*w,(i//columns)*h))
    return out


def composite(layers):
    im=layers[0].copy()
    for layer in layers[1:]:im.alpha_composite(layer)
    return im


def font(size):
    for path in ("C:/Windows/Fonts/consola.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"):
        if Path(path).exists():return ImageFont.truetype(path,size)
    return ImageFont.load_default()


def label(im,xy,text,size=16,color="#b7c9bf"):
    ImageDraw.Draw(im).text(xy,text,font=font(size),fill=color)


def paste_center(board,im,bounds,scale=1):
    x,y,w,h=bounds;im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.NEAREST)
    board.alpha_composite(im,(round(x+(w-im.width)/2),round(y+(h-im.height)/2)))


def old_frames(assets):
    # Read only. Sizes mirror game.js drawPlayer/drawEnemies/drawBoss envelopes.
    classes=Image.open(assets/"sprites/player/classes.png").convert("RGBA")
    enemies=Image.open(assets/"sprites/enemies/enemies.png").convert("RGBA")
    boss_im=Image.open(assets/"sprites/bosses/mother_crawler.png").convert("RGBA")
    return [classes.crop((0,0,24,32)).resize((48,64),Image.Resampling.NEAREST),
            classes.crop((0,96,24,128)).resize((48,64),Image.Resampling.NEAREST),
            enemies.crop((0,0,48,48)).resize((32,32),Image.Resampling.NEAREST).resize((64,64),Image.Resampling.NEAREST),
            enemies.crop((0,96,48,144)).resize((32,32),Image.Resampling.NEAREST).resize((64,64),Image.Resampling.NEAREST),
            boss_im.crop((0,0,96,64)).resize((192,128),Image.Resampling.NEAREST)]


def comparison(assets, frames, icons, shot_sheet, city, under, tile_city, tile_under):
    board=Image.new("RGBA",(1400,1320),"#0b1622");d=ImageDraw.Draw(board)
    label(board,(40,23),"PIXEL DEFENSE FRONT / ART DIRECTION STUDY 01",26,"#e5e9cd")
    label(board,(40,63),"FIELD STEEL / LIVING CARAPACE    -    PROPOSAL, NOT IN-GAME REPLACEMENT",16)
    old=old_frames(assets)
    for col,(name,a,b) in enumerate(zip(["RANGER","WING","E-01 GROUND","E-03 AIR"],old,frames)):
        x=40+col*236;box(d,(x,104,x+218,363),"#102431")
        label(board,(x+12,113),name,18,"#e5e9cd")
        paste_center(board,a,(x+8,150,94,147),2);paste_center(board,b,(x+112,150,94,147),2)
        label(board,(x+16,320),"CURRENT",13);label(board,(x+122,320),"STUDY",13,"#72d5c3")
    # Silhouette test on the same board, independent of palette recognition.
    box(d,(1000,104,1359,363),"#142936");label(board,(1018,114),"SHAPE FIRST",18,"#e5e9cd")
    for i,im in enumerate(frames[:4]):
        flat=Image.new("RGBA",im.size,"#c4d2b7");flat.putalpha(im.getchannel("A"))
        paste_center(board,flat,(1010+(i%2)*170,150+(i//2)*94,160,90),1)
    label(board,(1018,340),"NO COLOR CUES",13)
    label(board,(40,390),"B-01 / SAME 96 x 64 WORLD ENVELOPE",20,"#e5e9cd")
    box(d,(40,427,671,694),"#102431");box(d,(688,427,1359,694),"#102431")
    paste_center(board,old[4],(50,430,610,244),2);paste_center(board,frames[4],(698,430,650,244),2)
    label(board,(60,667),"CURRENT",14);label(board,(710,667),"STUDY",14,"#72d5c3")
    label(board,(40,723),"WEAPONS / ICON + PROJECTILE",20,"#e5e9cd")
    old_icons=Image.open(assets/"sprites/weapons/weapon_icons.png").convert("RGBA")
    for i,(name,old_index) in enumerate(zip(WEAPONS,[0,3,7,5,18])):
        x=40+i*266;box(d,(x,760,x+251,926),"#102431");label(board,(x+10,767),name,16,"#e5e9cd")
        paste_center(board,old_icons.crop((old_index*32,0,old_index*32+32,32)),(x+5,796,79,91),2)
        paste_center(board,icons.crop((i*32,0,i*32+32,32)),(x+85,796,79,91),2)
        paste_center(board,shot_sheet.crop((i*32,0,i*32+32,32)),(x+167,796,79,91),2)
        label(board,(x+10,899),"OLD   NEW   SHOT",13)
    label(board,(40,955),"M01 CITY / M02 UNDERGROUND - LAYERED ATMOSPHERE",20,"#e5e9cd")
    # Crop only the decorative sky here; full native scenes are separate.
    for x,bg,ts,name in ((40,city,tile_city,"M01"),(720,under,tile_under,"M02")):
        bg=bg.copy()
        for tx in range(0,640,32):
            n=tile_variant(tx//32);bg.alpha_composite(ts.crop((n*32,0,n*32+32,32)),(tx,296))
        board.alpha_composite(bg.crop((0,80,640,360)),(x,1000));label(board,(x+12,1291),name+" / NATIVE 640 x 360 AVAILABLE",13)
    return board


def tile_variant(index):
    return [0,0,1,0,0,2,0,3,0,0,1,0,2,0,0,0][index % 16]


def scene(background, tile_sheet, frames):
    im=background.copy()
    for x in range(0,640,32):
        n=tile_variant(x//32);im.alpha_composite(tile_sheet.crop((n*32,0,n*32+32,32)),(x,296))
    im.alpha_composite(frames[0],(112,232));im.alpha_composite(frames[1],(216,180))
    im.alpha_composite(frames[2],(310,232));im.alpha_composite(frames[3],(390,176))
    im.alpha_composite(frames[4],(445,168))
    return im


def generate(root):
    root=Path(root);assets=root/"assets";output=assets/"art-refresh/study-01";output.mkdir(parents=True,exist_ok=True)
    records={}
    def save(name,im,cell,logical,poses,role):
        path=output/name;path.parent.mkdir(parents=True,exist_ok=True);im.save(path,optimize=True)
        records[name]={"size":list(im.size),"cell":list(cell),"logicalCell":list(logical),"frames":len(poses),"columns":im.width//cell[0],"poses":poses,"role":role,"sha256":hashlib.sha256(path.read_bytes()).hexdigest()}
        print(f"art-refresh/study-01/{name}: {im.width}x{im.height}")
    actors=[ranger(),wing(),crawler(),needle(),boss()]
    for name,fn,cell,logical,poses in [
        ("ranger",ranger,(48,64),(24,32),["aim_idle","stride_study"]),
        ("wing",wing,(48,64),(24,32),["hover","rise_study"]),
        ("crawler",crawler,(64,64),(32,32),["crawl_a","crawl_b"]),
        ("needle",needle,(64,64),(32,32),["wing_low","wing_high"]),
        ("mother_crawler",boss,(192,128),(96,64),["guard","mandible_attack_study"])]:
        save(f"sprites/{name}.png",atlas([fn(0),fn(1)]),cell,logical,poses,"world sprite study, not animation complete")
    icons=atlas([weapon_icon(i) for i in range(5)]);shots=atlas([projectile(i) for i in range(5)])
    save("weapons/icons.png",icons,(32,32),(32,32),WEAPONS,"HUD icons")
    save("weapons/equipped.png",icons.copy(),(32,32),(16,16),WEAPONS,"equipment silhouette study")
    save("weapons/projectiles.png",shots,(32,32),(16,16),WEAPONS,"projectile visual only; no hitbox")
    save("weapons/impacts.png",atlas([impact(i,f) for i in range(5) for f in range(4)],4),(64,64),(32,32),[f"{w}:{f}" for w in WEAPONS for f in range(4)],"four impact phases per weapon row")
    tc,tu=tiles(),tiles(True)
    save("tiles/city.png",tc,(32,32),(16,16),["asphalt_a","asphalt_crack","asphalt_branch","concrete_seam","platform_left","platform_middle","platform_right","supply_panel"],"M01 eight tile studies")
    save("tiles/underground.png",tu,(32,32),(16,16),["panel","vent","conduit","indicator","pipe","organic_cable","hazard","floor"],"M02 eight tile studies")
    scenes=[]
    for name,layers in (("city",city_layers()),("underground",underground_layers())):
        for depth,layer in zip(["far","middle","near"],layers):save(f"backgrounds/{name}_{depth}.png",layer,(640,360),(320,180),[depth],"background layer, no collision")
        bg=composite(layers);save(f"backgrounds/{name}.png",bg,(640,360),(320,180),["composite"],"flattened background study");scenes.append(bg)
    for name,bg,ts in zip(["city","underground"],scenes,[tc,tu]):
        save(f"preview/{name}_scene.png",scene(bg,ts,actors),(640,360),(320,180),["composition"],"static art composition; not mission geometry")
    board=comparison(assets,actors,icons,shots,*scenes,tc,tu)
    save("comparison.png",board,board.size,board.size,["comparison"],"contact sheet; labels may use font antialiasing")
    metadata={"study":"ART DIRECTION REFRESH / STUDY 01","status":"PROPOSAL_NOT_INTEGRATED","gameVersion":"0.2.3","seed":SEED,"sampling":"nearest","worldSourceScale":2,"palette":P,"weaponOrder":WEAPONS,"assets":records,"notes":["Production PNGs are read-only comparison inputs.","World sizes and hitboxes are not changed.","640 canvas is preview-only, not a game change.","Two poses are look studies, not completed animation sets."]}
    (output/"manifest.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Study complete: {len(records)} PNG. Production assets untouched.")


if __name__=="__main__":
    generate(Path(__file__).resolve().parents[1])
