"""FINAL DEFENSE 01: deterministic, project-owned Pillow pixel artwork.

Only assets/final-defense-01 is written. Existing art and game data are never
modified. Source art is 2x logical pixels, using integer edges and no AA.
"""
from pathlib import Path
import hashlib
import json
import math
import random
from PIL import Image, ImageDraw
try:
    from .mothership_assets import panel, line, actor as mothership_actor
    from .coastal_assets import plate
    from .art_unification import far_sprite
except ImportError:
    from mothership_assets import panel, line, actor as mothership_actor
    from coastal_assets import plate
    from art_unification import far_sprite

SEED = 10001008
INK = '#101625'
EDGE = '#d2d9bc'
TEAL = '#a8c8b8'
AMBER = '#e2bd91'
BIO = '#a995b1'
SCENES = ('deep', 'arsenal', 'network', 'source', 'final')
ENDINGS = ('earth', 'escape', 'silence')
ACTORS = {'overseer': (32, 28), 'biobreaker': (48, 42),
          'coreguard': (36, 34), 'overmind1': (176, 112),
          'overmind2': (176, 112), 'overmind3': (176, 112),
          'defensenode': (28, 32)}
STATES = ['idle', 'move', 'attack', 'death', 'hit', 'open', 'damaged', 'phase']
EFFECTS = ('finalShield', 'finalBeam', 'finalPulse', 'finalSpore',
           'finalTransition', 'finalCollapse')


