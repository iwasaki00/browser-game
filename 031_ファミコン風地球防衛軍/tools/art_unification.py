"""UNIFIED 01. Local, deterministic Pillow art; never writes earlier art sets.

All coordinates below are authored pixels. Game sizes and combat data are read-only.
"""
from pathlib import Path
import hashlib
import json
import math
import random
import re
from PIL import Image, ImageDraw, ImageFont
try:
    from . import art_direction_samples as a, art_readability as b
except ImportError:
    import art_direction_samples as a
    import art_readability as b

SEED = 24032025
INK = '#090f1b'
EDGE = '#d2d9b8'
SHELL = '#ad6976'
BONE = '#dfc29d'
POSES = b.POSES
ENEMIES = {
    'crawler': ('E-01',32,32,'sprites/enemies/enemies.png'),
    'spider': ('E-02',32,32,'sprites/enemies/enemies.png'),
    'needle': ('E-03',32,32,'sprites/enemies/enemies.png'),
    'beetle': ('E-04',48,48,'sprites/enemies/enemies.png'),
    'worm': ('E-05',32,20,'sprites/enemies/tunnel_worm.png'),
    'spitter': ('E-06',28,24,'sprites/enemies/ceiling_spitter.png'),
    'boss': ('B-01',96,64,'sprites/bosses/mother_crawler.png'),
    'queen': ('B-02',120,96,'sprites/bosses/abyss_queen.png'),
    'nest': ('H-01',48,48,'sprites/enemies/spawn_nest.png'),
    'barrier': ('O-01',24,32,'tiles/underground_tiles.png')
}
ENEMY_POSES = ['move_a','move_b','attack','dead','hit','weak_open']

def player(kind, frame):
    if kind in ('ranger','wing'):
        return b.player_frame(kind,frame)
    # New silhouettes, not hue-shifted Ranger clones. Original legs remain frame-compatible.
    im = a.rgba((48,64)); d = ImageDraw.Draw(im)
    heavy = kind == 'guardian'
    if frame == 8:
        a.poly(d,[(3,58),(8,51),(29,48),(45,54),(46,63),(7,63)],INK)
        a.poly(d,[(7,56),(23,52),(40,56),(39,60),(8,61)],'#8d9d9e' if heavy else '#8d9c75')
        a.box(d,(29,52,43,56),'#a6d9c7'); a.box(d,(6,59,19,61),EDGE)
        if heavy:a.box(d,(16,48,29,54),'#bec7b5')
        return im
    im=b.legs(im,'ranger',frame); d=ImageDraw.Draw(im)
    if heavy:
        # Wide pauldrons, slab chest and shin greaves; boots still contact y=63.
        a.poly(d,[(5,23),(15,20),(32,22),(40,29),(38,43),(30,48),(11,46),(5,37)],INK)
        a.poly(d,[(11,26),(29,25),(35,31),(32,43),(14,44),(9,36)],'#5e7681')
        a.poly(d,[(11,25),(27,24),(31,28),(28,35),(11,34)],'#9aacaa')
        a.line(d,[(11,25),(27,25),(30,28)],EDGE,2)
        for x in (4,29):
            a.poly(d,[(x,23),(x+10,22),(x+14,27),(x+11,35),(x,33)],INK)
            a.poly(d,[(x+2,25),(x+9,24),(x+11,28),(x+9,31),(x+2,30)],'#a7b7b1')
            a.line(d,[(x+2,25),(x+9,25)],EDGE,2)
        a.box(d,(14,36,28,40),'#263743');a.box(d,(19,36,23,39),'#d7bd78')
        a.poly(d,[(12,8),(29,7),(36,13),(36,22),(15,24),(10,18)],INK)
        a.poly(d,[(14,10),(28,9),(32,13),(13,15)],'#96a7a5')
        a.box(d,(17,15,34,19),'#82c2c0');a.box(d,(18,20,31,23),'#566c77')
        for x in (13,29):a.box(d,(x,53,x+5,58),'#9aaea8')
    else:
        # Lean, forward-set helmet, compact pack, diagonal thigh armor.
        a.poly(d,[(9,26),(15,23),(18,30),(16,42),(9,41),(7,33)],INK)
        a.box(d,(9,28,13,36),'#778569')
        a.poly(d,[(17,25),(28,23),(35,29),(32,41),(24,46),(16,42)],INK)
        a.poly(d,[(19,27),(28,26),(31,30),(29,38),(22,42),(18,38)],'#6e826c')
        a.line(d,[(19,27),(28,26),(31,29)],'#c2cf98',2)
        a.line(d,[(17,33),(25,38),(31,36)],'#374c49',3)
        a.poly(d,[(18,12),(31,8),(38,12),(38,19),(23,22),(15,18)],INK)
        a.poly(d,[(20,12),(31,10),(36,12),(33,14),(19,16)],'#b6c78c')
        a.box(d,(24,15,38,18),'#c5ddbd');a.box(d,(16,19,23,22),'#687b78')
        a.line(d,[(10,24),(8,19),(11,15)],'#829584',2)
        if frame==9:
            a.poly(d,[(5,29),(12,26),(17,30),(10,38),(4,37)],'#839879')
            a.line(d,[(5,29),(11,28)],EDGE,2)
    a.line(d,[(27,32),(32,36),(39,35)],INK,6)
    a.line(d,[(27,32),(32,35),(39,35)],'#a2b4a6',3)
    if frame==6:a.line(d,[(29,33),(38,33)],EDGE,2)
    if frame==7:a.line(d,[(16,27),(23,29),(21,34)],'#eddbac',2)
    return im

