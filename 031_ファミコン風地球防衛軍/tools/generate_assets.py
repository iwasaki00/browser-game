"""Generate the original pixel-art assets for PIXEL DEFENSE FRONT.

The script is deterministic, uses no downloaded material, and deliberately draws at
native resolution without antialiasing. Run with: py -3 tools/generate_assets.py
"""
from pathlib import Path
from PIL import Image, ImageDraw
import random
import argparse
import math
import json

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
random.seed(7319)

P = {
    "clear": (0, 0, 0, 0), "outline": (3, 7, 16, 255), "navy": (8, 24, 40, 255),
    "steel": (36, 72, 88, 255), "light": (222, 255, 245, 255), "cyan": (55, 232, 223, 255),
    "cyan2": (22, 137, 153, 255), "yellow": (255, 224, 92, 255), "orange": (255, 139, 66, 255),
    "red": (255, 79, 109, 255), "purple": (163, 105, 255, 255), "green": (94, 220, 126, 255),
    "acid": (174, 240, 70, 255), "gray": (102, 119, 126, 255), "dark": (15, 32, 44, 255),
}

def out(path, img):
    target = ASSETS / path
    target.parent.mkdir(parents=True, exist_ok=True)
    img.save(target, optimize=True)
    print(f"{path}: {img.width}x{img.height}")

def rect(d, box, fill): d.rectangle(box, fill=P[fill] if isinstance(fill, str) else fill)
def poly(d, xy, fill): d.polygon(xy, fill=P[fill] if isinstance(fill, str) else fill)

def draw_player(d, ox, oy, frame):
    bob = 1 if frame in (1, 3) else 0
    # backpack and antenna
    rect(d, (ox+3, oy+9+bob, ox+7, oy+21+bob), "steel")
    rect(d, (ox+4, oy+5+bob, ox+5, oy+10+bob), "cyan")
    rect(d, (ox+5, oy+4+bob, ox+6, oy+5+bob), "yellow")
    # helmet and visor
    rect(d, (ox+7, oy+5+bob, ox+17, oy+13+bob), "outline")
    rect(d, (ox+8, oy+4+bob, ox+15, oy+6+bob), "light")
    rect(d, (ox+8, oy+7+bob, ox+18, oy+11+bob), "cyan2")
    rect(d, (ox+12, oy+7+bob, ox+18, oy+8+bob), "cyan")
    rect(d, (ox+8, oy+12+bob, ox+16, oy+14+bob), "gray")
    # armored torso and insignia
    rect(d, (ox+6, oy+14+bob, ox+16, oy+24+bob), "outline")
    rect(d, (ox+7, oy+14+bob, ox+15, oy+22+bob), "steel")
    rect(d, (ox+9, oy+15+bob, ox+12, oy+18+bob), "yellow")
    rect(d, (ox+16, oy+15+bob, ox+21, oy+17+bob), "light")
    rect(d, (ox+19, oy+14+bob, ox+23, oy+16+bob), "cyan")
    # legs, with run cycle
    if frame % 4 == 1:
        rect(d, (ox+5, oy+22, ox+10, oy+28), "gray"); rect(d, (ox+13, oy+22, ox+17, oy+30), "steel")
        rect(d, (ox+3, oy+28, ox+10, oy+31), "outline"); rect(d, (ox+13, oy+30, ox+20, oy+31), "outline")
    elif frame % 4 == 3:
        rect(d, (ox+7, oy+22, ox+11, oy+30), "steel"); rect(d, (ox+14, oy+22, ox+19, oy+28), "gray")
        rect(d, (ox+4, oy+30, ox+11, oy+31), "outline"); rect(d, (ox+14, oy+28, ox+22, oy+31), "outline")
    else:
        rect(d, (ox+7, oy+22, ox+11, oy+30), "steel"); rect(d, (ox+13, oy+22, ox+17, oy+30), "gray")
        rect(d, (ox+5, oy+30, ox+11, oy+31), "outline"); rect(d, (ox+13, oy+30, ox+20, oy+31), "outline")
    if frame == 4:
        rect(d, (ox+5, oy+25, ox+10, oy+28), "steel"); rect(d, (ox+14, oy+23, ox+20, oy+26), "gray")
    elif frame == 5:
        rect(d, (ox+4, oy+27, ox+10, oy+30), "gray"); rect(d, (ox+15, oy+27, ox+21, oy+30), "steel")
    elif frame == 6:
        rect(d, (ox+15, oy+13, ox+23, oy+16), "yellow"); rect(d, (ox+20, oy+12, ox+23, oy+17), "cyan")
    elif frame == 7:
        rect(d, (ox+8, oy+7, ox+18, oy+11), "red"); rect(d, (ox+4, oy+29, ox+21, oy+31), "outline")

def player_sheet():
    img = Image.new("RGBA", (24*8, 32), P["clear"]); d = ImageDraw.Draw(img)
    for f in range(8): draw_player(d, f*24, 0, f)
    out("sprites/player/player.png", img)