def background(scene):
    scenes = (*SCENES, *ENDINGS)
    rng = random.Random(SEED + scenes.index(scene) * 503)
    im = Image.new('RGBA', (640, 360), '#121c2d'); d = ImageDraw.Draw(im)
    for y, color in ((38, '#1c293a'), (136, '#293749'), (239, '#24333e'), (302, '#1d2b35')):
        d.rectangle((0, y, 639, 359), fill=color)
    if scene in ENDINGS:
        d.rectangle((0, 0, 639, 359), fill='#0c1628')
        for n in range(95):
            x, y = rng.randrange(640), rng.randrange(280)
            d.rectangle((x, y, x + (n % 9 == 0), y), fill=('#738da4', '#acbfb8')[n % 2])
        if scene == 'earth':
            d.ellipse((107, 68, 533, 494), fill='#3c637a', outline='#abc1be', width=4)
            for poly in ([(145, 180), (182, 126), (239, 115), (278, 152), (260, 207), (204, 217)],
                         [(310, 225), (359, 141), (430, 154), (482, 225), (437, 265), (390, 249)],
                         [(211, 269), (260, 239), (298, 274), (277, 345), (239, 359)]):
                d.polygon(poly, fill='#829b83')
            for yy in (146, 227, 298):
                line(d, [(132, yy), (203, yy-9), (273, yy+7), (353, yy-8), (498, yy+2)], '#c8d1bd', 4)
        elif scene == 'escape':
            d.ellipse((316, 207, 790, 666), fill='#365973', outline='#a7b8b1', width=3)
            for x, y, scale in ((179, 120, 1), (295, 83, 1), (424, 145, 1)):
                plate(d, [(x-33, y+11), (x-13, y-5), (x+10, y-8), (x+43, y+8), (x+4, y+17)], '#9aaeb3')
                line(d, [(x-21,y+13),(x-42,y+29)], '#dbbf9a', 4)
                line(d, [(x-12,y+16),(x-30,y+34)], '#f0dcc0', 2)
            for x in (37, 65, 98):
                line(d, [(x, 20), (x+40, 62), (x+23, 103)], '#5b6577', 3)
        else:
            # A powerless, fractured core; no new enemy or mission is implied.
            for side in (-1, 1):
                plate(d, [(320+side*24,99),(320+side*112,61),(320+side*171,116),
                          (320+side*128,203),(320+side*45,216)], '#3d4c5d')
                line(d, [(320+side*104,76),(320+side*71,123),(320+side*120,181)], '#78908d', 3)
            d.ellipse((278, 107, 362, 191), fill='#16202f', outline='#657c81', width=4)
            line(d, [(296,119),(321,142),(306,163),(339,179)], '#b6aa95', 3)
        return im
    # Architectural depth uses desaturated dark planes behind playable actors.
    for x in range(-60, 700, 119):
        plate(d, [(x,0),(x+24,0),(x+52,88),(x+32,224),(x+47,359),
                  (x+18,359),(x+7,224),(x+28,91)], '#354455')
        line(d, [(x+7,0),(x+37,91),(x+17,224),(x+31,359)], '#60717a', 2)
    for n in range(18):
        x,y=rng.randrange(615),rng.randrange(20,273)
        d.rectangle((x,y,x+20,y+8),fill='#2c4051',outline='#4d606d')
        if n % 3 == 0:d.rectangle((x+4,y+3,x+8,y+4),fill='#8ba69b')
    if scene == 'deep':
        for x in (126, 320, 514):
            panel(d,(x-67,28,x+67,277),'#44596a')
            d.polygon([(x-45,54),(x+45,54),(x+30,234),(x-30,234)],fill='#172c3c')
            for yy in range(75,230,32):line(d,[(x-30,yy),(x+30,yy)],'#5f817f',3)
    elif scene == 'arsenal':
        for x in (29, 237, 445):
            panel(d,(x,37,x+167,265),'#485f6d')
            d.rectangle((x+17,57,x+149,245),fill='#1b2e3e')
            for yy in (88,154,220):
                plate(d,[(x+29,yy),(x+71,yy-15),(x+119,yy-7),(x+141,yy+17),(x+48,yy+20)],'#677987')
                line(d,[(x+52,yy+2),(x+116,yy+2)],'#a5b9a6',2)
    elif scene == 'network':
        for x,y in ((114,102),(320,168),(526,98)):
            for side in (-1,1):
                line(d,[(x,y),(x+side*59,y-44),(x+side*93,y-44)],'#586b7b',8)
                line(d,[(x,y),(x+side*59,y-44),(x+side*93,y-44)],'#a4b3a8',2)
                line(d,[(x,y),(x+side*47,y+65),(x+side*88,y+65)],'#4d6a6e',6)
            panel(d,(x-34,y-36,x+34,y+37),'#7a8095')
            d.ellipse((x-19,y-20,x+19,y+20),fill='#233c47',outline='#b8c9b5',width=2)
    elif scene == 'source':
        for side in (-1,1):
            for n in range(4):
                x=320+side*(53+n*63)
                line(d,[(x,2),(x-side*23,91),(x+side*7,245),(x-side*22,359)],'#534b67',17)
                line(d,[(x-3,2),(x-side*26,91),(x+side*4,245)],'#877b91',4)
        d.ellipse((249,27,391,251),fill='#293e4b',outline='#829b98',width=4)
        for yy in (60,96,132,168,204):line(d,[(278,yy),(320,yy+17),(362,yy)],'#789d94',4)
    else:
        for side in (-1,1):
            for n in range(5):
                x=320+side*(77+n*46)
                line(d,[(x,0),(320+side*(55+n*31),80),(320+side*(91+n*39),276)],'#4b586e',12)
                line(d,[(x,0),(320+side*(55+n*31),80)],'#8b94a2',3)
        d.ellipse((205,7,435,264),fill='#142d3a',outline='#657e86',width=7)
        d.ellipse((242,46,398,225),fill='#2f4550',outline='#8daca0',width=3)
        for yy in range(70,222,28):line(d,[(259,yy),(320,yy+12),(381,yy)],'#547771',3)
    return im


