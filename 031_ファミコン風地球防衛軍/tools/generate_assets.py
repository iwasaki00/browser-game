"""Generate the original pixel-art assets for PIXEL DEFENSE FRONT.

The script is deterministic, uses no downloaded material, and deliberately draws at
native resolution without antialiasing. Run with: py -3 tools/generate_assets.py
"""
from pathlib import Path
from PIL import Image, ImageDraw
import random

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
def weapon_assets():
    icons=Image.new("RGBA",(32*8,32),P["clear"]); di=ImageDraw.Draw(icons)
    pro=Image.new("RGBA",(16*8,16),P["clear"]); dp=ImageDraw.Draw(pro)
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
    out("sprites/weapons/weapon_icons.png",icons); out("sprites/weapons/projectiles.png",pro)

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

def main():
    player_sheet(); enemies_sheet(); boss_sheet(); weapon_assets(); effects_items_tiles(); city_background()
    print("Generated all original assets with seed 7319.")

if __name__ == "__main__": main()