def class_sheet():
    """24x32 cells, 12 poses x 4 silhouettes, using the established palette.

    Columns: idle/run1/run2/run3/jump/fall/shoot/hit/death/dash/fly/hover.
    Rows: RANGER/SCOUT/GUARDIAN/WING. No random calls: other assets are unchanged.
    """
    sheet = Image.new("RGBA", (24*12, 32*4), P["clear"])
    for row in range(4):
        for frame in range(12):
            cell = Image.new("RGBA", (24, 32), P["clear"])
            d = ImageDraw.Draw(cell)
            base = frame if frame < 7 else (7 if frame == 8 else 0)
            if frame == 9: base = 1
            draw_player(d, 0, 0, base)
            bob = 1 if base in (1, 3) else 0
            if row == 1:  # SCOUT: low helmet, scarf, slim torso and swept antenna.
                rect(d, (2, 3, 18, 23), "clear")
                poly(d, [(5, 8), (9, 3), (17, 5), (20, 10), (9, 13)], "outline")
                rect(d, (9, 5, 16, 7), "green")
                rect(d, (12, 8, 19, 10), "yellow")
                poly(d, [(8, 12), (15, 13), (14, 23), (8, 23)], "steel")
                poly(d, [(8, 12), (3, 13), (0, 19), (7, 16), (16, 14)], "green")
                d.line([(7, 7), (4, 3), (1, 2)], fill=P["light"], width=1)
                rect(d, (14, 15, 23, 17), "outline")
                rect(d, (17, 15, 23, 16), "cyan")
            elif row == 2:  # GUARDIAN: broad helmet, pauldrons, slab shield, heavy boots.
                rect(d, (3, 4+bob, 18, 14+bob), "outline")
                rect(d, (5, 4+bob, 16, 7+bob), "gray")
                rect(d, (6, 8+bob, 18, 10+bob), "orange")
                rect(d, (1, 13+bob, 20, 22+bob), "outline")
                rect(d, (2, 14+bob, 7, 19+bob), "light")
                rect(d, (8, 15+bob, 18, 24+bob), "steel")
                rect(d, (11, 16+bob, 14, 21+bob), "orange")
                rect(d, (0, 18, 6, 29), "outline")
                rect(d, (1, 19, 4, 27), "gray")
                rect(d, (8, 27, 12, 30), "gray")
                rect(d, (14, 27, 20, 30), "gray")
                rect(d, (18, 14+bob, 23, 18+bob), "navy")
            elif row == 3:  # WING: twin fins and visible thruster pack, split crest.
                rect(d, (2, 3, 8, 22), "clear")
                poly(d, [(6, 13), (0, 4), (1, 21), (6, 25)], "outline")
                poly(d, [(5, 14), (1, 7), (2, 20), (5, 22)], "purple")
                poly(d, [(8, 14), (8, 1), (13, 8), (12, 21)], "outline")
                poly(d, [(9, 5), (12, 9), (11, 15), (9, 13)], "light")
                rect(d, (12, 5, 17, 6), "purple")
                rect(d, (13, 8, 19, 10), "cyan")
                rect(d, (4, 15, 8, 25), "navy")
                rect(d, (5, 16, 7, 22), "purple")
                rect(d, (9, 15, 12, 20), "purple")
                if frame in (4, 5, 10, 11):
                    rect(d, (7, 25, 21, 31), "clear")
                    rect(d, (9, 23, 12, 28), "steel")
                    rect(d, (16, 22, 19, 27), "gray")
                    poly(d, [(4, 25), (9, 25), (7, 31 if frame == 10 else 29)], "cyan")
                    rect(d, (5, 25, 7, 27), "light")
            if frame == 6:
                rect(d, (20, 12, 23, 16), "yellow")
            if frame == 7:
                rect(d, (10, 8, 18, 10), "red")
                rect(d, (8, 16, 10, 19), "light")
            if frame == 8:
                # Distinct fallen silhouette, not just a red visor on an upright body.
                cell = cell.rotate(90, resample=Image.Resampling.NEAREST, expand=True)
                fallen = Image.new("RGBA", (24, 32), P["clear"])
                fallen.alpha_composite(cell, (-4, 8))
                cell = fallen
            elif frame == 9 and row == 1:
                # Short scarf wake contained inside the original cell dimensions.
                d.line([(0, 20), (4, 18), (7, 18)], fill=P["green"], width=2)
                rect(d, (0, 24, 4, 24), "cyan")
            sheet.alpha_composite(cell, (frame*24, row*32))
    out("sprites/player/classes.png", sheet)

def crawler(d, ox, oy, f):
    y=oy+18+(f%2)
    # beetle/wolf-like armored crawler
    poly(d, [(ox+6,y+9),(ox+10,y+2),(ox+29,y),(ox+39,y+7),(ox+36,y+18),(ox+12,y+19)], "outline")
    poly(d, [(ox+10,y+8),(ox+14,y+3),(ox+29,y+3),(ox+35,y+8),(ox+32,y+15),(ox+13,y+15)], "red")
    rect(d,(ox+15,y+5,ox+29,y+8),"orange"); rect(d,(ox+31,y+7,ox+35,y+10),"yellow")
    for x in (12,21,31):
        leg = 3 if (f+x)%2 else 0
        rect(d,(ox+x,y+15,ox+x+3,y+21+leg),"steel"); rect(d,(ox+x-2,y+20+leg,ox+x+4,y+22+leg),"outline")

