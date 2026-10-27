import {WORLD,VIEW,BATTLE_CAMERA,clamp} from './data.js?v=0.4.1';
import {movePlayerBody} from './player.js?v=0.2.2';
import {createImpactState} from './impact.js?v=0.4.1';
import {AttackDirector} from './invasion.js?v=0.4.1';
import {createBattleCamera,evaluateBattleCamera} from './camera.js?v=0.4.1';

// M04-only world, state and attack plans. Fixed devices are targetable entities,
// but are not members of the invasion population or reward/drop population.
export const SKY=Object.freeze({shieldRadius:120,shieldScale:.7,warning:1.25,recovery:1.8,
  summonLimit:10,shotLimit:48,hazardLimit:6,rescueY:205,rescueDamage:12,coreHp:3200,
  turretHp:160,generatorHp:220,phaseGrace:1.6,collapseDuration:1.5,armoredCameraMaxZoom:.35});
export const FORTRESS_GUIDANCE=Object.freeze({intro:2.5,blockedHit:.45,turnWarning:.6,shieldRelease:.5,
  targetMarkers:3,shieldMarkers:12,reducedShieldMarkers:8,sourceMarkers:4,rescueStep:24});
export const SKY_PHASES=Object.freeze({
  1:{text:'外部砲台を破壊せよ',lines:['外部砲台を破壊せよ','中央コアは防御中'],short:'外部砲台を破壊'},
  2:{text:'左右のシールド発生装置を破壊せよ',lines:['左右のシールド発生装置を','破壊せよ'],short:'左右装置を破壊'},
  3:{text:'中央コアを攻撃せよ',lines:['中央コアを攻撃せよ','SHIELD DOWN'],short:'中央コアを攻撃'}
});
export const M04=Object.freeze({id:'M04',world:{...WORLD,width:7200,ground:260},bossX:6200,bossSpawnX:6650,
  areas:[{x:0,name:'高層市街地'},{x:1200,name:'対空防衛線'},{x:2600,name:'輸送プラットフォーム'},{x:4100,name:'要塞外殻'},{x:5600,name:'空中要塞中枢'}],
  platforms:[{x:0,y:148,w:2960,h:112,solid:true,kind:'roof'},
    {x:2960,y:172,w:160,h:88,solid:true,kind:'recovery'},
    {x:3120,y:148,w:2920,h:112,solid:true,kind:'roof'},
    {x:6040,y:148,w:1160,h:112,solid:true,kind:'arena'},
    {x:604,y:124,w:64,h:24,solid:true,kind:'defense'},
    {x:1580,y:124,w:80,h:24,solid:true,kind:'defense'},
    {x:4320,y:124,w:96,h:24,solid:true,kind:'shell'},
    {x:4940,y:124,w:80,h:24,solid:true,kind:'shell'}],
  movers:[{id:'transport-1',x:2890,y:124,w:104,h:12,travel:250,speed:44},
    {id:'transport-2',x:3450,y:120,w:96,h:12,travel:180,speed:36}],
  encounters:[
    {id:'s1-scout',x:220,until:1160,pattern:'WAVE',enemy:'interceptor',count:12,batch:3,interval:1.2},
    {id:'s1-gun',x:700,until:1190,pattern:'WAVE',enemy:'heavygunner',count:2,batch:1,interval:3},
    {id:'s2-air',x:1240,until:2520,pattern:'SWARM',enemy:'interceptor',fraction:.7,batch:5,interval:.5},
    {id:'s2-shield',x:1480,until:2500,pattern:'WAVE',enemy:'shielddrone',count:4,batch:1,interval:2},
    {id:'s2-guns',x:1880,until:2530,pattern:'WAVE',enemy:'heavygunner',count:4,batch:1,interval:2.4},
    {id:'s3-air',x:2650,until:4050,pattern:'WAVE',enemy:'interceptor',fraction:.6,batch:4,interval:1},
    {id:'s3-support',x:3260,until:4040,pattern:'WAVE',enemy:'shielddrone',count:3,batch:1,interval:3},
    {id:'s4-swarm',x:4160,until:5530,pattern:'SWARM',enemy:'interceptor',fraction:1,batch:6,interval:.4},
    {id:'s4-guns',x:4400,until:5520,pattern:'WAVE',enemy:'heavygunner',count:6,batch:1,interval:2},
    {id:'s4-shield',x:4720,until:5520,pattern:'WAVE',enemy:'shielddrone',count:5,batch:1,interval:2},
    {id:'s5-escort',x:5620,until:5980,pattern:'WAVE',enemy:'interceptor',count:8,batch:2,interval:1}]
});
export const createM04Geometry=()=>[...M04.platforms.map(p=>({...p})),...M04.movers.map(p=>({...p,baseX:p.x,moving:true,solid:true,kind:'transport',active:true}))];
export const createSkyState=()=>({safeX:64,safeY:116,rescues:0,rescueWait:0,rescuePending:false,lastRescue:null,
  guideUntil:0,shieldSources:[],parts:[],hazards:[],collapseLeft:0,collapseTick:0,collapseDone:false});
