// Rendering-only Study 01 adapter. No gameplay, save, RNG or camera mutations.
const ROOT='assets/art-refresh/study-01/';
export const STUDY_FILES=Object.freeze({
  ranger:['in-game/ranger_body.png',96,64],wing:['in-game/wing_body.png',96,64],
  crawler:['sprites/crawler.png',128,64],needle:['sprites/needle.png',128,64],boss:['sprites/mother_crawler.png',384,128],
  icons:['weapons/icons.png',160,32],held:['weapons/equipped.png',160,32],shots:['weapons/projectiles.png',160,32],fx:['weapons/impacts.png',256,320],
  city:['backgrounds/city.png',640,360],underground:['backgrounds/underground.png',640,360],cityTiles:['tiles/city.png',128,64],underTiles:['tiles/underground.png',128,64]
});
export const STUDY_WEAPONS=Object.freeze({'A-01':0,'R-04':1,'H-08':2,'T-06':3,'D-19':4});
export const ART_ANCHORS=Object.freeze({
  player:{width:24,height:32,sourceScale:2},
  crawler:{width:32,height:32,foot:31},needle:{width:32,height:32,bodyCenter:17},boss:{width:96,height:64,foot:63.5},
  // Source-space muzzle anchors. The actual firing origin stays in game.js.
  held:{'A-01':[30,14],'R-04':[28,15],'H-08':[27,14],'T-06':[29,16],'D-19':[30,11]}
});
export function loadStudyImage(src,width,height){return new Promise((resolve,reject)=>{
  const im=new Image(),timer=setTimeout(()=>finish(()=>reject(new Error('画像読み込みがタイムアウトしました'))),12000);
  const finish=fn=>{clearTimeout(timer);im.onload=im.onerror=null;fn()};
  im.onload=()=>finish(()=>{if(im.naturalWidth!==width||im.naturalHeight!==height)reject(new Error('画像サイズが一致しません'));else resolve(im)});
  im.onerror=()=>finish(()=>reject(new Error('画像を読み込めません')));im.src=ROOT+src;
})}
export class ArtPreview {
  constructor(){this.pack=null;this.style='ORIGINAL';this.requested='ORIGINAL';this.loading=false;this.error='';this.token=0}
  reset(){this.token++;this.style=this.requested='ORIGINAL';this.loading=false;this.error=''}
  async select(style,loader=loadStudyImage){
    if(!['ORIGINAL','STUDY_01'].includes(style))return false;
    const token=++this.token;this.requested=style;this.error='';
    if(style==='ORIGINAL'){this.style=style;this.loading=false;return true}
    this.loading=!this.pack;
    try{
      const pack=this.pack??Object.fromEntries(await Promise.all(Object.entries(STUDY_FILES).map(async([key,args])=>[key,await loader(...args)])));
      if(token!==this.token)return false;
      this.pack=pack;this.style='STUDY_01';this.loading=false;return true;
    }catch(error){if(token!==this.token)return false;this.style=this.requested='ORIGINAL';this.loading=false;this.error=`Study 01読込失敗：ORIGINALへ戻しました（${error.message}）`;return false}
  }
}
const has=(object,id)=>Object.hasOwn(object,id);
export function drawStudyIcon(ctx,pack,id,x,y,w,h){if(!pack||!has(STUDY_WEAPONS,id))return false;ctx.drawImage(pack.icons,STUDY_WEAPONS[id]*32,0,32,32,x,y,w,h);return true}
export function drawStudyProjectile(ctx,pack,id,x,y,w=16,h=16){if(!pack||!has(STUDY_WEAPONS,id))return false;ctx.drawImage(pack.shots,STUDY_WEAPONS[id]*32,0,32,32,x,y,w,h);return true}
export function drawStudyPlayer(ctx,pack,p,weapon,originalHeld){
  const id=p.spriteClass||p.classId;
  // Unsupported animation states deliberately use their original animation frames.
  if(!pack||!['RANGER','WING'].includes(id)||p.dead||p.hitPose>0||id==='RANGER'&&!p.onGround||id==='WING'&&(p.onGround||p.flightLocked))return false;
  const frame=id==='RANGER'?(Math.abs(p.vx)>0?1:0):(p.vy<0?1:0),x=Math.round(p.x-12),y=Math.round(p.y);
  ctx.save();ctx.translate(x+(p.face<0?24:0),y);if(p.face<0)ctx.scale(-1,1);
  ctx.drawImage(pack[id==='RANGER'?'ranger':'wing'],frame*48,0,48,64,0,0,24,32);ctx.restore();
  const muzzle={x:p.x+(p.face>0?18:-3),y:p.y+13},anchor=ART_ANCHORS.held[weapon.id];
  ctx.save();ctx.translate(muzzle.x,muzzle.y);ctx.scale(p.face>0?1:-1,1);
  if(anchor)ctx.drawImage(pack.held,STUDY_WEAPONS[weapon.id]*32,0,32,32,-anchor[0]/2,-anchor[1]/2,16,16);
  else ctx.drawImage(originalHeld,weapon.assetIndex*16,0,16,16,-15,-8,16,16);
  ctx.restore();return true;
}
export function drawStudyEnemy(ctx,pack,e,x,y){
  if(!pack||e.dead)return false;
  if(e.type==='boss'){const a=ART_ANCHORS.boss,frame=e.phase==='charge'||e.attackFlash>0?1:0;ctx.drawImage(pack.boss,frame*192,0,192,128,x-a.width/2,y+e.h-a.foot,a.width,a.height);return true}
  if(!['crawler','needle'].includes(e.type)||e.attackFlash>0||e.phase==='charge')return false;
  const frame=Math.floor(e.anim)%2,a=ART_ANCHORS[e.type];
  const top=e.type==='crawler'?y+e.h-a.foot:y+e.h/2-a.bodyCenter;
  ctx.drawImage(pack[e.type],frame*64,0,64,64,x-a.width/2,top,a.width,a.height);return true;
}
const TILE_PATTERN=Object.freeze([0,0,1,0,0,2,0,3,0,0,1,0,2,0,0,0]);
export const studyTileVariant=x=>TILE_PATTERN[((Math.floor(x/16)%16)+16)%16];
export function drawStudyTile(ctx,pack,mission,index,x,y,w=16,h=16){
  if(!pack||index<0||index>7)return false;
  ctx.drawImage(mission==='M02'?pack.underTiles:pack.cityTiles,index%4*32,Math.floor(index/4)*32,w*2,h*2,x,y,w,h);return true;
}
export function studyEffectWeapon(f){
  if(f.artWeaponId)return f.artWeaponId;
  if(f.assetIndex!==undefined)return {0:'A-01',3:'R-04',7:'H-08',5:'T-06',18:'D-19'}[f.assetIndex]??null;
  return {bullet:'A-01',rocket:'R-04',homing:'H-08',thunder:'T-06'}[f.type]??null;
}
export function drawStudyEffect(ctx,pack,id,progress,x,y,size=32){
  if(!pack||!has(STUDY_WEAPONS,id))return false;
  const frame=Math.min(3,Math.max(0,Math.floor(progress*4)));
  ctx.drawImage(pack.fx,frame*64,STUDY_WEAPONS[id]*64,64,64,x-size/2,y-size/2,size,size);return true;
}
export function drawStudyLightning(ctx,pack,f){
  if(!pack||f.assetIndex!==undefined&&f.assetIndex!==5)return false;
  const length=Math.hypot(f.x2-f.x,f.y2-f.y);ctx.save();ctx.translate(f.x,f.y);ctx.rotate(Math.atan2(f.y2-f.y,f.x2-f.x));
  ctx.drawImage(pack.shots,3*32,0,32,32,0,-8,length,16);ctx.restore();return true;
}