def spider(d, ox, oy, f):
    cx,cy=ox+24,oy+23
    rect(d,(cx-8,cy-7,cx+8,cy+7),"outline"); rect(d,(cx-6,cy-5,cx+6,cy+5),"purple")
    rect(d,(cx-3,cy-3,cx+2,cy+1),"cyan"); rect(d,(cx+5,cy-1,cx+11,cy+1),"yellow")
    for i,sy in enumerate((-1,1)):
        for j in range(2):
            side=-1 if j==0 else 1; k=(f+i+j)%2
            pts=[(cx+side*7,cy+sy*(2+i*4)),(cx+side*(13+k*2),cy+sy*(7+i*4)),(cx+side*(18+k*2),cy+sy*(5+i*5))]
            d.line(pts,fill=P["steel"],width=2)

def needle(d, ox, oy, f):
    y=oy+16+(f%2)*2
    poly(d,[(ox+5,y+8),(ox+18,y),(ox+38,y+8),(ox+18,y+15)],"outline")
    poly(d,[(ox+9,y+8),(ox+19,y+3),(ox+34,y+8),(ox+19,y+12)],"cyan2")
    rect(d,(ox+18,y+5,ox+28,y+8),"cyan"); rect(d,(ox+8,y+7,ox+13,y+9),"yellow")
    poly(d,[(ox+18,y+13),(ox+24,y+22),(ox+27,y+13)],"red")

def beetle(d, ox, oy, f):
    y=oy+8
    # heavy bipedal mid-boss, 44x40
    rect(d,(ox+8,y+9,ox+37,y+31),"outline"); poly(d,[(ox+11,y+10),(ox+22,y+3),(ox+35,y+11),(ox+33,y+27),(ox+12,y+27)],"steel")
    rect(d,(ox+15,y+11,ox+31,y+18),"dark"); rect(d,(ox+18,y+12,ox+28,y+15),"red")
    rect(d,(ox+31,y+16,ox+45,y+20),"outline"); rect(d,(ox+34,y+17,ox+44,y+18),"orange")
    rect(d,(ox+5,y+15,ox+11,y+26),"gray")
    step=2 if f%2 else 0
    rect(d,(ox+11,y+28,ox+18,y+38-step),"steel"); rect(d,(ox+29,y+28,ox+36,y+36+step),"steel")
    rect(d,(ox+7,y+36-step,ox+19,y+40-step),"outline"); rect(d,(ox+28,y+34+step,ox+42,y+40+step),"outline")

def enemies_sheet():
    img=Image.new("RGBA",(48*4,48*4),P["clear"]); d=ImageDraw.Draw(img)
    funcs=(crawler,spider,needle,beetle)
    for row,fn in enumerate(funcs):
        for f in range(4):
            fn(d,f*48,row*48,f)
            if f == 2: rect(d,(f*48+38,row*48+20,f*48+46,row*48+23),"yellow")
            if f == 3:
                d.line((f*48+8,row*48+38,f*48+39,row*48+12),fill=P["gray"],width=2)
                d.line((f*48+10,row*48+13,f*48+40,row*48+39),fill=P["red"],width=2)
    out("sprites/enemies/enemies.png",img)

def boss_sheet():
    img=Image.new("RGBA",(96*4,64),P["clear"]); d=ImageDraw.Draw(img)
    for f in range(4):
        ox=f*96; y=5+(f%2)
        # giant mechanical brood mother, broad segmented silhouette
        poly(d,[(ox+5,y+32),(ox+14,y+13),(ox+37,y+4),(ox+70,y+9),(ox+90,y+28),(ox+80,y+50),(ox+26,y+55)],"outline")
        poly(d,[(ox+10,y+31),(ox+18,y+16),(ox+40,y+8),(ox+68,y+13),(ox+84,y+29),(ox+76,y+45),(ox+29,y+49)],"red")
        for x in (25,39,53,67): rect(d,(ox+x,y+12,ox+x+8,y+43),"orange" if x%3 else "steel")
        rect(d,(ox+10,y+26,ox+25,y+34),"dark"); rect(d,(ox+12,y+27,ox+20,y+30),"acid")
        poly(d,[(ox+78,y+19),(ox+95,y+8),(ox+86,y+29)],"steel")
        for x in (20,42,65,78):
            leg=(f+x)%3
            d.line([(ox+x,y+45),(ox+x-5,y+58-leg),(ox+x+6,y+61-leg)],fill=P["outline"],width=4)
            d.line([(ox+x,y+45),(ox+x-5,y+57-leg)],fill=P["steel"],width=2)
        rect(d,(ox+46,y+22,ox+62,y+34),"outline"); rect(d,(ox+49,y+24,ox+59,y+31),"yellow")
        if f == 1: rect(d,(ox+7,y+28,ox+17,y+35),"acid")
        if f == 2: poly(d,[(ox+80,y+25),(ox+95,y+18),(ox+91,y+32)],"orange")
        if f == 3:
            d.line((ox+28,y+8,ox+70,y+50),fill=P["yellow"],width=2)
            d.line((ox+25,y+48,ox+72,y+12),fill=P["cyan"],width=2)
    out("sprites/bosses/mother_crawler.png",img)

WEAPON_COLORS=("cyan","yellow","cyan","orange","red","purple","green","yellow")
NEW_WEAPON_IDS=("B-09","R-10","X-11","P-12","P-13","G-14","F-15","T-16","S-17","M-18","D-19","M-20")
NEW_WEAPON_COLORS=("cyan","orange","red","yellow","cyan","green","red","purple","yellow","red","cyan","orange")

