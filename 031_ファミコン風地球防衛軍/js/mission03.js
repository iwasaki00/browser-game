import {WORLD,clamp} from './data.js?v=0.3.0';

// All coastal geometry/events are additive. M01/M02 retain their original data.
export const M03=Object.freeze({id:'M03',world:{...WORLD,width:6400,ground:220},bossX:5480,bossSpawnX:6060,
  areas:[{x:0,name:'沿岸防衛線'},{x:1100,name:'コンテナ埠頭'},{x:2300,name:'対空迎撃区画'},{x:3700,name:'崩壊した岸壁'},{x:5100,name:'沖合決戦'}],
  gaps:[{x:4056,w:28},{x:4560,w:24}],
  platforms:[{x:0,y:148,w:4056,h:72,solid:true,kind:'quay'},{x:4084,y:148,w:476,h:72,solid:true,kind:'quay'},{x:4584,y:148,w:1816,h:72,solid:true,kind:'quay'},
    {x:1260,y:124,w:80,h:24,solid:true,kind:'container'},{x:1600,y:120,w:96,h:28,solid:true,kind:'container'},
    {x:1960,y:124,w:96,h:24,solid:true,kind:'container'},{x:2860,y:132,w:64,h:16,solid:true,kind:'defense'},
    {x:3870,y:124,w:64,h:24,solid:true,kind:'wreck'},{x:4800,y:124,w:80,h:24,solid:true,kind:'wreck'}],
  turrets:[2700,3300],
  encounters:[
    {id:'c1-landing',x:220,until:1080,pattern:'WAVE',enemy:'shorecrab',count:14,batch:3,interval:.8,sea:true},
    {id:'c1-ray',x:640,until:1130,pattern:'AIR_RAID',enemy:'skyray',count:6,batch:6,interval:1.4,formation:'LINE'},
    {id:'c2-swarm',x:1160,until:2260,pattern:'SWARM',enemy:'shorecrab',fraction:1,batch:6,interval:.18,sea:true},
    {id:'c2-siege',x:1540,until:2300,pattern:'WAVE',enemy:'siegebeetle',count:3,batch:1,interval:3},
    {id:'c3-v',x:2340,until:3000,pattern:'AIR_RAID',enemy:'skyray',fraction:.6,batch:6,interval:1,formation:'V'},
    {id:'c3-step',x:2960,until:3700,pattern:'AIR_RAID',enemy:'skyray',fraction:.6,batch:6,interval:1,formation:'STEP'},
    {id:'c3-ground',x:2620,until:3650,pattern:'WAVE',enemy:'shorecrab',count:14,batch:3,interval:.6,sea:true},
    {id:'c4-tide',x:3760,until:5030,pattern:'SWARM',enemy:'shorecrab',fraction:1.2,batch:8,interval:.16,sea:true},
    {id:'c4-guns',x:4100,until:5060,pattern:'WAVE',enemy:'siegebeetle',count:5,batch:1,interval:2.4},
    {id:'c4-rays',x:4520,until:5070,pattern:'AIR_RAID',enemy:'skyray',count:12,batch:6,interval:1.6,formation:'V'}]
});
export const COAST=Object.freeze({waterY:148,rescueY:158,rescueDamage:12,rescueCooldown:1.2,landingTime:.65,shotLimit:64,
  turretRange:360,turretInterval:.7,turretDamage:12,turretShotLimit:12,formationSize:6,
  bossHp:3000,bossWeakMultiplier:1.5,bossWarning:.95,bossSummonLimit:12});