def plated(d, points, color=SHELL):
    a.poly(d,points,INK)
    cx=sum(x for x,y in points)/len(points);cy=sum(y for x,y in points)/len(points)
    a.poly(d,[(cx+(x-cx)*.79,cy+(y-cy)*.79) for x,y in points],color)
    a.line(d,points[:3],BONE,2)

def enemy(kind, frame):
    if kind in ('crawler','needle','boss'):
        im=b.enemy_frame(kind,frame if frame<4 else 2 if frame==5 else 0)
        d=ImageDraw.Draw(im)
        if frame==4:a.line(d,[(im.width*.4,im.height*.45),(im.width*.53,im.height*.55)],'#f0d7b0',3)
        return im
    _,w,h,_=ENEMIES[kind];im=a.rgba((w*2,h*2));d=ImageDraw.Draw(im)
    s=frame%2
    if kind=='spider':
        # Radial legs, compact hanging abdomen, hooked ends.
        for side in (-1,1):
            for k in range(4):
                root=(31+side*6,25+k*3);knee=(31+side*(17+k*2),9+k*11+s*2);end=(31+side*(26-k),6+k*15)
                a.line(d,[root,knee,end],INK,5);a.line(d,[root,knee,end],'#b18b8e',2)
                a.box(d,(knee[0]-1,knee[1]-1,knee[0]+1,knee[1]+1),BONE)
        plated(d,[(21,14),(31,9),(42,16),(44,33),(35,42),(23,35)],'#987583')
        a.oval(d,(25,34,38,46),INK);a.oval(d,(27,36,36,42),'#ceab89')
        a.box(d,(25,39,30,40),'#c5dd8c');a.line(d,[(28,44),(22,49 if frame==2 else 46)],BONE,2)
    elif kind=='beetle':
        for k in range(3):
            x=28+k*22;end=x-13+(3 if (k+s)%2 else -2)
            a.line(d,[(x,56),(x-7,72),(end,92)],INK,9);a.line(d,[(x,57),(x-7,72),(end,90)],'#8b8998',4)
            a.box(d,(x-10,69,x-4,73),'#cfb897')
        plated(d,[(18,43),(29,18),(56,11),(80,27),(90,51),(76,68),(35,70)],'#6e7985')
        for x in (36,54,72):a.line(d,[(x,25),(x+6,43),(x-1,62)],'#a9b7ae',3)
        plated(d,[(5,42),(20,36),(31,44),(28,59),(10,62)],'#aa8d8a')
        a.box(d,(5,46,15,49),'#cfdb95')
        a.poly(d,[(5,42),(0,22 if frame==2 else 29),(10,35),(16,41)],BONE)
    elif kind=='worm':
        for n in reversed(range(5)):
            x=9+n*11;y=15+((n+s)%2)*3
            plated(d,[(x-8,y),(x-3,y-8),(x+6,y-7),(x+12,y+3),(x+8,y+13),(x-6,y+12)],'#9e7970' if n%2 else '#b08773')
            a.line(d,[(x,y+12),(x-5,y+18),(x+1,y+18)],'#d0a789',2)
        a.oval(d,(0,17,20,32),INK);a.poly(d,[(1,20),(9,18),(16,22),(13,28),(2,27)],'#d1b390')
        a.box(d,(1,20,7,22),'#d3df8a');a.line(d,[(0,27),(7,30),(3,34 if frame==2 else 31)],BONE,2)
    elif kind=='spitter':
        for side in (-1,1):
            for k in range(3):
                a.line(d,[(28+side*8,20+k*2),(28+side*19,6+k*4),(28+side*23,0)],INK,5)
                a.line(d,[(28+side*8,20+k*2),(28+side*19,6+k*4),(28+side*23,0)],'#b098a4',2)
        plated(d,[(12,8),(28,4),(44,9),(45,26),(34,36),(21,33)],'#826481')
        a.oval(d,(22-s,20-s,39+s,35+s),'#586546');a.oval(d,(25,22,35+s,31+s),'#c3d18c')
        a.line(d,[(28,31),(27,43 if frame==2 else 38)],INK,8)
        a.line(d,[(28,32),(27,43 if frame==2 else 38)],'#bcbe79',3)
        a.box(d,(15,16,20,18),BONE)
    elif kind=='queen':
        # Core source center (128,120) maps exactly to e.x+4,e.y+60. No whole-sprite flip.
        for k,x in enumerate((43,75,111,167,202)):
            step=4 if (k+s)%2 else -2
            a.line(d,[(x,103),(x-15,145),(x-30,185+step)],INK,12)
            a.line(d,[(x,103),(x-15,145),(x-30,185+step)],'#a38b9b',5)
            a.oval(d,(x-20,139,x-10,149),'#c7b59c');a.line(d,[(x-34,188),(x-24,188)],BONE,3)
        plated(d,[(30,79),(59,35),(111,21),(174,31),(215,68),(226,111),(201,145),(83,150),(39,126)],'#795c7f')
        for x,y in ((73,58),(112,49),(153,57),(188,76)):
            plated(d,[(x-19,y+15),(x-13,y-15),(x+8,y-12),(x+21,y+8),(x+12,y+38),(x-10,y+32)],'#98788f')
            a.line(d,[(x-8,y-9),(x+4,y-7),(x+12,y+5)],'#bca49e',2)
        for x,y in ((66,45),(103,31),(143,33),(181,48)):
            plated(d,[(x-15,y+29),(x-14,y-9),(x,y-25),(x+17,y+24)],'#8d778c')
        plated(d,[(5,80),(26,60),(60,71),(67,100),(45,123),(13,115)],'#b48c9c')
        a.line(d,[(8,87),(32,85)],'#dce29a',5)
        for y in (101,113):a.poly(d,[(1,y),(24,y-3),(15,y+5)],BONE)
        # Armored iris is closed except during the existing weakCore.open window.
        a.oval(d,(89,81,167,159),INK);a.oval(d,(95,87,161,153),'#9a857d')
        if frame==5:
            a.oval(d,(101,93,155,147),'#598c7b');a.oval(d,(111,103,145,137),'#c8e49c')
            a.box(d,(120,109,132,124),'#f1f0d5')
        else:
            plated(d,[(98,91),(127,87),(128,151),(99,145)],'#9d788f')
            plated(d,[(131,88),(158,95),(156,146),(131,152)],'#78687f')
        if frame==2:a.poly(d,[(1,111),(15,116),(7,130),(0,124)],'#bbc790')
        if frame==3:a.line(d,[(86,47),(109,69),(98,90)],INK,5)
    elif kind=='nest':
        for n in range(5):
            x=10+n*17;a.line(d,[(48,61),(x,80),(x-4,95)],INK,7);a.line(d,[(48,61),(x,80)],'#866f80',3)
        plated(d,[(9,75),(15,35),(32,14),(61,9),(83,33),(87,76),(64,91),(28,90)],'#78546b')
        for x,y in ((28,44),(58,34),(70,62)):
            a.oval(d,(x-10,y-10,x+10,y+10),INK);a.oval(d,(x-6,y-6,x+6,y+6),'#9aa76d')
            a.box(d,(x-3,y-3,x+1,y), '#c9d99b' if frame%2 else '#9ead7e')
        if frame==2:a.oval(d,(29,63,65,81),INK)
    else:
        # Barrier stages: intact / chipped / broken. Physical 24x32 stays unchanged.
        a.box(d,(0,0,47,63),INK);a.box(d,(2,2,45,61),'#636d6e')
        for y in (3,23,44):
            a.box(d,(4,y,43,y+4),'#b1b598');a.line(d,[(5,y+6),(39,y+18)],'#2a3a46',3)
        for x in (6,35):a.box(d,(x,5,x+4,58),'#919d95')
        if frame in (1,4):a.line(d,[(17,0),(23,20),(14,31),(29,47),(26,63)],INK,4)
        if frame==3:
            im=a.rgba((48,64));d=ImageDraw.Draw(im)
            for x in (2,18,33):a.poly(d,[(x,61),(x+4,48),(x+12,53),(x+13,63)],'#84978c')
    if frame==3 and kind not in ('barrier','queen'):
        # Fold appendages and crack the shell; existing death physics supplies rotation.
        a.line(d,[(w*.6,h*.6),(w*.9,h*.9),(w*1.3,h*.8)],INK,3)
        a.line(d,[(w*.7,h*.65),(w*.9,h*.88)],'#d4b99c',2)
    if frame==4:a.line(d,[(w*.5,h*.7),(w*.8,h*.9),(w*1.1,h*.8)],'#f0d6b1',3)
    return im