def expanded_weapon_art(index, color):
    """Distinct silhouettes, not palette swaps; all geometry on the native grid."""
    icon=Image.new("RGBA",(32,32),P["clear"]);d=ImageDraw.Draw(icon)
    rect(d,(5,15,24,21),"outline");rect(d,(7,16,22,19),"steel")
    rect(d,(10,20,15,27),"outline");rect(d,(11,20,13,25),"gray")
    if index==0:
        poly(d,[(5,15),(14,7),(24,11),(29,17),(21,22)],"outline")
        d.line([(8,16),(15,10),(22,14),(16,18),(27,18)],fill=P[color],width=2)
    elif index==1:
        for y in (7,13,19):
            rect(d,(3,y,26,y+5),"outline");rect(d,(6,y+1,23,y+3),color);poly(d,[(25,y),(30,y+2),(25,y+5)],"light")
    elif index==2:
        d.line([(6,13),(16,8),(25,16)],fill=P[color],width=2)
        for x,y in [(6,13),(16,8),(25,16)]:
            rect(d,(x-4,y-4,x+4,y+4),"outline");rect(d,(x-2,y-2,x+2,y+2),color)
    elif index==3:
        poly(d,[(12,10),(20,10),(30,16),(20,22),(12,22)],"outline")
        for x in (15,20,25):poly(d,[(x,12),(x+4,16),(x,20)],color)
    elif index==4:
        d.ellipse((9,5,28,24),fill=P["outline"]);d.ellipse((12,8,25,21),outline=P[color],width=3)
        rect(d,(17,12,22,17),"light");rect(d,(3,11,11,20),"gray")
    elif index==5:
        rect(d,(4,6,26,23),"outline")
        for y in (9,16):
            for x in (8,15,22):rect(d,(x-2,y-2,x+2,y+2),color)
    elif index==6:
        poly(d,[(8,12),(27,5),(27,25),(8,20)],"outline")
        for y in (9,15,21):d.line([(12,16),(26,y)],fill=P[color],width=2)
    elif index==7:
        rect(d,(8,5,22,19),"outline");rect(d,(10,7,20,17),"purple")
        d.line([(14,2),(19,7),(13,11),(20,16),(26,11)],fill=P["light"],width=2)
    elif index==8:
        for y in (9,19):
            rect(d,(4,y,28,y+4),"outline");rect(d,(7,y+1,27,y+2),color)
        d.line([(10,9),(18,20),(26,10)],fill=P["cyan"],width=2)
    elif index==9:
        d.ellipse((5,9,26,26),fill=P["outline"]);d.ellipse((8,12,23,23),fill=P["steel"])
        rect(d,(13,13,18,18),color)
        for x in (7,22):rect(d,(x,5,x+2,11),"gray")
    elif index==10:
        rect(d,(13,10,18,24),"gray");rect(d,(5,8,28,14),"outline");rect(d,(8,9,28,11),color)
        poly(d,[(15,20),(4,28),(9,29),(17,23),(25,29),(29,28),(18,20)],"outline")
    else:
        for x,y in ((5,6),(13,10),(21,14)):
            rect(d,(x,y,x+7,y+11),"outline");rect(d,(x+2,y+2,x+5,y+8),color)
        poly(d,[(20,4),(27,7),(23,12)],"yellow")
    shot=Image.new("RGBA",(16,16),P["clear"]);s=ImageDraw.Draw(shot)
    if index in (0,3,8):
        for k in range(3):
            y=3+k*4;poly(s,[(1,y),(7,y-2),(14,y+1),(7,y+2)],color if k%2==0 else "light")
    elif index in (1,11):
        poly(s,[(2,4),(10,4),(15,8),(10,12),(2,12)],"outline");poly(s,[(4,5),(11,5),(14,8),(11,10),(4,10)],color);rect(s,(0,6,3,9),"yellow")
    elif index in (2,5,9):
        s.ellipse((3,3,13,13),fill=P["outline"]);rect(s,(5,5,11,11),color);rect(s,(7,1,9,4),"light")
        if index==2:s.line([(1,3),(5,7),(2,12)],fill=P["yellow"],width=1)
    elif index==4:
        s.ellipse((1,1,14,14),fill=P["cyan2"],outline=P["cyan"],width=2);rect(s,(5,5,10,10),"light")
    elif index==6:
        poly(s,[(1,13),(4,2),(8,7),(13,1),(15,12),(8,15)],color);rect(s,(6,9,10,13),"yellow")
    elif index==7:s.line([(3,0),(10,5),(5,8),(12,15)],fill=P["purple"],width=3)
    else:rect(s,(1,6,14,9),color);rect(s,(12,5,15,10),"light")
    return icon,shot
