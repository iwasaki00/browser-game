"""COASTAL 01: deterministic, locally authored UNIFIED 01-compatible pixel art.

Only assets/coastal-01 is written. World collision/AI/weapon data are not imported.
Source cells have exactly two pixels per logical world pixel; no antialiasing.
"""
from pathlib import Path
import hashlib
import json
import math
import random
from PIL import Image, ImageDraw
try:
    from . import art_direction_samples as a
    from .art_unification import far_sprite
except ImportError:
    import art_direction_samples as a
    from art_unification import far_sprite

SEED = 3006400
INK = '#090f1b'
STEEL = '#526d79'
EDGE = '#b9c9b8'
BONE = '#dfc29d'
SHELL = '#947087'
SEA = '#274b5d'
STATES = ['move_a', 'move_b', 'attack', 'dead', 'hit', 'weak_open']
ENEMIES = {'shorecrab': (40,24), 'skyray': (40,24), 'siegebeetle': (48,40), 'leviathan': (160,96)}


def plate(d, points, color=SHELL):
    a.poly(d,points,INK)
    cx=sum(x for x,y in points)/len(points);cy=sum(y for x,y in points)/len(points)
    inset=[(cx+(x-cx)*.82,cy+(y-cy)*.82) for x,y in points]
    a.poly(d,inset,color)
    rgb=tuple(int(color[i:i+2],16) for i in (1,3,5))
    # Broad, restrained facets: lit top, cool underside, no smoothed edges.
    for n,p in enumerate(inset):
        q=inset[(n+1)%len(inset)];factor=1.12 if (p[1]+q[1])/2<cy else .82
        tint=tuple(max(0,min(255,round(c*factor))) for c in rgb)
        a.poly(d,[(cx,cy),p,q],tint)
    a.line(d,inset[:3],BONE,2)


