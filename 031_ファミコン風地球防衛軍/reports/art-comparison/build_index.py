"""Build QA contact sheets from actual browser captures, not game assets.

No repainting, sharpening, resampling, game imports or asset generation.
Run: py -3 reports/art-comparison/build_index.py
"""
from pathlib import Path
import hashlib
from PIL import Image, ImageDraw, ImageFont, ImageChops

ROOT=Path(__file__).resolve().parent
SCENES={'m01-ranger':'M01 / RANGER / AREA 02', 'm01-boss':'M01 / B-01 / BOSS', 'm02-wing':'M02 / WING / AREA 02'}
SIZES=[(844,390),(780,360),(390,844)]
CONDITIONS=[('original',320),('study01',320),('original',640),('study01',640)]
CROP=(112,145,732,388) # Battle band of the 844x390 viewport; no resize.
BG='#07111e'
def font(size):
    path=Path('C:/Windows/Fonts/arial.ttf')
    return ImageFont.truetype(str(path),size) if path.is_file() else ImageFont.load_default()

def label(draw,xy,text,size=20):draw.text(xy,text,font=font(size),fill='#d8eeef')

def source(scene,size,style,res):
    path=ROOT/f'{scene}-{size[0]}x{size[1]}-{style}-{res}.jpg'
    with Image.open(path) as im:
        if im.size!=size:raise ValueError(f'Unexpected capture dimensions: {path.name} / {im.size}')
        return im.convert('RGB')

def sheet(scene,size,crop=False):
    w,h=(CROP[2]-CROP[0],CROP[3]-CROP[1]) if crop else size
    gap=12;title=68;caption=34
    im=Image.new('RGB',(w*2+gap*3,title+(h+caption+gap)*2+gap),BG);d=ImageDraw.Draw(im)
    label(d,(12,9),SCENES[scene]+' | FIXED 0.50 | '+f'{size[0]}x{size[1]}')
    label(d,(12,37),'Battle crop, 1:1 screen pixels (not enlarged)' if crop else 'Full browser viewport | same paused scene | columns: ORIGINAL / STUDY 01',16)
    for i,(style,res) in enumerate(CONDITIONS):
        x=gap+(i%2)*(w+gap);y=title+(i//2)*(h+caption+gap)
        label(d,(x,y),f'{"ORIGINAL" if style=="original" else "STUDY 01"} / {res}x{res*180//320}',20)
        raw=source(scene,size,style,res);im.paste(raw.crop(CROP) if crop else raw,(x,y+caption))
    name=f'{scene}-detail.png' if crop else f'{scene}-{size[0]}x{size[1]}-comparison.png'
    im.save(ROOT/name,optimize=True)
    print(name,im.size)

def main():
    files=[ROOT/f'{scene}-{w}x{h}-{style}-{res}.jpg' for scene in SCENES for w,h in SIZES for style,res in CONDITIONS]
    assert len(files)==36 and all(p.is_file() for p in files)
    before={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    for scene in SCENES:
        for size in SIZES:sheet(scene,size)
        sheet(scene,SIZES[0],True)
        crops=[source(scene,SIZES[0],style,res).crop(CROP) for style,res in CONDITIONS]
        for a,b in [(0,1),(0,2),(1,3),(2,3)]:
            assert ImageChops.difference(crops[a],crops[b]).getbbox(),f'Suspected stale duplicate: {scene} / {a},{b}'
    w,h=CROP[2]-CROP[0],CROP[3]-CROP[1];gap=12;rowtitle=34
    overview=Image.new('RGB',(w*4+gap*5,60+len(SCENES)*(h+rowtitle+gap)+gap),BG);d=ImageDraw.Draw(overview)
    for col,(style,res) in enumerate(CONDITIONS):
        label(d,(gap+col*(w+gap),14),f'{"ORIGINAL" if style=="original" else "STUDY 01"} / {res}x{res*180//320}',24)
    for row,(scene,title) in enumerate(SCENES.items()):
        y=60+row*(h+rowtitle+gap);label(d,(gap,y),title+' | same paused state / zoom 0.50',20)
        for col,(style,res) in enumerate(CONDITIONS):overview.paste(source(scene,SIZES[0],style,res).crop(CROP),(gap+col*(w+gap),y+rowtitle))
    overview.save(ROOT/'overview.png',optimize=True)
    assert before=={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    print('36 screenshots verified; 9 full contact sheets + 3 detail sheets + overview generated. Source JPEGs unchanged.')

if __name__=='__main__':main()