def weapon_assets():
    count=8+len(NEW_WEAPON_IDS)
    icons=Image.new("RGBA",(32*count,32),P["clear"]); di=ImageDraw.Draw(icons)
    pro=Image.new("RGBA",(16*count,16),P["clear"]); dp=ImageDraw.Draw(pro)
    for i,c in enumerate(WEAPON_COLORS):
        x=i*32; rect(di,(x+4,13,x+25,18),"outline"); rect(di,(x+6,14,x+24,16),c)
        rect(di,(x+9,18,x+14,25),"steel"); rect(di,(x+22,11,x+28,19),c)
        if i in (1,3,6): rect(di,(x+2,11,x+8,20),"gray")
        if i==2: rect(di,(x+24,8,x+27,12),"cyan")
        px=i*16
        if i==0: rect(dp,(px+2,7,px+13,9),c); rect(dp,(px+11,6,px+14,10),"light")
        elif i==1: 
            for yy in (4,7,10): rect(dp,(px+5,yy,px+9,yy+1),c)
        elif i==2: rect(dp,(px,6,px+15,9),"cyan"); rect(dp,(px+2,7,px+14,8),"light")
        elif i==3: poly(dp,[(px+2,5),(px+12,5),(px+15,8),(px+12,11),(px+2,11)],c); rect(dp,(px,6,px+3,10),"gray")
        elif i==4: poly(dp,[(px+2,13),(px+4,4),(px+8,8),(px+11,2),(px+13,12)],c); rect(dp,(px+6,10,px+10,14),"yellow")
        elif i==5: dpts=[(px+2,3),(px+6,7),(px+4,9),(px+12,13)]; dp.line(dpts,fill=P[c],width=2)
        elif i==6: rect(dp,(px+4,4,px+12,12),"outline"); rect(dp,(px+6,5,px+10,9),c); rect(dp,(px+7,2,px+9,4),"gray")
        else: poly(dp,[(px+2,8),(px+7,4),(px+13,7),(px+13,10),(px+7,12)],c); rect(dp,(px+10,6,px+14,10),"light")
    fx=Image.new("RGBA",(32*8,32*len(NEW_WEAPON_IDS)),P["clear"])
    for index,color in enumerate(NEW_WEAPON_COLORS):
        icon,shot=expanded_weapon_art(index,color);icons.alpha_composite(icon,((index+8)*32,0));pro.alpha_composite(shot,((index+8)*16,0))
        for frame in range(8):
            cell=Image.new("RGBA",(32,32),P["clear"]);d=ImageDraw.Draw(cell)
            radius=3+(frame%4)*3
            if index==7 and frame>=4:
                for x,y in ((4,12),(11,7),(19,9),(23,15)):
                    rect(d,(x,y,x+7,y+7),"purple");rect(d,(x+2,y,x+5,y+2),"light")
            else:
                for k in range(4+index%5):
                    angle=k*math.tau/(4+index%5)+index*.18
                    x=16+int(math.cos(angle)*radius);y=16+int(math.sin(angle)*radius)
                    d.line((16,16,x,y),fill=P[color],width=1 if frame<4 else 2);rect(d,(x-1,y-1,x+1,y+1),"light")
                if frame>=4:d.rectangle((16-radius,16-radius,16+radius,16+radius),outline=P[color],width=2)
            fx.alpha_composite(cell,(frame*32,index*32))
    held=Image.new("RGBA",(16*count,16),P["clear"])
    for i in range(count):held.alpha_composite(icons.crop((i*32,0,i*32+32,32)).resize((16,16),Image.Resampling.NEAREST),(i*16,0))
    out("sprites/weapons/weapon_icons.png",icons);out("sprites/weapons/projectiles.png",pro)
    out("sprites/weapons/equipped.png",held);out("effects/weapon_fx.png",fx)

