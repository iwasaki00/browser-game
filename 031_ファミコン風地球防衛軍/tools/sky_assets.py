"""SKY 01: deterministic local Pillow artwork, isolated from M01–M03."""
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

SEED = 4007200
ACTORS = {'interceptor': (36,22), 'shielddrone': (32,28), 'heavygunner': (40,36),
          'fortress': (160,96), 'skydevice': (28,32)}
INK = '#090f1b'
EDGE = '#b9c9b8'


def actor(kind, frame):
    w,h = ACTORS[kind]
    im = Image.new('RGBA', (w*2,h*2))
    d = ImageDraw.Draw(im)
    if kind == 'interceptor':
        for side in (-1,1):
            plate(d, [(36,14),(36+side*28,2+frame%2*5),(36+side*33,23),(36+side*12,30)], '#647d95')
        plate(d, [(26,10),(38,3),(47,16),(42,35),(33,42),(25,30)], '#a5a79a')
        d.rectangle((32,15,41,19),fill='#eee0a3')
        if frame==2:d.polygon([(30,30),(36,43),(42,30)],fill='#f2ae6f')
    elif kind == 'shielddrone':
        d.arc((2,2,61,53),10,350,fill='#84b6a9',width=3)
        plate(d,[(10,18),(24,8),(43,10),(56,25),(42,45),(24,48),(8,34)],'#536d7c')
        for x in (15,45):
            d.rectangle((x,15,x+5,39),fill=EDGE)
            d.rectangle((x+1,21,x+4,32),fill='#9be1bb')
        d.rectangle((26,22,38,32),fill='#d5dbb1' if frame!=3 else '#463b49')
    elif kind == 'heavygunner':
        for x in (13,29,49,65):
            d.line([(x,40),(x-3,57+frame%2),(x-6,71)],fill=INK,width=8)
            d.line([(x,40),(x-3,57+frame%2),(x-6,70)],fill='#a8a292',width=3)
        plate(d,[(6,31),(20,17),(55,17),(75,38),(65,54),(16,54)],'#797d87')
        for x in (20,38,56):plate(d,[(x-7,24),(x+4,19),(x+12,36),(x+6,47),(x-8,43)],'#8a8993')
        plate(d,[(28,22),(28,8),(7,5),(2,13),(9,22)],'#8ca0a1')
        d.rectangle((3,10,9,16),fill='#f6c382' if frame==2 else INK)
        d.rectangle((15,32,26,35),fill=EDGE)
    elif kind == 'fortress':
        d.polygon([(0,75),(38,17),(140,2),(278,21),(319,73),(264,156),(63,151)],fill=INK)
        for side in (-1,1):
            for k in range(3):
                x=160+side*(36+k*36)
                plate(d,[(x-side*29,36+k*8),(x+side*18,25+k*10),(x+side*37,73),(x+side*18,130),(x-side*26,132)],'#5f7182' if k%2 else '#75808a')
            d.line([(160+side*115,108),(160+side*138,159),(160+side*124,185)],fill='#414a5b',width=10)
            d.line([(160+side*115,108),(160+side*138,159),(160+side*124,185)],fill=EDGE,width=3)
        plate(d,[(124,51),(158,36),(194,52),(204,117),(180,157),(139,155),(118,116)],'#8c8796')
        # Exact logical weak/core center = sprite (80,64), world (core.x,100).
        d.ellipse((127,95,193,161),fill=INK,outline=EDGE,width=3)
        d.ellipse((136,104,184,152),fill='#f4c986' if frame in (5,6) else '#488d9a')
        d.rectangle((152,115,168,140),fill='#fff0bd' if frame in (5,6) else '#c2dbce')
        if frame>=5:
            for x in (58,110,215,264):d.line([(x,38),(x+7,62),(x-4,86),(x+9,116)],fill=INK,width=4)
        if frame==6:d.rectangle((60,50,87,61),fill='#f3af6b')
    else:
        plate(d,[(4,14),(14,3),(43,3),(52,17),(49,56),(7,61)],'#687584')
        d.rectangle((15,15,41,42),fill=INK)
        d.rectangle((20,19,36,39),fill='#a3dcbd' if frame in (0,1,2) else '#70566c')
        d.line([(10,58),(45,58)],fill=EDGE,width=3)
        if frame==2:d.rectangle((24,3,32,20),fill='#f0cf92')
    if frame==1:
        # Restrained animated vents/pulse, with unchanged silhouette and anchor.
        d.rectangle((w-7,h//2+4,w+7,h//2+6),fill='#b9c9b8')
    if frame==3:d.line([(2,h),(w,h-5),(w*2-2,h+8)],fill='#e4b386',width=3)
    if frame==4:d.rectangle((w-6,5,w+6,7),fill='#fff0cb')
    return im


def generate(root):
    dest=root/'assets'/'sky-01'
    rng=random.Random(SEED)
    records=[]
    def save(path,im,**meta):
        target=dest/path;target.parent.mkdir(parents=True,exist_ok=True);im.save(target)
        records.append({'path':str(path),'size':list(im.size),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),**meta})
    layers=[]
    for depth in range(3):
        im=Image.new('RGBA',(640,360),(17,29,47,255) if depth==0 else (0,0,0,0));d=ImageDraw.Draw(im)
        if depth==0:
            for y in range(0,360,8):d.rectangle((0,y,639,y+7),fill=(17+y//24,29+y//24,47+y//20,255))
            for k in range(12):
                x=rng.randrange(640);y=rng.randrange(30,150);d.line((x,y,x+50,y),fill='#384959',width=2)
            d.polygon([(380,65),(415,50),(485,50),(520,68),(480,80),(418,78)],fill='#354152')
        for x in range(-16,680,32 if depth<2 else 64):
            top=rng.randrange(155+depth*28,238+depth*12)
            color=('#26394b','#344957','#405461')[depth]
            d.rectangle((x,top,x+24+depth*10,359),fill=color)
            d.line((x,top,x+24+depth*10,top),fill=('#3c5262','#50636a','#657b7c')[depth],width=2)
            for wy in range(top+10,340,18):d.rectangle((x+5,wy,x+9,wy+2),fill='#74847c' if depth==2 else '#425761')
        save(f'backgrounds/layer-{depth}.png',im);layers.append(im)
    composite=layers[0].copy()
    for layer in layers[1:]:composite.alpha_composite(layer)
    save('backgrounds/sky.png',composite)
    tiles=Image.new('RGBA',(256,64));d=ImageDraw.Draw(tiles)
    for i in range(16):
        x=(i%8)*32;y=(i//8)*32
        d.rectangle((x,y,x+31,y+31),fill=('#334858','#435463','#586878','#3e4356')[i%4])
        d.line((x,y,x+31,y),fill=EDGE,width=3);d.line((x,y+31,x+31,y+31),fill=INK,width=2)
        d.rectangle((x+5,y+8,x+24,y+23),outline='#70888b',width=1)
        for dx in (3,28):d.point((x+dx,y+5),fill='#bfbb9c')
        if i%4==2:
            for dx in range(2,30,8):d.line((x+dx,y+2,x+dx+4,y+6),fill='#cbb775',width=2)
    save('tiles/sky.png',tiles,cell=[32,32],frames=16)
    for kind,(w,h) in ACTORS.items():
        frames=[actor(kind,f) for f in range(8)]
        for far in (False,True):
            sheet=Image.new('RGBA',(w*2*8,h*2))
            for f,im in enumerate(frames):sheet.alpha_composite(far_sprite(im) if far else im,(f*w*2,0))
            save(('far/' if far else 'sprites/')+kind+'.png',sheet,cell=[w*2,h*2],frames=8,states=['idle','move','attack','death','hit','open','damaged','idle'])
    for name in ('warning','shot','break','shield'):
        sheet=Image.new('RGBA',(512,64))
        for f in range(8):
            d=ImageDraw.Draw(sheet);cx=f*64+32;cy=32;r=5+f*3
            col='#e3b780' if name in ('warning','break') else '#93c9bf'
            points=[(cx+round(math.cos(k*math.tau/8)*r),cy+round(math.sin(k*math.tau/8)*r)) for k in range(9)]
            d.line(points,fill=col,width=3)
            if name=='break':
                for k in range(8):
                    x=cx+round(math.cos(k*math.tau/8)*r);y=cy+round(math.sin(k*math.tau/8)*r)
                    d.rectangle((x,y,x+2,y+2),fill='#f5dfaa')
            else:d.rectangle((cx-3,cy-3,cx+3,cy+3),fill=EDGE)
        save('effects/'+name+'.png',sheet,cell=[64,64],frames=8)
    (dest/'catalog.json').write_text(json.dumps({'version':'0.4.0','seed':SEED,'sampling':'nearest','sourceScale':2,'assets':records},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'SKY 01: {len(records)} isolated PNGs / seed {SEED}')