export const createM03Geometry=()=>M03.platforms.map(p=>({...p}));
export const createCoastalState=()=>({safeX:64,safeY:116,rescueWait:0,rescues:0,formations:new Map(),turrets:M03.turrets.map(x=>({x,y:116,hp:160,wait:0})),aaShots:[],turretsEnabled:true,hazards:[]});
export function coastalFloor(platforms,x,width=1){let y=220;for(const p of platforms)if(p.active!==false&&x+width/2>p.x&&x-width/2<p.x+p.w)y=Math.min(y,p.y);return y}
export function recoverCoastalPlayer(g,dt,hurt,effect){
  const c=g.coast,p=g.player;c.rescueWait=Math.max(0,c.rescueWait-dt);
  const supported=p.onGround&&g.platforms.some(b=>b.active!==false&&p.x-12>=b.x&&p.x+12<=b.x+b.w&&Math.abs(p.y+32-b.y)<.01);
  if(supported&&p.y+32<=148){c.safeX=p.x;c.safeY=p.y}
  if(p.y<=COAST.rescueY||p.dead)return false;
  Object.assign(p,{x:c.safeX,y:c.safeY,vx:0,vy:0,onGround:true});c.rescues++;
  if(c.rescueWait===0){hurt(COAST.rescueDamage,p.x-1);c.rescueWait=COAST.rescueCooldown}effect({kind:'coastSplash',x:p.x,y:148,life:.4,max:.4});return true;
}
export function registerCoastalFormation(g,e){
  if(e.type!=='skyray')return;
  const key=e.formationId??`lab-${Math.floor((e.uid-1)/6)}`;e.formationId=key;e.formationOrder??=(e.uid-1)%6;e.formationPattern??='V';
  if(!g.coast.formations.has(key))g.coast.formations.set(key,{x:e.x,y:48,age:0,count:0});
}
export function advanceCoastalFormations(g,dt){
  for(const group of g.coast.formations.values()){group.count=0;group.age+=dt;const dx=g.player.x-group.x;group.x+=Math.sign(dx)*Math.min(Math.abs(dx),48*dt)}
  for(const e of g.enemies)if(e.type==='skyray'&&!e.dead){registerCoastalFormation(g,e);g.coast.formations.get(e.formationId).count++}
  for(const [key,group] of g.coast.formations)if(!group.count)g.coast.formations.delete(key);
}
function coastShot(g,e,x,y,speed,damage,kind='coastOrb'){
  if(g.enemyShots.length>=COAST.shotLimit)return false;
  const ox=e.x,oy=e.y+e.h/2,a=Math.atan2(y-oy,x-ox);g.enemyShots.push({kind,x:ox,y:oy,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,w:kind==='artillery'?12:7,h:kind==='artillery'?12:7,damage,life:5,normal:e.type!=='leviathan'});return true;
}
export function coastalWeakCore(e){const phase=e.hp>1950?1:e.hp>900?2:3;return {x:e.x,y:e.y+58,r:22,open:!e.dead&&(e.timer??0)%4<(phase===1?1.6:phase===2?2:3)}}
export function coastalDamage(e,damage,s={}){
  const c=coastalWeakCore(e);let hit=Math.hypot((s.x??-1e6)-c.x,(s.y??-1e6)-c.y)<=c.r+(s.radial?s.radius??0:0);
  if(!s.radial&&Number.isFinite(s.vx+s.vy)){const dx=c.x-(s.originX??s.oldX??s.x),dy=c.y-(s.originY??s.oldY??s.y),speed=Math.hypot(s.vx,s.vy);if(speed)hit=dx*s.vx+dy*s.vy>=0&&Math.abs(dx*s.vy-dy*s.vx)/speed<=c.r}
  return c.open&&hit?damage*COAST.bossWeakMultiplier:damage;
}
export function updateCoastalEnemy(g,e,dt,spawn,effect){
  const p=g.player,dx=p.x-e.x;
  if(e.type==='shorecrab'){
    if(e.landingLeft>0){e.landingLeft=Math.max(0,e.landingLeft-dt);e.y=148-e.h+e.landingLeft*24;return}
    e.x=clamp(e.x+(Math.sign(dx)*36*e.speedScale+e.separateX)*dt,24,6376);e.y=coastalFloor(g.platforms,e.x,e.w)-e.h;
  }else if(e.type==='skyray'){
    registerCoastalFormation(g,e);const group=g.coast.formations.get(e.formationId),i=e.formationOrder%6;
    const offset=e.formationPattern==='LINE'?{x:i*38,y:0}:e.formationPattern==='STEP'?{x:i*30,y:(i%3)*18}:{x:Math.abs(i-2.5)*30,y:Math.abs(i-2.5)*12};
    e.x=clamp(e.x+(group.x+offset.x-e.x)*Math.min(1,dt*3)+e.separateX*dt,24,6376);e.diveCd-=dt;e.diveTimer=Math.max(0,e.diveTimer-dt);
    if(Math.abs(dx)<170&&e.diveCd<=0&&g.attacks.dive(g.time)){e.diveTimer=.9;e.diveCd=3+(e.uid%5)*.2}
    const y=e.diveTimer>0?112:group.y+offset.y+Math.sin(group.age*2+i)*8;e.y=clamp(e.y+(y-e.y)*Math.min(1,dt*4)+e.separateY*dt,16,124);
  }else if(e.type==='siegebeetle'){
    if(Math.abs(dx)>230)e.x+=Math.sign(dx)*18*dt;e.y=coastalFloor(g.platforms,e.x,e.w)-e.h;
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft&&g.attacks.ranged(g.time)){coastShot(g,e,e.warnX,e.warnY,115,18,'artillery');e.shotCd=3.3}}
    else if(e.shotCd<=0&&Math.abs(dx)<500&&e.x>=g.camera&&e.x<=g.camera+320/g.battleCamera.zoom){e.warningLeft=1;e.warnX=p.x;e.warnY=p.y+16;effect({kind:'coastWarning',x:e.warnX,y:140,life:1,max:1})}
  }else if(e.type==='leviathan'){
    e.timer+=dt;e.coastPhase=e.hp>1950?1:e.hp>900?2:3;e.actionWait=(e.actionWait??1.6)-dt;
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){
      const action=e.coastAction;
      if(action===0){for(let i=0;i<e.coastPhase;i++){const x=clamp(e.warnX+(i-(e.coastPhase-1)/2)*76,5500,6330);if(g.coast.hazards.length<8)g.coast.hazards.push({x,w:42,life:.24,hit:false});effect({kind:'coastTentacle',x,y:132,life:.35,max:.35})}}
      else if(action===1){for(let i=0;i<3+e.coastPhase*2;i++)coastShot(g,e,p.x+(i-1-e.coastPhase)*45,p.y+16,85+e.coastPhase*8,12)}
      else if(e.coastPhase===1){coastShot(g,e,p.x,p.y+16,95,16)}
      else if(e.coastPhase===2){for(let i=0;i<3;i++)if(g.liveMobs<COAST.bossSummonLimit)spawn(i===2?'skyray':'shorecrab',clamp(p.x+230+i*36,5520,6300),i===2?48:null)}
      else{for(const direction of [-1,1])if(g.enemyShots.length<COAST.shotLimit)g.enemyShots.push({kind:'wave',x:e.x,y:142,vx:direction*135,vy:0,w:22,h:12,life:5,damage:22});effect({kind:'coastSplash',x:e.x,y:148,life:.5,max:.5})}
      e.actionWait=e.coastPhase===3?1.3:2.1;
    }}else if(e.actionWait<=0&&Math.abs(dx)<600){e.coastAction=(e.actionIndex??0)%3;e.actionIndex=(e.actionIndex??0)+1;e.warningLeft=COAST.bossWarning;e.warnX=p.x;e.warnY=p.y+16;e.attackFlash=.3;
      for(let i=0;i<(e.coastAction===0?e.coastPhase:1);i++)effect({kind:'coastWarning',x:clamp(p.x+(i-(e.coastPhase-1)/2)*76,5500,6330),y:140,life:COAST.bossWarning,max:COAST.bossWarning});}
  }
}
export function updateCoastalDevices(g,dt,damage,hurt,effect){
  const c=g.coast;
  for(const t of c.turrets){t.wait=Math.max(0,t.wait-dt);if(t.hp<=0||!c.turretsEnabled||t.wait>0||g.bossStarted||g.coast.aaShots.length>=COAST.turretShotLimit)continue;
    let target=null,best=COAST.turretRange;for(const e of g.enemies){if(e.dead||!['skyray','needle'].includes(e.type))continue;const d=Math.hypot(e.x-t.x,e.y-t.y);if(d<best){best=d;target=e}}
    if(target){const a=Math.atan2(target.y+target.h/2-t.y,target.x-t.x);c.aaShots.push({x:t.x,y:t.y,vx:Math.cos(a)*240,vy:Math.sin(a)*240,life:1.5});t.wait=COAST.turretInterval;effect({kind:'coastAA',x:t.x,y:t.y,life:.12,max:.12})}
  }
  let write=0;for(const s of c.aaShots){s.life-=dt;const oldX=s.x,oldY=s.y;s.x+=s.vx*dt;s.y+=s.vy*dt;
    for(const e of g.enemies){if(e.dead)continue;const dx=s.x-oldX,dy=s.y-oldY,k=clamp(((e.x-oldX)*dx+(e.y+e.h/2-oldY)*dy)/(dx*dx+dy*dy||1),0,1);if(Math.abs(oldX+k*dx-e.x)<e.w/2&&Math.abs(oldY+k*dy-e.y-e.h/2)<e.h/2){damage(e,COAST.turretDamage,{type:'bullet',vx:s.vx,vy:s.vy});s.life=0;break}}
    if(s.life>0)c.aaShots[write++]=s;
  }c.aaShots.length=write;
  write=0;for(const h of c.hazards){h.life-=dt;if(!h.hit&&Math.abs(g.player.x-h.x)<h.w/2+7&&g.player.y+32>120){hurt(22,h.x);h.hit=true}if(h.life>0)c.hazards[write++]=h}c.hazards.length=write;
}