def enemy(kind,frame,variant=0):
    w,h=ENEMIES[kind];im=a.rgba((w*2,h*2));d=ImageDraw.Draw(im)
    shell=('#947087','#8c796e','#786886')[variant%3]
    s=frame%2;attack=frame==2;dead=frame==3
    if kind=='shorecrab':
        # Broad low carapace, jointed lateral legs and two asymmetric pincers.
        for side in (-1,1):
            for n in range(3):
                x=39+side*(11+n*2);y=23+n*3
                knee=(39+side*(24+n*2),25+n*5+s*2)
                foot=(39+side*(32-n*4+s),47)
                a.line(d,[(x,y),knee,foot],INK,5)
                a.line(d,[(x,y),knee,foot],'#b39099',2)
                a.box(d,(knee[0]-1,knee[1]-1,knee[0]+1,knee[1]+1),BONE)
        plate(d,[(15,24),(22,10),(39,5),(57,10),(65,26),(54,37),(28,36)],shell)
        for x in (27,40,53):a.line(d,[(x-3,14),(x+1,24),(x-2,31)],'#c29e9c',2)
        a.poly(d,[(24,30),(38,26),(53,31),(47,40),(29,39)],INK)
        a.line(d,[(31,37),(45,37)],'#827b7e',2)
        a.line(d,[(28,32),(34,32)],'#dfdca3',2);a.line(d,[(44,32),(49,32)],'#dfdca3',2)
        for side in (-1,1):
            x=39+side*30;extend=3 if attack else 0
            a.line(d,[(39+side*17,23),(x,15+extend)],INK,6)
            plate(d,[(x-side*6,10),(x+side*5,6),(x+side*8,17),(x,23),(x-side*6,18)],shell)
            a.line(d,[(x+side*5,8),(x,15),(x+side*7,18)],BONE,2)
    elif kind=='skyray':
        # Swept manta wings are not insect/needle wings; chest remains visible.
        tip=4 if s else 12
        for side in (-1,1):
            plate(d,[(39+side*5,15),(39+side*22,8),(39+side*38,tip),(39+side*28,31),(39+side*9,34)],'#747b94')
            a.line(d,[(39+side*7,18),(39+side*24,17),(39+side*32,tip+4)],'#b2b2b9',2)
            a.line(d,[(39+side*11,24),(39+side*24,23),(39+side*28,28)],'#474967',2)
        plate(d,[(30,14),(38,7),(47,15),(48,31),(39,37),(30,29)],shell)
        a.line(d,[(34,20),(37,20)],'#d8dca2',2);a.line(d,[(42,20),(45,20)],'#d8dca2',2)
        a.line(d,[(39,32),(39+s*3,41),(33+s*3,47)],INK,4)
        a.line(d,[(39,32),(39+s*3,41),(33+s*3,46)],'#b7a2aa',2)
        if attack:a.poly(d,[(34,29),(39,37),(45,29)],'#d8bd8f')
    elif kind=='siegebeetle':
        # Heavy segmented carrier, elevated organic artillery and ventral legs.
        for k in range(4):
            x=20+k*18;step=3 if (k+s)%2 else -1
            a.line(d,[(x,45),(x-8,61),(x-14+step,79)],INK,8)
            a.line(d,[(x,45),(x-8,61),(x-14+step,78)],'#a298a1',3)
            a.oval(d,(x-11,58,x-6,63),BONE)
        plate(d,[(14,42),(25,24),(49,18),(76,26),(91,43),(81,61),(30,62)],'#677b85')
        for n in range(3):
            x=28+n*18
            plate(d,[(x-9,30),(x+3,21),(x+14,34),(x+10,52),(x-9,52)],shell)
            a.line(d,[(x-4,34),(x+4,32),(x+7,41)],'#b8a1a7',1)
            a.line(d,[(x-6,48),(x+7,48)],'#4f495e',2)
        plate(d,[(3,47),(12,36),(29,41),(31,56),(16,64),(4,58)],'#a28787')
        a.line(d,[(5,46),(17,46)],'#cbd697',3)
        plate(d,[(37,32),(42,10),(63,3),(73,11),(62,24),(56,36)],'#859c9c')
        a.oval(d,(41,4,61,17),INK);a.oval(d,(45,7,57,14),'#c2ce9d' if attack else '#698380')
        a.line(d,[(63,7),(69,12),(61,21)],EDGE,2)
        if attack:a.line(d,[(45,9),(51,5),(57,9)],'#eee3ba',2)
    else:
        # The core center is (160,116) source / (0,+58) world from centerX.
        # Never horizontally mirror this asymmetrical face/core alignment.
        for k in range(5):
            root=(119+k*29,111);tip=(101+k*38,187)
            knee=(93+k*35,151-(k%2)*9+s*3)
            a.line(d,[root,knee,tip],INK,15)
            a.line(d,[root,knee,tip],'#7a657f',9)
            a.line(d,[root,knee], '#b194a0',3)
            for n in range(3):
                xx=knee[0]+(tip[0]-knee[0])*n/3;yy=knee[1]+(tip[1]-knee[1])*n/3
                a.oval(d,(xx-3,yy-3,xx+3,yy+3),'#d4bc9c')
        plate(d,[(40,93),(68,43),(132,15),(213,22),(274,60),(298,111),(273,148),(96,152),(48,125)],'#62566f')
        for k in range(5):
            x=87+k*38;y=49+(k-2)**2*4
            plate(d,[(x-25,y+13),(x-16,y-18),(x+8,y-23),(x+29,y+3),(x+17,y+48),(x-14,y+47)],'#897389')
            a.line(d,[(x-11,y-12),(x+4,y-14),(x+18,y+4)],'#c2a7a2',3)
            a.line(d,[(x-10,y+34),(x+7,y+35),(x+16,y+22)],'#51475e',3)
            a.line(d,[(x-9,y-5),(x-4,y+6)],'#b097a1',2)
        for x,y in ((79,52),(120,27),(166,23),(212,35),(250,58)):
            plate(d,[(x-12,y+18),(x-15,y-13),(x-1,max(1,y-30)),(x+18,y+20)],'#789092')
        # Head at left is readable even when the core is closed.
        plate(d,[(6,87),(28,63),(58,67),(79,88),(69,112),(33,126),(8,112)],'#9a7f8c')
        a.line(d,[(12,89),(41,84)],'#d8dda3',5)
        a.box(d,(15,86,22,88),'#f1f0d5')
        for y in (100,113):a.poly(d,[(1,y),(24,y-3),(15,y+7)],BONE)
        # Visible circular iris; frame 5 opens it without shifting the anchor.
        a.oval(d,(119,78,201,154),INK);a.oval(d,(125,84,195,148),'#a1958c')
        if frame==5:
            a.oval(d,(133,90,187,142),'#4f8e8c');a.oval(d,(142,99,178,133),'#d0dca4')
            a.box(d,(153,108,167,123),'#f1f0d5')
        else:
            plate(d,[(130,87),(157,82),(158,150),(130,142)],'#94798c')
            plate(d,[(164,83),(193,91),(190,143),(163,151)],'#76667c')
        if attack:a.line(d,[(8,115),(22,123),(8,134)],'#d9d199',4)
        if dead:
            for x,y in ((99,62),(211,58),(248,102)):
                a.line(d,[(x-9,y-12),(x+4,y),(x-5,y+17)],INK,6)
                a.line(d,[(x-6,y-10),(x+3,y),(x-3,y+12)],'#d9b59c',2)
    if frame==4:a.line(d,[(w*.65,h*.9),(w,h*.65),(w*1.25,h*.9)],'#f0dfbe',3)
    if dead and kind!='leviathan':
        a.line(d,[(w*.7,h*.45),(w*.9,h*.8),(w*.75,h*1.3)],INK,3)
        a.line(d,[(w*.74,h*.45),(w*.94,h*.8)],BONE,1)
    return im


