"""Build comparison sheets from real browser JPEGs; never modifies source art or captures."""
from pathlib import Path
import hashlib
import html
import json
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[2]
FONT=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',16)
SMALL=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',13)
LABELS={'A':'ORIGINAL / 320','B':'STUDY 01-B / 320','C':'UNIFIED 01 / 320','D':'UNIFIED 01 / 640'}
data=json.loads((ROOT/'verification.json').read_text(encoding='utf-8'))
raw={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in ROOT.glob('*.jpg')}
groups={}
for record in data['shots']:
    group,letter=record['file'].rsplit('-',1);letter=letter.split('.')[0]
    groups.setdefault(group,{})[letter]=record
assert len(groups)==10
overview=Image.new('RGB',(1800,len(groups)*224+50),'#081320');od=ImageDraw.Draw(overview)
od.text((12,12),'REAL GAME CAPTURES / FROZEN SCENE / nearest report scaling',font=FONT,fill='#d1e4d6')
gallery=[]
for row,(group,records) in enumerate(groups.items()):
    base=records['A']; stable=['playerX','playerHp','playerClass','flightEnergy','enemies','cameraX','viewZoom','checkpoint','missionId','area','boss']
    for letter,r in records.items():
        assert all(base['data'].get(k)==r['data'].get(k) for k in stable),(group,letter,'state changed')
        assert r['data']['artStyle']=={'A':'ORIGINAL','B':'STUDY_01_B','C':'UNIFIED_01','D':'UNIFIED_01'}[letter]
        assert r['canvas']==([640,360] if letter=='D' else [320,180])
        assert r['rect']['x']>=0 and r['rect']['y']>=0
        assert r['rect']['x']+r['rect']['w']<=r['screen'][0]+1
        assert r['rect']['y']+r['rect']['h']<=r['screen'][1]+1
    letters=[k for k in ('A','B','C','D') if k in records]
    w,h=base['screen'];cols=2 if len(letters)==4 else 3;rows=(len(letters)+cols-1)//cols
    sheet=Image.new('RGB',(w*cols,(h+30)*rows),'#081320');sd=ImageDraw.Draw(sheet)
    for n,letter in enumerate(letters):
        shot=Image.open(ROOT/records[letter]['file']);assert shot.size==(w,h)
        x=n%cols*w;y=n//cols*(h+30);sheet.paste(shot,(x,y+30));sd.text((x+8,y+6),LABELS[letter],font=FONT,fill='#d1e4d6')
    name=group+'-comparison.png';sheet.save(ROOT/name,optimize=True);gallery.append((group,name))
    # Canvas battle strip; exclude the top comparison toolbar, preserve x / y scale identically.
    for col,letter in enumerate(('A','C','D')):
        r=records[letter];rect=r['rect'];x=round(rect['x']);y=max(140,round(rect['y']));right=round(rect['x']+rect['w']);bottom=round(rect['y']+rect['h'])
        crop=Image.open(ROOT/r['file']).crop((x,y,right,bottom));scale=min(590/crop.width,176/crop.height)
        crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.NEAREST)
        xx=col*600;yy=50+row*224;overview.paste(crop,(xx,yy+42));od.text((xx+5,yy+4),group,font=SMALL,fill='#b6ccbf');od.text((xx+5,yy+22),LABELS[letter],font=SMALL,fill='#f0d99f')
overview.save(ROOT/'overview.png',optimize=True)
# All pose frames and weapon categories, explicitly an asset sheet rather than game evidence.
assetroot=PROJECT/'assets/art-refresh/unified-01'
actors=[('ranger',48,64),('scout',48,64),('guardian',48,64),('wing',48,64)]
poses=Image.new('RGB',(1250,680),'#081320');pd=ImageDraw.Draw(poses)
pd.text((12,8),'SOURCE ANIMATION ATLAS / NOT GAME CAPTURES / nearest x2',font=FONT,fill='#d1e4d6')
for row,(kind,w,h) in enumerate(actors):
    atlas=Image.open(assetroot/f'sprites/{kind}.png');y=32+row*160
    for f in range(12):
        x=f*104+3;im=atlas.crop((f*w,0,(f+1)*w,h)).resize((w*2,h*2),Image.Resampling.NEAREST)
        poses.paste(im,(x,y+22),im);pd.text((x,y),f'{kind[:3]}:{f}',font=SMALL,fill='#b6ccbf')
poses.save(ROOT/'animation-atlas.png',optimize=True)
weapons=Image.new('RGB',(1200,20*84+44),'#081320');wd=ImageDraw.Draw(weapons)
wd.text((12,8),'WEAPON SOURCE CELLS / NOT GAME CAPTURES / icons, held, shot, hit frames, special',font=FONT,fill='#d1e4d6')
manifest=json.loads((assetroot/'manifest.json').read_text(encoding='utf-8'))
for i,w in enumerate(manifest['weapons']):
    y=44+i*84;wd.text((10,y+8),w['id']+' / '+w['type'],font=SMALL,fill='#b6ccbf')
    x=210
    for name in ('icons','equipped','projectiles'):
        im=Image.open(assetroot/f'weapons/{name}.png').crop((i*32,0,(i+1)*32,32)).resize((64,64),Image.Resampling.NEAREST);weapons.paste(im,(x,y),im);x+=80
    for name in ('impacts','special'):
        atlas=Image.open(assetroot/f'weapons/{name}.png')
        for f in range(4):
            im=atlas.crop((f*64,i*64,(f+1)*64,(i+1)*64));weapons.paste(im,(x,y),im);x+=76
weapons.save(ROOT/'weapon-atlas.png',optimize=True)
assert raw=={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in raw}
items=''.join(f'<section><h2>{html.escape(g)}</h2><a href="{n}"><img loading="lazy" src="{n}" alt="{html.escape(g)} comparison"></a></section>' for g,n in gallery)
page='<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UNIFIED 01 — 比較一覧</title><style>body{background:#081320;color:#d1e4d6;font:16px monospace;margin:20px}img{max-width:100%;height:auto}section{margin:32px 0}a{color:#bdcf9c}</style><h1>0.2.3-C / UNIFIED 01</h1><p>実ゲーム・同一停止状態。A=従来320、B=Study 01-B 320（一部）、C=統合320、D=統合640。画像クリックで原寸。</p><p><a href="README.md">検証範囲・制約</a> / <a href="animation-atlas.png">素材アニメ帳（ゲーム画面ではありません）</a> / <a href="weapon-atlas.png">20武器素材帳</a></p><img src="overview.png" alt="実ゲーム比較総覧">'+items+'</html>'
(ROOT/'index.html').write_text(page,encoding='utf-8')
print(f'{len(data["shots"])} actual scene JPEGs; {len(gallery)} comparison sheets + overview + two source atlases; stable-state checks passed.')