def actor(kind, frame):
    w,h=ACTORS[kind]; im=Image.new('RGBA',(w*2,h*2)); d=ImageDraw.Draw(im); s=frame%2
    if kind == 'overseer':
        for side in (-1,1):
            plate(d,[(32+side*6,17),(32+side*28,6+s),(32+side*30,30),(32+side*14,42)],'#7b8d9f')
            line(d,[(32+side*8,25),(32+side*23,18),(32+side*24,33)],EDGE,2)
        panel(d,(19,11,45,41),'#9693a5')
        d.rectangle((23,21,41,26),fill=INK);d.rectangle((27,22,37,24),fill=AMBER if frame==2 else TEAL)
        line(d,[(32,12),(32,2),(42,2)],TEAL,2)
        for side in (-1,1):line(d,[(32+side*6,39),(32+side*12,51+s*3)],'#bac3ad',3)
    elif kind == 'biobreaker':
        for side in (-1,1):
            for n in range(2):
                line(d,[(48+side*(12+n*10),43),(48+side*(27+n*9+s),63),(48+side*(31+n*10),82)],INK,9)
                line(d,[(48+side*(12+n*10),43),(48+side*(27+n*9+s),63),(48+side*(31+n*10),82)],'#94a59c',4)
        plate(d,[(9,31),(22,9),(47,1),(74,10),(88,35),(75,61),(46,70),(19,59)],'#918499')
        for x in (25,46,67):panel(d,(x-9,15,x+10,51),'#81999c')
        plate(d,[(2,35),(18,25),(40,34),(42,52),(21,61),(4,51)],'#b1b9a5')
        d.rectangle((7,37,27,40),fill=AMBER if frame==2 else '#b8dcc4')
        line(d,[(63,16),(69,2),(77,5)],'#c0c5ad',5)
    elif kind == 'coreguard':
        for side in (-1,1):
            panel(d,(36+side*19-11,17,36+side*19+11,48),'#8ba19e')
            line(d,[(36+side*8,42),(36+side*(15+s*2),65)],INK,9)
            line(d,[(36+side*8,42),(36+side*(15+s*2),65)],'#bdc5ad',4)
        panel(d,(23,14,49,49),'#91859b')
        plate(d,[(22,16),(31,3),(47,5),(54,20),(42,28),(25,24)],'#a9b7ac')
        d.rectangle((25,15,43,18),fill=AMBER if frame==2 else TEAL)
        # Its broad forward shield identifies the defensive role at tiny zoom.
        plate(d,[(1,21),(15,14),(28,23),(27,49),(13,57),(2,47)],'#6f99a0')
        line(d,[(6,26),(14,23),(22,29),(21,44),(13,49),(7,43)],EDGE,2)
    elif kind.startswith('overmind'):
        form=int(kind[-1]);cx=176;cy=112
        # Same anchor, independently authored mechanical / biological / broken forms.
        for side in (-1,1):
            for n in range(4):
                joint=(cx+side*(80+n*16),46+n*35)
                tip=(cx+side*(120+n*14),14+n*65)
                line(d,[(cx+side*40,cy-10+n*10),joint,tip],INK,15)
                line(d,[(cx+side*40,cy-10+n*10),joint,tip],'#718594' if form==1 else '#897f99',9)
                line(d,[joint,tip],EDGE,2)
                d.ellipse((joint[0]-6,joint[1]-6,joint[0]+6,joint[1]+6),fill=TEAL,outline=INK,width=2)
            plate(d,[(cx+side*28,49),(cx+side*91,17),(cx+side*146,53),
                      (cx+side*154,121),(cx+side*103,164),(cx+side*43,147)],'#7d8d9e' if form==1 else '#93869c')
            for n in range(3):
                x=cx+side*(64+n*28)
                line(d,[(x,43+n*8),(x+side*17,76+n*11),(x+side*7,116+n*10)],'#c6cbb6',3)
            if form>=2:
                for n in range(3):
                    x=cx+side*(58+n*30)
                    d.ellipse((x-11,64+n*13,x+11,94+n*13),fill='#667f82',outline='#b8c4ad',width=2)
        plate(d,[(135,31),(159,3),(195,3),(220,31),(242,104),
                  (222,177),(176,218),(130,177),(109,104)],'#8c9a9e' if form==1 else '#9b8ca4')
        for x in (153,184):d.rectangle((x,40,x+16,45),fill=AMBER if frame==2 else EDGE)
        d.ellipse((123,59,229,165),fill=INK,outline=EDGE,width=4)
        d.ellipse((131,67,221,157),fill='#324c58',outline=TEAL,width=3)
        if form==1 and frame not in (5,6):
            for side in (-1,1):
                plate(d,[(176,72),(176+side*36,82),(176+side*35,141),(176,153)],'#809ba1')
            line(d,[(176,74),(176,151)],EDGE,3)
        else:
            d.ellipse((141,77,211,147),fill='#9b8f9f',outline='#d5d8b8',width=3)
            for side in (-1,1):line(d,[(176+side*20,85),(176+side*27,111),(176+side*16,138)],'#c6c5a8',3)
            d.polygon([(176,83),(201,112),(176,141),(151,112)],fill=AMBER)
            d.rectangle((169,102,183,122),fill='#f2e9bf')
        if form==3:
            for side in (-1,1):
                line(d,[(176+side*86,23),(176+side*62,63),(176+side*89,99),(176+side*66,144)],INK,6)
                line(d,[(176+side*76,38),(176+side*57,67)],AMBER,2)
                d.polygon([(176+side*113,137),(176+side*151,144),(176+side*129,174)],fill=INK)
    else:
        im=mothership_actor('commanddevice',frame);d=ImageDraw.Draw(im)
        d.polygon([(28,15),(42,31),(28,46),(14,31)],fill='#304b58',outline=EDGE,width=2)
        d.rectangle((25,26,31,36),fill=AMBER if frame==2 else TEAL)
    if frame==3:
        line(d,[(w*.7,h*.3),(w*1.15,h*.9),(w*.9,h*1.6)],INK,4)
    if frame==4:d.rectangle((w-7,5,w+7,7),fill='#f3e9bf')
    return im