def crane(d,x,y,scale=1,color='#435b68'):
    def p(points):return [(x+int(px*scale),y+int(py*scale)) for px,py in points]
    a.line(d,p([(0,80),(12,0),(25,80)]),color,max(1,int(5*scale)))
    a.line(d,p([(-24,12),(67,12),(10,0),(-24,12)]),color,max(1,int(4*scale)))
    a.line(d,p([(57,14),(57,56),(52,59)]),color,max(1,int(2*scale)))
    for yy in range(20,80,15):a.line(d,p([(3,yy),(20,yy+10),(4,yy+15)]),color,max(1,int(2*scale)))


def backgrounds():
    rng=random.Random(SEED)
    far=Image.new('RGBA',(640,360),'#1b2e40');d=ImageDraw.Draw(far)
    # Crisp stepped dusk, not a blurred gradient; lower contrast behind combat.
    for y,col in ((0,'#243c50'),(52,'#2d4659'),(104,'#365364'),(146,'#466675'),(182,'#66838a'),(205,'#738b8d')):
        a.box(d,(0,y,639,359),col)
    for x,y in ((84,44),(114,43),(385,72),(414,75),(560,42)):
        a.line(d,[(x,y),(x+24,y),(x+36,y+2)],'#789095',1)
    for x,y in ((26,81),(251,52),(440,111)):
        a.poly(d,[(x,y+8),(x+17,y+4),(x+27,y),(x+58,y+2),(x+67,y+7),(x+98,y+10),(x,y+10)],'#344f61')
        a.line(d,[(x+12,y+6),(x+36,y+3),(x+58,y+5)],'#476374',1)
    # Offshore organic invasion silhouettes distinguish this sea from city sky.
    for x,sc in ((60,.7),(400,1),(590,.45)):
        yy=177
        a.poly(d,[(x-48*sc,yy),(x-30*sc,yy-10*sc),(x-22*sc,yy-29*sc),(x-10*sc,yy-17*sc),(x+5*sc,yy-40*sc),(x+23*sc,yy-22*sc),(x+41*sc,yy-10*sc),(x+57*sc,yy)],'#344d5a')
        a.line(d,[(x-19*sc,yy-13*sc),(x+21*sc,yy-13*sc)],'#8e9991',1)
    a.box(d,(0,212,639,359),'#2c4f60')
    for n in range(90):
        x=rng.randrange(640);y=rng.randrange(218,360);ln=rng.randrange(5,28)
        a.line(d,[(x,y),(min(639,x+ln),y)],'#3b6472' if n%3 else '#527b83',1)
    middle=a.rgba((640,360));d=ImageDraw.Draw(middle)
    for x in (55,312,526):crane(d,x,102,.9,'#304b5b')
    for x,y,w,h in ((0,210,92,28),(105,196,68,40),(232,205,114,31),(445,216,84,22)):
        a.box(d,(x,y,x+w,y+h),'#304a58');a.box(d,(x,y,x+w,y+2),'#6a8387')
        for xx in range(x+7,x+w-3,12):a.line(d,[(xx,y+4),(xx,y+h)],'#3f5c67',2)
        for xx in range(x+10,x+w-4,24):a.box(d,(xx,y+8,xx+7,y+11),'#7a8985')
        a.box(d,(x+3,y+h-3,x+w-3,y+h-1),'#243d4c')
    a.box(d,(0,239,639,248),'#233b4b');a.line(d,[(0,239),(639,239)],'#718c8d',2)
    for x in range(6,640,38):
        a.line(d,[(x,239),(x,230),(x+23,230)],'#5a767c',1)
        a.box(d,(x+20,231,x+23,233),'#8c998e')
    for x in range(12,640,54):a.box(d,(x,248,x+10,286),'#294959')
    front=a.rgba((640,360));d=ImageDraw.Draw(front)
    # Low architectural band deliberately leaves combat silhouettes unobscured.
    a.box(d,(0,322,639,359),'#1a303f');a.line(d,[(0,322),(639,322)],'#526d73',2)
    for x in range(0,640,32):
        a.line(d,[(x,324),(x-8,359)],'#29414d',2)
        if x%96==0:a.box(d,(x+8,328,x+14,331),'#a3a58b')
    return [far,middle,front]


