"""Contact sheets from real screenshots; asset catalogue is explicitly separate.
Never paints over game captures. Crops/enlargements use nearest-neighbor only.
"""
from pathlib import Path
import hashlib
import itertools
from PIL import Image, ImageDraw, ImageFont, ImageChops

ROOT=Path(__file__).resolve().parent;PROJECT=ROOT.parents[2]
SCENES={'m01-ranger':'M01 / RANGER','m01-boss':'M01 / B-01','m02-wing':'M02 / WING'}
SIZES=[(844,390),(780,360),(390,844)];ZOOMS=['050','035']
LABELS=['A: ORIGINAL / 320','B: STUDY 01 / 320','C: STUDY 01-B / 320','D: STUDY 01-B / 640']
BG='#07111e';CROP=(112,145,732,388)
def font(size):
    f=Path('C:/Windows/Fonts/consola.ttf')
    return ImageFont.truetype(str(f),size) if f.is_file() else ImageFont.load_default()
def text(d,xy,value,size=18):d.text(xy,value,font=font(size),fill='#d8e9e6')
def read(scene,z,size,condition):
    p=ROOT/f'{scene}-z{z}-{size[0]}x{size[1]}-{condition}.jpg'
    with Image.open(p) as im:
        assert im.size==size,(p.name,im.size)
        return im.convert('RGB')
def contact(scene,z,size,crop=None,suffix='comparison',scale=1):
    frames=[read(scene,z,size,c) for c in 'ABCD']
    if crop:frames=[im.crop(crop) for im in frames]
    if scale!=1:frames=[im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST) for im in frames]
    w,h=frames[0].size;gap=12;title=64;cap=32
    out=Image.new('RGB',(w*2+gap*3,title+(h+cap+gap)*2+gap),BG);d=ImageDraw.Draw(out)
    text(d,(12,8),f'{scene} | zoom 0.{z[1:]} | {size[0]}x{size[1]}',20)
    text(d,(12,35),f'{suffix} | same paused scene | '+(f'nearest x{scale}' if scale>1 else 'native screen pixels'),16)
    for i,im in enumerate(frames):
        x=12+i%2*(w+12);y=title+i//2*(h+cap+gap);text(d,(x,y),LABELS[i],18);out.paste(im,(x,y+cap))
    out.save(ROOT/f'{scene}-z{z}-{size[0]}x{size[1]}-{suffix}.png',optimize=True)
    if crop==CROP:
        for i,j in [(0,1),(1,2),(2,3)]:assert ImageChops.difference(frames[i],frames[j]).getbbox(),f'Possible stale capture {scene} {z} {i},{j}'

def overview(z):
    w,h=620,243;gap=12;row=34
    out=Image.new('RGB',(4*w+5*gap,60+3*(h+row+gap)+gap),BG);d=ImageDraw.Draw(out)
    for i,label in enumerate(LABELS):text(d,(12+i*(w+12),12),label,22)
    for n,(scene,name) in enumerate(SCENES.items()):
        y=60+n*(h+row+gap);text(d,(12,y),name+f' | zoom 0.{z[1:]} / same paused frame',20)
        for i,c in enumerate('ABCD'):out.paste(read(scene,z,SIZES[0],c).crop(CROP),(12+i*(w+12),y+row))
    out.save(ROOT/f'overview-z{z}.png',optimize=True)

def asset_catalogue():
    assets=PROJECT/'assets/art-refresh';out=Image.new('RGB',(1220,890),BG);d=ImageDraw.Draw(out)
    text(d,(12,8),'ASSET CATALOGUE (not a game screenshot) | nearest x3',22)
    poses=[0,1,4,6,7,8,10,11]
    for row,name in enumerate(('ranger','wing')):
        with Image.open(assets/f'study-01-b/sprites/{name}.png') as sheet:
            y=55+row*246;text(d,(12,y),name.upper()+' / '+str(poses),18)
            for i,frame in enumerate(poses):
                cell=sheet.crop((frame*48,0,frame*48+48,64)).resize((144,192),Image.Resampling.NEAREST)
                out.paste(cell,(12+i*150,y+30),cell)
    y=555
    for i,(name,w,h) in enumerate([('crawler',64,64),('needle',64,64),('mother_crawler',192,128)]):
        x=12+i*390;text(d,(x,y),name+' / STUDY 01 -> 01-B',16)
        for j,folder in enumerate(('study-01','study-01-b')):
            with Image.open(assets/f'{folder}/sprites/{name}.png') as sheet:
                cell=sheet.crop((0,0,w,h));scale=2 if w<100 else 1
                cell=cell.resize((w*scale,h*scale),Image.Resampling.NEAREST);out.paste(cell,(x+j*195,y+32),cell)
    text(d,(12,843),'Original Study 01 and production assets remain unchanged. No runtime halo.',17)
    out.save(ROOT/'asset-catalogue.png',optimize=True)

def main():
    expected=[ROOT/f'{s}-z{z}-{w}x{h}-{c}.jpg' for s,z,(w,h),c in itertools.product(SCENES,ZOOMS,SIZES,'ABCD')]
    expected += [ROOT/f'm01-swarm50-z{z}-844x390-{c}.jpg' for z,c in itertools.product(ZOOMS,'ABCD')]
    expected += [ROOT/f'm01-e03-z050-844x390-{c}.jpg' for c in 'ABCD']
    assert len(expected)==84 and all(p.is_file() for p in expected)
    before={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in expected}
    for s,z,size in itertools.product(SCENES,ZOOMS,SIZES):contact(s,z,size)
    for s,z in itertools.product(SCENES,ZOOMS):contact(s,z,SIZES[0],CROP,'detail')
    for s,crop in [('m01-ranger',(395,278,459,336)),('m02-wing',(388,207,466,304))]:
        for z in ZOOMS:contact(s,z,SIZES[0],crop,'focus',4)
    for z in ZOOMS:
        overview(z);contact('m01-swarm50',z,SIZES[0]);contact('m01-swarm50',z,SIZES[0],CROP,'detail')
    contact('m01-e03','050',SIZES[0]);contact('m01-e03','050',SIZES[0],CROP,'detail')
    asset_catalogue()
    assert before=={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in expected}
    print('84 screenshots verified; contact/detail/focus/overview sheets generated; raw JPEGs unchanged.')

if __name__=='__main__':main()