def effects_items_tiles():
    fx=Image.new("RGBA",(32*8,32),P["clear"]); d=ImageDraw.Draw(fx)
    for f in range(8):
        x=f*32; r=2+f*2
        rect(d,(x+16-r,16-r,x+16+r,16+r),"orange" if f<5 else "red")
        if r>5: rect(d,(x+16-r//2,16-r//2,x+16+r//2,16+r//2),"yellow")
        if f>5: rect(d,(x+4,15,x+27,17),"gray")
    out("effects/explosion.png",fx)
    items=Image.new("RGBA",(32*2,32),P["clear"]); d=ImageDraw.Draw(items)
    rect(d,(6,7,25,25),"outline"); rect(d,(8,9,23,23),"green"); rect(d,(14,11,17,21),"light"); rect(d,(11,14,20,17),"light")
    rect(d,(38,8,58,25),"outline"); rect(d,(40,10,56,23),"yellow"); rect(d,(47,10,50,23),"orange"); rect(d,(40,15,56,18),"orange")
    out("sprites/ui/items.png",items)
    tiles=Image.new("RGBA",(16*8,16*2),P["clear"]); d=ImageDraw.Draw(tiles)
    for i in range(8):
        x=i*16; base="steel" if i%2 else "dark"; rect(d,(x,0,x+15,15),base)
        rect(d,(x,0,x+15,2),"gray"); rect(d,(x+2,7,x+13,8),"outline")
        if i%3==0: rect(d,(x+3,3,x+5,6),"yellow")
        rect(d,(x,16,x+15,31),"navy"); rect(d,(x,16,x+15,18),"cyan2"); rect(d,(x+3,22,x+12,24),"steel")
    out("tiles/city_tiles.png",tiles)
    ui=Image.new("RGBA",(128,16),P["clear"]); d=ImageDraw.Draw(ui)
    rect(d,(0,2,127,13),"outline"); rect(d,(2,4,125,11),"red"); rect(d,(2,4,125,5),"orange")
    out("ui/bars.png",ui)

def city_background():
    img=Image.new("RGB",(320,180),(4,10,22)); d=ImageDraw.Draw(img)
    # stars and distant haze
    for _ in range(38):
        x=random.randrange(320); y=random.randrange(75); col=(31,76,91) if random.random()<.7 else (105,151,150)
        d.point((x,y),fill=col)
    # moon/defense beacon
    rect(d,(251,19,270,21),(42,115,124)); rect(d,(257,14,264,27),(55,232,223))
    heights=[45,61,38,72,54,81,47,65,42,74,52,60,35,68,49,77]
    for i,h in enumerate(heights):
        x=i*22-5; c=(9+i%3*4,28+i%2*8,45+i%3*5); d.rectangle((x,132-h,x+20,150),fill=c)
        for wy in range(138-h,145,9):
            for wx in range(x+4,x+17,7):
                if (wx+wy+i)%3: d.rectangle((wx,wy,wx+2,wy+3),fill=(25,91,96) if i%2 else (112,94,38))
    d.rectangle((0,148,319,179),fill=(8,18,30)); d.rectangle((0,149,319,152),fill=(28,69,78))
    d.line((0,170,319,170),fill=(98,107,91),width=2)
    for x in range(0,320,32): d.rectangle((x,169,x+14,171),fill=(214,184,70))
    out("backgrounds/city.png",img)

def underground_assets():
    """M02 only: isolated RNG and new paths keep every M01 pixel unchanged."""
    rng = random.Random(2207319)
    records = {}

    def emit(path, image, width, height, frames=1, **extra):
        out(path, image)
        records[path] = {"frameWidth": width, "frameHeight": height,
                         "frames": frames, "columns": image.width // width, **extra}

    # Repeatable underground station: sealed arches, broken train and pipe banks.
    bg = Image.new("RGB", (320, 180), (5, 12, 19)); d = ImageDraw.Draw(bg)
    for x in range(0, 320, 64):
        d.rectangle((x, 0, x+63, 179), fill=(10, 23, 31))
        d.rectangle((x+3, 25, x+60, 141), fill=(14, 34, 41))
        d.rectangle((x+9, 35, x+54, 137), fill=(5, 15, 22))
        poly(d, [(x+9,35),(x+23,18),(x+41,18),(x+54,35)], (5,15,22))
        rect(d,(x,21,x+4,151),(24,48,53)); rect(d,(x+59,21,x+63,151),(24,48,53))
        rect(d,(x+17,11,x+45,13),(32,66,65)); rect(d,(x+24,12,x+37,13),(51,112,98))
    for y in (4, 9, 151):
        rect(d,(0,y,319,y+2),(25,45,50));rect(d,(0,y,319,y),(39,65,65))
        for x in range(12,320,32):rect(d,(x,y-1,x+2,y+3),(49,69,70))
    # A recognizably derelict subway carriage, not another city skyline.
    poly(d,[(73,104),(83,91),(194,91),(205,108),(202,142),(74,142)],(18,38,43))
    rect(d,(78,108,201,113),(45,64,58))
    for x in range(83,195,22):
        rect(d,(x,96,x+14,106),(3,11,18));d.line((x+2,97,x+11,104),fill=(41,71,68))
    rect(d,(135,94,154,139),(5,17,22));d.line((144,94,144,139),fill=(35,61,56))
    for x in (89,177):d.ellipse((x,135,x+14,148),fill=(4,11,17),outline=(30,49,50))
    d.line((0,165,319,165),fill=(48,63,59),width=2)
    d.line((0,173,319,173),fill=(26,44,44),width=2)
    for x in range(0,320,16):rect(d,(x,162,x+3,177),(17,32,34))
    for _ in range(70):
        x=rng.randrange(320);y=rng.randrange(180)
        d.point((x,y),fill=(21,43,41) if y<150 else (35,45,41))
    for x,y in ((18,87),(244,117),(289,54)):
        d.line([(x,y-7),(x+3,y+1),(x+2,y+12)],fill=(44,75,51),width=2)
        rect(d,(x+1,y+10,x+3,y+13),(78,116,49))
    emit("backgrounds/underground.png",bg,320,180)

    names = ["metal_floor","metal_ceiling","metal_wall","pipe_horizontal",
             "pipe_vertical","pipe_cross","subway_rail","subway_panel",
             "cave_wall","cave_floor","cave_ceiling","nest_wall",
             "barrier_intact","barrier_cracked","barrier_broken","warning_panel"]
    tiles=Image.new("RGBA",(128,32),P["clear"])
    for i,name in enumerate(names):
        cell=Image.new("RGBA",(16,16),P["clear"]);t=ImageDraw.Draw(cell)
        if i<8 or i==15:
            rect(t,(0,0,15,15),"dark");rect(t,(1,1,14,14),"steel")
            if i in (0,1):
                y=0 if i==0 else 13;rect(t,(0,y,15,y+2),"gray")
                for x in (3,11):rect(t,(x,6,x+1,9),"outline")
            elif i==2:
                rect(t,(0,0,2,15),"gray");rect(t,(13,0,15,15),"navy")
                for y in (3,11):rect(t,(6,y,9,y+1),"outline")
            elif i in (3,4,5):
                rect(t,(0,0,15,15),"navy")
                if i in (3,5):
                    rect(t,(0,5,15,11),"outline");rect(t,(0,6,15,9),"gray");rect(t,(0,6,15,6),"light")
                if i in (4,5):
                    rect(t,(5,0,11,15),"outline");rect(t,(6,0,9,15),"steel");rect(t,(6,0,6,15),"gray")
            elif i==6:
                rect(t,(0,0,15,15),"navy");rect(t,(3,0,6,15),"steel");rect(t,(0,4,15,6),"gray");rect(t,(0,12,15,14),"gray")
            elif i==7:
                rect(t,(2,2,13,9),"outline");rect(t,(3,3,12,8),"cyan2");rect(t,(3,3,12,3),"cyan")
            else:
                for x in range(-12,20,8):poly(t,[(x,0),(x+4,0),(x+20,15),(x+16,15)],"yellow")
        elif i<12:
            rect(t,(0,0,15,15),"navy")
            for k in range(5):
                x=(k*7+i*3)%16;y=(k*5+i)%16
                poly(t,[(x-5,y-3),(x+2,y-4),(x+6,y+1),(x+1,y+5),(x-4,y+3)],"dark" if k%2 else "steel")
            if i==9:rect(t,(0,0,15,2),"gray")
            if i==10:rect(t,(0,13,15,15),"gray")
            if i==11:
                t.line([(1,14),(4,7),(9,9),(14,1)],fill=P["purple"],width=2)
                rect(t,(8,7,10,9),"acid")
        else:
            if i!=14:rect(t,(0,0,15,15),"outline")
            for y in (0,8):
                for x in (0,8):
                    if i==14 and x==8:continue
                    poly(t,[(x+1,y+1),(x+6,y+1),(x+7,y+6),(x+1,y+7)],"gray" if i==12 else "steel")
            if i==12:rect(t,(6,2,9,13),"orange")
            if i==13:t.line([(8,0),(5,6),(11,9),(6,15)],fill=P["outline"],width=2)
        tiles.alpha_composite(cell,((i%8)*16,(i//8)*16))
    emit("tiles/underground_tiles.png",tiles,16,16,16,tileNames=names)

    def animated(path,width,height,frames,draw):
        sheet=Image.new("RGBA",(width*frames,height),P["clear"])
        for f in range(frames):
            cell=Image.new("RGBA",(width,height),P["clear"]);draw(ImageDraw.Draw(cell),f)
            sheet.alpha_composite(cell,(width*f,0))
        emit(path,sheet,width,height,frames)

    def worm(d,f):
        for k in range(5):
            x=8+k*4;y=9+int(math.sin(k*1.1+f*math.pi/2)*2)
            d.ellipse((x-5,y-5,x+5,y+5),fill=P["outline"])
            d.ellipse((x-3,y-3,x+3,y+3),fill=P["purple"] if k%2 else P["steel"])
            rect(d,(x,y-3,x+1,y-2),"gray")
            d.line([(x,y+3),(x-2+(f+k)%2,y+7)],fill=P["acid"],width=1)
        poly(d,[(0,7),(8,3),(13,7),(10,14),(2,15)],"outline")
        poly(d,[(2,7),(8,5),(11,8),(8,12),(3,12)],"purple")
        rect(d,(2,8,4,10),"acid");rect(d,(2,12,6,13),"light")
    animated("sprites/enemies/tunnel_worm.png",32,20,4,worm)

    def spitter(d,f):
        for side in (-1,1):
            for k in range(3):
                d.line([(14+side*6,9+k*2),(14+side*(9+k),3+k),(14+side*(11+k),0)],fill=P["gray"],width=2)
        poly(d,[(7,5),(20,5),(23,13),(18,20),(10,20),(5,13)],"outline")
        poly(d,[(9,6),(18,6),(21,12),(17,17),(10,17),(7,12)],"green")
        rect(d,(9,8,12,10),"acid");rect(d,(16,8,19,10),"acid")
        d.ellipse((10,13,18,22),fill=P["outline"])
        rect(d,(12,15,16,19+f%2),"acid" if f==2 else "cyan2")
        if f==2:rect(d,(13,21,15,23),"light")
    animated("sprites/enemies/ceiling_spitter.png",28,24,4,spitter)

    def nest(d,f):
        for x in (3,12,28,39):
            poly(d,[(x,47),(x+2,28),(x+7,21),(x+5,46)],"outline")
            d.line([(x+2,45),(x+4,30)],fill=P["purple"],width=2)
        poly(d,[(4,39),(10,17),(21,6),(35,12),(44,34),(39,46),(9,46)],"outline")
        poly(d,[(8,37),(13,20),(23,10),(33,15),(40,34),(36,42),(12,42)],"purple")
        for x,y in ((14,23),(30,20),(19,36),(33,35)):
            d.ellipse((x-4,y-4,x+4,y+4),fill=P["navy"],outline=P["gray"])
        d.ellipse((17,19-f%2,31,36+f%2),fill=P["outline"])
        d.ellipse((20,22-f%2,28,33+f%2),fill=P["acid"] if f==2 else P["green"])
        rect(d,(22,24,25,27),"light")
        if f==3:
            d.line([(10,23),(25,17),(34,39)],fill=P["yellow"],width=2)
    animated("sprites/enemies/spawn_nest.png",48,48,4,nest)

    def queen(d,f):
        # Crown fins + six grounded legs + exposed abdominal core. Faces left.
        bob=f%2
        for k,x in enumerate((24,43,66,88,103)):
            side=1 if k%2 else -1;step=2 if (k+f)%2 else -1
            d.line([(x,58+bob),(x+side*8,77+step),(x+side*13,92)],fill=P["outline"],width=7)
            d.line([(x,58+bob),(x+side*8,77+step),(x+side*13,92)],fill=P["steel"],width=3)
        poly(d,[(13,48+bob),(28,22),(51,13),(87,17),(110,35),(117,60),(101,79),(49,83),(22,70)],"outline")
        poly(d,[(20,47+bob),(33,28),(55,20),(85,24),(104,40),(110,58),(98,71),(52,75),(28,64)],"purple")
        for x,y in ((35,26),(54,18),(74,18),(94,26)):
            poly(d,[(x-6,y+17),(x-5,y-4),(x+2,y-15),(x+8,y+16)],"outline")
            poly(d,[(x-3,y+12),(x-2,y-3),(x+2,y-10),(x+5,y+12)],"steel")
            rect(d,(x,y-3,x+1,y+7),"cyan2")
        poly(d,[(3,43),(14,33),(32,39),(37,53),(25,64),(7,61)],"outline")
        poly(d,[(7,43),(16,38),(28,42),(29,53),(21,58),(9,56)],"steel")
        rect(d,(8,44,18,47),"acid");rect(d,(8,44,11,45),"light")
        for y in (51,57):poly(d,[(2,y),(15,y-1),(10,y+3)],"light")
        d.ellipse((44,42,83,76),fill=P["outline"],outline=P["gray"],width=2)
        d.ellipse((49,46,78,71),fill=P["cyan2"] if f!=2 else P["red"])
        d.ellipse((54,49,73,67),fill=P["acid"] if f!=3 else P["yellow"])
        rect(d,(59,51,66,60),"light")
        for x in (87,96,105):
            d.line([(x,38),(x+4,51),(x,62)],fill=P["gray"],width=2)
        if f==1:poly(d,[(0,51),(8,47),(10,58),(2,61)],"acid")
        if f==3:
            d.line([(32,32),(44,39),(39,48)],fill=P["yellow"],width=2)
            d.line([(83,27),(91,38),(84,48)],fill=P["yellow"],width=2)
    animated("sprites/bosses/abyss_queen.png",120,96,4,queen)

    def acid(d,f):
        r=3+f%2
        d.ellipse((8-r,8-r,8+r,8+r),fill=P["outline"])
        poly(d,[(2,3+f),(10,5),(13,9),(9,12),(5,9)],"acid")
        rect(d,(8,6,10,8),"light");rect(d,(1,2+f,3,3+f),"green")
    animated("effects/acid.png",16,16,4,acid)

    def wave(d,f):
        poly(d,[(1,23),(7,12),(13,17),(20,3+f),(26,14),(31,23)],"outline")
        d.line([(2,22),(8,14),(13,19),(20,7+f),(26,16),(30,22)],fill=P["acid"],width=2)
        d.line([(6,23),(12,20),(19,12+f),(24,21)],fill=P["light"],width=1)
    animated("effects/ground_wave.png",32,24,4,wave)

    def burst(d,f,width,height,color):
        cx=width//2;cy=height//2;r=5+f*(min(width,height)//19)
        for k in range(12):
            a=k*math.tau/12+f*.12
            x=cx+int(math.cos(a)*r);y=cy+int(math.sin(a)*r*.8)
            s=2 if f<5 else 1
            rect(d,(x-s,y-s,x+s,y+s),color if k%2 else "yellow")
            if f>1:d.line((x,y,x-int(math.cos(a)*4),y-int(math.sin(a)*4)),fill=P["purple"],width=2)
        if f<5:
            d.ellipse((cx-r,cy-r,cx+r,cy+r),outline=P["orange"],width=3)
            inner=max(1,12-f*2)
            poly(d,[(cx,cy-inner),(cx+inner,cy),(cx,cy+inner),(cx-inner,cy)],"light" if f<2 else "yellow")
    animated("effects/nest_break.png",64,64,8,lambda d,f:burst(d,f,64,64,"acid"))
    animated("effects/boss_break.png",128,96,8,lambda d,f:burst(d,f,128,96,"cyan"))

    metadata={"version":"0.2.2","seed":2207319,"sampling":"nearest",
              "animationOrder":["idle","move_or_pulse","attack","hit"],
              "assets":records}
    target=ASSETS/"underground.json"
    target.write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("underground.json: M02 frame metadata")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--classes-only", action="store_true", help="Generate only the formal-class atlas")
    parser.add_argument("--weapons-only", action="store_true", help="Generate only weapon atlases")
    parser.add_argument("--underground-only", action="store_true", help="Generate only M02 assets and metadata")
    parser.add_argument("--art-study-only", action="store_true", help="Generate isolated art-direction samples; never overwrite production PNGs")
    args=parser.parse_args()
    if args.art_study_only:
        if args.classes_only or args.weapons_only or args.underground_only:
            parser.error("--art-study-only cannot be combined with production generation flags")
        from art_direction_samples import generate
        generate(ROOT)
        return
    if args.classes_only:
        class_sheet()
        return
    if args.weapons_only:
        weapon_assets()
        return
    if args.underground_only:
        underground_assets()
        return
    player_sheet(); class_sheet(); enemies_sheet(); boss_sheet(); weapon_assets(); effects_items_tiles(); city_background()
    underground_assets()
    print("Generated all original assets with seed 7319; M02 isolated seed 2207319.")

if __name__ == "__main__": main()