def tiles():
    cells=[]
    for variant in range(4):
        for index in range(16):
            im=a.rgba((32,32));d=ImageDraw.Draw(im);rng=random.Random(SEED+index*31+variant)
            if index in (5,6):
                a.box(d,(0,0,31,31),SEA)
                for y in (5,14,25):
                    x=(variant*5+y)%13;a.line(d,[(x,y),(min(31,x+17),y)],'#628b92',2)
                if index==6:a.line(d,[(0,4),(6,2),(12,5),(20,3),(31,5)],'#c2d6ca',3)
            elif index==7:
                a.box(d,(0,0,31,31),'#2b4350');a.line(d,[(2,31),(12,0),(29,31)],INK,7)
                a.line(d,[(2,31),(12,0),(29,31)],'#b0a478',3)
                a.line(d,[(7,12),(22,14),(5,26),(25,28)],'#6f7e7a',2)
            else:
                a.box(d,(0,0,31,31),INK);a.box(d,(1,2,30,30),'#465c67' if index!=2 else ('#67766a','#685d68','#5b7580','#7c7066')[variant])
                a.line(d,[(0,0),(31,0)],EDGE,2)
                if index==0:
                    a.box(d,(2,5,29,30),'#344c58');a.box(d,(5,13,22,15),'#a5a58a')
                    for x in (3,27):a.box(d,(x,4,x+1,5),'#94a69d')
                elif index==1:
                    for y in (9,22):a.line(d,[(1,y),(30,y)],'#263b49',2)
                    a.line(d,[(7,10),(7,21)],'#718184',1);a.line(d,[(23,24),(23,30)],'#718184',1)
                elif index==2:
                    for x in range(4,30,6):
                        a.line(d,[(x,4),(x,28)],'#293f4a',2);a.line(d,[(x+2,4),(x+2,27)],'#a1a99a',1)
                    a.box(d,(1,29,30,31),INK)
                elif index==3:
                    a.box(d,(3,6,28,25),'#859893');a.box(d,(7,10,24,20),'#263e4b')
                    for x in (9,15,21):a.box(d,(x,12,x+2,17),'#a8b797')
                elif index==4:
                    a.poly(d,[(1,4),(12,9),(9,19),(22,23),(31,30),(1,31)],'#62737a')
                    a.line(d,[(0,5),(11,11),(9,21),(23,25)],'#b1b7a1',2)
                    a.line(d,[(15,0),(19,12),(31,18)],INK,3)
                else:
                    a.box(d,(5,7,26,26),'#2e4653');a.line(d,[(4,4),(28,4)],'#90a59e',2)
                    if index%2:a.line(d,[(5,8),(25,26)],'#9b956e',3)
                    else:
                        for x in (9,17,24):a.box(d,(x,10,x+2,22),'#718b89')
                for k in range(variant):
                    x=rng.randrange(4,27);y=rng.randrange(5,28);a.line(d,[(x,y),(x+3,y+1)],'#85928b',1)
            cells.append(im)
    return a.atlas(cells,8)


