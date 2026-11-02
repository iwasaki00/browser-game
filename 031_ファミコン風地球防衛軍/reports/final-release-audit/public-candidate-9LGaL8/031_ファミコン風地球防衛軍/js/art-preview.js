// Rendering-only art adapters. No gameplay, save, RNG or camera mutations.
import {classPlayerFrame} from './player.js?v=0.2.2';
import {WEAPONS} from './data.js?v=0.2.3-C';
import {weakCore} from './mission02.js?v=0.2.2';
const ROOT='assets/art-refresh/study-01/';
const B_ROOT='assets/art-refresh/study-01-b/';
export const ART_STYLES=Object.freeze(['ORIGINAL','STUDY_01','STUDY_01_B','UNIFIED_01']);
export const artStyleLabel=style=>({'STUDY_01':'STUDY 01','STUDY_01_B':'STUDY 01-B','UNIFIED_01':'UNIFIED 01'}[style]??'ORIGINAL');
export const STUDY_FILES=Object.freeze({
  ranger:['in-game/ranger_body.png',96,64],wing:['in-game/wing_body.png',96,64],
  crawler:['sprites/crawler.png',128,64],needle:['sprites/needle.png',128,64],boss:['sprites/mother_crawler.png',384,128],
  icons:['weapons/icons.png',160,32],held:['weapons/equipped.png',160,32],shots:['weapons/projectiles.png',160,32],fx:['weapons/impacts.png',256,320],
  city:['backgrounds/city.png',640,360],underground:['backgrounds/underground.png',640,360],cityTiles:['tiles/city.png',128,64],underTiles:['tiles/underground.png',128,64]
});
export const STUDY_B_FILES=Object.freeze({
  ranger:['sprites/ranger.png',576,64],wing:['sprites/wing.png',576,64],
  crawler:['sprites/crawler.png',256,192],needle:['sprites/needle.png',256,192],boss:['sprites/mother_crawler.png',768,128],
  city:['backgrounds/city.png',640,360],underground:['backgrounds/underground.png',640,360],cityTiles:['tiles/city.png',128,64],underTiles:['tiles/underground.png',128,64]
});
export const STUDY_WEAPONS=Object.freeze({'A-01':0,'R-04':1,'H-08':2,'T-06':3,'D-19':4});
const U_ROOT='assets/art-refresh/unified-01/';
export const UNIFIED_ENEMIES=Object.freeze({
  crawler:[32,32],spider:[32,32],needle:[32,32],beetle:[48,48],worm:[32,20],spitter:[28,24],boss:[96,64],queen:[120,96],nest:[48,48],barrier:[24,32]
});
export const UNIFIED_FILES=Object.freeze({
  ...Object.fromEntries(['ranger','scout','guardian','wing'].flatMap(k=>[[k,[`sprites/${k}.png`,576,64]],[`${k}Far`,[`far/${k}.png`,576,64]]])),
  ...Object.fromEntries(Object.entries(UNIFIED_ENEMIES).flatMap(([k,[w,h]])=>{
    const rows=['boss','queen','nest','barrier'].includes(k)?1:3;
    return [[k,[`sprites/${k}.png`,w*12,h*2*rows]],[`${k}Far`,[`far/${k}.png`,w*12,h*2*rows]]];
  })),
  icons:['weapons/icons.png',640,32],held:['weapons/equipped.png',640,32],shots:['weapons/projectiles.png',640,32],
  fx:['weapons/impacts.png',256,1280],special:['weapons/special.png',256,1280],
  city:['backgrounds/city.png',640,360],underground:['backgrounds/underground.png',640,360],cityTiles:['tiles/city.png',256,256],underTiles:['tiles/underground.png',256,256],
  acid:['effects/acid.png',128,32],wave:['effects/wave.png',256,48],nestBreak:['effects/nestBreak.png',1024,128],bossBreak:['effects/bossBreak.png',2048,192]
});
const U_WEAPONS=Object.freeze(Object.fromEntries(WEAPONS.map(w=>[w.id,w.assetIndex])));
export const FAR_DETAIL=Object.freeze({enterZoom:.40,exitZoom:.44});
export const ART_ANCHORS=Object.freeze({
  player:{width:24,height:32,sourceScale:2},
  crawler:{width:32,height:32,foot:31},needle:{width:32,height:32,bodyCenter:17},boss:{width:96,height:64,foot:63.5},
  // Source-space muzzle anchors. The actual firing origin stays in game.js.
  held:{'A-01':[30,14],'R-04':[28,15],'H-08':[27,14],'T-06':[29,16],'D-19':[30,11]}
});
export function loadStudyImage(src,width,height,root=ROOT){return new Promise((resolve,reject)=>{
  const im=new Image(),timer=setTimeout(()=>finish(()=>reject(new Error('画像読み込みがタイムアウトしました'))),12000);
  const finish=fn=>{clearTimeout(timer);im.onload=im.onerror=null;fn()};
  im.onload=()=>finish(()=>{if(im.naturalWidth!==width||im.naturalHeight!==height)reject(new Error('画像サイズが一致しません'));else resolve(im)});
  im.onerror=()=>finish(()=>reject(new Error('画像を読み込めません')));im.src=root+src;
})}
export class ArtPreview {
  constructor(){this.pack=null;this.basePack=null;this.bPack=null;this.uPack=null;this.style='ORIGINAL';this.requested='ORIGINAL';this.loading=false;this.error='';this.token=0;this.far=false}
  reset(){this.token++;this.style=this.requested='ORIGINAL';this.loading=false;this.error='';this.far=false}
  async select(style,loader=loadStudyImage){
    if(!ART_STYLES.includes(style))return false;
    const token=++this.token;this.requested=style;this.error='';
    if(style==='ORIGINAL'){this.style=style;this.loading=false;return true}
    if(!this.basePack&&this.pack&&!this.pack._b&&!this.pack._u)this.basePack=this.pack;
    this.loading=!(style==='STUDY_01'?this.basePack:style==='UNIFIED_01'?this.uPack:this.bPack);
    try{
      const base=async(key,args)=>this.basePack?.[key]??await loader(...args);
      let pack;
      if(style==='STUDY_01')pack=this.basePack??Object.fromEntries(await Promise.all(Object.entries(STUDY_FILES).map(async([key,args])=>[key,await base(key,args)])));
      else if(style==='UNIFIED_01'){
        if(this.uPack)pack=this.uPack;
        else{
          const unified={},revised={},fallbacks=[];
          const entries=await Promise.all(Object.entries(UNIFIED_FILES).map(async([key,args])=>{
            try{const image=await loader(...args,U_ROOT);unified[key]=true;return [key,image]}catch{fallbacks.push(key)}
            // A missing far sheet uses its close sheet; other resources descend B -> Study -> ORIGINAL individually.
            if(!key.endsWith('Far')){
              if(STUDY_B_FILES[key])try{const image=this.bPack?._b?.[key]?this.bPack[key]:await loader(...STUDY_B_FILES[key],B_ROOT);revised[key]=true;return [key,image]}catch{}
              if(STUDY_FILES[key])try{return [key,await base(key,STUDY_FILES[key])]}catch{}
            }
            return [key,null];
          }));
          pack={...Object.fromEntries(entries),_u:unified,_b:revised,fallbacks:fallbacks.sort(),_far:false};
        }
      }
      else if(this.bPack)pack=this.bPack;
      else{
        const revised={},fallbacks=[];
        const entries=await Promise.all(Object.entries(STUDY_FILES).map(async([key,args])=>{
          if(STUDY_B_FILES[key])try{const image=await loader(...STUDY_B_FILES[key],B_ROOT);revised[key]=true;return [key,image]}catch{fallbacks.push(key)}
          return [key,await base(key,args)];
        }));
        pack={...Object.fromEntries(entries),_b:revised,fallbacks:fallbacks.sort()};
      }
      if(token!==this.token)return false;
      if(style==='STUDY_01')this.basePack=pack;else if(style==='UNIFIED_01')this.uPack=pack;else this.bPack=pack;
      this.pack=pack;this.style=style;this.loading=false;return true;
    }catch(error){if(token!==this.token)return false;this.style=this.requested='ORIGINAL';this.loading=false;this.error=`${artStyleLabel(style)}読込失敗：ORIGINALへ戻しました（${error.message}）`;return false}
  }
  prepare(zoom){
    if(zoom<=FAR_DETAIL.enterZoom)this.far=true;else if(zoom>=FAR_DETAIL.exitZoom)this.far=false;
    if(this.pack?._u)this.pack._far=this.far;
  }
}
const has=(object,id)=>Object.hasOwn(object,id);
const weaponIndex=(pack,key,id)=>pack?._u?.[key]?U_WEAPONS[id]:STUDY_WEAPONS[id];
const actorImage=(pack,key)=>pack._u?.[key]&&pack._far&&pack._u?.[`${key}Far`]?pack[`${key}Far`]:pack[key];
export function drawStudyIcon(ctx,pack,id,x,y,w,h){const index=weaponIndex(pack,'icons',id);if(!pack?.icons||index===undefined)return false;ctx.drawImage(pack.icons,index*32,0,32,32,x,y,w,h);return true}
export function drawStudyProjectile(ctx,pack,id,x,y,w=16,h=16){const index=weaponIndex(pack,'shots',id);if(!pack?.shots||index===undefined)return false;ctx.drawImage(pack.shots,index*32,0,32,32,x,y,w,h);return true}
export function drawStudyPlayer(ctx,pack,p,weapon,originalHeld){
  const id=p.spriteClass||p.classId;
  // Unsupported animation states deliberately use their original animation frames.
  const key=id.toLowerCase(),unified=!!pack?._u?.[key],revised=unified||!!pack?._b?.[key];
  if(!pack?.[key]||!unified&&!['RANGER','WING'].includes(id)||!revised&&(p.dead||p.hitPose>0||id==='RANGER'&&!p.onGround||id==='WING'&&(p.onGround||p.flightLocked)))return false;
  const frame=revised?classPlayerFrame(p):id==='RANGER'?(Math.abs(p.vx)>0?1:0):(p.vy<0?1:0),x=Math.round(p.x-12),y=Math.round(p.y);
  ctx.save();ctx.translate(x+(p.face<0?24:0),y);if(p.face<0)ctx.scale(-1,1);
  ctx.drawImage(actorImage(pack,key),frame*48,0,48,64,0,0,24,32);ctx.restore();
  if(p.dead)return true;
  const muzzle={x:p.x+(p.face>0?18:-3),y:p.y+13},anchor=pack._u?.held?[30,14]:ART_ANCHORS.held[weapon.id];
  ctx.save();ctx.translate(muzzle.x,muzzle.y);ctx.scale(p.face>0?1:-1,1);
  if(anchor&&pack.held)ctx.drawImage(pack.held,weaponIndex(pack,'held',weapon.id)*32,0,32,32,-anchor[0]/2,-anchor[1]/2,16,16);
  else ctx.drawImage(originalHeld,weapon.assetIndex*16,0,16,16,-15,-8,16,16);
  ctx.restore();return true;
}
export function drawStudyEnemy(ctx,pack,e,x,y){
  const key=e.type==='boss'?'boss':e.type,revised=!!pack?._b?.[key];
  if(pack?._u?.[key]){
    const [w,h]=UNIFIED_ENEMIES[key];
    const open=key==='queen'&&weakCore(e).open;
    const frame=e.dead?3:open?5:e.hitFlash>0?4:e.phase==='charge'||e.attackFlash>0?2:key==='barrier'?(e.hp<e.maxHp/2?1:0):Math.floor(e.anim||0)%2;
    const row=['boss','queen','nest','barrier'].includes(key)?0:Math.abs(e.uid??0)%3;
    const top=key==='needle'?y+e.h/2-17:key==='boss'?y+e.h-63.5:['worm','spitter','queen','nest','barrier'].includes(key)?y:y+e.h-h;
    // Queen core is asymmetric (+4 world px), so never mirror it away from its real hit area.
    ctx.save();if(e.face>0&&key!=='queen'&&key!=='barrier'&&key!=='nest'){ctx.translate(x*2,0);ctx.scale(-1,1)}
    ctx.drawImage(actorImage(pack,key),frame*w*2,row*h*2,w*2,h*2,x-w/2,top,w,h);ctx.restore();return true;
  }
  if(!pack?.[key]||e.dead&&!revised)return false;
  if(revised&&['boss','crawler','needle'].includes(key)){
    const a=ART_ANCHORS[key],frame=e.dead?3:e.phase==='charge'||e.attackFlash>0?2:Math.floor(e.anim||0)%2;
    const cell=key==='boss'?192:64,row=key==='boss'?0:Math.abs(e.uid??0)%3;
    const top=key==='needle'?y+e.h/2-a.bodyCenter:y+e.h-a.foot;
    ctx.save();if(e.face>0){ctx.translate(x*2,0);ctx.scale(-1,1)}
    ctx.drawImage(pack[key],frame*cell,row*64,cell,key==='boss'?128:64,x-a.width/2,top,a.width,a.height);ctx.restore();return true;
  }
  if(e.type==='boss'){const a=ART_ANCHORS.boss,frame=e.phase==='charge'||e.attackFlash>0?1:0;ctx.drawImage(pack.boss,frame*192,0,192,128,x-a.width/2,y+e.h-a.foot,a.width,a.height);return true}
  if(!['crawler','needle'].includes(e.type)||e.attackFlash>0||e.phase==='charge')return false;
  const frame=Math.floor(e.anim)%2,a=ART_ANCHORS[e.type];
  const top=e.type==='crawler'?y+e.h-a.foot:y+e.h/2-a.bodyCenter;
  ctx.drawImage(pack[e.type],frame*64,0,64,64,x-a.width/2,top,a.width,a.height);return true;
}
const TILE_PATTERN=Object.freeze([0,0,1,0,0,2,0,3,0,0,1,0,2,0,0,0]);
export const studyTileVariant=x=>TILE_PATTERN[((Math.floor(x/16)%16)+16)%16];
export function drawStudyTile(ctx,pack,mission,index,x,y,w=16,h=16){
  if(!pack?.[mission==='M02'?'underTiles':'cityTiles']||index<0||index>7)return false;
  if(pack._u?.[mission==='M02'?'underTiles':'cityTiles'])return drawUnifiedTile(ctx,pack,mission,mission==='M02'&&index===4?3:index,x,y,w,h);
  ctx.drawImage(mission==='M02'?pack.underTiles:pack.cityTiles,index%4*32,Math.floor(index/4)*32,w*2,h*2,x,y,w,h);return true;
}
export function drawUnifiedTile(ctx,pack,mission,index,x,y,w=16,h=16){
  const key=mission==='M02'?'underTiles':'cityTiles';if(!pack?._u?.[key])return false;
  const variant=((Math.floor(x/16)*7+Math.floor(y/16)*3)%4+4)%4,cell=variant*16+index;
  ctx.drawImage(pack[key],cell%8*32,Math.floor(cell/8)*32,w*2,h*2,x,y,w,h);return true;
}
export function studyEffectWeapon(f){
  if(f.artWeaponId)return f.artWeaponId;
  if(f.assetIndex!==undefined)return WEAPONS[f.assetIndex]?.id??null;
  return {bullet:'A-01',rocket:'R-04',homing:'H-08',thunder:'T-06'}[f.type]??null;
}
export function drawStudyEffect(ctx,pack,id,progress,x,y,size=32){
  const index=weaponIndex(pack,'fx',id);if(!pack?.fx||index===undefined)return false;
  const frame=Math.min(3,Math.max(0,Math.floor(progress*4)));
  ctx.drawImage(pack.fx,frame*64,index*64,64,64,x-size/2,y-size/2,size,size);return true;
}
export function drawStudyLightning(ctx,pack,f){
  if(pack?._u?.shots){
    const id=WEAPONS[f.assetIndex??5]?.id??'T-06',index=U_WEAPONS[id],length=Math.hypot(f.x2-f.x,f.y2-f.y);
    ctx.save();ctx.translate(f.x,f.y);ctx.rotate(Math.atan2(f.y2-f.y,f.x2-f.x));ctx.drawImage(pack.shots,index*32,0,32,32,0,-8,length,16);ctx.restore();return true;
  }
  if(!pack?.shots||f.assetIndex!==undefined&&f.assetIndex!==5)return false;
  const length=Math.hypot(f.x2-f.x,f.y2-f.y);ctx.save();ctx.translate(f.x,f.y);ctx.rotate(Math.atan2(f.y2-f.y,f.x2-f.x));
  ctx.drawImage(pack.shots,3*32,0,32,32,0,-8,length,16);ctx.restore();return true;
}
export function drawUnifiedSpecial(ctx,pack,id,progress,x,y,w=32,h=w){
  if(!pack?._u?.special||!has(U_WEAPONS,id))return false;
  ctx.drawImage(pack.special,Math.min(3,Math.max(0,Math.floor(progress*4)))*64,U_WEAPONS[id]*64,64,64,x-w/2,y-h/2,w,h);return true;
}
export function drawUnifiedTrail(ctx,pack,s){
  if(!pack?._u?.shots)return false;
  const length=Math.min(64,Math.hypot(s.x-s.oldX,s.y-s.oldY));if(length<1)return true;
  ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.atan2(s.y-s.oldY,s.x-s.oldX));ctx.globalAlpha=.5;
  ctx.drawImage(pack.shots,U_WEAPONS[s.weapon.id]*32,0,32,32,-length,-2,length,4);ctx.restore();return true;
}
export function drawUnifiedEnvironmentalEffect(ctx,pack,key,progress,x,y,w,h){
  if(!pack?._u?.[key])return false;
  const frames=key.endsWith('Break')?8:4;
  ctx.drawImage(pack[key],Math.min(frames-1,Math.max(0,Math.floor(progress*frames)))*w*2,0,w*2,h*2,x-w/2,y-h/2,w,h);return true;
}