export function skyPlatformMotion(b,time){
  const cycle=b.travel*2,at=(time*b.speed)%cycle;
  return {x:b.baseX+(at<=b.travel?at:cycle-at),direction:at<b.travel?1:-1,turnLeft:(at<b.travel?b.travel-at:cycle-at)/b.speed};
}
export function skyDeviceState(g,e){
  return e.dead?'破壊済':skyTargetOpen(g,e)?'攻撃可':'防御中';
}
export function skyShieldSource(g,e,sources=g.enemies){
  if(e.dead||e.fixedDevice||e.type==='fortress')return null;
  for(const d of sources)if(d!==e&&!d.dead&&d.type==='shielddrone'&&Math.hypot(d.x-e.x,d.y-e.y)<SKY.shieldRadius)return d;
  return null;
}
export function refreshSkyVisuals(g){
  const sources=g.sky.shieldSources;sources.length=0;
  for(const e of g.enemies)if(!e.dead&&e.type==='shielddrone')sources.push(e);
}
export function skySurface(g,x){let y=g.world.ground;for(const b of g.platforms)if(b.active!==false&&x>b.x&&x<b.x+b.w)y=Math.min(y,b.y);return y}
export function advanceSkyPlatforms(g,dt){
  const p=g.player;
  for(const b of g.platforms){if(!b.moving)continue;
    const oldX=b.x,oldY=b.y,supported=p.onGround&&Math.abs(p.y+32-oldY)<.05&&p.x+7>oldX&&p.x-7<oldX+b.w;
    b.x=skyPlatformMotion(b,g.time).x;
    const dx=b.x-oldX;
    if(supported&&!p.dead){const vx=p.vx,vy=p.vy;b.active=false;p.vx=dx/dt;p.vy=0;movePlayerBody(p,g.platforms,dt,true);b.active=true;p.vx=vx;p.vy=vy;p.onGround=Math.abs(p.y+32-b.y)<.05&&p.x+7>b.x&&p.x-7<b.x+b.w}
    // A moving leading edge must not enter an airborne/grounded non-rider.
    if(!supported&&!p.dead&&p.y+32>b.y&&p.y<b.y+b.h&&p.x+7>b.x&&p.x-7<b.x+b.w){
      const vx=p.vx,vy=p.vy,target=dx>=0?b.x+b.w+7:b.x-7;b.active=false;p.vx=(target-p.x)/dt;p.vy=0;movePlayerBody(p,g.platforms,dt,true);b.active=true;p.vx=vx;p.vy=vy;
      if(p.x+7>b.x+.01&&p.x-7<b.x+b.w-.01){p.y=b.y+b.h;p.vy=Math.max(0,p.vy);p.onGround=false}
    }
    // Installations ride their supporting deck; never remain floating at its old position.
    for(const i of g.arsenal.installations){if(i.supportId===b.id||!i.supportId&&Math.abs(i.y-oldY)<.1&&i.x>=oldX&&i.x<=oldX+b.w){i.supportId=b.id;i.x+=dx;if(i.x<b.x||i.x>b.x+b.w)i.life=0}}
  }
}
export function recoverSkyPlayer(g,dt,hurt,effect){
  const s=g.sky,p=g.player;s.rescueWait=Math.max(0,s.rescueWait-dt);
  if(p.onGround&&g.platforms.some(b=>!b.moving&&b.active!==false&&p.x-8>=b.x&&p.x+8<=b.x+b.w&&Math.abs(p.y+32-b.y)<.1)&&p.y<150){s.safeX=p.x;s.safeY=p.y}
  if(p.y<=SKY.rescueY||p.dead){s.rescuePending=false;return false}
  const anchor=findSkyRescue(g,s.safeX);
  if(!anchor){s.rescuePending=true;p.vx=p.vy=0;return false}
  s.lastRescue={requestedX:s.safeX,x:anchor.x,y:anchor.y};s.rescuePending=false;
  Object.assign(p,{x:anchor.x,y:anchor.y,vx:0,vy:0,onGround:true});s.rescues++;
  if(!s.rescueWait){hurt(SKY.rescueDamage,p.x-1);s.rescueWait=1.2}effect({kind:'skyBreak',x:p.x,y:p.y+16,life:.3,max:.3});return true;
}
export function findSkyRescue(g,requestedX){
  const min=g.bossStarted?M04.bossX:12,max=g.bossStarted?7050:g.world.width-25;
  const origin=clamp(requestedX,min,max),steps=Math.ceil((max-min)/FORTRESS_GUIDANCE.rescueStep);
  for(let n=0;n<=steps;n++)for(const side of n?[-1,1]:[1]){
    const x=origin+n*side*FORTRESS_GUIDANCE.rescueStep;if(x<min||x>max)continue;
    let floor=g.world.ground;
    for(const b of g.platforms)if(!b.moving&&b.active!==false&&x-8>=b.x&&x+8<=b.x+b.w)floor=Math.min(floor,b.y);
    const y=floor-32;if(y>150)continue;
    if(g.platforms.some(b=>b.active!==false&&x+7>b.x&&x-7<b.x+b.w&&y+32>b.y+.01&&y<b.y+(b.h??8)-.01))continue;
    if(g.enemies.some(e=>!e.dead&&Math.abs(x-e.x)<e.w/2+15&&y+32>e.y-8&&y<e.y+e.h+8))continue;
    return {x,y};
  }
  return null;
}
export function resetSkyBossPhase(g,boss,phase=1){
  const n=clamp(Math.floor(Number(phase)||1),1,3);
  // Remove every previous boss part, summon, projectile and pending weapon job.
  g.enemies.length=0;g.enemies.push(boss);g.liveEnemies=1;g.liveMobs=0;
  g.shots.length=g.enemyShots.length=g.effects.length=0;
  g.impact=createImpactState();g.shake=0;g.clear=false;g.attacks=new AttackDirector();
  g.arsenal.installations.length=g.arsenal.jobs.length=g.arsenal.pending.length=0;
  g.sky=createSkyState();g.sky.safeX=g.player.x;g.sky.safeY=g.player.y;
  Object.assign(boss,{dead:false,death:0,hp:SKY.coreHp,maxHp:SKY.coreHp,skyPhase:n,cameraMaxZoom:n<3?SKY.armoredCameraMaxZoom:BATTLE_CAMERA.bossMaxZoom,timer:0,warningLeft:0,attackPlan:null,actionWait:SKY.phaseGrace,actionIndex:0,hitFlash:0,shieldedUntil:0,vx:0,vy:0,active:true});
  g.sky.guideUntil=g.time+FORTRESS_GUIDANCE.intro;
  for(const [kind,x] of [['turret',6320],['turret',6940],['generator',6360],['generator',6860]]){
    const hp=kind==='turret'?SKY.turretHp:SKY.generatorHp;
    const part={uid:g.nextEnemyId++,type:'skydevice',fixedDevice:true,partKind:kind,x,y:116,w:28,h:32,hp,maxHp:hp,dead:kind==='turret'?n>1:n>2,death:0,anim:0,face:1,shotCd:0,active:true};
    g.sky.parts.push(part);g.enemies.push(part);
  }
  boss.activeParts=g.sky.parts;g.bossStarted=true;
}
// Only on entry/restart: frame every critical part immediately, without changing
// the camera's shared limits, smoothing during play, or player-safe margin.
export function frameSkyBoss(g){
  const c=g.battleCamera??(g.battleCamera=createBattleCamera(g.player));
  evaluateBattleCamera(c,g.player,g.enemies,g,1);
  c.zoom=c.targetZoom=c.candidateZoom=c.rawZoom;c.stableTime=1;
  const w=VIEW.canvasWidth/c.zoom,margin=BATTLE_CAMERA.playerMargin;
  c.x=clamp(clamp(c.focusX-w/2,g.player.x-(VIEW.canvasWidth-margin)/c.zoom,g.player.x-margin/c.zoom),0,g.world.width-w);
  g.camera=c.x;
}
export const skyCore=b=>({x:b.x,y:b.y+b.h/2,r:23,open:!b.dead&&b.skyPhase===3});
export function skyTargetOpen(g,e){return e.type==='fortress'?e.skyPhase===3:!e.fixedDevice||g.enemies.find(b=>b.type==='fortress'&&!b.dead)?.skyPhase===(e.partKind==='turret'?1:2)}
export function skyDamage(g,e,damage){
  if((e.type==='fortress'||e.fixedDevice)&&!skyTargetOpen(g,e))return 0;
  if(skyShieldSource(g,e))return damage*SKY.shieldScale;
  return damage;
}
export function skyAttackPlan(g,b){
  const phase=b.skyPhase,index=b.actionIndex??0;
  // Attack rectangles are locked once. Their exact data is also used by the warnings.
  const x=clamp(g.player.x,6030,7160),width=phase===3?72:40;
  const turrets=g.sky.parts.filter(d=>!d.dead&&d.partKind==='turret'),emitter=turrets[index%Math.max(1,turrets.length)];
  return {originX:emitter?.x??b.x,originY:emitter?emitter.y+8:b.y+16,phase,kind:phase===3&&index%3===2?'sweep':'strike',zones:[{x,y:phase===3&&index%3===2?136:0,w:width,h:phase===3&&index%3===2?12:148}],damage:phase===3?22:16};
}
function skyShot(g,e,x,y){if(g.enemyShots.length>=SKY.shotLimit)return;const a=Math.atan2(y-e.y-12,x-e.x);g.enemyShots.push({kind:'skyOrb',x:e.x,y:e.y+12,vx:Math.cos(a)*110,vy:Math.sin(a)*110,w:10,h:10,life:4,damage:18,normal:true})}
export function updateSkyEnemy(g,e,dt,spawn,effect){
  const p=g.player,dx=p.x-e.x;
  if(e.fixedDevice)return;
  if(e.type==='interceptor'){
    e.diveCd-=dt;
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){e.diveTimer=.55;const a=Math.atan2(e.warnY-e.y,e.warnX-e.x);e.vx=Math.cos(a)*165;e.vy=Math.sin(a)*165}}
    else if(e.diveTimer>0){e.diveTimer=Math.max(0,e.diveTimer-dt);e.x+=e.vx*dt;e.y+=e.vy*dt}
    else{e.x+=Math.sign(dx)*70*e.speedScale*dt;e.y+=(78+Math.sin(e.anim*.5)*22-e.y)*Math.min(1,dt*3);if(Math.abs(dx)<190&&e.diveCd<=0&&g.attacks.dive(g.time)){e.warningLeft=.7;e.warnX=p.x;e.warnY=p.y+12;e.diveCd=3.5}}
    e.x=clamp(e.x,24,7170);e.y=clamp(e.y,12,124-e.h/2);
  }else if(e.type==='shielddrone'){
    e.x=clamp(e.x+Math.sign(dx)*30*dt+e.separateX*dt,24,7170);e.y=52+Math.sin(e.anim*.5)*12;
  }else if(e.type==='heavygunner'){
    e.y=skySurface(g,e.x)-e.h;
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft&&g.attacks.ranged(g.time)){skyShot(g,e,e.warnX,e.warnY);e.shotCd=3.6}}
    else if(e.shotCd<=0&&Math.abs(dx)<420){e.warningLeft=1.35;e.warnX=p.x;e.warnY=p.y+16}
  }else if(e.type==='fortress'){
    e.timer+=dt;
    const pending=g.sky.parts.some(d=>!d.dead&&d.partKind===(e.skyPhase===1?'turret':'generator'));
    if(e.skyPhase<3&&!pending){e.skyPhase++;e.shieldedUntil=0;e.cameraMaxZoom=e.skyPhase<3?SKY.armoredCameraMaxZoom:BATTLE_CAMERA.bossMaxZoom;e.warningLeft=0;e.attackPlan=null;e.actionWait=SKY.phaseGrace;g.sky.guideUntil=g.time+FORTRESS_GUIDANCE.intro;g.sky.hazards.length=0;g.enemyShots.length=0;effect({kind:'skyBreak',x:e.x,y:100,life:.7,max:.7});g.areaText=SKY_PHASES[e.skyPhase].text;g.areaTimer=0}
    e.actionWait-=dt;
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){const plan=e.attackPlan;effect({kind:'skyFire',x:plan.originX,y:plan.originY,life:.18,max:.18});for(const z of plan.zones)if(g.sky.hazards.length<SKY.hazardLimit)g.sky.hazards.push({...z,damage:plan.damage,life:.25,hit:false});e.attackPlan=null;e.actionWait=SKY.recovery;
      if(e.skyPhase>=2&&e.actionIndex%2===0&&g.liveMobs<SKY.summonLimit){const x=clamp(p.x+(p.x<6650?240:-240),6050,7140);spawn(e.skyPhase===2?'shielddrone':'interceptor',x,56)}
    }}else if(e.actionWait<=0&&Math.abs(dx)<850){e.attackPlan=skyAttackPlan(g,e);e.warningLeft=SKY.warning;e.actionIndex++}
  }
}
export function updateSkyHazards(g,dt,hurt,effect){
  let write=0;for(const h of g.sky.hazards){h.life-=dt;const p=g.player;if(!h.hit&&Math.abs(p.x-h.x)<h.w/2+7&&p.y+32>h.y&&p.y<h.y+h.h){hurt(h.damage,h.x);h.hit=true}if(h.life>0)g.sky.hazards[write++]=h}g.sky.hazards.length=write;
  if(g.sky.collapseLeft>0){g.sky.collapseLeft=Math.max(0,g.sky.collapseLeft-dt);g.sky.collapseTick-=dt;if(g.sky.collapseTick<=0){g.sky.collapseTick=.2;effect({kind:'skyBreak',x:6650+Math.sin(g.time*17)*100,y:65+Math.cos(g.time*13)*36,life:.6,max:.6})}}
}