def turret(frame):
    im=a.rgba((64,64));d=ImageDraw.Draw(im);angle=(0,-.2,-.4,0,.2,0)[frame]
    a.poly(d,[(5,63),(9,48),(24,41),(46,43),(56,51),(62,63)],INK)
    a.poly(d,[(10,59),(14,51),(26,47),(46,48),(53,54),(56,60)],STEEL)
    a.line(d,[(14,50),(27,46),(46,47)],EDGE,2)
    a.box(d,(22,26,45,46),INK);a.box(d,(25,29,42,42),'#79938d')
    for n in (0,1):
        y=26+n*7;end=(56, max(4,int(y-15+angle*30)))
        a.line(d,[(30,y),end],INK,7);a.line(d,[(31,y-1),end], '#b4c4af',3)
        if frame==2:a.poly(d,[(end[0]-3,end[1]-4),(63,end[1]-9),(61,end[1]),(63,end[1]+3)],'#f1d799')
    a.box(d,(26,31,31,34),'#bfd09e');a.line(d,[(23,27),(18,18),(11,18)],'#91aaa2',2)
    if frame==3:a.line(d,[(24,27),(35,35),(30,43)],INK,3)
    return im


def effect(name,frame):
    size=(128,128) if name=='tentacle' else (320,192) if name=='bossBreak' else (32,32)
    im=a.rgba(size);d=ImageDraw.Draw(im);rng=random.Random(SEED+frame*47)
    if name=='tentacle':
        points=[(13,127),(23,81),(54,52-frame*3),(82,27),(105,7+frame*4),(119,20),(94,44),(75,75),(58,127)]
        a.poly(d,points,INK);a.poly(d,[(23,127),(33,85),(62,60-frame*3),(89,34),(106,16+frame*4),(108,22),(85,48),(67,79),(49,127)],'#8d768c')
        a.line(d,[(26,123),(38,84),(67,58),(90,35)],BONE,3)
        for x,y in ((39,102),(50,81),(68,62),(85,45)):a.oval(d,(x-3,y-4,x+4,y+4),'#c8bc9d')
    elif name=='bossBreak':
        cx=160;cy=96;r=18+frame*14
        if frame<5:
            d.ellipse((cx-r,cy-r*.7,cx+r,cy+r*.7),outline='#c7d7b6',width=3)
            for n in range(7):
                x=cx+math.cos(n*math.tau/7+frame*.4)*r*.6;y=cy+math.sin(n*math.tau/7)*r*.5
                rr=max(3,22-frame*3)
                a.oval(d,(x-rr,y-rr,x+rr,y+rr),'#aa6b53');a.oval(d,(x-rr*.6,y-rr*.6,x+rr*.6,y+rr*.6),'#ebc489')
        for n in range(18):
            ang=n*math.tau/18;rr=r+rng.randrange(-6,14);x=cx+math.cos(ang)*rr;y=cy+math.sin(ang)*rr*.65
            a.line(d,[(x,y),(x-math.cos(ang)*8,y-math.sin(ang)*8)],'#b8c6ad' if n%2 else '#99b6b7',2)
    elif name=='splash':
        r=4+frame*3
        a.line(d,[(0,28),(8,26),(17,28),(29,26)],'#8eb9bb',2)
        for n in range(5):
            x=3+n*6;y=26-r+(n%2)*4
            a.line(d,[(16,29),(x,y)],'#aacdca',2);a.box(d,(x,y-3,x+1,y-1),'#d5e0ca')
    elif name=='warning':
        d.ellipse((3+frame,3+frame,29-frame,29-frame),outline='#d8ae7e',width=2)
        for x,y in ((16,0),(16,28),(0,16),(28,16)):a.box(d,(x,y,x+3,y+3),'#e2cca3')
        a.line(d,[(14,9),(18,9),(16,20)],'#edd6b1',2);a.box(d,(15,24,17,26),'#edd6b1')
    else:
        a.poly(d,[(3,18),(8,10),(20,9),(29,16),(21,24),(7,23)],INK)
        a.poly(d,[(8,16),(14,11),(23,14),(25,18),(17,22),(8,21)],'#b5ad85')
        a.box(d,(19,14,24,18),'#e3d7ab')
        a.line(d,[(2,16),(10,16)],'#84aaa8',2)
    return im


