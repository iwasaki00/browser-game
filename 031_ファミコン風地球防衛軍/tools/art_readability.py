"""Study 01-B: targeted pixel clusters, real representative poses, read-only Study 01.

Local Pillow only. No filters/AA, downloads, gameplay imports or production writes.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageColor
try:
    from . import art_direction_samples as a
except ImportError:
    import art_direction_samples as a

SEED=24032024
POSES=['idle','walk_a','walk_b','walk_c','jump','fall','shoot','hit','dead','dash','fly','hover']
INK='#090f1b'; ARMOR='#8b9b87'; EDGE='#d2d9b8'; CLOTH='#56624b'; JOINT='#23323c'

def rect(d,b,c):d.rectangle(b,fill=c)
def line(d,p,c,w=1):d.line(p,fill=c,width=w)
def poly(d,p,c):d.polygon(p,fill=c)

def remap(im,mapping):
    out=im.copy();src=im.load();dst=out.load()
    colors={ImageColor.getcolor(k,'RGBA'):ImageColor.getcolor(v,'RGBA') for k,v in mapping.items()}
    for y in range(im.height):
        for x in range(im.width):dst[x,y]=colors.get(src[x,y],src[x,y])
    return out

def armor(id,pose=0):
    im=(a.ranger if id=='ranger' else a.wing)(pose,draw_weapon=False)
    im=remap(im,{a.P['olive']:'#909d72',a.P['olive1']:'#c8cfa0',a.P['mid']:'#9aada6',a.P['edge']:'#c4d2ba'})
    d=ImageDraw.Draw(im)
    if id=='ranger':
        # Selective light clusters, not a uniform outline or a new glow.
        poly(d,[(16,10),(21,8),(28,8),(31,10),(29,12),(17,13)],ARMOR)
        line(d,[(17,10),(22,9),(28,9)],EDGE,2)
        rect(d,(25,15,34,17),'#bce6d5')
        poly(d,[(13,26),(19,26),(22,29),(19,32),(13,31)],ARMOR)
        line(d,[(13,26),(19,26),(21,28)],EDGE,2)
        poly(d,[(18,28),(25,28),(28,31),(25,34),(18,34)],'#a9b58d')
        line(d,[(24,31),(26,35),(28,37)],INK,2)
        line(d,[(28,33),(31,35),(37,35)],'#b7c6b8',2)
        rect(d,(17,37,21,40),JOINT);rect(d,(24,38,27,41),JOINT)
        rect(d,(16,42,27,44),INK)
    else:
        # Wing outer edge / root separate from the person, interiors retain shadows.
        line(d,[(3,6),(4,20),(6,30)],'#c9d1c1',2)
        line(d,[(6,31),(13,39)],'#8297a5',2)
        line(d,[(17,3),(20,9),(26,14)],EDGE,2)
        line(d,[(20,26),(18,31),(19,36)],INK,3)
        rect(d,(15,28,18,31),'#d6c98a');rect(d,(18,30,20,34),JOINT)
        poly(d,[(23,27),(29,27),(32,32),(26,34),(23,32)],'#b2bdc5')
        line(d,[(24,28),(28,28),(30,30)],EDGE,2)
        rect(d,(31,16,38,18),'#bce6d5')
        line(d,[(25,36),(29,36)],JOINT,2)
        line(d,[(32,31),(36,35),(41,35)],'#cad8c1',2)
    return im

def legs(im,id,frame):
    im=im.copy();d=ImageDraw.Draw(im);rect(d,(0,45,47,63),(0,0,0,0))
    hip=22 if id=='ranger' else 27
    # Distinct contacting / passing strides, tucked jump, extended fall.
    boots={0:((12,63),(32,63)),1:((4,61),(36,63)),2:((18,63),(27,61)),3:((29,63),(12,62)),4:((9,56),(33,58)),5:((13,63),(33,61)),6:((11,63),(33,63)),7:((10,63),(35,63)),9:((3,60),(38,63))}
    front,rear=boots.get(frame,boots[0])
    for n,(bx,by) in enumerate((rear,front)):
        hx=hip+4 if n==0 else hip-3;kx=(hx+bx)//2+(2 if n==0 else -2);ky=52 if frame!=4 else 47
        poly(d,[(hx-3,43),(hx+3,44),(kx+3,ky),(bx+3,by-3),(bx+5,by-2),(bx+5,by),(bx-5,by),(bx-5,by-3),(kx-3,ky)],INK)
        line(d,[(hx,46),(kx,ky),(bx,by-4)],'#617481' if n==0 else CLOTH,4)
        rect(d,(kx-2,ky-1,kx+2,ky+1),ARMOR if n else '#617481')
        line(d,[(bx-3,by-2),(bx+3,by-2)],EDGE if n else '#82969d',2)
    rect(d,(hip-6,43,hip+7,46),JOINT)
    return im

def player_frame(id,frame):
    im=armor(id,1 if frame in (1,10) else 0)
    if frame==8:
        # Authored collapsed silhouette, not an idle frame mislabelled as death.
        dead=a.rgba((48,64));d=ImageDraw.Draw(dead)
        if id=='wing':
            poly(d,[(3,55),(9,40),(21,51),(31,59),(9,62)],INK)
            line(d,[(7,54),(10,45),(20,54)],'#9aaca8',2)
        poly(d,[(3,57),(9,51),(25,49),(43,54),(46,62),(8,63)],INK)
        poly(d,[(9,55),(23,52),(35,55),(32,60),(9,60)],CLOTH)
        line(d,[(10,54),(24,53),(31,55)],ARMOR,3)
        head=im.crop((13,7,37,25)) if id=='ranger' else im.crop((21,10,40,26))
        dead.alpha_composite(head,(23,44));line(d,[(5,61),(17,61)],'#a3b7ad',2)
        return dead
    if id=='ranger' or frame not in (10,11):im=legs(im,id,frame)
    d=ImageDraw.Draw(im)
    if frame==6:
        # Recoiled shoulder / straight supporting arm, gun remains independent.
        line(d,[(13,29),(19,29)],EDGE,2);line(d,[(29,35),(37,35)],'#cfdec6',2)
    elif frame==7:
        # Contracted forearm and exposed plate edge for the existing hit timer.
        poly(d,[(29,32),(34,34),(37,38),(31,39)],JOINT)
        line(d,[(14,28),(19,27),(22,29)],'#e5dfbd',2)
        line(d,[(30,34),(33,37)],EDGE,2)
    elif frame==10:
        line(d,[(14,46),(15,54)],'#addec8',2)
    elif frame==11:
        rect(d,(13,50,16,55),(0,0,0,0));line(d,[(14,46),(15,49)],'#addec8',2)
    return im

def enemy_frame(kind,frame):
    fn={'crawler':a.crawler,'needle':a.needle,'boss':a.boss}[kind]
    im=fn(1 if frame in (1,2) else 0);d=ImageDraw.Draw(im)
    if kind=='crawler':
        # Dark belly, distinct head mass, broad upper plates and readable limb roots.
        rect(d,(25,40,45,43),'#3d2834')
        line(d,[(19,31),(20,36),(22,40)],INK,2)
        poly(d,[(8,32),(15,30),(19,33),(17,36),(9,36)],'#e3bd8c')
        rect(d,(7,36,11,38),'#c4db89')
        for x,y in [(25,27),(37,24),(49,26)]:line(d,[(x-2,y),(x+2,y),(x+4,y+2)],'#dfb27d',2)
        for x in (23,36,49):rect(d,(x-1,42,x+2,44),'#dfb27d')
        if frame==2:line(d,[(4,45),(1,48),(6,50)],'#e1cc9e',2)
        elif frame==3:
            rect(d,(0,47,63,63),(0,0,0,0))
            for x in (19,34,48):line(d,[(x,42),(x-5,48),(x+1,51)],'#805365',3)
            line(d,[(10,39),(17,43),(26,43)],'#d9a87d',2)
    elif kind=='needle':
        line(d,[(7,14-(4 if frame==1 else 0)),(12,29),(23,34)],'#e1b783',2)
        line(d,[(39,26),(57,10-(4 if frame==1 else 0)),(54,18)],'#dfc49a',2)
        line(d,[(28,29),(30,36),(33,40)],INK,3)
        poly(d,[(20,31),(25,30),(27,33),(23,35),(18,34)],'#e7c39b')
        rect(d,(17,32,20,34),'#cbd985')
        if frame==2:line(d,[(34,41),(34,54)],'#e5b47c',3)
        elif frame==3:
            # Folded wing tips/legs, same body palette while rotating in death state.
            rect(d,(0,0,63,20),(0,0,0,0))
            line(d,[(13,28),(25,32),(33,42)],'#9e6a71',3)
            line(d,[(47,26),(39,32)],'#dfc49a',2)
    else:
        poly(d,[(27,54),(44,48),(59,52),(64,59),(43,61),(26,61)],'#e3af88')
        line(d,[(25,64),(34,62),(41,64)],'#d5e28e',4)
        line(d,[(44,64),(50,68),(44,74)],INK,3)
        line(d,[(7,78),(13,86),(24,88)],'#e6cca3',3)
        for x in (58,88,157):
            d.ellipse((x-18,107,x-10,114),fill='#b78a80');rect(d,(x-17,108,x-13,110),'#e3c19b')
            line(d,[(x-14,121),(x-6,122),(x-2,124)],'#d7cbb1',3)
        # B-01 has no actual weak-point multiplier. Organ is an art landmark only.
        d.ellipse((119,79,135,94),fill='#edc46e');rect(d,(123,81,129,86),'#f1e4b1')
        if frame==2:
            poly(d,[(22,72),(33,70),(38,76),(28,82),(19,79)],INK)
            line(d,[(20,78),(27,82),(34,78)],'#e6cca3',3)
        elif frame==3:
            line(d,[(117,79),(126,87),(138,82)],INK,3)
            line(d,[(126,87),(122,97)],INK,2)
    return im

def enemy_sheet(kind):
    frames=[]
    for variant in range(3 if kind!='boss' else 1):
        for frame in range(4):
            im=enemy_frame(kind,frame)
            if variant==1:im=remap(im,{a.P['shell2']:'#996052',a.P['shell3']:'#cf9d77',a.P['shell4']:'#dfbc8c'})
            elif variant==2:im=remap(im,{a.P['shell2']:'#88586d',a.P['shell3']:'#bb8493',a.P['shell4']:'#d2a8a5'})
            frames.append(im)
    return a.atlas(frames,4)

def background_layers(underground=False):
    layers=(a.underground_layers if underground else a.city_layers)();out=[]
    for depth,layer in enumerate(layers):
        result=layer.copy();src=layer.load();dst=result.load();cache={}
        for y in range(layer.height):
            # Suppress competing bright edges in the active battle band, not all art uniformly.
            factor=[.88,.80,.90][depth] if 110<=y<296 else [.93,.90,.94][depth]
            for x in range(layer.width):
                r,g,b,alpha=src[x,y];key=(r,g,b,alpha,factor)
                if key not in cache:
                    grey=(r*3+g*6+b)/10;sat=[.58,.72,.8][depth]
                    rgb=[round((grey+(v-grey)*sat)*factor) for v in (r,g,b)]
                    cache[key]=(*rgb,alpha)
                dst[x,y]=cache[key]
        out.append(result)
    return out

def generate(root):
    root=Path(root);output=root/'assets/art-refresh/study-01-b';output.mkdir(parents=True,exist_ok=True);records={}
    def save(path,im,cell,logical,poses,columns):
        target=output/path;target.parent.mkdir(parents=True,exist_ok=True);im.save(target,optimize=True)
        records[path]={'size':list(im.size),'cell':list(cell),'logicalCell':list(logical),'poses':poses,'columns':columns,'frames':im.width//cell[0]*(im.height//cell[1]),'rows':im.height//cell[1],'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
    for id in ('ranger','wing'):save(f'sprites/{id}.png',a.atlas([player_frame(id,i) for i in range(12)]),(48,64),(24,32),POSES,12)
    for kind,name,cell,logical in [('crawler','crawler',(64,64),(32,32)),('needle','needle',(64,64),(32,32)),('boss','mother_crawler',(192,128),(96,64))]:
        save(f'sprites/{name}.png',enemy_sheet(kind),cell,logical,['move_a','move_b','attack','dead'],4)
    for name,under in [('city',False),('underground',True)]:
        layers=background_layers(under)
        for depth,layer in zip(('far','middle','near'),layers):save(f'backgrounds/{name}_{depth}.png',layer,(640,360),(320,180),[depth],1)
        save(f'backgrounds/{name}.png',a.composite(layers),(640,360),(320,180),['composite'],1)
        tiles=a.tiles(under);d=ImageDraw.Draw(tiles)
        for n in range(8):
            x=n%4*32;y=n//4*32
            rect(d,(x,y,x+31,y+1),'#aebaa2');rect(d,(x,y+2,x+31,y+3),'#758981')
        save(f'tiles/{name}.png',tiles,(32,32),(16,16),list(range(8)),4)
    metadata={'version':'0.2.3-B','study':'STUDY 01-B / ART READABILITY','status':'LAB_PREVIEW_ONLY','seed':SEED,'baseSeed':a.SEED,'sampling':'nearest','source':'tools/art_direction_samples.py + targeted authored readability clusters (no additional randomness)','assets':records,'weaponFallback':['A-01','R-04','H-08','T-06','D-19'],'enemyVariants':3,'notes':['No production or Study 01 PNG overwritten.','Weapons reuse Study 01 without positional/performance changes.','No runtime glow or sorting; stable uid selects three authored shell palettes.','B-01 organ is not a newly added weak point.']}
    (output/'manifest.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Study 01-B: {len(records)} PNG + manifest; original assets untouched.')

if __name__=='__main__':generate(Path(__file__).resolve().parents[1])