def tiles():
    im=Image.new('RGBA',(256,64));d=ImageDraw.Draw(im)
    for i in range(16):
        x=i%8*32;y=i//8*32
        d.rectangle((x,y,x+31,y+31),fill=('#4e6575','#5b566d','#4c6c72','#596775')[i%4])
        line(d,[(x,y+1),(x+31,y+1)],EDGE,2);line(d,[(x,y+30),(x+31,y+30)],INK,2)
        if i%3==0:
            panel(d,(x+3,y+6,x+28,y+27),'#7e8f9b')
            line(d,[(x+8,y+14),(x+23,y+14)],TEAL,2)
        elif i%3==1:
            line(d,[(x+5,y+27),(x+10,y+8),(x+22,y+20),(x+29,y+5)],'#b3b4a4',3)
        else:
            for yy in (9,20):line(d,[(x+3,y+yy),(x+28,y+yy)],'#93a8a7',2)
    return im


def effects(kind):
    im=Image.new('RGBA',(512,64));d=ImageDraw.Draw(im)
    for f in range(8):
        rng=random.Random(SEED+f*73);cx=f*64+32;cy=32;r=5+f*3
        if kind=='finalShield':
            d.polygon([(cx,cy-r),(cx+r,cy-r//2),(cx+r,cy+r//2),(cx,cy+r),
                       (cx-r,cy+r//2),(cx-r,cy-r//2)],outline=TEAL,width=2)
            line(d,[(cx-7,cy),(cx-1,cy+5),(cx+8,cy-7)],EDGE,2)
        elif kind=='finalBeam':
            line(d,[(cx,2),(cx,61)],'#7c9ca5',8 if f<5 else 4)
            line(d,[(cx,2),(cx,61)],EDGE,3 if f<5 else 1)
            for side in (-1,1):line(d,[(cx,cy),(cx+side*r,cy+12)],AMBER,2)
        elif kind=='finalSpore':
            for n in range(7):
                angle=n*math.tau/7+f*.11;x=cx+round(math.cos(angle)*r);y=cy+round(math.sin(angle)*r)
                d.ellipse((x-2,y-2,x+2,y+2),fill=BIO,outline=EDGE)
        elif kind=='finalTransition':
            for n in range(3):
                rr=max(2,r-n*6);d.arc((cx-rr,cy-rr,cx+rr,cy+rr),20+n*65,270+n*35,fill=TEAL if n%2 else BIO,width=2)
            d.rectangle((cx-2,cy-2,cx+2,cy+2),fill=EDGE)
        else:
            d.ellipse((cx-r,cy-r,cx+r,cy+r),outline=AMBER if kind=='finalCollapse' else TEAL,width=3)
            if kind=='finalCollapse' and f<5:d.ellipse((cx-r//2,cy-r//2,cx+r//2,cy+r//2),fill='#e9d5a8')
            for n in range(8):
                angle=n*math.tau/8;rr=r+rng.randrange(0,4);x=cx+round(math.cos(angle)*rr);y=cy+round(math.sin(angle)*rr)
                d.rectangle((x,y,x+2,y+2),fill=EDGE if n%2 else BIO)
    return im


def generate(root):
    out=Path(root)/'assets/final-defense-01'; records=[]
    def save(path,im,cell,logical,states,anchor=None):
        target=out/path;target.parent.mkdir(parents=True,exist_ok=True);im.save(target,optimize=True)
        records.append({'path':path,'size':list(im.size),'cell':list(cell),'logicalCell':list(logical),
                        'frames':len(states),'states':states,'anchor':anchor or {'topLeft':[0,0]},
                        'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    for scene in (*SCENES,*ENDINGS):save('backgrounds/'+scene+'.png',background(scene),(640,360),(320,180),[scene])
    save('tiles/final-defense.png',tiles(),(32,32),(16,16),['tile'+str(i) for i in range(16)])
    for kind,(w,h) in ACTORS.items():
        sheet=Image.new('RGBA',(w*16,h*2))
        for f in range(8):sheet.alpha_composite(actor(kind,f),(f*w*2,0))
        anchor={'centerX':0,'topOffset':-24,'coreCenter':[0,32]} if kind.startswith('overmind') else {'centerX':0,'feet':h}
        for far in (False,True):save(('far/' if far else 'sprites/')+kind+'.png',far_sprite(sheet) if far else sheet,(w*2,h*2),(w,h),STATES,anchor)
    for name in EFFECTS:save('effects/'+name+'.png',effects(name),(64,64),(32,32),[name+':'+str(f) for f in range(8)])
    contact=Image.new('RGB',(1280,1440),'#17202e');d=ImageDraw.Draw(contact)
    d.text((12,10),'FINAL DEFENSE 01 / ASSET CONTACT ONLY - NOT A GAME SCREENSHOT',fill=EDGE)
    for n,scene in enumerate((*SCENES,*ENDINGS)):
        x=10+n%3*422;y=34+n//3*249
        contact.paste(background(scene).resize((416,234),Image.Resampling.NEAREST),(x,y));d.text((x,y+235),scene.upper(),fill=EDGE)
    x=15
    for kind in ('overseer','biobreaker','coreguard','defensenode'):
        a=actor(kind,0);contact.paste(a,(x,803),a);d.text((x,894),kind.upper(),fill=EDGE);x+=a.width+35
    for n in range(1,4):
        a=actor('overmind'+str(n),5);x=15+(n-1)*420;contact.paste(a,(x,936),a);d.text((x,1167),'OVERMIND FORM '+str(n),fill=EDGE)
    contact.paste(tiles(),(15,1220))
    for n,name in enumerate(EFFECTS):
        a=effects(name).crop((192,0,256,64));x=300+n*159;contact.paste(a,(x,1220),a);d.text((x,1292),name.replace('final',''),fill=EDGE)
    d.text((15,1392),'UNIFIED 01 / SOURCE SCALE 2 / NEAREST / SEED 10001008 / EXISTING ASSETS UNTOUCHED',fill=EDGE)
    save('contact-sheet.png',contact,contact.size,contact.size,['preview'])
    catalog={'version':'1.0.0','style':'UNIFIED 01 / FINAL DEFENSE 01','seed':SEED,'sourceScale':2,
             'sampling':'nearest','generator':'tools/final_defense_assets.py','missions':['M08'],'assets':records,
             'tileIndex':{'hull':0,'ceiling':1,'container':2,'gate':3,'biofield':4},
             'notes':['Only assets/final-defense-01 is written.','All three forms share source core (176,112), world (e.x,e.y+32), top offset -24.',
                      'No artwork changes collision, weapon origins or AI.','Far sheets preserve exact alpha and world anchors.','Ending backgrounds are presentation-only.']}
    (out/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'FINAL DEFENSE 01: {len(records)} PNGs / {sum(r["frames"] for r in records)} cells / seed {SEED}')
    return catalog


if __name__=='__main__':generate(Path(__file__).resolve().parents[1])