def generate(root):
    out=Path(root)/'assets/coastal-01';out.mkdir(parents=True,exist_ok=True);records={}
    def save(path,im,cell,logical,states,anchor=None):
        target=out/path;target.parent.mkdir(parents=True,exist_ok=True);im.save(target,optimize=True)
        records[path]={'size':list(im.size),'cell':list(cell),'logicalCell':list(logical),'columns':im.width//cell[0],
                       'frames':(im.width//cell[0])*(im.height//cell[1]),'states':states,'anchor':anchor or {'centerX':0,'top':0},
                       'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
    layers=backgrounds()
    for name,im in zip(('far','mid','front'),layers):save(f'backgrounds/coast_{name}.png',im,(640,360),(320,180),[name])
    save('backgrounds/coast.png',a.composite(layers),(640,360),(320,180),['composite'])
    save('tiles/coast.png',tiles(),(32,32),(16,16),[f'tile{i}:variant{v}' for v in range(4) for i in range(16)])
    for kind,(w,h) in ENEMIES.items():
        sheet=a.atlas([enemy(kind,f,v) for v in range(1 if kind=='leviathan' else 3) for f in range(6)],6)
        anchor={'centerX':0,'top':0,'weakCore':[0,58]} if kind=='leviathan' else {'centerX':0,'feet':h}
        for far in (False,True):save(f'{"far" if far else "sprites"}/{kind}.png',far_sprite(sheet) if far else sheet,(w*2,h*2),(w,h),STATES,anchor)
    save('sprites/aa.png',a.atlas([turret(f) for f in range(6)],6),(64,64),(32,32),STATES)
    for name,w,h,count in [('splash',16,16,4),('warning',16,16,4),('artillery',16,16,4),('tentacle',64,64,4),('bossBreak',160,96,8)]:
        save(f'effects/{name}.png',a.atlas([effect(name,f) for f in range(count)],count),(w*2,h*2),(w,h),[f'{name}:{f}' for f in range(count)])
    sheet=Image.new('RGB',(1000,1000),'#101e2d');d=ImageDraw.Draw(sheet)
    d.text((16,12),'COASTAL 01 / M03 / ASSET CONTACT SHEET - NOT A GAME SCREENSHOT',fill=EDGE)
    y=45
    for x,k in ((20,'shorecrab'),(230,'skyray'),(440,'siegebeetle')):
        im=enemy(k,0).resize((ENEMIES[k][0]*4,ENEMIES[k][1]*4),Image.Resampling.NEAREST)
        sheet.paste(im,(x,y+20),im);d.text((x,y),k.upper(),fill=EDGE)
    im=enemy('leviathan',5);sheet.paste(im,(25,255),im);d.text((25,235),'B-03 LEVIATHAN / OPEN CORE',fill=EDGE)
    im=turret(2).resize((128,128),Image.Resampling.NEAREST);sheet.paste(im,(410,270),im)
    im=tiles();sheet.paste(im,(710,180),im);d.text((710,160),'16 TILES x 4 VARIANTS',fill=EDGE)
    bg=a.composite(layers).convert('RGB').resize((960,540),Image.Resampling.NEAREST);sheet.paste(bg,(20,450))
    sheet.save(out/'contact-sheet.png',optimize=True)
    manifest={'version':'0.3.0','style':'UNIFIED 01 / COASTAL 01','seed':SEED,'sampling':'nearest','generator':'tools/coastal_assets.py',
              'missions':['M03'],'assets':records,'poses':STATES,'tileIndex':{'road':0,'quay':1,'container':2,'defense':3,'wreck':4,'water':5,'foam':6,'crane':7},
              'notes':['Source cells are 2x world logical cells. Never changes collision sizes.','Leviathan must not be mirrored: core center logical(80,58), world offset(0,58).','Six ordinary animation columns and three color variants; boss has one row.','Far sheets preserve alpha silhouettes. Existing M01/M02 material is not written.']}
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'COASTAL 01: {len(records)+1} PNG ({len(records)} runtime + contact sheet), {sum(r["frames"] for r in records.values())} indexed cells.')
    return manifest


if __name__=='__main__':generate(Path(__file__).resolve().parents[1])
