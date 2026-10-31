"""MOBILE FORTRESS 01: local deterministic M05 pixel art, isolated output.

Author at exactly two source pixels per world pixel. No antialiasing, external
images, game data imports, or writes to any earlier PNG set.
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

SEED = 5008000
INK = '#090f1b'
EDGE = '#becbb9'
STEEL = '#627b83'
AMBER = '#dcc08b'
MINT = '#99d6bc'
ACTORS = {'assaultroller': (36,24), 'repairdrone': (30,22),
          'sentrywalker': (44,38), 'reactor': (160,96), 'basedevice': (28,32)}
SCENES = ('wilderness','deck','interior','control','reactor')
STATES = ['idle','move','attack','death','hit','open','damaged','idle']


def gear(d,x,y,r,phase,color=STEEL):
    pts=[]
    for k in range(32):
        a=k*math.tau/32+phase;rr=r if k%4 in (0,1) else r*.79
        pts.append((round(x+math.cos(a)*rr),round(y+math.sin(a)*rr)))
    d.polygon(pts,fill=INK);d.ellipse((x-r*.7,y-r*.7,x+r*.7,y+r*.7),fill=color)
    d.ellipse((x-r*.2,y-r*.2,x+r*.2,y+r*.2),fill=INK,outline=EDGE,width=2)
    for k in range(6):
        a=k*math.tau/6+phase
        d.line((x+math.cos(a)*r*.3,y+math.sin(a)*r*.3,x+math.cos(a)*r*.6,y+math.sin(a)*r*.6),fill='#3a515e',width=3)


def tread(d,x,y,w,h,phase=0):
    d.rounded_rectangle((x,y,x+w,y+h),radius=h//2,fill=INK,outline='#83918d',width=2)
    for xx in range(x+h//2,x+w-h//2+1,h):
        d.ellipse((xx-h//3,y+3,xx+h//3,y+h-3),fill='#3e5059',outline='#87988f',width=2)
        d.line((xx,y+5,xx,y+h-5),fill='#263944',width=2)
    for xx in range(x+phase%8,x+w-4,8):
        d.rectangle((xx,y+1,xx+4,y+3),fill='#9aa396')
        d.rectangle((xx,y+h-3,xx+4,y+h-1),fill='#687a7c')


def crawler(canvas,x,y,scale=1):
    # Complete distant fortress, not just an anonymous rectangular silhouette.
    im=Image.new('RGBA',(430,164));p=ImageDraw.Draw(im)
    tread(p,12,112,400,46)
    plate(p,[(3,111),(20,67),(83,45),(348,45),(418,85),(427,113),(365,129),(53,129)],'#465b68')
    for xx in range(65,367,58):
        plate(p,[(xx,65),(xx+45,57),(xx+48,107),(xx-4,109)],'#5b6b73')
        p.line((xx+6,70,xx+34,65),fill='#91a096',width=2)
    plate(p,[(161,49),(174,19),(229,14),(254,34),(244,53)],'#6a787b')
    p.line((220,25,293,20),fill=INK,width=12);p.line((220,23,293,18),fill='#9aa9a1',width=5)
    for xx in (92,121,307):
        p.rectangle((xx,12,xx+12,53),fill=INK);p.rectangle((xx+3,15,xx+8,45),fill='#677f83')
    p.rectangle((263,76,297,116),fill=INK,outline='#b7bfa9',width=2)
    p.line((280,77,280,113),fill='#587178',width=2)
    im=im.resize((round(430*scale),round(164*scale)),Image.Resampling.NEAREST)
    canvas.alpha_composite(im,(int(x),int(y)))


def background(scene):
    rng=random.Random(SEED+SCENES.index(scene)*313)
    im=Image.new('RGBA',(640,360),'#182631');d=ImageDraw.Draw(im)
    if scene in ('wilderness','deck'):
        for y,c in ((0,'#263747'),(64,'#354957'),(118,'#4c5c61'),(174,'#6b7168'),(220,'#68675b')):
            d.rectangle((0,y,639,359),fill=c)
        for x,y,w in ((12,39,92),(238,67,66),(500,35,105)):
            d.line((x,y,x+w,y),fill='#71817d',width=2)
        for n in range(11):
            x=n*67-45;top=rng.randrange(174,216)
            d.polygon([(x,230),(x+21,top),(x+55,top-6),(x+84,231)],fill='#414e52')
        if scene=='deck':
            # Own fortress hull enters foreground; big treads read below deck.
            tread(d,-40,285,720,72)
            plate(d,[(-10,260),(53,231),(600,231),(657,260),(639,291),(0,291)],'#354c59')
            for x in (56,175,310,430,555):
                d.rectangle((x,240,x+72,277),fill='#405964',outline='#768b88',width=2)
            for x in (180,445):
                d.rectangle((x,187,x+20,242),fill=INK);d.rectangle((x+4,191,x+15,238),fill='#566c72')
                d.rectangle((x+3,183,x+17,190),fill='#a5afa1')
        for y in range(265,360,12):
            for n in range(7):
                x=rng.randrange(640);d.line((x,y,x+rng.randrange(10,45),y),fill='#86806b' if y%24 else '#414a48',width=2)
    else:
        # Interior scenes use a darker rear wall and readable broad machinery,
        # leaving the world y~90..148 combat band low-contrast.
        for x in range(0,640,80):
            d.rectangle((x,0,x+79,359),fill='#233744' if x%160 else '#1b303d')
            d.line((x+2,0,x+2,359),fill='#425b64',width=3)
        for y in (25,59,322):
            d.rectangle((0,y,639,y+9),fill='#101f2b');d.line((0,y,639,y),fill='#597174',width=2)
        for x in (35,328,588):
            d.rectangle((x,15,x+14,332),fill='#3b5361');d.line((x+2,15,x+2,332),fill='#728681',width=2)
        if scene=='interior':
            for x,y,r in ((138,122,69),(254,78,42),(414,120,77),(540,88,39)):
                gear(d,x,y,r,x*.01)
            for x in (89,357):
                d.rectangle((x,192,x+128,251),fill='#172a37',outline='#7c8e89',width=3)
                for dx in range(9,120,15):d.rectangle((x+dx,199,x+dx+5,244),fill='#4a626c')
                d.rectangle((x+43,155,x+60,211),fill='#8d9f99');d.rectangle((x+38,150,x+66,170),fill='#435d68')
        elif scene=='control':
            for x in (78,248,420):
                plate(d,[(x,75),(x+126,75),(x+139,178),(x-6,180)],'#3b5363')
                d.rectangle((x+10,87,x+116,153),fill='#132b35',outline='#798c88',width=2)
                for n in range(6):
                    xx=x+18+n*14;d.rectangle((xx,144-(n*13)%39,xx+7,146),fill='#547f7c')
                d.line((x+16,103,x+39,101,x+61,118,x+82,98,x+106,106),fill='#8aaba0',width=2)
                d.rectangle((x+2,180,x+130,200),fill='#627374')
                for dx in range(8,120,12):d.rectangle((x+dx,185,x+dx+5,189),fill='#b8bb9b')
        else:
            for x in (105,490):
                d.rectangle((x,72,x+48,252),fill='#132735',outline='#667e80',width=3)
                for yy in range(84,240,21):d.rectangle((x+7,yy,x+39,yy+8),fill='#3d626e')
                d.line((x+24,252,x+24,289,320,289),fill='#526e77',width=8)
            d.ellipse((229,52,411,236),fill='#152c39',outline='#425f6c',width=9)
            d.ellipse((255,77,385,211),fill='#243e4b',outline='#728b88',width=4)
            for a in range(0,360,45):
                r=math.radians(a);x=320+math.cos(r)*93;y=145+math.sin(r)*93
                d.rectangle((x-5,y-5,x+5,y+5),fill='#8c9b8d')
        d.rectangle((0,304,639,359),fill='#1b2b36');d.line((0,305,639,305),fill='#687d7d',width=3)
        for x in range(0,640,32):d.line((x,312,x-12,359),fill='#334a57',width=2)
    return im


def actor(kind,f):
    w,h=ACTORS[kind];im=Image.new('RGBA',(w*2,h*2));d=ImageDraw.Draw(im);s=f%2
    if kind=='assaultroller':
        tread(d,4,27,64,20,f*3)
        plate(d,[(4,28),(14,10),(37,3),(62,11),(69,29),(52,36),(18,35)],'#7b7f76')
        for x in (21,39,54):d.line((x,12,x+3,25),fill='#c9bf9e',width=2)
        d.rectangle((4,18,18,22),fill='#f3c58b' if f==2 else '#b8cec0')
        d.line((3,26,14,27),fill=INK,width=3)
    elif kind=='repairdrone':
        for x in (4,40):
            d.ellipse((x,2+s*2,x+17,11+s*2),fill=INK,outline='#b3c8bb',width=2)
            d.line((x+2,6,x+15,6),fill='#7d9b98',width=2)
        plate(d,[(14,12),(29,6),(46,15),(43,32),(29,40),(14,29)],'#68838c')
        d.rectangle((24,17,35,29),fill=INK);d.line((26,23,33,23),fill=MINT,width=3);d.line((30,19,30,27),fill=MINT,width=3)
        for x in (20,39):d.line((x,31,x-2,40),fill=EDGE,width=2)
        if f==2:d.line((28,36,29,43),fill='#d6eac3',width=3)
    elif kind=='sentrywalker':
        for x in (19,39,65):
            dx=3 if (x+f)%2 else -2
            d.line([(x,43),(x+dx,59),(x-7+dx,74)],fill=INK,width=9)
            d.line([(x,43),(x+dx,59),(x-7+dx,73)],fill='#adb7aa',width=3)
            d.rectangle((x-12+dx,71,x+dx,75),fill='#6d8184')
        plate(d,[(8,29),(22,14),(61,14),(82,34),(72,51),(22,52)],'#7b8186')
        for x in (29,48,65):plate(d,[(x-9,19),(x+6,18),(x+12,37),(x+4,45),(x-10,42)],'#6a7983')
        for y in (17,25):
            d.rectangle((1,y,39,y+7),fill=INK);d.rectangle((3,y+1,35,y+3),fill='#b8c5b6')
            if f==2:d.polygon([(0,y-3),(10,y+2),(0,y+11)],fill='#ebc18a')
        d.rectangle((15,37,24,40),fill=MINT)
        if f>=5:
            d.line([(48,17),(43,26),(52,33),(46,45)],fill=INK,width=4)
            d.rectangle((63,22,75,29),fill='#3c4c57')
    elif kind=='reactor':
        # Symmetric machine body; source core center (160,128) exactly maps to
        # world e.x,e.y+32 when whole image is drawn at e.x-80,e.y-32.
        for side in (-1,1):
            x=160+side*99
            plate(d,[(x-24,28),(x+24,28),(x+31,158),(x-31,158)],'#526b79')
            for y in (43,70,97,124):d.rectangle((x-15,y,x+15,y+9),fill='#92a49c')
            d.line([(x,155),(x,181),(160+side*39,181)],fill=INK,width=14)
            d.line([(x,155),(x,181),(160+side*39,181)],fill='#9ea99b',width=5)
        plate(d,[(105,11),(213,11),(237,48),(230,165),(194,187),(125,187),(91,161),(84,49)],'#7b7a80')
        for x in (109,198):d.rectangle((x,30,x+13,78),fill='#b7b9a6');d.rectangle((x+3,37,x+9,66),fill=INK)
        d.ellipse((103,71,217,185),fill=INK,outline=EDGE,width=4)
        d.ellipse((113,81,207,175),fill='#416d79' if f<5 else '#ad775f',outline='#9bb7af',width=3)
        if f<5:
            for x in (132,157,182):d.line((x,87,x,169),fill='#1f3e4e',width=9)
        else:
            d.ellipse((127,95,193,161),fill='#e4c68b');d.ellipse((143,111,177,145),fill='#f1eac8')
        d.rectangle((152,39,168,61),fill='#e1c38a' if f in (2,5,6) else MINT)
        if f==6:
            for x in (109,201):d.line([(x,25),(x-8,43),(x+7,62),(x-4,84)],fill=INK,width=5)
    else:
        plate(d,[(4,14),(13,4),(42,4),(52,17),(49,59),(7,62)],'#6e7c82')
        d.rectangle((13,15,42,44),fill=INK);d.rectangle((18,20,37,40),fill=MINT if f<5 else '#b97f64')
        d.rectangle((23,23,31,37),fill='#d5dec0')
        for x in (9,44):d.rectangle((x,49,x+3,56),fill=AMBER)
        if f==2:d.line((18,8,37,8),fill='#f4ca8d',width=3)
    if f==3:
        d.line([(w*.5,h*.4),(w,h*.7),(w*.8,h*1.3)],fill=INK,width=4)
        d.line([(w*.56,h*.4),(w*1.05,h*.7)],fill=AMBER,width=2)
    if f==4:d.rectangle((w-7,4,w+7,6),fill='#f7e4ba')
    return im


def tiles():
    im=Image.new('RGBA',(256,64));d=ImageDraw.Draw(im)
    for i in range(16):
        x=i%8*32;y=i//8*32
        d.rectangle((x,y,x+31,y+31),fill=('#425765','#304957','#5e6c71','#4d4b4d')[i%4])
        d.line((x,y,x+31,y),fill=EDGE,width=3);d.line((x,y+30,x+31,y+30),fill=INK,width=2)
        if i%4==0:
            d.rectangle((x+5,y+8,x+26,y+23),outline='#7d928d',width=2)
        elif i%4==1:
            for dx in (6,16,26):d.line((x+dx,y+5,x+dx,y+27),fill=INK,width=3)
        elif i%4==2:
            for dx in range(0,30,9):d.line((x+dx,y+4,x+dx+5,y+9),fill=AMBER,width=3)
            d.rectangle((x+6,y+15,x+25,y+25),fill='#2a434e')
        else:
            d.line((x+3,y+10,x+14,y+5,x+27,y+13),fill='#b4b29c',width=2)
        for dx in (3,28):d.point((x+dx,y+5),fill='#d0c6a6')
    return im


def effects(name):
    im=Image.new('RGBA',(512,64));d=ImageDraw.Draw(im)
    for f in range(8):
        rng=random.Random(SEED+f*19);cx=f*64+32;cy=32;r=5+f*3
        if name in ('dust','exhaust'):
            color=('#887b67','#ad9b7b') if name=='dust' else ('#54616a','#7b8889')
            for n in range(5):
                xx=cx-15+n*7+(f%2)*2;yy=cy+4-(n%3)*5-f*2;rr=max(2,7-f//2)
                d.rectangle((xx-rr,yy-rr,xx+rr,yy+rr),fill=color[n%2])
        elif name=='heal':
            d.line((cx-9,cy,cx+9,cy),fill=MINT,width=4);d.line((cx,cy-9,cx,cy+9),fill=MINT,width=4)
            d.ellipse((cx-r,cy-r,cx+r,cy+r),outline='#ccdfbe',width=2)
        elif name=='warning':
            d.polygon([(cx,cy-r),(cx+r,cy+r),(cx-r,cy+r)],outline=AMBER,width=3)
            d.line((cx,cy-4,cx,cy+5),fill='#f6dab0',width=3);d.rectangle((cx-1,cy+9,cx+1,cy+11),fill='#f6dab0')
        else:
            if f<5:
                d.ellipse((cx-r,cy-r,cx+r,cy+r),fill='#9a624d',outline='#e6bf87',width=2)
                d.ellipse((cx-r*.6,cy-r*.6,cx+r*.6,cy+r*.6),fill='#efd4a1')
            for n in range(10):
                a=n*math.tau/10;rr=r+rng.randrange(2,9);x=cx+math.cos(a)*rr;y=cy+math.sin(a)*rr
                d.rectangle((x,y,x+2,y+2),fill=EDGE if name=='break' else AMBER)
    return im


def generate(root):
    dest=Path(root)/'assets/mobile-fortress-01';records=[]
    def save(path,im,cell,logical,states,anchor=None):
        target=dest/path;target.parent.mkdir(parents=True,exist_ok=True);im.save(target,optimize=True)
        records.append({'path':path,'size':list(im.size),'cell':list(cell),'logicalCell':list(logical),
                        'frames':len(states),'states':states,'anchor':anchor or {'topLeft':[0,0]},
                        'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    backgrounds=[]
    for name in SCENES:
        im=background(name);backgrounds.append(im);save('backgrounds/'+name+'.png',im,(640,360),(320,180),[name])
    base=Image.new('RGBA',(430,164));crawler(base,0,0)
    save('backgrounds/distant-base.png',base,(430,164),(215,82),['distant-base'])
    save('tiles/mobile.png',tiles(),(32,32),(16,16),[f'tile{i}' for i in range(16)])
    for kind,(w,h) in ACTORS.items():
        frames=[actor(kind,f) for f in range(8)];sheet=Image.new('RGBA',(w*16,h*2))
        for f,im in enumerate(frames):sheet.alpha_composite(im,(f*w*2,0))
        for far in (False,True):
            save(('far/' if far else 'sprites/')+kind+'.png',far_sprite(sheet) if far else sheet,(w*2,h*2),(w,h),STATES,
                 {'centerX':0,'topOffset':-32,'coreCenter':[0,32]} if kind=='reactor' else {'centerX':0,'feet':h})
    for name in ('dust','exhaust','fire','break','heal','warning'):
        save('effects/'+name+'.png',effects(name),(64,64),(32,32),[name+':'+str(f) for f in range(8)])
    contact=Image.new('RGB',(1280,1000),'#101d29');d=ImageDraw.Draw(contact)
    d.text((14,10),'MOBILE FORTRESS 01 / GENERATED ASSET CONTACT SHEET / NOT GAME SCREENSHOT',fill=EDGE)
    for n,bg in enumerate(backgrounds):
        x=(n%3)*420+10;y=(n//3)*260+40
        contact.paste(bg.resize((416,234),Image.Resampling.NEAREST),(x,y));d.text((x,y+237),SCENES[n].upper(),fill=EDGE)
    x=15;y=590
    for kind in ACTORS:
        im=actor(kind,5 if kind=='reactor' else 0)
        contact.paste(im,(x,y),im);d.text((x,y+im.height+4),kind.upper(),fill=EDGE);x+=im.width+35
    contact.paste(tiles(),(15,835));d.text((15,910),'16 TILES / SOURCE SCALE 2 / NEAREST / FIXED SEED 5008000',fill=EDGE)
    save('contact-sheet.png',contact,contact.size,contact.size,['preview'])
    catalog={'version':'0.5.0','style':'UNIFIED 01 / MOBILE FORTRESS 01','seed':SEED,'sourceScale':2,
             'sampling':'nearest','generator':'tools/mobile_fortress_assets.py','missions':['M05'],'assets':records,
             'notes':['Only assets/mobile-fortress-01 is written.','Body hitboxes and projectile origins are not imported or changed.',
                      'Reactor visual center is source (160,128), world(e.x,e.y+32); draw top offset -32.',
                      'Travel belongs to backdrop scrolling, never to actor or platform collision coordinates.']}
    (dest/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'MOBILE FORTRESS 01: {len(records)} PNGs / {sum(x["frames"] for x in records)} cells / seed {SEED}')
    return catalog


if __name__=='__main__':generate(Path(__file__).resolve().parents[1])