def far_sprite(im):
    # Deliberately coarsen interior color clusters on a stable 2-source-pixel grid.
    # Same canvas/anchor; alpha silhouette is retained, so feet and weak core do not shift.
    out=im.copy();src=im.load();dst=out.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,bl,alpha=src[x,y]
            if not alpha:continue
            sample=src[min(im.width-1,(x//2)*2),min(im.height-1,(y//2)*2)]
            if sample[3]:r,g,bl=sample[:3]
            if max(r,g,bl)<65:rgb=(18,27,37)
            else:rgb=tuple(min(255,round(v/24)*24) for v in (r,g,bl))
            dst[x,y]=(*rgb,alpha)
    return out

def weapon_art(index, kind, color, mode='icon', frame=0):
    im=a.rgba((32,32));d=ImageDraw.Draw(im)
    if mode=='shot':
        if kind in ('laser','bounce','drill','spiral','bullet','spread','turret'):
            if kind=='bounce':
                a.line(d,[(1,19),(9,10),(16,20),(24,11),(30,16)],color,3)
            elif kind=='drill':
                a.poly(d,[(6,9),(30,16),(6,23)],INK)
                for x in (8,13,18,23):a.line(d,[(x,12),(x+4,16),(x,20)],color,2)
            elif kind=='spiral':
                a.line(d,[(1,11),(9,20),(19,10),(30,16)],color,2)
                a.line(d,[(1,21),(9,10),(19,22),(30,16)],'#aecfcc',2)
            elif kind=='spread':
                for y in (9,16,23):a.poly(d,[(13,y-2),(23,y-2),(29,y),(23,y+2),(13,y+2)],color)
            else:a.poly(d,[(2,14),(22,13),(31,16),(22,19),(2,18)],color)
            a.line(d,[(21,15),(28,16)],'#f1f0d5',1)
        elif kind in ('flame','wideflame'):
            for k in range(3 if kind=='wideflame' else 1):
                y=8+k*8 if kind=='wideflame' else 16
                a.poly(d,[(1,y-4),(10,y-8),(22,y-3),(31,y),(20,y+6),(8,y+4)],'#ab4b45')
                a.poly(d,[(10,y-2),(23,y-1),(30,y),(20,y+3),(8,y+1)],'#f2ba6e')
        elif kind in ('thunder','storm'):
            a.line(d,[(1,17),(10,5),(9,18),(20,11),(18,26),(31,14)],color,4)
            a.line(d,[(2,17),(10,8),(10,18),(20,13),(19,24),(30,14)],'#eee5cf',1)
            if kind=='storm':a.line(d,[(12,13),(23,3),(26,6)],color,2)
        elif kind in ('plasma','meteor'):
            a.oval(d,(10,6,29,26),INK);a.oval(d,(12,8,27,24),color);a.oval(d,(16,11,23,20),'#f1e4bd')
            for y in (9,16,23):a.line(d,[(1,y),(13,y)],'#628f92' if kind=='plasma' else '#b47758',2)
        elif kind in ('grenade','cluster','chain','mine'):
            a.poly(d,[(9,8),(21,6),(27,14),(23,25),(11,26),(6,18)],INK)
            a.poly(d,[(11,10),(20,9),(23,15),(20,22),(11,22),(9,17)],color)
            a.box(d,(13,5,18,9),'#c5ccb1')
            if kind in ('cluster','chain'):
                for x,y in ((8,11),(20,11),(12,21)):a.box(d,(x,y,x+3,y+3),'#f0e3bd')
        else:
            # Rocket, split and homing have different fins / seeker clusters.
            a.poly(d,[(7,10),(22,10),(31,16),(22,22),(7,22),(4,27),(3,20),(5,16),(3,10),(4,5)],INK)
            a.poly(d,[(9,12),(22,12),(28,16),(22,19),(9,19)],'#b7c5b7')
            a.box(d,(19,12,22,18),color);a.poly(d,[(7,13),(7,19),(0,17)],'#e2a16c')
            if kind=='split':a.line(d,[(14,9),(14,23)],color,2);a.line(d,[(8,7),(22,7)],color,2)
            if kind=='homing':a.box(d,(23,14,26,17),'#d6e49c');a.box(d,(11,9,13,23),'#81996b')
        return im
    # Weapon hulls: receiver and grip share manufacturing language, no shared silhouette.
    if kind in ('mine','turret'):
        if kind=='mine':
            a.poly(d,[(3,22),(8,16),(25,16),(29,22),(27,27),(4,27)],INK)
            a.poly(d,[(6,22),(10,18),(24,18),(26,22),(24,24),(6,24)],'#9aa99c')
            a.box(d,(13,18,20,20),color);a.line(d,[(23,18),(23,7),(26,5)],'#a1bcb0',1)
        else:
            a.line(d,[(16,18),(5,29)],INK,4);a.line(d,[(17,18),(29,29)],INK,4)
            a.line(d,[(16,18),(6,28)],'#a1b3a4',2);a.line(d,[(17,18),(28,28)],'#718d8b',2)
            a.poly(d,[(7,12),(15,8),(23,12),(22,22),(9,22)],INK)
            a.box(d,(10,13,21,19),'#6e9293');a.box(d,(15,10,30,13),'#c5cdb5')
            a.box(d,(10,15,14,17),color);a.line(d,[(9,12),(6,5)],'#a2baad',1)
        if mode=='held':
            # Portable remote control, muzzle stays at (30,14) like other held weapons.
            im=a.rgba((32,32));d=ImageDraw.Draw(im);a.box(d,(10,10,27,21),INK);a.box(d,(12,12,25,19),'#82968b');a.box(d,(15,13,22,16),color);a.line(d,[(26,13),(30,14)],'#d2d9b8',2)
        return im
    if kind in ('rocket','split','homing','meteor','plasma'):
        tall=4 if kind in ('split','meteor') else 7
        a.poly(d,[(3,9),(7,tall),(25,tall),(29,10),(31,14),(29,19),(9,20),(5,18)],INK)
        a.box(d,(7,tall+2,25,17),'#7e9593');a.line(d,[(8,tall+1),(24,tall+1)],EDGE,1)
        a.oval(d,(24,9,30,18),INK);a.oval(d,(26,11,29,16),color)
        a.box(d,(13,19,18,25),'#53665d')
        if kind=='split':
            for y in (7,12,17):a.box(d,(11,y,25,y+1),color)
        elif kind=='homing':a.box(d,(6,6,12,9),'#b6cf89');a.box(d,(18,6,22,9),color)
        elif kind=='meteor':a.poly(d,[(8,6),(10,1),(15,1),(17,6)],'#b98c67');a.box(d,(20,8,24,16),color)
        elif kind=='plasma':a.oval(d,(10,6,22,17),INK);a.oval(d,(13,8,20,15),color)
        return im
    a.poly(d,[(2,12),(9,8),(22,8),(26,11),(31,12),(31,16),(23,18),(19,23),(14,23),(15,18),(7,19),(2,17)],INK)
    a.box(d,(8,10,25,16),'#78918e');a.line(d,[(10,9),(22,9)],EDGE,1)
    a.box(d,(27,13,30,14),'#ced6bb');a.box(d,(15,18,18,22),'#7b8b69')
    if kind in ('bullet','spread','drill','spiral'):
        a.box(d,(20,12,28,14),color)
        if kind=='spread':a.box(d,(10,16,26,18),'#bd9b65');a.box(d,(21,11,30,12),'#d5c191')
        if kind=='drill':
            for x in (20,23,26):a.line(d,[(x,10),(x+2,14),(x,17)],color,1)
        if kind=='spiral':a.oval(d,(18,10,24,16),color)
    elif kind in ('laser','bounce','thunder','storm'):
        a.box(d,(10,12,22,14),color)
        if kind=='bounce':a.poly(d,[(23,7),(29,10),(26,15),(29,19),(23,20)],color)
        if kind=='thunder':a.line(d,[(22,9),(25,4),(29,5)],'#c2b1d7',2)
        if kind=='storm':
            for x in (10,17,24):a.line(d,[(x,10),(x,4),(x+3,2)],'#c3b4d8',2)
    elif kind in ('flame','wideflame'):
        a.box(d,(5,5,13,10),'#9d6955');a.box(d,(8,6,11,8),'#d4b58d')
        a.box(d,(21,11,29,17),color)
        if kind=='wideflame':a.poly(d,[(23,9),(31,7),(31,20),(23,18)],'#e4b07e')
    else:
        a.oval(d,(10,7,23,19),INK);a.oval(d,(12,9,21,17),color)
        if kind=='cluster':
            for x in (12,17,22):a.box(d,(x,9,x+2,16),'#c2caa7')
        if kind=='chain':a.line(d,[(11,7),(17,4),(23,7)],'#e5acaf',2)
    return im

def weapon_fx(index, kind, color, frame, special=False):
    im=a.rgba((64,64));d=ImageDraw.Draw(im);rng=random.Random(SEED+index*37+frame)
    radius=(8,15,23,29)[frame]
    if kind in ('thunder','storm','bounce','laser'):
        for n in range(3 if kind!='storm' else 6):
            angle=n*math.tau/(3 if kind!='storm' else 6)+.2
            pts=[(32,32),(32+math.cos(angle)*radius*.5,32+math.sin(angle)*radius*.5-5),(32+math.cos(angle)*radius*.7+3,32+math.sin(angle)*radius*.7),(32+math.cos(angle)*radius,32+math.sin(angle)*radius)]
            a.line(d,pts,color,3);a.line(d,pts,'#ece7cd',1)
        if kind=='storm' and special:
            for x,y in ((15,20),(28,14),(41,19)):a.oval(d,(x-10,y-7,x+11,y+6),'#686c8f');a.line(d,[(x-6,y-6),(x+6,y-6)],'#bdc1ca',2)
    elif kind in ('flame','wideflame'):
        for n in range(5 if kind=='wideflame' else 3):
            x=17+n*7 if kind=='wideflame' else 25+n*6;y=43-frame*5-(n%2)*8
            a.poly(d,[(x-8,y+6),(x-7,y-7),(x+1,y-18),(x+3,y-3),(x+8,y+3),(x+3,y+10)],'#ab4b45')
            a.poly(d,[(x-3,y+4),(x,y-9),(x+4,y+3),(x,y+7)],'#e6bc78')
    elif kind in ('rocket','split','grenade','cluster','chain','plasma','meteor','mine'):
        pts=[]
        for n in range(16):
            angle=n*math.tau/16;r=radius+(3 if n%2 else -2)
            pts.append((32+math.cos(angle)*r,32+math.sin(angle)*r*.85))
        if frame<3:a.poly(d,pts,'#79584e' if kind!='plasma' else '#367279')
        if frame<2:a.oval(d,(32-radius*.7,32-radius*.6,32+radius*.7,32+radius*.6),color);a.box(d,(28,28,36,35),'#efe2bc')
        for n in range(8 if kind in ('cluster','split') else 5):
            angle=n*math.tau/(8 if kind in ('cluster','split') else 5)
            x=32+math.cos(angle)*radius;y=32+math.sin(angle)*radius
            a.line(d,[(x,y),(x-math.cos(angle)*4,y-math.sin(angle)*4)],color,2)
        if special:d.ellipse((32-radius,32-radius*.65,32+radius,32+radius*.65),outline=color,width=2)
        if kind=='chain':a.line(d,[(5,24),(15,20),(23,27)],'#e8b9af',2)
    else:
        for n in range(6 if kind=='spread' else 4):
            angle=n*math.tau/(6 if kind=='spread' else 4)+.2;r=radius+rng.randrange(-2,3)
            a.line(d,[(32+math.cos(angle)*4,32+math.sin(angle)*4),(32+math.cos(angle)*r,32+math.sin(angle)*r)],color,2)
        if frame<2:a.box(d,(29,29,34,34),'#f1eacb')
    return im

def terrain(under):
    frames=[];base=a.tiles(under)
    for variant in range(4):
        for index in range(16):
            rng=random.Random(SEED+index*41+variant+int(under)*1000)
            if not under and index<8:im=base.crop((index%4*32,index//4*32,index%4*32+32,index//4*32+32))
            else:
                im=a.rgba((32,32));d=ImageDraw.Draw(im)
                a.box(d,(0,0,31,31),INK);a.box(d,(1,2,30,30),'#405760' if index<8 else '#45374e')
            d=ImageDraw.Draw(im)
            if under:
                if index in (0,1,2,6,7,15):
                    y=28 if index==1 else 0
                    a.box(d,(0,y,31,min(31,y+2)),'#a7b5a4');a.box(d,(3,7,28,23),'#243b47')
                    for x in (5,24):a.box(d,(x,9,x+2,11),'#899d93')
                    if index==2:a.box(d,(0,0,2,31),'#afbaaa')
                    if index==6:a.box(d,(0,14,31,17),'#8e9e95')
                    if index==15:
                        for x in range(-8,32,10):a.line(d,[(x,7),(x+12,25)],'#b0a16e',3)
                elif index in (3,4,5):
                    if index!=4:a.box(d,(0,8,31,23),INK);a.box(d,(0,10,31,21),'#6f8e8a');a.box(d,(0,10,31,12),'#b3c4ad')
                    if index!=3:a.box(d,(8,0,23,31),INK);a.box(d,(10,0,21,31),'#657f80');a.box(d,(10,0,12,31),'#a7bda8')
                elif index in (8,9,10,11):
                    for k in range(3):
                        x=rng.randrange(-3,23);y=k*12-3
                        plated(d,[(x,y+3),(x+9,y),(x+19,y+5),(x+16,y+12),(x+2,y+13)],'#555568' if index!=11 else '#785c70')
                    if index==9:a.line(d,[(0,0),(31,0)],'#a3ac91',2)
                    if index==10:a.line(d,[(0,31),(31,31)],'#908b94',2)
                    if index==11:a.line(d,[(12,0),(17,10),(10,21),(16,31)],'#a8ad7c',3)
                else:
                    a.box(d,(2,2,29,29),'#7d8d89');a.line(d,[(4,5),(27,27)],'#bbc2a2',3)
                    if index>=13:a.line(d,[(13,0),(16,14),(9,23),(13,31)],INK,3)
                    if index==14:a.box(d,(9,0,23,22),INK)
            elif index>=8:
                a.box(d,(1,1,30,3),'#a3b19d');a.box(d,(3,7,28,24),'#2b414a')
                if index%3==0:a.line(d,[(4,23),(27,8)],'#778b7f',3)
                elif index%3==1:
                    for x in range(3,29,8):a.box(d,(x,9,x+3,20),'#536c70')
                else:a.box(d,(8,8,23,22),'#5d7166');a.box(d,(11,11,19,13),'#b3b58c')
            for k in range(variant):
                x=rng.randrange(4,27);y=rng.randrange(5,28);a.line(d,[(x,y),(min(30,x+3),y+1)],'#81918a',1)
            frames.append(im)
    return a.atlas(frames,8)

def generate(root):
    root=Path(root);output=root/'assets/art-refresh/unified-01';output.mkdir(parents=True,exist_ok=True)
    records={};mapping=[]
    weapon_source=(root/'js/data.js').read_text(encoding='utf-8')
    weapons=[{'id':m[0],'name':m[1],'type':m[2],'color':m[3]} for m in re.findall(r'\{\s*id:\s*"([A-Z]-\d\d)",\s*name:\s*"([^"]+)".*?type:\s*"([^"]+)".*?color:\s*"(#[0-9a-fA-F]+)"',weapon_source)]
    assert len(weapons)==20, 'Read the existing 20-weapon registry; never invent a second ID list'
    def save(path,im,cell,logical,states,owner,original,anchor,columns=None):
        target=output/path;target.parent.mkdir(parents=True,exist_ok=True);im.save(target,optimize=True)
        cols=columns or im.width//cell[0];rows=im.height//cell[1];count=cols*rows
        ids=[f'{owner}:{states[i%len(states)]}:{i//len(states)}' for i in range(count)]
        records[path]={'size':list(im.size),'cell':list(cell),'logicalCell':list(logical),'columns':cols,'frames':count,'states':states,'frameIds':ids,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
        mapping.append({'assetId':owner+':'+Path(path).stem,'purpose':path.split('/')[0],'missions':['M01','M02'],'owner':owner,'original':'assets/'+original,'unified':'assets/art-refresh/unified-01/'+path,'frames':count,'states':states,'anchor':anchor,'generator':'tools/art_unification.py','status':'LAB_PREVIEW_READY'})
    for kind in ('ranger','scout','guardian','wing'):
        sheet=a.atlas([player(kind,f) for f in range(12)],12)
        for far in (False,True):save(f'{"far" if far else "sprites"}/{kind}.png',far_sprite(sheet) if far else sheet,(48,64),(24,32),POSES,kind.upper()+(':far' if far else ''),'sprites/player/classes.png',{'topLeft':[-12,0],'muzzleWorld':['x+18 / x-3','y+13']})
    for kind,(id,w,h,old) in ENEMIES.items():
        frames=[]
        for variant in range(3 if id.startswith('E') else 1):
            for f in range(6):
                im=enemy(kind,f)
                if variant:im=b.remap(im,{'#ad6976':'#996052' if variant==1 else '#88586d','#d98e82':'#cf9d77' if variant==1 else '#bb8493','#b08773':'#99826f' if variant==1 else '#9c798a'})
                frames.append(im)
        sheet=a.atlas(frames,6)
        for far in (False,True):save(f'{"far" if far else "sprites"}/{kind}.png',far_sprite(sheet) if far else sheet,(w*2,h*2),(w,h),ENEMY_POSES,id+(':far' if far else ''),old,{'centerX':0,'top':'existing y/feet','weakCore':[4,60] if kind=='queen' else None})
    for mode,path,cell in [('icon','icons',32),('held','equipped',32),('shot','projectiles',32)]:
        frames=[weapon_art(i,w['type'],w['color'],mode) for i,w in enumerate(weapons)]
        save(f'weapons/{path}.png',a.atlas(frames,20),(32,32),(16,16),[w['id'] for w in weapons],'WEAPONS20:'+mode,'sprites/weapons/'+('weapon_icons.png' if mode=='icon' else 'equipped.png' if mode=='held' else 'projectiles.png'),{'muzzleSource':[30,14]} if mode=='held' else {'center':[16,16]})
    for special,name in ((False,'impacts'),(True,'special')):
        frames=[weapon_fx(i,w['type'],w['color'],f,special) for i,w in enumerate(weapons) for f in range(4)]
        save(f'weapons/{name}.png',a.atlas(frames,4),(64,64),(32,32),[f'{w["id"]}:{f}' for w in weapons for f in range(4)],'WEAPONS20:'+name,'effects/weapon_fx.png',{'center':[16,16]},4)
    # Per-weapon records resolve shared atlases to the exact owned cell / row.
    for i,w in enumerate(weapons):
        for name in ('icons','equipped','projectiles','impacts','special'):
            path=f'weapons/{name}.png';fx=name in ('impacts','special')
            old='assets/'+('effects/weapon_fx.png' if fx else 'sprites/weapons/'+{'icons':'weapon_icons','equipped':'equipped','projectiles':'projectiles'}[name]+'.png')
            if fx and i<8:old='js/game.js' # Legacy impacts/lightning were procedural, not rows in the expansion atlas.
            mapping.append({'assetId':f'{w["id"]}:{name}','purpose':name,'missions':['M01','M02'],'owner':w['id'],'original':old,'originalRendering':'drawHitEffect / drawEffects / explosion.png' if fx and i<8 else 'atlas','unified':'assets/art-refresh/unified-01/'+path,'frames':4 if fx else 1,'states':[f'{w["id"]}:{f}' for f in range(4)] if fx else [w['id']],'sourceRect':[0,i*64,256,64] if fx else [i*32,0,32,32],'anchor':{'center':[16,16]} if name!='equipped' else {'muzzleSource':[30,14]},'generator':'tools/art_unification.py','status':'LAB_PREVIEW_READY'})
    for under,name in ((False,'city'),(True,'underground')):
        layers=b.background_layers(under)
        for depth,layer in zip(('far','middle','near'),layers):save(f'backgrounds/{name}_{depth}.png',layer,(640,360),(320,180),[depth],name+':'+depth,'backgrounds/'+name+'.png',{'origin':[0,0]})
        save(f'backgrounds/{name}.png',a.composite(layers),(640,360),(320,180),['composite'],name,'backgrounds/'+name+'.png',{'origin':[0,0]})
        save(f'tiles/{name}.png',terrain(under),(32,32),(16,16),[f'tile{i}:variant{v}' for v in range(4) for i in range(16)],name+':tiles','tiles/'+('underground_tiles.png' if under else 'city_tiles.png'),{'topLeft':[0,0]},8)
    for name,w,h,frames in [('acid',16,16,4),('wave',32,24,4),('nestBreak',64,64,8),('bossBreak',128,96,8)]:
        cells=[]
        for f in range(frames):
            if name=='acid':
                im=weapon_art(5,'plasma','#b6cf7f','shot',f);d=ImageDraw.Draw(im)
                a.line(d,[(3,7+f*2),(12,12+f)],'#a4bd81',2)
            elif name=='wave':
                im=a.rgba((64,48));d=ImageDraw.Draw(im)
                points=[(2,44),(14,24+f),(24,35),(39,9+f*2),(51,29),(62,44)]
                a.line(d,points,INK,7);a.line(d,points,'#a1bb80',4);a.line(d,[(x,y-2) for x,y in points], '#dfdfad',2)
            else:
                im=weapon_fx(5,'plasma' if name=='wave' else 'cluster','#b9d594',f%4,True)
                if frames==8 and f>=4:
                    # Fading fragments instead of restarting the explosion animation.
                    im=a.rgba((64,64));d=ImageDraw.Draw(im)
                    for k in range(8):
                        angle=k*math.tau/8;r=18+(f-4)*4
                        x=32+math.cos(angle)*r;y=32+math.sin(angle)*r*.8
                        a.box(d,(x,y,x+2,y+2),'#b5ba8b')
            im=im.resize((w*2,h*2),Image.Resampling.NEAREST);cells.append(im)
        save(f'effects/{name}.png',a.atlas(cells,frames),(w*2,h*2),(w,h),[f'{name}:{i}' for i in range(frames)],name,'effects/'+{'wave':'ground_wave','nestBreak':'nest_break','bossBreak':'boss_break'}.get(name,name)+'.png',{'center':[w/2,h/2]})
    manifest={'version':'0.2.3-C','style':'UNIFIED 01','status':'LAB_PREVIEW_ONLY','seed':SEED,'sampling':'nearest','assets':records,'mapping':mapping,'weapons':weapons,'missingRuntimeTargets':[],'limitations':['Ranger/Wing and M01/M02 backdrop shapes intentionally retain Study 01-B basis.','Unused compatibility frames do not add class abilities.','Enemy frame 5 is only selected for queen weakCore.open; other kinds keep an unused compatibility cell.','City tiles 8-15 are optional unplaced decoration studies; all existing M01 runtime tile indices 0-7 are covered.','UI typography, health bars, pickup art and procedural particle primitives remain ORIGINAL; outside this art set.','Far sprites are an experimental LAB-only color-cluster simplification, not official adoption.']}
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    # Asset-level comparison, explicitly not an in-game screenshot.
    sheet=Image.new('RGB',(1100,1120),'#091420');d=ImageDraw.Draw(sheet)
    d.text((14,12),'UNIFIED 01 / ASSET CONTACT SHEET - NOT A GAME SCREENSHOT',fill='#d6e3d9')
    y=48
    for row,kinds in enumerate((('ranger','scout','guardian','wing'),('crawler','spider','needle','beetle','worm','spitter'),('boss','queen','nest','barrier'))):
        x=14
        for kind in kinds:
            im=player(kind,0) if row==0 else enemy(kind,5 if kind=='queen' else 0)
            scale=2 if row==0 else 1
            sheet.paste(im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST),(x,y+20),im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST))
            d.text((x,y),kind.upper(),fill='#d6e3d9');x+=max(165,im.width*scale+12)
        y+=(165 if row<2 else 230)
    for i,w in enumerate(weapons):
        x=14+(i%10)*108;yy=y+(i//10)*100
        im=weapon_art(i,w['type'],w['color']).resize((64,64),Image.Resampling.NEAREST)
        sheet.paste(im,(x,yy+18),im);d.text((x,yy),w['id'],fill='#c6d4c7')
    y+=210
    for x,under in ((14,False),(550,True)):
        bg=a.composite(b.background_layers(under)).resize((520,292),Image.Resampling.NEAREST);sheet.paste(bg,(x,y));d.text((x,y+295),'M02 UNDERGROUND' if under else 'M01 CITY',fill='#d6e3d9')
    sheet.save(output/'contact-sheet.png',optimize=True)
    print(f'UNIFIED 01: {len(records)+1} PNG; {sum(r["frames"] for r in records.values())} indexed cells; {len(mapping)} mapping rows.')

if __name__=='__main__':generate(Path(__file__).resolve().parents[1])
